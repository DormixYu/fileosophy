use crate::db::DbConn;
use crate::commands::utils::{encode_password, decode_password};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SharedConnection {
    pub id: i64,
    pub addr: String,
    pub label: String,
    #[serde(skip_serializing)]
    pub password: String,
    pub last_connected: Option<String>,
    pub last_path: String,
    pub created_at: String,
}

/// 获取所有已保存的共享连接
#[tauri::command]
pub fn get_shared_connections(conn: State<'_, DbConn>) -> Result<Vec<SharedConnection>, String> {
    let guard = conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = guard
        .prepare("SELECT id, addr, label, password, last_connected, last_path, created_at FROM shared_connections ORDER BY last_connected DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let encoded_pwd: String = row.get(3)?;
            Ok(SharedConnection {
                id: row.get(0)?,
                addr: row.get(1)?,
                label: row.get(2)?,
                password: decode_password(&encoded_pwd),
                last_connected: row.get(4)?,
                last_path: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut connections = Vec::new();
    for row in rows {
        connections.push(row.map_err(|e| e.to_string())?);
    }
    Ok(connections)
}

/// 保存或更新共享连接（INSERT OR REPLACE）
#[tauri::command]
pub fn save_shared_connection(
    conn: State<'_, DbConn>,
    addr: String,
    password: String,
    label: String,
) -> Result<(), String> {
    let encoded_pwd = encode_password(&password);
    let guard = conn.lock().map_err(|e| e.to_string())?;
    guard
        .execute(
            "INSERT INTO shared_connections (addr, password, label, last_connected)
             VALUES (?1, ?2, ?3, datetime('now'))
             ON CONFLICT(addr) DO UPDATE SET password = ?2, label = ?3, last_connected = datetime('now')",
            rusqlite::params![addr, encoded_pwd, label],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 删除共享连接
#[tauri::command]
pub fn delete_shared_connection(conn: State<'_, DbConn>, addr: String) -> Result<(), String> {
    let guard = conn.lock().map_err(|e| e.to_string())?;
    let affected = guard
        .execute("DELETE FROM shared_connections WHERE addr = ?1", rusqlite::params![addr])
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("连接不存在".to_string());
    }
    Ok(())
}

/// 更新连接的最后连接时间和浏览路径
#[tauri::command]
pub fn update_shared_connection(
    conn: State<'_, DbConn>,
    addr: String,
    last_path: Option<String>,
) -> Result<(), String> {
    let guard = conn.lock().map_err(|e| e.to_string())?;
    if let Some(path) = last_path {
        guard
            .execute(
                "UPDATE shared_connections SET last_connected = datetime('now'), last_path = ?1 WHERE addr = ?2",
                rusqlite::params![path, addr],
            )
            .map_err(|e| e.to_string())?;
    } else {
        guard
            .execute(
                "UPDATE shared_connections SET last_connected = datetime('now') WHERE addr = ?1",
                rusqlite::params![addr],
            )
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 测试连接是否可达（尝试认证）
#[tauri::command]
pub fn test_shared_connection(addr: String, password: String) -> Result<bool, String> {
    match crate::commands::folder_share::connect_and_auth(&addr, &password) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// 从旧 settings 表迁移 share_connections 数据
#[tauri::command]
pub fn migrate_legacy_connections(conn: State<'_, DbConn>) -> Result<(), String> {
    let guard = conn.lock().map_err(|e| e.to_string())?;

    // 读取旧的 share_connections JSON
    let old_data: Option<String> = guard
        .query_row(
            "SELECT value FROM settings WHERE key = 'share_connections'",
            [],
            |row| row.get(0),
        )
        .ok();

    let Some(json_str) = old_data else {
        return Ok(()); // 没有旧数据需要迁移
    };

    #[derive(Deserialize)]
    struct LegacyConnection {
        addr: String,
        label: String,
        #[serde(default)]
        last_connected: String,
        #[serde(default)]
        last_path: String,
    }

    let legacy: Vec<LegacyConnection> =
        serde_json::from_str(&json_str).map_err(|e| format!("解析旧连接数据失败: {e}"))?;

    for conn_item in &legacy {
        guard
            .execute(
                "INSERT OR IGNORE INTO shared_connections (addr, label, password, last_connected, last_path)
                 VALUES (?1, ?2, '', ?3, ?4)",
                rusqlite::params![conn_item.addr, conn_item.label, conn_item.last_connected, conn_item.last_path],
            )
            .map_err(|e| e.to_string())?;
    }

    // 删除旧数据
    guard
        .execute("DELETE FROM settings WHERE key = 'share_connections'", [])
        .map_err(|e| e.to_string())?;

    log::info!("已迁移 {} 条旧共享连接数据", legacy.len());
    Ok(())
}

/// 获取指定连接的密码（单独接口，避免列表接口泄露密码）
#[tauri::command]
pub fn get_connection_password(conn: State<'_, DbConn>, addr: String) -> Result<String, String> {
    let guard = conn.lock().map_err(|e| e.to_string())?;
    let encoded_pwd: String = guard
        .query_row(
            "SELECT password FROM shared_connections WHERE addr = ?1",
            [addr],
            |row| row.get(0),
        )
        .map_err(|e| format!("连接不存在: {}", e))?;
    Ok(decode_password(&encoded_pwd))
}
