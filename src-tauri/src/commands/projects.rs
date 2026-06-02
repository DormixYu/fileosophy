use std::fs;
use tauri::{AppHandle, Manager, State};

use crate::db::models::Project;
use crate::db::DbConn;
use crate::events;

/// 与前端 DEFAULT_PROJECT_TYPES 一致的默认分类 JSON
pub const DEFAULT_PROJECT_TYPES_JSON: &str = "[\
  {\"id\":\"tb\",\"name\":\"投标\",\"prefix\":\"TB\",\"keywords\":[\"标书\",\"响应文件\",\"响应函\",\"报价函\",\"投标\",\"招标\",\"招投标\"]},\
  {\"id\":\"pj\",\"name\":\"项目\",\"prefix\":\"PJ\",\"keywords\":[\"XM\",\"项目\"]},\
  {\"id\":\"xz\",\"name\":\"行政\",\"prefix\":\"XZ\",\"keywords\":[\"BX\",\"报销\",\"发票\"]},\
  {\"id\":\"st\",\"name\":\"学习\",\"prefix\":\"ST\",\"keywords\":[\"学习\",\"初会\",\"注会\",\"CPA\"]},\
  {\"id\":\"qt\",\"name\":\"其他\",\"prefix\":\"QT\",\"keywords\":[\"杂\"]}\
]";

/// 从 settings 表读取文件夹模板，生成项目文件夹名
pub fn generate_folder_name(conn: &rusqlite::Connection, project_number: &str, name: &str) -> String {
    let template: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'folder_template'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "[{code}] {name}".to_string());

    template
        .replace("{code}", project_number)
        .replace("{name}", name)
}

/// 从查询行构造 Project 结构体（公共函数，供其他模块复用）
pub fn row_to_project(row: &rusqlite::Row) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        project_number: row.get(5)?,
        project_type: row.get(6)?,
        status: row.get(7)?,
        start_date: row.get(8)?,
        end_date: row.get(9)?,
        status_changed_at: row.get(10)?,
        created_by: row.get(11)?,
        folder_path: row.get(12)?,
    })
}

pub const PROJECT_COLUMNS: &str =
    "id, name, description, created_at, updated_at, \
     project_number, project_type, status, start_date, end_date, status_changed_at, created_by, folder_path";

#[tauri::command]
pub fn get_all_projects(db: State<'_, DbConn>) -> Result<Vec<Project>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {PROJECT_COLUMNS} FROM projects WHERE status IS NULL OR status != 'archived' ORDER BY updated_at DESC"
        ))
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], row_to_project)
        .map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for row in rows {
        projects.push(row.map_err(|e| e.to_string())?);
    }
    Ok(projects)
}

#[tauri::command]
pub fn get_project_by_id(db: State<'_, DbConn>, id: i64) -> Result<Project, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        &format!("SELECT {PROJECT_COLUMNS} FROM projects WHERE id = ?1"),
        [id],
        row_to_project,
    )
    .map_err(|e| e.to_string())
}

/// 从 settings 表读取编号模板，自动生成项目编号
pub fn generate_project_number(conn: &rusqlite::Connection, project_type: &str, name: &str) -> String {
    // 读取编号模板，默认 {prefix}-{date}-{sequence} {name}
    let template: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'number_template'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "{prefix}-{date}-{sequence}".to_string());

    // 读取分类前缀
    let prefix: String = if !project_type.is_empty() {
        let types_json: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'project_types'",
                [],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| DEFAULT_PROJECT_TYPES_JSON.to_string());

        serde_json::from_str::<Vec<serde_json::Value>>(&types_json)
            .unwrap_or_default()
            .iter()
            .find(|t| t.get("id").and_then(|v| v.as_str()) == Some(project_type))
            .and_then(|t| t.get("prefix").and_then(|v| v.as_str()))
            .unwrap_or("PRJ")
            .to_string()
    } else {
        "PRJ".to_string()
    };

    // 日期格式（读取设置，默认 YYMMDD）
    let date_fmt: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'date_format'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "YYMMDD".to_string());

    let now = chrono::Local::now();
    let date_str = if date_fmt == "YYYYMMDD" {
        now.format("%Y%m%d").to_string()
    } else {
        now.format("%y%m%d").to_string()
    };

    // 流水号：当日同前缀的项目计数 + 1
    let safe_prefix = prefix.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
    let pattern = format!("{}-{}%", safe_prefix, date_str);
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM projects WHERE project_number LIKE ?1 ESCAPE '\\'",
            [&pattern],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let sequence = format!("{:02}", count + 1);

    // 替换模板变量
    template
        .replace("{prefix}", &prefix)
        .replace("{date}", &date_str)
        .replace("{sequence}", &sequence)
        .replace("{name}", name)
}

/// 获取系统用户名
pub fn get_system_username() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "User".to_string())
}

