use crate::commands::files::MdnsState;
use crate::commands::utils::{hex_encode, read_json_frame, send_json_frame, set_stream_timeout, encode_password, decode_password};
use crate::db::DbConn;
use crate::events;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::thread;
use std::time::Duration;
use tauri::{Manager, State};

/// 最大并发连接数
const MAX_SHARE_CONNECTIONS: u32 = 10;

// ── 协议消息 ──────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum ShareRequest {
    #[serde(rename = "auth")]
    Auth { password_hash: String, username: Option<String> },
    #[serde(rename = "list_dir")]
    ListDir { path: String },
    #[serde(rename = "download")]
    Download { path: String },
    #[serde(rename = "upload")]
    Upload { path: String, file_name: String, file_size: u64 },
    #[serde(rename = "project_info")]
    ProjectInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirEntry {
    name: String,
    is_dir: bool,
    size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum ServerResponse {
    #[serde(rename = "nonce")]
    Nonce { nonce: String },
    #[serde(rename = "status")]
    Status { success: bool, message: Option<String> },
    #[serde(rename = "list")]
    List { entries: Vec<DirEntry> },
    #[serde(rename = "download_header")]
    DownloadHeader { file_name: String, file_size: u64, sha256_hash: String },
    #[serde(rename = "upload_ack")]
    UploadAck { accepted: bool, reason: Option<String> },
    #[serde(rename = "project_info")]
    ProjectInfo {
        project_name: String,
        owner: String,
        description: Option<String>,
        status: Option<String>,
        start_date: Option<String>,
        end_date: Option<String>,
    },
}

// ── 活动日志 ──────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct ActivityLogEntry {
    pub client_addr: String,
    pub action: String,
    pub file_path: String,
    pub file_size: u64,
    pub timestamp: String,
}

const MAX_ACTIVITY_LOG: usize = 100;

// ── 服务器 ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareProjectMeta {
    pub project_name: String,
    pub owner: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

