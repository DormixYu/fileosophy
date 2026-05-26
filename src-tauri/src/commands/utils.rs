/// 获取本机主机名
pub fn get_hostname() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "Fileosophy".to_string())
}

/// 从 settings 表读取值
pub fn get_setting(conn: &rusqlite::Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        [key],
        |row| row.get::<_, String>(0),
    )
    .ok()
}

/// 向 settings 表写入值
pub fn set_setting(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// hex 编码辅助
pub fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// hex 解码辅助
pub fn hex_decode(hex: &str) -> Option<Vec<u8>> {
    if hex.len() % 2 != 0 {
        return None;
    }
    let mut bytes = Vec::with_capacity(hex.len() / 2);
    for i in (0..hex.len()).step_by(2) {
        let byte = u8::from_str_radix(&hex[i..i + 2], 16).ok()?;
        bytes.push(byte);
    }
    Some(bytes)
}

/// 密码混淆密钥（简单 XOR 混淆，防止明文存储）
const OBFUSCATION_KEY: &[u8] = b"Fileosophy2026Secure";

/// 对密码进行简单混淆编码（存储到数据库时使用）
pub fn encode_password(password: &str) -> String {
    let encoded: Vec<u8> = password
        .bytes()
        .enumerate()
        .map(|(i, b)| b ^ OBFUSCATION_KEY[i % OBFUSCATION_KEY.len()])
        .collect();
    format!("enc:{}", hex_encode(&encoded))
}

/// 对混淆编码的密码进行解码（从数据库读取时使用）
pub fn decode_password(encoded: &str) -> String {
    // 兼容旧版明文密码
    let hex_str = match encoded.strip_prefix("enc:") {
        Some(h) => h,
        None => return encoded.to_string(),
    };
    let bytes = match hex_decode(hex_str) {
        Some(b) => b,
        None => return encoded.to_string(),
    };
    let decoded: Vec<u8> = bytes
        .iter()
        .enumerate()
        .map(|(i, &b)| b ^ OBFUSCATION_KEY[i % OBFUSCATION_KEY.len()])
        .collect();
    String::from_utf8_lossy(&decoded).to_string()
}

/// TCP 帧协议常量：最大帧大小
pub const MAX_FRAME_SIZE: usize = 10 * 1024 * 1024;

/// TCP 帧协议：读取 JSON 帧
pub fn read_json_frame<T: serde::de::DeserializeOwned>(stream: &mut std::net::TcpStream) -> Result<T, String> {
    use std::io::Read;

    let mut len_buf = [0u8; 4];
    stream
        .read_exact(&mut len_buf)
        .map_err(|e| format!("读取帧长度失败: {e}"))?;
    let frame_len = u32::from_be_bytes(len_buf) as usize;
    if frame_len > MAX_FRAME_SIZE {
        return Err(format!("帧大小超限: {frame_len} > {MAX_FRAME_SIZE}"));
    }

    let mut frame_buf = vec![0u8; frame_len];
    stream
        .read_exact(&mut frame_buf)
        .map_err(|e| format!("读取帧数据失败: {e}"))?;

    serde_json::from_slice(&frame_buf).map_err(|e| format!("解析帧数据失败: {e}"))
}

/// TCP 帧协议：发送 JSON 帧
pub fn send_json_frame(stream: &mut std::net::TcpStream, data: &impl serde::Serialize) -> Result<(), String> {
    use std::io::Write;

    let json_bytes = serde_json::to_vec(data).map_err(|e| format!("序列化失败: {e}"))?;
    let len_bytes = (json_bytes.len() as u32).to_be_bytes();
    stream
        .write_all(&len_bytes)
        .map_err(|e| format!("发送帧长度失败: {e}"))?;
    stream
        .write_all(&json_bytes)
        .map_err(|e| format!("发送帧数据失败: {e}"))?;
    Ok(())
}

/// 设置 TCP 流超时
pub fn set_stream_timeout(stream: &mut std::net::TcpStream, timeout: std::time::Duration) -> Result<(), String> {
    stream.set_read_timeout(Some(timeout)).map_err(|e| format!("设置读超时失败: {e}"))?;
    stream.set_write_timeout(Some(timeout)).map_err(|e| format!("设置写超时失败: {e}"))?;
    Ok(())
}

/// 检查路径是否安全（不含 shell 元字符和控制字符，防止命令注入）
pub fn check_path_safe(path: &str) -> Result<(), String> {
    if path.contains('&') || path.contains('|') || path.contains(';')
        || path.contains('^') || path.contains('%') || path.contains('<')
        || path.contains('>') || path.contains('!') || path.contains('"')
        || path.contains('\'') || path.contains('`') || path.contains('$')
        || path.contains('\n') || path.contains('\r')
    {
        return Err("路径包含非法字符".to_string());
    }
    Ok(())
}