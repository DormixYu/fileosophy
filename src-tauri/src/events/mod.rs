use tauri::Emitter;
use crate::commands::notifications::NotificationPreferences;
use crate::commands::utils::get_setting;

pub const EVENT_FILE_SHARED: &str = "file-shared";
pub const EVENT_NOTIFICATION: &str = "app-notification";
pub const EVENT_PROJECT_UPDATED: &str = "project-updated";
pub const EVENT_SHARE_CONNECTED: &str = "share-connected";
pub const EVENT_SHARE_DISCONNECTED: &str = "share-disconnected";
pub const EVENT_SHARE_MEMBER_JOINED: &str = "share-member-joined";

/// 发送通知事件到前端
pub fn emit_notification(app: &tauri::AppHandle, type_: &str, title: &str, message: &str, link: Option<&str>) {
    let mut payload = serde_json::json!({
        "type": type_,
        "title": title,
        "message": message,
    });
    if let Some(l) = link {
        payload["link"] = serde_json::json!(l);
    }
    let _ = app.emit(EVENT_NOTIFICATION, payload);
}

/// 检查通知偏好后发送通知（preference_key 映射到 NotificationPreferences 的字段）
pub fn emit_notification_checked(
    app: &tauri::AppHandle,
    db: &std::sync::Mutex<rusqlite::Connection>,
    preference_key: &str,
    type_: &str,
    title: &str,
    message: &str,
    link: Option<&str>,
) {
    // 检查偏好设置
    let enabled = if let Ok(conn) = db.lock() {
        let json = get_setting(&conn, "notification_preferences");
        match json {
            Some(s) => {
                let prefs: NotificationPreferences =
                    serde_json::from_str(&s).unwrap_or_default();
                match preference_key {
                    "project_created" => prefs.project_created,
                    "project_deleted" => prefs.project_deleted,
                    "project_status_changed" => prefs.project_status_changed,
                    "card_created" => prefs.card_created,
                    "card_moved" => prefs.card_moved,
                    "file_uploaded" => prefs.file_uploaded,
                    "file_deleted" => prefs.file_deleted,
                    "file_received" => prefs.file_received,
                    "share_started" => prefs.share_started,
                    "share_stopped" => prefs.share_stopped,
                    _ => true,
                }
            }
            None => true, // 无偏好设置时默认启用
        }
    } else {
        true // 锁获取失败时默认发送
    };

    if enabled {
        emit_notification(app, type_, title, message, link);
    }
}