pub struct FolderShareServer {
    port: u16,
    running: Arc<AtomicBool>,
    root_path: PathBuf,
    clients: Arc<Mutex<Vec<ClientInfo>>>,
    activity_log: Arc<Mutex<Vec<ActivityLogEntry>>>,
    project_meta: Option<ShareProjectMeta>,
    #[allow(dead_code)]
    connection_count: Arc<AtomicU32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ClientInfo {
    pub addr: String,
    pub connected_at: String,
}

impl FolderShareServer {
    pub fn start(root_path: String, password: String, project_meta: Option<ShareProjectMeta>) -> Result<Self, String> {
        let path = PathBuf::from(&root_path);
        if !path.is_dir() {
            return Err("文件夹路径不存在或不是目录".to_string());
        }

        let abs_root = path
            .canonicalize()
            .map_err(|e| format!("获取绝对路径失败: {e}"))?;

        let listener =
            TcpListener::bind("0.0.0.0:0").map_err(|e| format!("绑定端口失败: {e}"))?;
        let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = Arc::clone(&running);
        let pw = password.clone();
        let root_clone = abs_root.clone();
        let clients = Arc::new(Mutex::new(Vec::<ClientInfo>::new()));
        let clients_clone = Arc::clone(&clients);
        let activity_log = Arc::new(Mutex::new(Vec::<ActivityLogEntry>::new()));
        let activity_log_clone = Arc::clone(&activity_log);
        let meta = project_meta.clone();
        let connection_count = Arc::new(AtomicU32::new(0));
        let conn_count_clone = Arc::clone(&connection_count);

        thread::spawn(move || {
            log::info!("文件夹分享服务器已启动，端口: {port}, 根目录: {:?}", root_clone);
            listener.set_nonblocking(true).ok();

            loop {
                if !running_clone.load(Ordering::SeqCst) {
                    break;
                }

                match listener.accept() {
                    Ok((stream, addr)) => {
                        // 检查连接数上限：发送明确拒绝消息后关闭
                        if conn_count_clone.load(Ordering::SeqCst) >= MAX_SHARE_CONNECTIONS {
                            log::warn!("拒绝分享连接 {addr}: 已达到最大连接数 {MAX_SHARE_CONNECTIONS}");
                            let mut s = stream;
                            if s.set_write_timeout(Some(Duration::from_secs(2))).is_ok() {
                                let _ = send_json_frame(&mut s, &ServerResponse::Status {
                                    success: false,
                                    message: Some(format!("已达最大连接数 {}", MAX_SHARE_CONNECTIONS)),
                                });
                            }
                            continue;
                        }
                        log::info!("分享连接: {addr}");
                        conn_count_clone.fetch_add(1, Ordering::SeqCst);
                        let pw = pw.clone();
                        let root = root_clone.clone();
                        let client_addr = addr.to_string();
                        let clients = Arc::clone(&clients_clone);

                        // 记录已连接客户端
                        {
                            let Ok(mut guard) = clients.lock() else {
                                log::error!("无法获取客户端列表锁（可能已损坏），跳过连接记录");
                                continue;
                            };
                            guard.push(ClientInfo {
                                addr: client_addr.clone(),
                                connected_at: chrono::Local::now().to_rfc3339(),
                            });
                        }

                        let activity_log = Arc::clone(&activity_log_clone);
                        let cc = Arc::clone(&conn_count_clone);
                        let client_meta = meta.clone();

                        thread::spawn(move || {
                            let result = handle_connection(stream, &root, &pw, &client_addr, &activity_log, client_meta.as_ref());
                            // 连接断开后移除客户端记录并减少连接计数
                            {
                                if let Ok(mut guard) = clients.lock() {
                                    guard.retain(|c| c.addr != client_addr);
                                }
                            }
                            cc.fetch_sub(1, Ordering::SeqCst);
                            if let Err(e) = result {
                                log::error!("处理分享连接失败: {e}");
                            }
                        });
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(std::time::Duration::from_millis(100));
                        continue;
                    }
                    Err(e) => {
                        log::error!("接受分享连接失败: {e}");
                        break;
                    }
                }
            }
        });

        Ok(Self {
            port,
            running,
            root_path: abs_root,
            clients,
            activity_log,
            project_meta,
            connection_count,
        })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn root_path(&self) -> &Path {
        &self.root_path
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}

// ── 连接处理 ──────────────────────────────────────────────────

fn handle_connection(stream: TcpStream, root: &Path, password: &str, client_addr: &str, activity_log: &Arc<Mutex<Vec<ActivityLogEntry>>>, project_meta: Option<&ShareProjectMeta>) -> Result<(), String> {
    // 显式设为阻塞模式（Windows 上从非阻塞 listener accept 的 stream 可能继承非阻塞）
    let socket = socket2::Socket::from(stream);
    socket.set_nonblocking(false).map_err(|e| format!("设置阻塞模式失败: {e}"))?;
    let mut stream: TcpStream = socket.into();

    stream.set_read_timeout(Some(Duration::from_secs(60)))
        .map_err(|e| format!("设置读超时失败: {e}"))?;
    stream.set_write_timeout(Some(Duration::from_secs(60)))
        .map_err(|e| format!("设置写超时失败: {e}"))?;

    // 第一步：发送 nonce
    let nonce = generate_nonce();
    send_json_frame(&mut stream, &ServerResponse::Nonce { nonce: nonce.clone() })?;

    // 第二步：读取认证请求（含 password_hash 和可选 username）
    let auth_req: ShareRequest = read_json_frame(&mut stream)?;
    let (authenticated, client_username) = match &auth_req {
        ShareRequest::Auth { password_hash: pw_hash, username } => {
            let uname = username.clone().unwrap_or_else(|| {
                client_addr.split(':').next().unwrap_or("unknown").to_string()
            });
            // 计算 SHA-256(password + nonce)，与客户端发来的 hash 比对
            let expected_hash = compute_auth_hash(password, &nonce);
            // 恒定时间比较，防止时序攻击
            let auth_ok = pw_hash.len() == expected_hash.len() && {
                let mut result = 0u8;
                for (a, b) in pw_hash.bytes().zip(expected_hash.bytes()) {
                    result |= a ^ b;
                }
                result == 0
            };
            (auth_ok, uname)
        }
        _ => (false, "unknown".to_string()),
    };

    if !authenticated {
        send_json_frame(&mut stream, &ServerResponse::Status {
            success: false,
            message: Some("认证失败，密码错误或请求格式错误".to_string()),
        })?;
        return Err("认证失败".to_string());
    }

    // 发送认证成功响应
    send_json_frame(&mut stream, &ServerResponse::Status {
        success: true,
        message: None,
    })?;

    // 命令循环
    loop {
        let request = match read_json_frame::<ShareRequest>(&mut stream) {
            Ok(req) => req,
            Err(_) => break, // 连接关闭或超时
        };

        match request {
            ShareRequest::Auth { .. } => {
                // 已认证，忽略重复认证
                send_json_frame(&mut stream, &ServerResponse::Status {
                    success: true,
                    message: Some("已认证".to_string()),
                })?;
            }
            ShareRequest::ListDir { path } => {
                set_stream_timeout(&mut stream, Duration::from_secs(30))?;
                let result = handle_list_dir(root, &path);
                match result {
                    Ok(entries) => {
                        send_json_frame(&mut stream, &ServerResponse::List { entries })?;
                    }
                    Err(e) => {
                        send_json_frame(&mut stream, &ServerResponse::Status {
                            success: false,
                            message: Some(e),
                        })?;
                    }
                }
            }
            ShareRequest::Download { path } => {
                set_stream_timeout(&mut stream, Duration::from_secs(300))?;
                if let Err(e) = handle_download(&mut stream, root, &path, client_addr, activity_log) {
                    log::error!("下载失败: {e}");
                    let _ = send_json_frame(&mut stream, &ServerResponse::Status {
                        success: false,
                        message: Some(e),
                    });
                }
            }
            ShareRequest::Upload { path, file_name, file_size } => {
                set_stream_timeout(&mut stream, Duration::from_secs(300))?;
                if let Err(e) = handle_upload(&mut stream, root, &path, &file_name, file_size, client_addr, activity_log, &client_username) {
                    log::error!("上传失败: {e}");
                }
            }
            ShareRequest::ProjectInfo => {
                if let Some(meta) = project_meta {
                    send_json_frame(&mut stream, &ServerResponse::ProjectInfo {
                        project_name: meta.project_name.clone(),
                        owner: meta.owner.clone(),
                        description: meta.description.clone(),
                        status: meta.status.clone(),
                        start_date: meta.start_date.clone(),
                        end_date: meta.end_date.clone(),
                    })?;
                } else {
                    send_json_frame(&mut stream, &ServerResponse::Status {
                        success: false,
                        message: Some("无项目元数据".to_string()),
                    })?;
                }
            }
        }
    }

    Ok(())
}

/// 处理列目录请求，返回目录条目列表
fn handle_list_dir(root: &Path, rel_path: &str) -> Result<Vec<DirEntry>, String> {
    let target = resolve_path(root, rel_path)?;
    if !target.is_dir() {
        return Err("路径不是目录".to_string());
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(&target).map_err(|e| format!("读取目录失败: {e}"))? {
        let entry = entry.map_err(|e| format!("读取目录项失败: {e}"))?;
        let name = entry
            .file_name()
            .to_string_lossy()
            .to_string();
        let file_type = entry.file_type().map_err(|e| format!("获取文件类型失败: {e}"))?;
        let size = if file_type.is_file() {
            entry.metadata().map(|m| m.len()).unwrap_or(0)
        } else {
            0
        };
        entries.push(DirEntry {
            name,
            is_dir: file_type.is_dir(),
            size,
        });
    }

    // 目录在前，按名称排序
    entries.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(entries)
}

/// 处理文件下载请求
fn handle_download(stream: &mut TcpStream, root: &Path, rel_path: &str, client_addr: &str, activity_log: &Arc<Mutex<Vec<ActivityLogEntry>>>) -> Result<(), String> {
    let target = resolve_path(root, rel_path)?;
    if !target.is_file() {
        return Err("路径不是文件".to_string());
    }

    let file_size = fs::metadata(&target)
        .map(|m| m.len())
        .map_err(|e| format!("获取文件大小失败: {e}"))?;

    let file_name = target
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // 计算 SHA-256
    let mut hasher = Sha256::new();
    {
        let mut hash_file = fs::File::open(&target).map_err(|e| format!("打开文件计算hash失败: {e}"))?;
        std::io::copy(&mut hash_file, &mut hasher).map_err(|e| format!("计算文件hash失败: {e}"))?;
    }
    let sha256_hash = hex_encode(&hasher.finalize());

    // 发送下载头（使用统一帧协议）
    send_json_frame(stream, &ServerResponse::DownloadHeader { file_name, file_size, sha256_hash })?;

    // 发送文件内容
    let mut file = fs::File::open(&target).map_err(|e| format!("打开文件失败: {e}"))?;
    std::io::copy(&mut file, stream).map_err(|e| format!("发送文件内容失败: {e}"))?;

    // 记录下载活动
    log_activity(activity_log, client_addr, "download", rel_path, file_size);

    Ok(())
}

/// 记录活动日志（FIFO 淘汰，最多 MAX_ACTIVITY_LOG 条）
fn log_activity(activity_log: &Arc<Mutex<Vec<ActivityLogEntry>>>, client_addr: &str, action: &str, file_path: &str, file_size: u64) {
    if let Ok(mut guard) = activity_log.lock() {
        guard.push(ActivityLogEntry {
            client_addr: client_addr.to_string(),
            action: action.to_string(),
            file_path: file_path.to_string(),
            file_size,
            timestamp: chrono::Local::now().to_rfc3339(),
        });
        if guard.len() > MAX_ACTIVITY_LOG {
            let excess = guard.len() - MAX_ACTIVITY_LOG;
            guard.drain(0..excess);
        }
    }
}

/// 上传文件大小上限（500MB）
const MAX_UPLOAD_SIZE: u64 = 500 * 1024 * 1024;

/// 处理文件上传请求
/// 上传文件自动存入 `{client_username}的提交/` 子目录，与 owner 文件隔离
fn handle_upload(
    stream: &mut TcpStream,
    root: &Path,
    rel_dir: &str,
    file_name: &str,
    file_size: u64,
    client_addr: &str,
    activity_log: &Arc<Mutex<Vec<ActivityLogEntry>>>,
    client_username: &str,
) -> Result<(), String> {
    // 检查上传大小
    if file_size > MAX_UPLOAD_SIZE {
        send_json_frame(stream, &ServerResponse::UploadAck {
            accepted: false,
            reason: Some(format!("文件过大: {} bytes，上传上限 {} bytes", file_size, MAX_UPLOAD_SIZE)),
        })?;
        return Err("上传文件过大".to_string());
    }

    // 解析目标目录路径，重定向到 `{username}的提交/` 子目录
    let base_dir = resolve_path(root, rel_dir)?;
    let upload_subdir = format!("{}的提交", client_username);
    let target_dir = base_dir.join(&upload_subdir);
    // 确保子目录存在
    fs::create_dir_all(&target_dir).map_err(|e| format!("创建上传子目录失败: {e}"))?;

    if !target_dir.is_dir() {
        send_json_frame(stream, &ServerResponse::UploadAck {
            accepted: false,
            reason: Some("目标路径不是目录".to_string()),
        })?;
        return Err("目标路径不是目录".to_string());
    }

    // 构建完整目标文件路径并验证安全
    let canonical_dir = target_dir.canonicalize().map_err(|_| "目标目录路径无效".to_string())?;
    let clean_name = Path::new(file_name).file_name().unwrap_or_default().to_string_lossy().to_string();
    if clean_name != file_name || file_name.contains('/') || file_name.contains('\\') {
        send_json_frame(stream, &ServerResponse::UploadAck {
            accepted: false,
            reason: Some("文件名包含非法字符".to_string()),
        })?;
        return Err("文件名包含路径穿越字符".to_string());
    }

    let safe_target = canonical_dir.join(&clean_name);

    // 发送 ack 接受上传
    send_json_frame(stream, &ServerResponse::UploadAck { accepted: true, reason: None })?;

    // 确保目录存在
    if let Some(parent) = safe_target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }

    // 接收文件内容并写入
    let mut file = fs::File::create(&safe_target).map_err(|e| format!("创建文件失败: {e}"))?;
    let mut remaining = file_size;
    let mut buf = vec![0u8; 8192];
    while remaining > 0 {
        let to_read = std::cmp::min(remaining, buf.len() as u64) as usize;
        stream
            .read_exact(&mut buf[..to_read])
            .map_err(|e| {
                // 写入失败时清理不完整文件
                let _ = fs::remove_file(&safe_target);
                format!("接收上传数据失败: {e}")
            })?;
        file.write_all(&buf[..to_read])
            .map_err(|e| {
                // 写入失败时清理不完整文件
                let _ = fs::remove_file(&safe_target);
                format!("写入上传文件失败: {e}")
            })?;
        remaining -= to_read as u64;
    }

    // 记录上传活动
    let rel_path = if rel_dir.is_empty() {
        clean_name
    } else {
        format!("{}/{}", rel_dir, clean_name)
    };
    log_activity(activity_log, client_addr, "upload", &rel_path, file_size);

    Ok(())
}

/// 解析相对路径，确保不超出 root 目录（防止路径穿越）
fn resolve_path(root: &Path, rel_path: &str) -> Result<PathBuf, String> {
    // 移除前导斜杠，防止路径穿越
    let clean = rel_path.trim_start_matches('/').trim_start_matches('\\');
    let target = if clean.is_empty() {
        root.to_path_buf()
    } else {
        let joined = root.join(clean);
        let canonical = joined
            .canonicalize()
            .map_err(|_| format!("路径无效: {rel_path}"))?;
        if !canonical.starts_with(root) {
            return Err("路径被拒绝（目录遍历）".to_string());
        }
        canonical
    };
    Ok(target)
}

// ── Tauri 命令 ────────────────────────────────────────────────

pub type FolderShareState = Mutex<HashMap<u16, FolderShareServer>>;

#[derive(Serialize)]
pub struct ShareStatus {
    pub port: u16,
    pub path: String,
    pub is_running: bool,
}

#[tauri::command]
pub fn start_folder_share(
    app: tauri::AppHandle,
    state: State<'_, FolderShareState>,
    conn: State<'_, DbConn>,
    path: String,
    password: String,
) -> Result<u16, String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;

    // 检查同路径是否已共享
    let canonical = PathBuf::from(&path).canonicalize()
        .map_err(|e| format!("路径无效: {e}"))?;
    for server in guard.values() {
        if server.root_path().canonicalize().map(|p| p == canonical).unwrap_or(false) {
            return Ok(server.port());
        }
    }

    // 查找关联的项目元数据
    let project_meta = lookup_project_meta(&conn, &canonical);

    let server = FolderShareServer::start(path, password, project_meta)?;
    let port = server.port();
    guard.insert(port, server);

    // 更新 mDNS 广播共享端口
    if let Some(mdns) = app.try_state::<MdnsState>() {
        if let Ok(mut mdns_guard) = mdns.lock() {
            if let Err(e) = mdns_guard.update_share_port(Some(port)) {
                log::warn!("更新 mDNS 共享端口失败: {e}");
            }
        }
    }

    events::emit_notification_checked(&app, conn.inner(), "share_started", "success", "共享已开启", &format!("端口: {}", port), None);
    Ok(port)
}

#[tauri::command]
pub fn stop_folder_share(app: tauri::AppHandle, state: State<'_, FolderShareState>, db: State<'_, DbConn>, port: u16) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    if let Some(server) = guard.remove(&port) {
        server.stop();
    }

