use serde::{Deserialize, Serialize};
use serialport::{available_ports, DataBits, FlowControl, Parity, SerialPortType, StopBits};
use std::io::Write;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct SerialPortInfo {
    pub port_name: String,
    pub port_type: String,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SerialPrintOptions {
    pub port_name: String,
    pub baud_rate: u32,
    pub flow_control: Option<String>,
}

#[tauri::command]
pub fn list_serial_ports() -> Result<Vec<SerialPortInfo>, String> {
    match available_ports() {
        Ok(ports) => {
            let list = ports
                .into_iter()
                .map(|p| {
                    let (port_type, manufacturer, product) = match p.port_type {
                        SerialPortType::UsbPort(info) => (
                            "USB".to_string(),
                            info.manufacturer,
                            info.product,
                        ),
                        SerialPortType::PciPort => ("PCI".to_string(), None, None),
                        SerialPortType::BluetoothPort => ("Bluetooth".to_string(), None, None),
                        SerialPortType::Unknown => ("Native/Unknown".to_string(), None, None),
                    };

                    SerialPortInfo {
                        port_name: p.port_name,
                        port_type,
                        manufacturer,
                        product,
                    }
                })
                .collect();
            Ok(list)
        }
        Err(e) => Err(format!("Failed to list serial ports: {}", e)),
    }
}

#[tauri::command]
pub async fn send_raw_serial(
    options: SerialPrintOptions,
    data: Vec<u8>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let flow = match options.flow_control.as_deref() {
            Some("SOFTWARE") => FlowControl::Software,
            Some("HARDWARE") => FlowControl::Hardware,
            _ => FlowControl::None,
        };

        let mut port = serialport::new(&options.port_name, options.baud_rate)
            .data_bits(DataBits::Eight)
            .parity(Parity::None)
            .stop_bits(StopBits::One)
            .flow_control(flow)
            .timeout(Duration::from_millis(3000))
            .open()
            .map_err(|e| format!("Failed to open serial port {}: {}", options.port_name, e))?;

        port.write_all(&data)
            .map_err(|e| format!("Error writing to serial port {}: {}", options.port_name, e))?;

        port.flush()
            .map_err(|e| format!("Error flushing serial port {}: {}", options.port_name, e))?;

        Ok(format!(
            "Successfully transmitted {} bytes to {} at {} baud",
            data.len(),
            options.port_name,
            options.baud_rate
        ))
    })
    .await
    .map_err(|e| format!("Serial dispatch task panicked: {}", e))?
}
