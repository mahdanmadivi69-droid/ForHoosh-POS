use std::io::Write;
use std::net::TcpStream;
use std::time::Duration;

#[tauri::command]
pub async fn send_raw_escpos(host: String, port: u16, data: Vec<u8>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let addr = format!("{}:{}", host, port);
        let mut stream = TcpStream::connect_timeout(
            &addr.parse().map_err(|e| format!("Invalid address: {}", e))?,
            Duration::from_secs(3),
        )
        .map_err(|e| format!("TCP connection to {} failed: {}", addr, e))?;

        stream
            .write_all(&data)
            .map_err(|e| format!("Failed to write bytes: {}", e))?;

        stream.flush().map_err(|e| format!("Failed to flush: {}", e))?;

        Ok(format!("Dispatched {} bytes to {}", data.len(), addr))
    })
    .await
    .map_err(|e| format!("TCP task error: {}", e))?
}
