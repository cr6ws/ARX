mod vault;

use std::sync::Mutex;

use tauri::State;

use vault::security;
use vault::service;
use vault::storage;
use vault::types::{VaultBackup, VaultEntry, VaultEntryInput, VaultEntrySummary, VaultSession, VaultStatus};

pub struct AppState {
    session: Mutex<VaultSession>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            session: Mutex::new(VaultSession::new()),
        }
    }
}

#[tauri::command]
fn vault_status(state: State<AppState>) -> Result<VaultStatus, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;

    let path = storage::vault_path()?;
    let mut hint = None;
    if path.exists() {
        if let Ok(file) = storage::read_vault_file(&path) {
            hint = file.hint_b64.and_then(|h| {
                use base64::engine::general_purpose::STANDARD;
                use base64::Engine as _;
                STANDARD.decode(h).ok().and_then(|b| String::from_utf8(b).ok())
            });
        }
    }

    Ok(VaultStatus {
        has_vault: path.exists(),
        is_unlocked: session.unlocked,
        hint,
    })
}

#[tauri::command]
fn init_vault(
    master_password: String,
    hint: Option<String>,
    state: State<AppState>,
) -> Result<String, String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    service::init_vault(&mut session, &master_password, hint)
}

#[tauri::command]
fn unlock_vault(master_password: String, state: State<AppState>) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    service::unlock_vault(&mut session, &master_password)
}

#[tauri::command]
fn lock_vault(state: State<AppState>) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    session.clear();
    Ok(())
}

#[tauri::command]
fn reset_vault(state: State<AppState>) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    session.clear();
    storage::delete_vault_file()?;
    Ok(())
}

#[tauri::command]
fn add_password(entry: VaultEntryInput, state: State<AppState>) -> Result<VaultEntrySummary, String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    let normalized = security::normalize_entry_input(&entry);
    security::validate_entry_input(&normalized)?;
    service::add_entry(&mut session, normalized)
}

#[tauri::command]
fn update_password(
    id: String,
    entry: VaultEntryInput,
    state: State<AppState>,
) -> Result<VaultEntrySummary, String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    let normalized = security::normalize_entry_input(&entry);
    security::validate_entry_input(&normalized)?;
    service::update_entry(&mut session, &id, normalized)
}

#[tauri::command]
fn get_passwords(state: State<AppState>) -> Result<Vec<VaultEntrySummary>, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    service::list_entries(&session)
}

#[tauri::command]
fn get_password(id: String, state: State<AppState>) -> Result<String, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    service::get_password(&session, &id)
}

#[tauri::command]
fn get_entry(id: String, state: State<AppState>) -> Result<VaultEntry, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    service::get_entry(&session, &id)
}

#[tauri::command]
fn delete_password(id: String, state: State<AppState>) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    service::delete_entry(&mut session, &id)
}

#[tauri::command]
fn export_vault(state: State<AppState>) -> Result<VaultBackup, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    service::export_backup(&session)
}

#[tauri::command]
fn import_vault(backup: VaultBackup, state: State<AppState>) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    service::import_backup(&mut session, backup)
}

#[tauri::command]
fn change_master_password(new_password: String, state: State<AppState>) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    service::change_master_password(&mut session, &new_password)
}

#[tauri::command]
fn recover_vault(recovery_key: String, state: State<AppState>) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    service::recover_vault(&mut session, &recovery_key)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            vault_status,
            init_vault,
            unlock_vault,
            lock_vault,
            reset_vault,
            add_password,
            update_password,
            get_passwords,
            get_password,
            get_entry,
            delete_password,
            export_vault,
            import_vault,
            change_master_password,
            recover_vault,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
