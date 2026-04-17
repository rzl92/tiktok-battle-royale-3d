use serde_json::{json, Value};
use std::{fs, path::PathBuf};
use tauri::Manager;

#[tauri::command]
fn load_store(app: tauri::AppHandle) -> Result<Value, String> {
    let path = store_path(&app)?;
    if !path.exists() {
        return Ok(default_store());
    }
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&text).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_store(app: tauri::AppHandle, store: Value) -> Result<(), String> {
    let path = store_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let text = serde_json::to_string_pretty(&store).map_err(|error| error.to_string())?;
    fs::write(path, text).map_err(|error| error.to_string())
}

fn store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    dir.push("store.json");
    Ok(dir)
}

fn default_store() -> Value {
    json!({
        "settings": {
            "backendUrl": "http://127.0.0.1:7860",
            "timerEnabled": false,
            "timerMinutes": 3,
            "resetCountdown": 8
        },
        "leaderboard": {}
    })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_store, save_store])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