#[tauri::command]
pub fn create_project(
    app: AppHandle,
    db: State<'_, DbConn>,
    name: String,
    description: Option<String>,
    project_type: Option<String>,
    status: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    created_by: Option<String>,
    parent_path: Option<String>,
) -> Result<Project, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;

    let tx_result: Result<Project, String> = (|| {
        let desc = description.unwrap_or_default();
        let p_type = project_type.unwrap_or_default();
        let p_status = status.unwrap_or_else(|| "planning".to_string());
        let p_created_by = created_by.unwrap_or_else(get_system_username);
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

        // 自动生成项目编号
        let project_number = generate_project_number(&conn, &p_type, &name);

        // 如果未提供 parent_path，尝试从设置读取默认路径
        let resolved_parent = parent_path.or_else(|| {
            conn.query_row(
                "SELECT value FROM settings WHERE key = 'default_project_path'",
                [],
                |row| row.get::<_, String>(0),
            ).ok().filter(|p| !p.is_empty())
        });

        // 如果有路径，生成文件夹名并创建目录
        let folder_path = if let Some(ref parent) = resolved_parent {
            let folder_name = generate_folder_name(&conn, &project_number, &name);
            let full_path = std::path::Path::new(parent).join(&folder_name);
            std::fs::create_dir_all(&full_path).map_err(|e| format!("创建文件夹失败: {e}"))?;
            Some(full_path.to_string_lossy().to_string())
        } else {
            None
        };

        conn.execute(
            "INSERT INTO projects (name, description, project_number, project_type, status, start_date, end_date, status_changed_at, created_by, folder_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![name, desc, project_number, p_type, p_status, start_date, end_date, now, p_created_by, folder_path],
        )
        .map_err(|e| e.to_string())?;

        let id = conn.last_insert_rowid();

        // 自动创建看板默认列：待办 / 进行中 / 已完成
        conn.execute(
            "INSERT INTO kanban_columns (project_id, title, position, column_type) VALUES (?1, '待办', 0, 'todo_pending')",
            rusqlite::params![id],
        ).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO kanban_columns (project_id, title, position, column_type) VALUES (?1, '进行中', 1, 'in_progress')",
            rusqlite::params![id],
        ).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO kanban_columns (project_id, title, position, column_type) VALUES (?1, '已完成', 2, 'todo_done')",
            rusqlite::params![id],
        ).map_err(|e| e.to_string())?;

        Ok(conn.query_row(
            &format!("SELECT {PROJECT_COLUMNS} FROM projects WHERE id = ?1"),
            [id],
            row_to_project,
        ).map_err(|e| e.to_string())?)
    })();

    if tx_result.is_ok() {
        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
    } else {
        conn.execute_batch("ROLLBACK").ok();
    }

    if let Ok(ref project) = tx_result {
        let link = format!("/project/{}", project.id);
        events::emit_notification_checked(&app, db.inner(), "project_created", "success", "项目已创建", &project.name, Some(&link));
    }

    tx_result
}

