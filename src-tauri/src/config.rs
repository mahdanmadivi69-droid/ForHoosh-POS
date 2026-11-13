use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum PrinterConnectionType {
    Lan,
    Serial,
}

impl Default for PrinterConnectionType {
    fn default() -> Self {
        PrinterConnectionType::Lan
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PrinterConfig {
    #[serde(default)]
    #[serde(rename = "connectionType")]
    pub connection_type: PrinterConnectionType,

    #[serde(default = "default_lan_host")]
    pub host: String,
    #[serde(default = "default_lan_port")]
    pub port: u16,

    #[serde(rename = "serialPort")]
    pub serial_port: Option<String>,
    #[serde(default = "default_baud_rate")]
    #[serde(rename = "baudRate")]
    pub baud_rate: u32,
    #[serde(rename = "flowControl")]
    pub flow_control: Option<String>,

    #[serde(default = "default_paper_width")]
    #[serde(rename = "paperWidth")]
    pub paper_width: String,
}

fn default_lan_host() -> String { "192.168.1.200".into() }
fn default_lan_port() -> u16 { 9100 }
fn default_baud_rate() -> u32 { 9600 }
fn default_paper_width() -> String { "80mm".into() }

impl Default for PrinterConfig {
    fn default() -> Self {
        Self {
            connection_type: PrinterConnectionType::Lan,
            host: default_lan_host(),
            port: default_lan_port(),
            serial_port: Some("COM1".into()),
            baud_rate: default_baud_rate(),
            flow_control: Some("NONE".into()),
            paper_width: default_paper_width(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct HardwareProfile {
    #[serde(rename = "cashierPrinter")]
    pub cashier_printer: PrinterConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct OfflineEngineConfig {
    #[serde(rename = "indexedDbPrefix")]
    pub indexed_db_prefix: String,
    #[serde(rename = "syncIntervalMs")]
    pub sync_interval_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VenueConfig {
    #[serde(rename = "tenantId")]
    pub tenant_id: String,
    #[serde(default)]
    #[serde(rename = "hardwareProfile")]
    pub hardware_profile: HardwareProfile,
    #[serde(default)]
    #[serde(rename = "offlineEngine")]
    pub offline_engine: OfflineEngineConfig,
    /// Accepts both numeric epochs and the installer's ISO-like timestamp string.
    #[serde(default)]
    #[serde(rename = "installedAt")]
    pub installed_at: Option<serde_json::Value>,
}

impl Default for VenueConfig {
    fn default() -> Self {
        Self {
            tenant_id: "100hich".into(),
            hardware_profile: HardwareProfile {
                cashier_printer: PrinterConfig::default(),
            },
            offline_engine: OfflineEngineConfig {
                indexed_db_prefix: "CafeOS_100hich_DB".into(),
                sync_interval_ms: 30000,
            },
            installed_at: None,
        }
    }
}

pub fn load_venue_config(_app_handle: &tauri::AppHandle) -> VenueConfig {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("."));

    let config_path = exe_dir.join("venue-config.json");

    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(parsed) = serde_json::from_str::<VenueConfig>(&content) {
                return parsed;
            }
        }
    }

    VenueConfig::default()
}

#[tauri::command]
pub fn get_initial_venue_config(state: tauri::State<VenueConfig>) -> VenueConfig {
    state.inner().clone()
}
