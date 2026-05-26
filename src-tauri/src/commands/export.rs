use crate::db::DbConn;
use super::projects::{row_to_project, PROJECT_COLUMNS, DEFAULT_PROJECT_TYPES_JSON, generate_project_number};
use crate::commands::utils::get_setting;
use crate::db::models::{FileEntry, FileEntryWithContent, GanttTask, KanbanCard, KanbanColumn, ProjectExport};
use base64::{Engine, engine::general_purpose::STANDARD};
use std::collections::HashMap;
use std::fs;
use tauri::{AppHandle, Emitter, Manager, State};

fn load_kanban_columns(conn: &rusqlite::Connection, project_id: i64) -> Result<Vec<KanbanColumn>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.project_id, c.title, c.position, c.created_at, c.column_type,
                    card.id, card.column_id, card.title, card.description, card.position, card.tags, card.created_at, card.updated_at, card.gantt_task_id, card.due_date
             FROM kanban_columns c
             LEFT JOIN kanban_cards card ON card.column_id = c.id
             WHERE c.project_id = ?1
             ORDER BY c.position, card.position",
        )
        .map_err(|e| e.to_string())?;

    let mut columns_map: HashMap<i64, KanbanColumn> = HashMap::new();
    let rows = stmt
        .query_map([project_id], |row| {
            let col_id: i64 = row.get(0)?;
            let col = KanbanColumn {
                id: col_id,
                project_id: row.get(1)?,
                title: row.get(2)?,
                position: row.get(3)?,
                created_at: row.get(4)?,
                column_type: row.get(5)?,
                cards: Vec::new(),
            };

            let card_id: Option<i64> = row.get(6)?;
            let card = card_id.map(|cid| KanbanCard {
                id: cid,
                column_id: row.get(7).unwrap_or(col_id),
                title: row.get(8).unwrap_or_default(),
                description: row.get(9).ok(),
                position: row.get(10).unwrap_or(0),
                tags: row
                    .get::<_, String>(11)
                    .ok()
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default(),
                created_at: row.get(12).unwrap_or_default(),
                updated_at: row.get(13).unwrap_or_default(),
                gantt_task_id: row.get(14).ok(),
                due_date: row.get(15).ok(),
            });

            Ok((col, card))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (col, card) = row.map_err(|e| e.to_string())?;
        let entry = columns_map.entry(col.id).or_insert(col);
        if let Some(c) = card {
            entry.cards.push(c);
        }
    }

    let mut columns: Vec<KanbanColumn> = columns_map.into_values().collect();
    columns.sort_by_key(|c| c.position);
    Ok(columns)
}