#[tauri::command]
pub fn update_project(
    app: AppHandle,
    db: State<'_, DbConn>,
    id: i64,
    name: Option<String>,
    description: Option<String>,
    project_type: Option<String>,
    status: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Project, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // 权限检查：共享项目的 member 角色不能修改元数据
    let is_member = conn.query_row(
        "SELECT role FROM shared_projects WHERE local_project_id = ?1",
        rusqlite::params![id],
        |row| row.get::<_, String>(0),
    ).ok();
    if is_member.as_deref() == Some("member") {
        if name.is_some() || status.is_some() || start_date.is_some() || end_date.is_some() {
            return Err("共享项目成员不能修改项目名称、状态和日期".to_string());
        }
    }

    // 动态构建 UPDATE 语句
    let mut sets = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref n) = name {
        sets.push(format!("name = ?{idx}"));
        params.push(Box::new(n.clone()));
        idx += 1;
    }
    if let Some(ref d) = description {
        sets.push(format!("description = ?{idx}"));
        params.push(Box::new(d.clone()));
        idx += 1;
    }
    if let Some(ref pt) = project_type {
        sets.push(format!("project_type = ?{idx}"));
        params.push(Box::new(pt.clone()));
        idx += 1;

        // 项目分类变更时，同步更新编号前缀
        let old_type: Option<String> = conn.query_row(
            "SELECT project_type FROM projects WHERE id = ?1",
            [id],
            |row| row.get::<_, Option<String>>(0),
        ).ok().flatten();

        if old_type.as_deref() != Some(pt.as_str()) {
            let types_json: String = conn.query_row(
                "SELECT value FROM settings WHERE key = 'project_types'",
                [],
                |row| row.get(0),
            ).unwrap_or_else(|_| DEFAULT_PROJECT_TYPES_JSON.to_string());

            let types: Vec<serde_json::Value> = serde_json::from_str(&types_json).unwrap_or_default();

            let old_prefix = old_type.as_ref().and_then(|t| {
                types.iter()
                    .find(|v| v.get("id").and_then(|v| v.as_str()) == Some(t.as_str()))
                    .and_then(|v| v.get("prefix").and_then(|v| v.as_str()))
            }).unwrap_or("PRJ");

            let new_prefix = types.iter()
                .find(|v| v.get("id").and_then(|v| v.as_str()) == Some(pt.as_str()))
                .and_then(|v| v.get("prefix").and_then(|v| v.as_str()))
                .unwrap_or("PRJ");

            let old_number: String = conn.query_row(
                "SELECT COALESCE(project_number, '') FROM projects WHERE id = ?1",
                [id],
                |row| row.get::<_, String>(0),
            ).unwrap_or_default();

            if !old_number.is_empty() && old_number.starts_with(old_prefix) {
                let new_number = old_number.replacen(old_prefix, new_prefix, 1);
                sets.push(format!("project_number = ?{idx}"));
                params.push(Box::new(new_number));
                idx += 1;
            }
        }
    }
    // 状态变更时记录历史
    let old_status: Option<String> = if status.is_some() {
        conn.query_row(
            "SELECT status FROM projects WHERE id = ?1",
            [id],
            |row| row.get(0),
        )
        .ok()
    } else {
        None
    };

    if let Some(ref s) = status {
        sets.push(format!("status = ?{idx}"));
        params.push(Box::new(s.clone()));
        idx += 1;
        // 状态变更时自动更新 status_changed_at
        sets.push(format!("status_changed_at = datetime('now')"));
    }
    if let Some(ref sd) = start_date {
        sets.push(format!("start_date = ?{idx}"));
        params.push(Box::new(sd.clone()));
        idx += 1;
    }
    if let Some(ref ed) = end_date {
        sets.push(format!("end_date = ?{idx}"));
        params.push(Box::new(ed.clone()));
        idx += 1;
    }

    if sets.is_empty() {
        return get_project_by_id_inner(&conn, id);
    }

    sets.push(format!("updated_at = datetime('now')"));
    params.push(Box::new(id));

    let sql = format!(
        "UPDATE projects SET {} WHERE id = ?{}",
        sets.join(", "),
        idx
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;

    // 记录状态变更历史
    if let Some(ref new_status) = status {
        if old_status.as_ref() != Some(new_status) {
            conn.execute(
                "INSERT INTO project_status_history (project_id, status, changed_at) VALUES (?1, ?2, datetime('now'))",
                rusqlite::params![id, new_status.as_str()],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    let project = get_project_by_id_inner(&conn, id)?;

    // 仅当状态变更时发送通知（先收集信息，释放锁后再发送）
    let should_notify = status.is_some() && old_status.as_ref() != status.as_ref();
    let notify_info = if should_notify {
        let status_label = match project.status.as_deref() {
            Some("planning") => "规划中",
            Some("in_progress") => "进行中",
            Some("on_hold") => "已暂停",
            Some("completed") => "已完成",
            Some("cancelled") => "已取消",
            _ => "未知",
        };
        Some((format!("{}: {}", project.name, status_label), format!("/project/{}", project.id)))
    } else {
        None
    };

    drop(conn);

    if let Some((msg, link)) = notify_info {
        events::emit_notification_checked(&app, db.inner(), "project_status_changed", "info", "项目状态变更", &msg, Some(&link));
    }

    Ok(project)
}

#[tauri::command]
pub fn delete_project(app: AppHandle, db: State<'_, DbConn>, id: i64) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    // 获取项目名称和 folder_path 用于清理磁盘文件
    let (name, folder_path): (String, Option<String>) = conn.query_row(
        "SELECT name, folder_path FROM projects WHERE id = ?1", [id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).unwrap_or_else(|_| ("项目".to_string(), None));

    conn.execute("DELETE FROM projects WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    drop(conn); // 释放锁后再执行文件操作

    // 清理应用数据目录下的项目文件
    let mut cleanup_errors = Vec::new();
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let project_files_dir = app_data_dir.join("files").join(id.to_string());
        if project_files_dir.exists() {
            if let Err(e) = fs::remove_dir_all(&project_files_dir) {
                cleanup_errors.push(format!("清理项目文件失败: {e}"));
            }
        }
    }

    // 清理项目关联的外部文件夹
    if let Some(ref path) = folder_path {
        let p = std::path::Path::new(path);
        if p.exists() && p.is_dir() {
            if let Err(e) = fs::remove_dir_all(p) {
                cleanup_errors.push(format!("清理项目文件夹失败: {e}"));
            }
        }
    }

    if !cleanup_errors.is_empty() {
        log::warn!("项目删除时磁盘清理不完整: {}", cleanup_errors.join("; "));
    }

    events::emit_notification_checked(&app, db.inner(), "project_deleted", "warning", "项目已删除", &name, None);

    Ok(())
}

pub fn get_project_by_id_inner(
    conn: &rusqlite::Connection,
    id: i64,
) -> Result<Project, String> {
    conn.query_row(
        &format!("SELECT {PROJECT_COLUMNS} FROM projects WHERE id = ?1"),
        [id],
        row_to_project,
    )
    .map_err(|e| e.to_string())
}

