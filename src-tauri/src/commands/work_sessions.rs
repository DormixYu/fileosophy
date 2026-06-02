use crate::db::models::WorkSession;
use crate::db::DbConn;
use tauri::State;

const SESSION_COLUMNS: &str =
    "id, project_id, name, open_files, active_tab, active_kanban_card_id, scroll_positions, created_at, updated_at";

fn row_to_session(row: &rusqlite::Row) -> rusqlite::Result<WorkSession> {
    Ok(WorkSession {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        open_files: row.get(3)?,
        active_tab: row.get(4)?,
        active_kanban_card_id: row.get(5)?,
        scroll_positions: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

#[tauri::command]
pub fn save_work_session(
    db: State<'_, DbConn>,
    project_id: i64,
    name: Option<String>,
    open_files: String,
    active_tab: String,
    active_kanban_card_id: Option<i64>,
    scroll_positions: Option<String>,
) -> Result<WorkSession, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let session_name = name.unwrap_or_else(|| {
        let now = chrono::Local::now();
        format!("会话 {}", now.format("%m-%d %H:%M"))
    });

    conn.execute(
        "INSERT INTO work_sessions (project_id, name, open_files, active_tab, active_kanban_card_id, scroll_positions)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![project_id, session_name, open_files, active_tab, active_kanban_card_id, scroll_positions],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        &format!("SELECT {SESSION_COLUMNS} FROM work_sessions WHERE id = ?1"),
        [id],
        row_to_session,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_work_sessions(
    db: State<'_, DbConn>,
    project_id: i64,
) -> Result<Vec<WorkSession>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {SESSION_COLUMNS} FROM work_sessions WHERE project_id = ?1 ORDER BY updated_at DESC"
        ))
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([project_id], row_to_session)
        .map_err(|e| e.to_string())?;

    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row.map_err(|e| e.to_string())?);
    }
    Ok(sessions)
}

#[tauri::command]
pub fn restore_work_session(
    db: State<'_, DbConn>,
    session_id: i64,
) -> Result<WorkSession, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // 更新 updated_at 时间戳
    conn.execute(
        "UPDATE work_sessions SET updated_at = datetime('now') WHERE id = ?1",
        [session_id],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        &format!("SELECT {SESSION_COLUMNS} FROM work_sessions WHERE id = ?1"),
        [session_id],
        row_to_session,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_work_session(db: State<'_, DbConn>, session_id: i64) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM work_sessions WHERE id = ?1", [session_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