    // 更新 mDNS：若还有其他活跃共享，广播其端口；否则清除
    let remaining_port = guard.values().next().map(|s| s.port());
    if let Some(mdns) = app.try_state::<MdnsState>() {
        if let Ok(mut mdns_guard) = mdns.lock() {
            if let Err(e) = mdns_guard.update_share_port(remaining_port) {
                log::warn!("更新 mDNS 共享端口失败: {e}");
            }
        }
    }

    events::emit_notification_checked(&app, db.inner(), "share_stopped", "info", "共享已停止", "", None);
    Ok(())
}

#[tauri::command]
pub fn get_share_status(state: State<'_, FolderShareState>) -> Result<Vec<ShareStatus>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    Ok(guard.values().map(|s| ShareStatus {
        port: s.port(),
        path: s.root_path().to_string_lossy().to_string(),
        is_running: s.is_running(),
    }).collect())
}

#[tauri::command]
pub fn get_connected_clients(state: State<'_, FolderShareState>, port: u16) -> Result<Vec<ClientInfo>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    match guard.get(&port) {
        Some(server) => {
            let clients = server.clients.lock().map_err(|e| e.to_string())?;
            Ok(clients.clone())
        }
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub fn get_activity_log(state: State<'_, FolderShareState>, port: u16) -> Result<Vec<ActivityLogEntry>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    match guard.get(&port) {
        Some(server) => {
            let log = server.activity_log.lock().map_err(|e| e.to_string())?;
            Ok(log.clone())
        }
        None => Ok(Vec::new()),
    }
}

