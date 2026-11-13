#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// KarWand POS Launcher — Tauri 2 harness.
// Startup errors are NEVER silent: every stage and every panic is appended to
// %LOCALAPPDATA%\KarWand\launcher-crash.log before the process dies.

mod config;
mod printer;
mod serial;

use config::{get_initial_venue_config, load_venue_config};
use printer::send_raw_escpos;
use serial::{list_serial_ports, send_raw_serial};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

fn crash_log_path() -> PathBuf {
    // Primary: next to the exe ({app} is per-user writable); fallback: %LOCALAPPDATA%\KarWand
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(PathBuf::from));
    if let Some(dir) = exe_dir {
        return dir.join("launcher-crash.log");
    }
    let base = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    base.join("KarWand").join("launcher-crash.log")
}

fn append_log(stage: &str, detail: &str) {
    let path = LOG_PATH.get_or_init(crash_log_path);
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let line = format!("[{ts}] {stage} - {detail}");
    // Mirror to stderr — visible whenever the launcher runs with redirected pipes.
    eprintln!("{line}");
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{line}");
    }
}

fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let msg = if let Some(s) = info.payload().downcast_ref::<&str>() {
            (*s).to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "unknown panic payload".to_string()
        };
        let loc = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "<unknown location>".to_string());
        let bt = std::backtrace::Backtrace::force_capture().to_string();
        append_log("PANIC", &format!("{msg} @ {loc}\nbacktrace:\n{bt}"));
    }));
}

fn main() {
    install_panic_hook();
    append_log("START", &format!(
        "launcher v{} | exe={:?} | cwd={:?}",
        env!("CARGO_PKG_VERSION"),
        std::env::current_exe().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
        std::env::current_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_default()
    ));

    let args: Vec<String> = std::env::args().collect();
    let is_kiosk_requested = args.iter().any(|arg| arg == "--kiosk" || arg == "-k");

    let app_result = tauri::Builder::default()
        .setup(move |app| {
            append_log("SETUP", "entered");
            let handle = app.handle();
            let venue_config = load_venue_config(&handle);
            append_log(
                "SETUP",
                &format!("venue tenant={} (config file optional, defaults applied)", venue_config.tenant_id),
            );

            app.manage(venue_config.clone());

            let start_url = format!("index.html?tenant={}", venue_config.tenant_id);
            append_log("SETUP", &format!("start_url={start_url}"));

            let mut window_builder = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::App(start_url.into()),
            )
            .title("KarWand POS Terminal")
            .inner_size(1280.0, 800.0)
            .min_inner_size(1024.0, 768.0)
            .center();

            if is_kiosk_requested {
                window_builder = window_builder
                    .fullscreen(true)
                    .resizable(false)
                    .decorations(false);
            }

            match window_builder.build() {
                Ok(_window) => {
                    append_log("SETUP", "main window + webview created successfully");
                    Ok(())
                }
                Err(e) => {
                    append_log("SETUP_ERROR", &format!("window/webview build failed: {e}"));
                    Err(Box::new(e))
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_venue_config,
            send_raw_escpos,
            list_serial_ports,
            send_raw_serial
        ])
        .build(tauri::generate_context!());

    match app_result {
        Ok(app) => {
            append_log("RUN", "event loop starting");
            app.run(|_app_handle, event| {
                if let tauri::RunEvent::Exit = event {
                    append_log("RUN", "event loop exited cleanly");
                }
            });
            append_log("RUN", "event loop finished");
        }
        Err(e) => {
            append_log("BUILD_ERROR", &format!("tauri app build failed: {e}"));
        }
    }

    append_log("EXIT", "process terminating");
}
