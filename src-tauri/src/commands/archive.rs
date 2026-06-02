use crate::db::models::ArchivedProject;
use crate::db::DbConn;
use crate::events;
use std::fs;
use tauri::{AppHandle, Emitter, Manager, State};

/// 从查询行构造 ArchivedProject
fn row_to_archived(row: &rusqlite::Row) -> rusqlite::Result<ArchivedProject> {
    Ok(ArchivedProject {
        id: row.get(0)?,
        project_id: row.get(1)?,
        project_name: row.get(2)?,
        project_number: row.get(3)?,
        project_type: row.get(4)?,
        category: row.get(5)?,
        original_folder_path: row.get(6)?,
        archive_path: row.get(7)?,
        file_size: row.get(8)?,
        archived_at: row.get(9)?,
    })
}

const ARCHIVE_COLUMNS: &str =
    "id, project_id, project_name, project_number, project_type, \
     category, original_folder_path, archive_path, file_size, archived_at";

/// 归档项目：压缩项目文件夹为 zip，更新项目状态为 archived
#[tauri::command]
pub fn archive_project(
    db: State<'_, DbConn>,
    app: AppHandle,
    project_id: i64,
) -> Result<ArchivedProject, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // 获取项目信息
    let (name, project_number, project_type, folder_path, status): (String, String, String, String, String) = conn
        .query_row(
            "SELECT name, COALESCE(project_number,''), COALESCE(project_type,''), \
             COALESCE(folder_path,''), COALESCE(status,'') FROM projects WHERE id = ?1",
            [project_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .map_err(|e| format!("项目不存在: {e}"))?;

    if folder_path.is_empty() {
        return Err("项目没有关联的文件夹路径，无法归档".to_string());
    }

    let src_dir = std::path::Path::new(&folder_path);
    if !src_dir.exists() {
        return Err("项目文件夹不存在".to_string());
    }

    // 创建归档目录
    let archives_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("archives");
    fs::create_dir_all(&archives_dir).map_err(|e| e.to_string())?;

    // 生成归档文件名
    let archive_name = format!("{}_{}.zip", project_number, project_id);
    let archive_path = archives_dir.join(&archive_name);

    // 压缩项目文件夹
    let file_size = zip_folder(src_dir, &archive_path)?;

    // 保存归档元数据
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO archives (project_id, project_name, project_number, project_type, \
         category, original_folder_path, archive_path, file_size, archived_at, previous_status) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            project_id,
            name,
            project_number,
            project_type,
            "",
            folder_path,
            archive_path.to_string_lossy(),
            file_size,
            now,
            status,
        ],
    )
    .map_err(|e| e.to_string())?;

    let archive_id = conn.last_insert_rowid();

    // 更新项目状态为 archived
    conn.execute(
        "UPDATE projects SET status = 'archived', status_changed_at = ?1, updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, project_id],
    )
    .map_err(|e| e.to_string())?;

    drop(conn);

    let _ = app.emit("project-updated", ());
    events::emit_notification(
        &app,
        "success",
        "项目已归档",
        &format!("项目「{}」已成功归档", name),
        Some("/archive"),
    );

    // 查询返回归档记录
    let conn = db.lock().map_err(|e| e.to_string())?;
    let archive = conn
        .query_row(
            &format!("SELECT {ARCHIVE_COLUMNS} FROM archives WHERE id = ?1"),
            [archive_id],
            row_to_archived,
        )
        .map_err(|e| e.to_string())?;

    Ok(archive)
}

/// 解归档项目
#[tauri::command]
pub fn unarchive_project(
    db: State<'_, DbConn>,
    app: AppHandle,
    archive_id: i64,
    restore_path: Option<String>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let (project_id, archive_path, original_path, previous_status): (i64, String, String, String) = conn
        .query_row(
            "SELECT project_id, archive_path, original_folder_path, COALESCE(previous_status,'planning') \
             FROM archives WHERE id = ?1",
            [archive_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|e| format!("归档记录不存在: {e}"))?;

    let dest = restore_path.unwrap_or(original_path);
    if dest.is_empty() {
        return Err("没有指定恢复路径".to_string());
    }

    // 解压 zip
    let archive_file = std::fs::File::open(&archive_path).map_err(|e| format!("打开归档文件失败: {e}"))?;
    let mut zip = zip::ZipArchive::new(archive_file).map_err(|e| format!("读取 zip 失败: {e}"))?;
    zip.extract(&dest).map_err(|e| format!("解压失败: {e}"))?;

    // 恢复项目状态
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE projects SET status = ?1, folder_path = ?2, status_changed_at = ?3, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![previous_status, dest, now, project_id],
    )
    .map_err(|e| e.to_string())?;

    // 删除归档记录
    conn.execute("DELETE FROM archives WHERE id = ?1", [archive_id])
        .map_err(|e| e.to_string())?;

    drop(conn);

    // 删除归档文件
    let _ = fs::remove_file(&archive_path);

    let _ = app.emit("project-updated", ());
    events::emit_notification(&app, "success", "项目已解归档", "项目已恢复到主列表", None);

    Ok(())
}

/// 获取所有归档项目
#[tauri::command]
pub fn get_archived_projects(db: State<'_, DbConn>) -> Result<Vec<ArchivedProject>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {ARCHIVE_COLUMNS} FROM archives ORDER BY archived_at DESC"
        ))
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], row_to_archived).map_err(|e| e.to_string())?;

    let mut archives = Vec::new();
    for row in rows {
        archives.push(row.map_err(|e| e.to_string())?);
    }
    Ok(archives)
}

/// 递归打包目录为 zip（复用 export 模块的逻辑）
fn zip_folder(src_dir: &std::path::Path, dst_file: &std::path::Path) -> Result<i64, String> {
    let file = fs::File::create(dst_file).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    fn add_entries(
        zip: &mut zip::ZipWriter<fs::File>,
        dir: &std::path::Path,
        base: &std::path::Path,
        options: zip::write::SimpleFileOptions,
    ) -> Result<(), String> {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();

                if path.is_dir() {
                    if file_name == ".git" || file_name == "node_modules" || file_name == "__pycache__"
                    {
                        continue;
                    }
                    let entry_path = base.join(&file_name);
                    zip.add_directory(entry_path.to_string_lossy(), options)
                        .map_err(|e| e.to_string())?;
                    add_entries(zip, &path, &base.join(&file_name), options)?;
                } else if !file_name.starts_with('.') {
                    let entry_path = base.join(&file_name);
                    zip.start_file(entry_path.to_string_lossy(), options)
                        .map_err(|e| e.to_string())?;
                    let mut f = fs::File::open(&path).map_err(|e| e.to_string())?;
                    std::io::copy(&mut f, zip).map_err(|e| e.to_string())?;
                }
            }
        }
        Ok(())
    }

    let dir_name = src_dir
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    zip.add_directory(&dir_name, options)
        .map_err(|e| e.to_string())?;
    add_entries(&mut zip, src_dir, std::path::Path::new(&dir_name), options)?;
    zip.finish().map_err(|e| e.to_string())?;

    let size = fs::metadata(dst_file)
        .map(|m| m.len() as i64)
        .unwrap_or(0);
    Ok(size)
}