// ── TCP 客户端（加入远程共享）────────────────────────────────────

pub fn connect_and_auth(addr: &str, password: &str) -> Result<TcpStream, String> {
    let socket_addr = addr.parse::<std::net::SocketAddr>()
        .map_err(|e| format!("地址格式无效: {e}"))?;
    let mut stream = TcpStream::connect_timeout(&socket_addr, Duration::from_secs(5))
        .map_err(|e| format!("连接超时或失败: {e}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .map_err(|e| format!("设置读超时失败: {e}"))?;
    stream
        .set_write_timeout(Some(Duration::from_secs(10)))
        .map_err(|e| format!("设置写超时失败: {e}"))?;

    // 第一步：读取服务端发送的 nonce
    let nonce_resp: ServerResponse = read_json_frame(&mut stream)?;
    let nonce = match nonce_resp {
        ServerResponse::Nonce { nonce } => nonce,
        ServerResponse::Status { success: false, message } => {
            return Err(message.unwrap_or_else(|| "服务端拒绝连接".to_string()));
        }
        _ => return Err("意外的响应类型，期望 nonce".to_string()),
    };

    // 第二步：计算 SHA-256(password + nonce)，发送 hash
    let password_hash = compute_auth_hash(password, &nonce);
    let username = super::utils::get_hostname();
    send_json_frame(&mut stream, &ShareRequest::Auth {
        password_hash,
        username: Some(username),
    })?;

    // 读取认证响应
    let resp: ServerResponse = read_json_frame(&mut stream)?;
    match resp {
        ServerResponse::Status { success, message } => {
            if !success {
                return Err(message.unwrap_or_else(|| "认证失败".to_string()));
            }
        }
        _ => return Err("意外的认证响应类型".to_string()),
    }

    Ok(stream)
}

#[tauri::command]
pub fn join_shared_folder(addr: String, password: String) -> Result<String, String> {
    let _stream = connect_and_auth(&addr, &password)?;
    Ok("连接成功".to_string())
}

#[tauri::command]
pub fn list_remote_files(
    addr: String,
    password: String,
    path: String,
) -> Result<Vec<DirEntry>, String> {
    let mut stream = connect_and_auth(&addr, &password)?;
    set_stream_timeout(&mut stream, Duration::from_secs(30))?;

    send_json_frame(&mut stream, &ShareRequest::ListDir {
        path: path.clone(),
    })?;

    let resp: ServerResponse = read_json_frame(&mut stream)?;
    match resp {
        ServerResponse::List { entries } => {
            Ok(entries)
        }
        ServerResponse::Status { success: false, message } => {
            Err(message.unwrap_or_else(|| "列目录失败".to_string()))
        }
        _ => Err("意外的响应类型".to_string()),
    }
}

#[tauri::command]
pub fn download_remote_file(
    addr: String,
    password: String,
    remote_path: String,
    local_path: String,
) -> Result<String, String> {
    let local_path_buf = PathBuf::from(&local_path);
    // 验证路径有有效文件名
    local_path_buf
        .file_name()
        .ok_or_else(|| "保存路径无有效文件名".to_string())?;
    let parent_dir = local_path_buf.parent()
        .ok_or_else(|| "保存路径无父目录".to_string())?;
    fs::create_dir_all(parent_dir).map_err(|e| format!("创建目录失败: {e}"))?;

    let mut stream = connect_and_auth(&addr, &password)?;
    set_stream_timeout(&mut stream, Duration::from_secs(300))?;

    send_json_frame(&mut stream, &ShareRequest::Download {
        path: remote_path.clone(),
    })?;

    // 读取响应（可能是 DownloadHeader 或 Status 错误）
    let resp: ServerResponse = read_json_frame(&mut stream)?;
    let header = match resp {
        ServerResponse::DownloadHeader { file_size, sha256_hash, .. } => DownloadHeaderInfo { file_size, sha256_hash },
        ServerResponse::Status { success: false, message } => {
            return Err(message.unwrap_or_else(|| "下载失败".to_string()));
        }
        _ => return Err("意外的响应类型".to_string()),
    };

    // 限制文件大小上限（10 GB）
    const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024 * 1024;
    if header.file_size > MAX_FILE_SIZE {
        return Err(format!(
            "文件过大: {} bytes，超过上限 {} bytes",
            header.file_size, MAX_FILE_SIZE
        ));
    }

    // 接收文件内容（写入到用户选择的路径）
    let mut file = fs::File::create(&local_path_buf)
        .map_err(|e| format!("创建文件失败: {e}"))?;

    let mut remaining = header.file_size;
    let mut buf = vec![0u8; 8192];
    while remaining > 0 {
        let to_read = std::cmp::min(remaining, buf.len() as u64) as usize;
        stream
            .read_exact(&mut buf[..to_read])
            .map_err(|e| format!("接收文件数据失败: {e}"))?;
        file.write_all(&buf[..to_read])
            .map_err(|e| format!("写入文件失败: {e}"))?;
        remaining -= to_read as u64;
    }

    // 验证 SHA-256
    let mut hasher = Sha256::new();
    {
        let mut verify_file = fs::File::open(&local_path_buf).map_err(|e| format!("打开文件验证hash失败: {e}"))?;
        std::io::copy(&mut verify_file, &mut hasher).map_err(|e| format!("计算验证hash失败: {e}"))?;
    }
    let computed_hash = hex_encode(&hasher.finalize());
    if computed_hash != header.sha256_hash {
        let _ = fs::remove_file(&local_path_buf);
        return Err(format!("文件完整性校验失败: SHA-256 不匹配 (期望: {}, 实际: {})", header.sha256_hash, computed_hash));
    }

    Ok(local_path_buf.to_string_lossy().to_string())
}

struct DownloadHeaderInfo {
    file_size: u64,
    sha256_hash: String,
}

#[tauri::command]
pub fn upload_remote_file(
    addr: String,
    password: String,
    remote_dir: String,
    file_name: String,
    local_path: String,
) -> Result<(), String> {
    let local_path_buf = PathBuf::from(&local_path);
    if !local_path_buf.exists() {
        return Err("本地文件不存在".to_string());
    }
    let file_size = fs::metadata(&local_path_buf)
        .map(|m| m.len())
        .map_err(|e| format!("获取文件大小失败: {e}"))?;

    let mut stream = connect_and_auth(&addr, &password)?;
    set_stream_timeout(&mut stream, Duration::from_secs(300))?;

    // 发送上传请求
    send_json_frame(&mut stream, &ShareRequest::Upload {
        path: remote_dir,
        file_name: file_name.clone(),
        file_size,
    })?;

    // 读取上传确认
    let resp: ServerResponse = read_json_frame(&mut stream)?;
    match resp {
        ServerResponse::UploadAck { accepted, reason } => {
            if !accepted {
                return Err(reason.unwrap_or_else(|| "上传被拒绝".to_string()));
            }
        }
        ServerResponse::Status { success: false, message } => {
            return Err(message.unwrap_or_else(|| "上传失败".to_string()));
        }
        _ => return Err("意外的响应类型".to_string()),
    }

    // 读取本地文件并发送内容
    let mut file = fs::File::open(&local_path_buf)
        .map_err(|e| format!("打开本地文件失败: {e}"))?;
    std::io::copy(&mut file, &mut stream)
        .map_err(|e| format!("发送文件内容失败: {e}"))?;

    Ok(())
}

/// 生成随机 nonce（8 字节的 hex 字符串）
fn generate_nonce() -> String {
    let nonce_bytes: [u8; 8] = rand::random();
    hex_encode(&nonce_bytes)
}

/// 计算 SHA-256(password + nonce)，返回 hex 字符串
fn compute_auth_hash(password: &str, nonce: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(nonce.as_bytes());
    let hash = hasher.finalize();
    hex_encode(&hash)
}

// ── 项目元数据查找 ──────────────────────────────────────────────

/// 根据文件夹路径查找关联的项目元数据
fn lookup_project_meta(conn: &DbConn, folder_path: &Path) -> Option<ShareProjectMeta> {
    let guard = conn.lock().ok()?;
    let path_str = folder_path.to_string_lossy().to_string();
    let row = guard.query_row(
        "SELECT name, description, status, start_date, end_date, created_by FROM projects WHERE folder_path = ?1",
        rusqlite::params![path_str],
        |row| {
            Ok(ShareProjectMeta {
                project_name: row.get::<_, String>(0).unwrap_or_default(),
                owner: row.get::<_, String>(5).unwrap_or_default(),
                description: row.get::<_, Option<String>>(1).ok().flatten(),
                status: row.get::<_, Option<String>>(2).ok().flatten(),
                start_date: row.get::<_, Option<String>>(3).ok().flatten(),
                end_date: row.get::<_, Option<String>>(4).ok().flatten(),
            })
        },
    ).ok()?;
    Some(row)
}

// ── 远程项目信息获取 ─────────────────────────────────────────────

/// 从远程共享获取项目信息
#[tauri::command]
pub fn get_remote_project_info(
    addr: String,
    password: String,
) -> Result<ShareProjectMeta, String> {
    let mut stream = connect_and_auth(&addr, &password)?;
    set_stream_timeout(&mut stream, Duration::from_secs(10))?;

    send_json_frame(&mut stream, &ShareRequest::ProjectInfo)?;

    let resp: ServerResponse = read_json_frame(&mut stream)?;
    match resp {
        ServerResponse::ProjectInfo { project_name, owner, description, status, start_date, end_date } => {
            Ok(ShareProjectMeta {
                project_name,
                owner,
                description,
                status,
                start_date,
                end_date,
            })
        }
        ServerResponse::Status { success: false, message } => {
            Err(message.unwrap_or_else(|| "获取项目信息失败".to_string()))
        }
        _ => Err("意外的响应类型".to_string()),
    }
}

// ── 共享项目 CRUD ────────────────────────────────────────────────

use crate::db::models::SharedProject;

/// 获取所有共享项目
#[tauri::command]
pub fn get_shared_projects(conn: State<'_, DbConn>) -> Result<Vec<SharedProject>, String> {
    let guard = conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = guard
        .prepare("SELECT id, local_project_id, remote_addr, remote_root_path, remote_project_name, remote_owner, password, role, last_synced, status, created_at FROM shared_projects ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let encoded_pwd: String = row.get(6)?;
            Ok(SharedProject {
                id: row.get(0)?,
                local_project_id: row.get(1)?,
                remote_addr: row.get(2)?,
                remote_root_path: row.get(3)?,
                remote_project_name: row.get(4)?,
                remote_owner: row.get(5)?,
                password: decode_password(&encoded_pwd),
                role: row.get(7)?,
                last_synced: row.get(8)?,
                status: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for row in rows {
        projects.push(row.map_err(|e| e.to_string())?);
    }
    Ok(projects)
}

/// 导入远程共享项目到本地
#[tauri::command]
pub fn import_shared_project(
    app: tauri::AppHandle,
    conn: State<'_, DbConn>,
    addr: String,
    password: String,
    root_path: String,
) -> Result<i64, String> {
    // 1. 获取远程项目信息
    let meta = get_remote_project_info(addr.clone(), password.clone())?;

    // 2-5. 在事务中完成所有数据库操作，避免中间状态不一致
    let local_project_id = {
        let mut guard = conn.lock().map_err(|e| e.to_string())?;
        let tx = guard.transaction().map_err(|e| e.to_string())?;

        // 创建本地项目
        tx.execute(
            "INSERT INTO projects (name, description, status, start_date, end_date, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                meta.project_name,
                meta.description.unwrap_or_default(),
                meta.status.unwrap_or_else(|| "planning".to_string()),
                meta.start_date,
                meta.end_date,
                meta.owner,
            ],
        ).map_err(|e| e.to_string())?;
        let pid = tx.last_insert_rowid();

        // 创建默认看板列
        let default_columns = ["待办", "进行中", "已完成"];
        for (i, title) in default_columns.iter().enumerate() {
            tx.execute(
                "INSERT INTO kanban_columns (project_id, title, position) VALUES (?1, ?2, ?3)",
                rusqlite::params![pid, title, i as i32],
            ).map_err(|e| e.to_string())?;
        }

        // 写入 shared_projects 记录（密码混淆存储）
        let encoded_pwd = encode_password(&password);
        tx.execute(
            "INSERT INTO shared_projects (local_project_id, remote_addr, remote_root_path, remote_project_name, remote_owner, password, role, last_synced, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'member', datetime('now'), 'connected')",
            rusqlite::params![pid, addr, root_path, meta.project_name, meta.owner, encoded_pwd],
        ).map_err(|e| e.to_string())?;

        // 同时保存到共享连接表
        tx.execute(
            "INSERT INTO shared_connections (addr, label, password, last_connected) VALUES (?1, ?2, ?3, datetime('now')) ON CONFLICT(addr) DO UPDATE SET label = ?2, password = ?3, last_connected = datetime('now')",
            rusqlite::params![addr, meta.project_name, encoded_pwd],
        ).map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;
        pid
    };

    events::emit_notification_checked(&app, conn.inner(), "file_received", "success", "项目已导入", &format!("已从 {} 导入: {}", meta.owner, meta.project_name), None);
    Ok(local_project_id)
}

/// 同步远程共享项目的元数据
#[tauri::command]
pub fn sync_shared_project(
    conn: State<'_, DbConn>,
    shared_project_id: i64,
) -> Result<(), String> {
    // 获取共享项目信息
    let (addr, password, local_project_id) = {
        let guard = conn.lock().map_err(|e| e.to_string())?;
        let (addr, encoded_pwd, lpid) = guard.query_row(
            "SELECT remote_addr, password, local_project_id FROM shared_projects WHERE id = ?1",
            rusqlite::params![shared_project_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, Option<i64>>(2)?)),
        ).map_err(|e| e.to_string())?;
        (addr, decode_password(&encoded_pwd), lpid)
    };

    // 获取远程项目信息
    let meta = get_remote_project_info(addr.clone(), password)?;

    // 更新本地项目
    if let Some(pid) = local_project_id {
        let guard = conn.lock().map_err(|e| e.to_string())?;
        guard.execute(
            "UPDATE projects SET name = ?1, status = ?2, start_date = ?3, end_date = ?4, updated_at = datetime('now') WHERE id = ?5",
            rusqlite::params![meta.project_name, meta.status, meta.start_date, meta.end_date, pid],
        ).map_err(|e| e.to_string())?;
    }

    // 更新 shared_projects 记录
    {
        let guard = conn.lock().map_err(|e| e.to_string())?;
        guard.execute(
            "UPDATE shared_projects SET remote_project_name = ?1, remote_owner = ?2, last_synced = datetime('now'), status = 'connected' WHERE id = ?3",
            rusqlite::params![meta.project_name, meta.owner, shared_project_id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 断开共享项目连接
#[tauri::command]
pub fn disconnect_shared_project(
    conn: State<'_, DbConn>,
    shared_project_id: i64,
    delete_local: bool,
) -> Result<(), String> {
    let guard = conn.lock().map_err(|e| e.to_string())?;

    // 获取本地项目 ID
    let local_project_id: Option<i64> = guard.query_row(
        "SELECT local_project_id FROM shared_projects WHERE id = ?1",
        rusqlite::params![shared_project_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    // 删除共享项目记录
    guard.execute("DELETE FROM shared_projects WHERE id = ?1", rusqlite::params![shared_project_id])
        .map_err(|e| e.to_string())?;

    // 如果需要，删除本地项目（CASCADE 会删除相关看板、甘特图等）
    if delete_local {
        if let Some(pid) = local_project_id {
            guard.execute("DELETE FROM projects WHERE id = ?1", rusqlite::params![pid])
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