fn load_gantt_tasks(conn: &rusqlite::Connection, project_id: i64) -> Result<Vec<GanttTask>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, start_date, duration_days, dependencies, progress, created_at
             FROM gantt_tasks WHERE project_id = ?1 ORDER BY start_date",
        )
        .map_err(|e| e.to_string())?;

    let tasks = stmt
        .query_map([project_id], |row| {
            Ok(GanttTask {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                start_date: row.get(3)?,
                duration_days: row.get(4)?,
                dependencies: row
                    .get::<_, String>(5)
                    .ok()
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default(),
                progress: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(tasks)
}

fn load_project_files(conn: &rusqlite::Connection, project_id: i64) -> Result<Vec<FileEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, original_name, stored_name, size, uploaded_at
             FROM project_files WHERE project_id = ?1 ORDER BY uploaded_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let files = stmt
        .query_map([project_id], |row| {
            Ok(FileEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                original_name: row.get(2)?,
                stored_name: row.get(3)?,
                size: row.get(4)?,
                uploaded_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(files)
}

/// 加载项目文件的 base64 内容（用于导出）
fn load_files_with_content(
    files: &[FileEntry],
    app_data_dir: &std::path::Path,
    project_id: i64,
) -> Option<Vec<FileEntryWithContent>> {
    if files.is_empty() {
        return None;
    }
    let files_dir = app_data_dir.join("files").join(project_id.to_string());
    let content_list: Vec<FileEntryWithContent> = files.iter().map(|f| {
        let file_path = files_dir.join(&f.stored_name);
        let content_base64 = if file_path.exists() {
            std::fs::read(&file_path).ok().map(|bytes| STANDARD.encode(&bytes))
        } else {
            None
        };
        FileEntryWithContent {
            id: f.id,
            project_id: f.project_id,
            original_name: f.original_name.clone(),
            stored_name: f.stored_name.clone(),
            size: f.size,
            uploaded_at: f.uploaded_at.clone(),
            content_base64,
        }
    }).collect();
    Some(content_list)
}

/// 导出项目为 JSON（完整数据）或 CSV（摘要），可选包含文件内容
#[tauri::command]
pub fn export_project(
    app: AppHandle,
    db: State<'_, DbConn>,
    project_id: i64,
    format: String,
    include_files: Option<bool>,
) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let project = conn
        .query_row(
            &format!("SELECT {PROJECT_COLUMNS} FROM projects WHERE id = ?1"),
            [project_id],
            row_to_project,
        )
        .map_err(|e| format!("项目不存在: {e}"))?;

    let kanban_columns = load_kanban_columns(&conn, project_id)?;
    let gantt_tasks = load_gantt_tasks(&conn, project_id)?;
    let files = load_project_files(&conn, project_id)?;

    let include_files_content = include_files.unwrap_or(false);
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let files_with_content = if include_files_content {
        load_files_with_content(&files, &app_data_dir, project_id)
    } else {
        None
    };

    let export = ProjectExport {
        version: 2,
        project,
        kanban_columns,
        gantt_tasks,
        files,
        files_with_content,
    };

    match format.as_str() {
        "json" => serde_json::to_string_pretty(&export).map_err(|e| e.to_string()),
        "csv" => export_to_csv(&export),
        _ => Err(format!("不支持的导出格式: {format}")),
    }
}

fn export_to_csv(export: &ProjectExport) -> Result<String, String> {
    let mut csv = String::new();

    // 项目信息
    csv.push_str("=== 项目信息 ===\n");
    csv.push_str("ID,名称,描述,创建时间,更新时间\n");
    csv.push_str(&format!(
        "{},\"{}\",\"{}\",{},{}\n\n",
        export.project.id,
        export.project.name.replace('"', "\"\""),
        export.project.description.as_deref().unwrap_or("").replace('"', "\"\""),
        export.project.created_at,
        export.project.updated_at,
    ));

    // 看板卡片
    csv.push_str("=== 看板任务 ===\n");
    csv.push_str("列名,卡片ID,标题,描述,标签,创建时间\n");
    for col in &export.kanban_columns {
        for card in &col.cards {
            csv.push_str(&format!(
                "\"{}\",{},\"{}\",\"{}\",\"{}\",{}\n",
                col.title.replace('"', "\"\""),
                card.id,
                card.title.replace('"', "\"\""),
                card.description.as_deref().unwrap_or("").replace('"', "\"\""),
                card.tags.join(",").replace('"', "\"\""),
                card.created_at,
            ));
        }
    }

    // 甘特图任务
    csv.push_str("\n=== 甘特图任务 ===\n");
    csv.push_str("任务ID,名称,开始日期,持续天数,依赖,进度,创建时间\n");
    for task in &export.gantt_tasks {
        let deps: Vec<String> = task.dependencies.iter().map(|d| d.to_string()).collect();
        csv.push_str(&format!(
            "{},\"{}\",{},{},\"{}\",{:.1},{}\n",
            task.id,
            task.name.replace('"', "\"\""),
            task.start_date,
            task.duration_days,
            deps.join(","),
            task.progress,
            task.created_at,
        ));
    }

    Ok(csv)
}


fn import_full_project_impl(conn: &rusqlite::Connection, export: ProjectExport) -> Result<crate::db::models::Project, String> {
    conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;

    let tx_result: Result<crate::db::models::Project, String> = (|| {
        // 1. INSERT 项目
        conn.execute(
            "INSERT INTO projects (name, description, project_number, project_type, status, start_date, end_date, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![export.project.name, export.project.description, export.project.project_number, export.project.project_type, export.project.status, export.project.start_date, export.project.end_date, export.project.created_by],
        )
        .map_err(|e| e.to_string())?;

        let new_project_id = conn.last_insert_rowid();

        // 2. INSERT 甘特任务（先建 map，再处理看板卡片的 gantt_task_id）
        let mut gantt_id_map: HashMap<i64, i64> = HashMap::new();
        for task in &export.gantt_tasks {
            conn.execute(
                "INSERT INTO gantt_tasks (project_id, name, start_date, duration_days, dependencies, progress) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![new_project_id, task.name, task.start_date, task.duration_days, "[]", task.progress],
            )
            .map_err(|e| e.to_string())?;

            let new_task_id = conn.last_insert_rowid();
            gantt_id_map.insert(task.id, new_task_id);
        }

        // 3. UPDATE 甘特依赖（用新 ID 映射）
        for task in &export.gantt_tasks {
            if !task.dependencies.is_empty() {
                let new_deps: Vec<i64> = task.dependencies
                    .iter()
                    .filter_map(|old_id| gantt_id_map.get(old_id).copied())
                    .collect();
                let deps_json = serde_json::to_string(&new_deps).unwrap_or_else(|_| "[]".to_string());
                let new_task_id = gantt_id_map[&task.id];
                conn.execute(
                    "UPDATE gantt_tasks SET dependencies = ?1 WHERE id = ?2",
                    rusqlite::params![deps_json, new_task_id],
                )
                .map_err(|e| e.to_string())?;
            }
        }

        // 4. INSERT 看板列 + 卡片（卡片 gantt_task_id 映射为新 ID）
        for col in &export.kanban_columns {
            conn.execute(
                "INSERT INTO kanban_columns (project_id, title, position, column_type) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![new_project_id, col.title, col.position, col.column_type],
            )
            .map_err(|e| e.to_string())?;

            let new_col_id = conn.last_insert_rowid();

            for card in &col.cards {
                let tags_json = serde_json::to_string(&card.tags).unwrap_or_else(|_| "[]".to_string());
                let new_gantt_task_id = card.gantt_task_id
                    .and_then(|old_id| gantt_id_map.get(&old_id).copied());
                conn.execute(
                    "INSERT INTO kanban_cards (column_id, title, description, position, tags, due_date, gantt_task_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    rusqlite::params![new_col_id, card.title, card.description, card.position, tags_json, card.due_date, new_gantt_task_id],
                )
                .map_err(|e| e.to_string())?;
            }
        }

        // 5. INSERT 文件元数据
        for file in &export.files {
            conn.execute(
                "INSERT INTO project_files (project_id, original_name, stored_name, size, uploaded_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![new_project_id, file.original_name, file.stored_name, file.size, file.uploaded_at],
            )
            .map_err(|e| e.to_string())?;
        }

        Ok(conn.query_row(
            &format!("SELECT {PROJECT_COLUMNS} FROM projects WHERE id = ?1"),
            [new_project_id],
            row_to_project,
        ).map_err(|e| e.to_string())?)
    })();

    if tx_result.is_ok() {
        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
    } else {
        conn.execute_batch("ROLLBACK").ok();
    }

    tx_result
}

/// 导出所有项目为 JSON（完整备份），可选包含文件内容
#[tauri::command]
pub fn export_all_projects(
    app: AppHandle,
    db: State<'_, DbConn>,
    include_files: Option<bool>,
) -> Result<String, String> {
    // 先收集所有项目 ID，尽快释放锁
    let project_ids: Vec<i64> = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id FROM projects ORDER BY updated_at DESC")
            .map_err(|e| e.to_string())?;
        let ids: Vec<i64> = stmt
            .query_map([], |row| row.get::<_, i64>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        ids
    };

    let include_files_content = include_files.unwrap_or(false);
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    // 逐个项目加载数据，每次独立加锁
    let mut exports = Vec::new();
    for pid in project_ids {
        let conn = db.lock().map_err(|e| e.to_string())?;

        let project = conn
            .query_row(
                &format!("SELECT {PROJECT_COLUMNS} FROM projects WHERE id = ?1"),
                [pid],
                row_to_project,
            )
            .map_err(|e| e.to_string())?;

        let kanban_columns = load_kanban_columns(&conn, pid)?;
        let gantt_tasks = load_gantt_tasks(&conn, pid)?;
        let files = load_project_files(&conn, pid)?;

        drop(conn); // 释放锁后再读取文件内容

        let files_with_content = if include_files_content {
            load_files_with_content(&files, &app_data_dir, pid)
        } else {
            None
        };

        exports.push(ProjectExport {
            version: 2,
            project,
            kanban_columns,
            gantt_tasks,
            files,
            files_with_content,
        });
    }

    serde_json::to_string_pretty(&exports).map_err(|e| e.to_string())
}

/// 从完整备份文件导入多个项目，可选替换现有数据
#[tauri::command]
pub fn import_all_projects(app: AppHandle, db: State<'_, DbConn>, file_path: String, replace: Option<bool>) -> Result<Vec<crate::db::models::Project>, String> {
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let exports: Vec<ProjectExport> =
        serde_json::from_str(&content).map_err(|e| format!("无法解析备份文件: {e}"))?;

    let do_replace = replace.unwrap_or(false);
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    let conn = db.lock().map_err(|e| e.to_string())?;

    // 使用事务确保原子性
    conn.execute_batch("BEGIN TRANSACTION").map_err(|e| e.to_string())?;

    let result = (|| -> Result<Vec<crate::db::models::Project>, String> {
        if do_replace {
            conn.execute_batch(
                "DELETE FROM kanban_cards; DELETE FROM kanban_columns; DELETE FROM gantt_tasks; DELETE FROM project_files; DELETE FROM project_status_history; DELETE FROM project_milestones; DELETE FROM projects;"
            ).map_err(|e| format!("清空数据失败: {e}"))?;
        }

        let mut imported = Vec::new();
        for export in exports {
            let files_content = export.files_with_content.clone();
            let project = import_full_project_impl(&conn, export)?;

            // 将 base64 文件内容写入磁盘
            if let Some(files) = files_content {
                let files_dir = app_data_dir.join("files").join(project.id.to_string());
                fs::create_dir_all(&files_dir).map_err(|e| format!("创建文件目录失败: {e}"))?;
                for file in &files {
                    if let Some(ref content_b64) = file.content_base64 {
                        if let Ok(bytes) = STANDARD.decode(content_b64) {
                            let file_path = files_dir.join(&file.stored_name);
                            fs::write(&file_path, &bytes).map_err(|e| format!("写入文件失败: {e}"))?;
                        }
                    }
                }
            }

            imported.push(project);
        }

        Ok(imported)
    })();

    match result {
        Ok(imported) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            Ok(imported)
        }
        Err(e) => {
            conn.execute_batch("ROLLBACK").ok();
            Err(e)
        }
    }
}

/// CSV 值中含逗号、引号、换行的要用双引号包裹并转义内部引号
fn csv_escape(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

/// 从 settings 表读取 project_types 和 project_statuses 配置，做 id→name 映射
fn load_type_map(conn: &rusqlite::Connection) -> HashMap<String, String> {
    let types_json = get_setting(conn, "project_types")
        .unwrap_or_else(|| DEFAULT_PROJECT_TYPES_JSON.to_string());
    serde_json::from_str::<Vec<serde_json::Value>>(&types_json)
        .unwrap_or_default()
        .iter()
        .filter_map(|t| {
            let id = t.get("id").and_then(|v| v.as_str())?;
            let name = t.get("name").and_then(|v| v.as_str())?;
            Some((id.to_string(), name.to_string()))
        })
        .collect()
}

fn load_status_map(conn: &rusqlite::Connection) -> HashMap<String, String> {
    let statuses_json = get_setting(conn, "project_statuses")
        .unwrap_or_else(|| "[{\"id\":\"planning\",\"name\":\"规划中\"},{\"id\":\"in_progress\",\"name\":\"进行中\"},{\"id\":\"on_hold\",\"name\":\"已暂停\"},{\"id\":\"completed\",\"name\":\"已完成\"},{\"id\":\"cancelled\",\"name\":\"已取消\"}]".to_string());
    serde_json::from_str::<Vec<serde_json::Value>>(&statuses_json)
        .unwrap_or_default()
        .iter()
        .filter_map(|s| {
            let id = s.get("id").and_then(|v| v.as_str())?;
            let name = s.get("name").and_then(|v| v.as_str())?;
            Some((id.to_string(), name.to_string()))
        })
        .collect()
}

/// 导出项目列表为 CSV
#[tauri::command]
pub fn export_project_list(
    app: AppHandle,
    db: State<'_, DbConn>,
    project_ids: Vec<i64>,
    fields: Vec<String>,
    save_path: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let type_map = load_type_map(&conn);
    let status_map = load_status_map(&conn);

    // 查询项目
    let mut stmt = conn
        .prepare(&format!("SELECT {PROJECT_COLUMNS} FROM projects WHERE id = ?1"))
        .map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for pid in &project_ids {
        if let Ok(project) = stmt.query_row([*pid], row_to_project) {
            projects.push(project);
        }
    }

    // 生成 CSV header
    let header_fields: Vec<String> = fields.iter().map(|f| {
        match f.as_str() {
            "number" => "项目编号".to_string(),
            "name" => "项目名称".to_string(),
            "type" => "项目类型".to_string(),
            "status" => "项目状态".to_string(),
            "status_time" => "状态变更时间".to_string(),
            "start_date" => "开始日期".to_string(),
            "end_date" => "结束日期".to_string(),
            "created_by" => "创建人".to_string(),
            "folder_path" => "文件夹路径".to_string(),
            _ => f.clone(),
        }
    }).collect();

    let mut csv = String::from("\u{FEFF}"); // UTF-8 BOM
    csv.push_str(&header_fields.iter().map(|f| csv_escape(f)).collect::<Vec<_>>().join(","));
    csv.push('\n');

    // 数据行
    for project in &projects {
        let row_values: Vec<String> = fields.iter().map(|f| {
            match f.as_str() {
                "number" => csv_escape(project.project_number.as_deref().unwrap_or("")),
                "name" => csv_escape(&project.name),
                "type" => csv_escape(project.project_type.as_ref()
                    .and_then(|t| type_map.get(t))
                    .map(|s| s.as_str())
                    .unwrap_or(project.project_type.as_deref().unwrap_or(""))),
                "status" => csv_escape(project.status.as_ref()
                    .and_then(|s| status_map.get(s))
                    .map(|s| s.as_str())
                    .unwrap_or(project.status.as_deref().unwrap_or(""))),
                "status_time" => csv_escape(project.status_changed_at.as_deref().unwrap_or("")),
                "start_date" => csv_escape(project.start_date.as_deref().unwrap_or("")),
                "end_date" => csv_escape(project.end_date.as_deref().unwrap_or("")),
                "created_by" => csv_escape(project.created_by.as_deref().unwrap_or("")),
                "folder_path" => csv_escape(project.folder_path.as_deref().unwrap_or("")),
                _ => csv_escape(""),
            }
        }).collect();
        csv.push_str(&row_values.join(","));
        csv.push('\n');
    }

    std::fs::write(&save_path, csv).map_err(|e| e.to_string())?;
    let _ = app.emit("project-updated", ());
    Ok(())
}

/// 递归打包目录为 zip
fn zip_dir(src_dir: &std::path::Path, dst_file: &std::path::Path) -> Result<i64, String> {
    let file = std::fs::File::create(dst_file).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Stored);

    fn add_entries(zip: &mut zip::ZipWriter<std::fs::File>, dir: &std::path::Path, base: &std::path::Path, options: zip::write::SimpleFileOptions) -> Result<(), String> {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();

                // 排除 .git、node_modules、__pycache__ 目录和以 . 开头的隐藏文件
                if path.is_dir() {
                    if file_name == ".git" || file_name == "node_modules" || file_name == "__pycache__" {
                        continue;
                    }
                    let entry_path = base.join(&file_name);
                    zip.add_directory(entry_path.to_string_lossy(), options).map_err(|e| e.to_string())?;
                    add_entries(zip, &path, &base.join(&file_name), options)?;
                } else {
                    if file_name.starts_with('.') {
                        continue;
                    }
                    let entry_path = base.join(&file_name);
                    zip.start_file(entry_path.to_string_lossy(), options).map_err(|e| e.to_string())?;
                    let mut f = std::fs::File::open(&path).map_err(|e| e.to_string())?;
                    std::io::copy(&mut f, zip).map_err(|e| e.to_string())?;
                }
            }
        }
        Ok(())
    }

    let dir_name = src_dir.file_name().unwrap_or_default().to_string_lossy().to_string();
    zip.add_directory(&dir_name, options).map_err(|e| e.to_string())?;
    add_entries(&mut zip, src_dir, std::path::Path::new(&dir_name), options)?;

    zip.finish().map_err(|e| e.to_string())?;

    let size = std::fs::metadata(dst_file)
        .map(|m| m.len() as i64)
        .unwrap_or(0);
    Ok(size)
}

/// 导出项目文件为 zip
#[tauri::command]
pub fn export_project_files(
    db: State<'_, DbConn>,
    project_id: i64,
    save_path: String,
) -> Result<i64, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let folder_path: String = conn
        .query_row(
            "SELECT folder_path FROM projects WHERE id = ?1",
            [project_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    if folder_path.is_empty() {
        return Err("项目没有关联的文件夹路径".to_string());
    }

    let src_dir = std::path::Path::new(&folder_path);
    if !src_dir.exists() {
        return Err("项目文件夹不存在".to_string());
    }

    zip_dir(src_dir, std::path::Path::new(&save_path))
}

/// CSV 字段名映射（反向：显示名→字段名）
fn csv_field_reverse(header: &str) -> Option<&str> {
    match header {
        "项目编号" => Some("number"),
        "项目名称" => Some("name"),
        "项目类型" => Some("type"),
        "项目状态" => Some("status"),
        "状态变更时间" => Some("status_time"),
        "开始日期" => Some("start_date"),
        "结束日期" => Some("end_date"),
        "创建人" => Some("created_by"),
        "文件夹路径" => Some("folder_path"),
        _ => None,
    }
}

/// 从 CSV 文件导入项目列表
#[tauri::command]
pub fn import_project_list(
    app: AppHandle,
    db: State<'_, DbConn>,
    file_path: String,
) -> Result<i64, String> {
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;

    // 去掉 UTF-8 BOM
    let content = content.strip_prefix('\u{FEFF}').unwrap_or(&content);

    let conn = db.lock().map_err(|e| e.to_string())?;

    let type_map = load_type_map(&conn);
    let status_map = load_status_map(&conn);

    conn.execute_batch("BEGIN").map_err(|e| e.to_string())?;

    let tx_result: Result<i64, String> = (|| {
        let mut lines = content.lines();
        let header_line = lines.next().ok_or("CSV 文件为空")?;

        // 解析 header，映射字段名
        let header_fields: Vec<String> = parse_csv_line(header_line);
        let field_keys: Vec<Option<&str>> = header_fields.iter()
            .map(|h| csv_field_reverse(h.as_str()))
            .collect();

        let mut count = 0i64;

        for line in lines {
            if line.trim().is_empty() {
                continue;
            }

            let values = parse_csv_line(line);
            // 字段值映射
            let mut project_number = String::new();
            let mut name = String::new();
            let mut project_type = String::new();
            let mut status = String::new();
            let mut status_changed_at = String::new();
            let mut start_date = String::new();
            let mut end_date = String::new();
            let mut created_by = String::new();
            let mut folder_path = String::new();

            for (i, val) in values.iter().enumerate() {
                if let Some(key) = field_keys.get(i).and_then(|k| *k) {
                    match key {
                        "number" => project_number = val.clone(),
                        "name" => name = val.clone(),
                        "type" => {
                            // 显示名→id 映射（反向）
                            project_type = type_map.iter()
                                .find(|(_, display)| display == &val)
                                .map(|(id, _)| id.clone())
                                .unwrap_or(val.clone());
                        }
                        "status" => {
                            status = status_map.iter()
                                .find(|(_, display)| display == &val)
                                .map(|(id, _)| id.clone())
                                .unwrap_or(val.clone());
                        }
                        "status_time" => status_changed_at = val.clone(),
                        "start_date" => start_date = val.clone(),
                        "end_date" => end_date = val.clone(),
                        "created_by" => created_by = val.clone(),
                        "folder_path" => folder_path = val.clone(),
                        _ => {}
                    }
                }
            }

            // project_number 为空则自动生成
            if project_number.is_empty() {
                project_number = generate_project_number(&conn, &project_type, &name);
            }

            let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
            let p_status = if status.is_empty() { "planning" } else { &status };

            conn.execute(
                "INSERT INTO projects (name, description, project_number, project_type, status, start_date, end_date, status_changed_at, created_by, folder_path)
                 VALUES (?1, '', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                rusqlite::params![name, project_number, project_type, p_status, start_date, end_date, if status_changed_at.is_empty() { &now } else { &status_changed_at }, created_by, folder_path],
            )
            .map_err(|e| e.to_string())?;

            let id = conn.last_insert_rowid();

            // 创建看板默认列
            conn.execute(
                "INSERT INTO kanban_columns (project_id, title, position, column_type) VALUES (?1, '待办事项', 0, 'todo_pending')",
                rusqlite::params![id],
            ).map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT INTO kanban_columns (project_id, title, position, column_type) VALUES (?1, '已完成事项', 1, 'todo_done')",
                rusqlite::params![id],
            ).map_err(|e| e.to_string())?;

            count += 1;
        }

        Ok(count)
    })();

    if tx_result.is_ok() {
        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
    } else {
        conn.execute_batch("ROLLBACK").ok();
    }

    let count = tx_result?;

    let _ = app.emit("project-updated", ());
    Ok(count)
}

/// 解析 CSV 行，支持引号包裹和转义
fn parse_csv_line(line: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(c) = chars.next() {
        if in_quotes {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    // 转义引号
                    current.push('"');
                    chars.next();
                } else {
                    // 引号结束
                    in_quotes = false;
                }
            } else {
                current.push(c);
            }
        } else {
            if c == '"' {
                in_quotes = true;
            } else if c == ',' {
                values.push(current.clone());
                current.clear();
            } else {
                current.push(c);
            }
        }
    }
    values.push(current);
    values
}