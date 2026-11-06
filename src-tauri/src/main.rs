#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod printer;
mod serial;

use config::{get_initial_venue_config, load_venue_config};
use printer::send_raw_escpos;
use serial::{list_serial_ports, send_raw_serial};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let is_kiosk_requested = args.iter().any(|arg| arg == "--kiosk" || arg == "-k");

    tauri::Builder::default()
        .setup(move |app| {
            let handle = app.handle();
            let venue_config = load_venue_config(&handle);

            app.manage(venue_config.clone());

            let start_url = format!("index.html?tenant={}", venue_config.tenant_id);

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

            let _window = window_builder.build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_venue_config,
            send_raw_escpos,
            list_serial_ports,
            send_raw_serial
        ])
        .run(tauri::generate_context!())
        .expect("Fatal error while starting KarWand POS Launcher");
}
