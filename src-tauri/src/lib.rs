mod vault;

use std::sync::Mutex;

use tauri::State;

use vault::security;
use vault::service;
use vault::storage;
use vault::types::{VaultBackup, VaultEntry, VaultEntryInput, VaultEntrySummary, VaultSession, VaultStatus};

pub struct AppState {
    session: Mutex<VaultSession>,
    login_attempts: Mutex<LoginAttempts>,
}

struct LoginAttempts {
    count: u32,
    last_failure: Option<std::time::Instant>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            session: Mutex::new(VaultSession::new()),
            login_attempts: Mutex::new(LoginAttempts {
                count: 0,
                last_failure: None,
            }),
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
async fn unlock_vault(master_password: String, state: State<'_, AppState>) -> Result<(), String> {
    // 1. Check for brute force lock
    {
        let attempts = state.login_attempts.lock().map_err(|_| "State lock poisoned.")?;
        if let Some(last) = attempts.last_failure {
            let elapsed = last.elapsed().as_secs();
            // Exponential backoff: 2^(count-1) seconds, starting after 3 attempts
            if attempts.count >= 3 {
                let wait_secs = 2u64.pow(attempts.count - 3).min(3600); // Max 1 hour
                if elapsed < wait_secs {
                    return Err(format!("Too many failed attempts. Please wait {} more seconds.", wait_secs - elapsed));
                }
            }
        }
    }

    let result = {
        let mut session = state.session.lock().map_err(|_| "State lock poisoned.")?;
        service::unlock_vault(&mut session, &master_password)
    };

    match result {
        Ok(_) => {
            // Reset attempts on success
            let mut attempts = state.login_attempts.lock().map_err(|_| "State lock poisoned.")?;
            attempts.count = 0;
            attempts.last_failure = None;
            
            let mut session = state.session.lock().map_err(|_| "State lock poisoned.")?;
            let _ = service::cleanup_trash(&mut session);
            Ok(())
        }
        Err(e) => {
            // Increment attempts on failure
            {
                let mut attempts = state.login_attempts.lock().map_err(|_| "State lock poisoned.")?;
                attempts.count += 1;
                attempts.last_failure = Some(std::time::Instant::now());
            }
            
            // Artificial delay to prevent timing attacks
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            
            Err(e)
        }
    }
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
fn get_audit_stats(state: State<AppState>) -> Result<crate::vault::types::AuditStats, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    service::get_audit_stats(&session)
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
fn get_totp_code(id: String, state: State<AppState>) -> Result<(String, u64), String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    service::get_totp_code(&session, &id)
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
fn get_trash_passwords(state: State<AppState>) -> Result<Vec<VaultEntrySummary>, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    service::list_trash_entries(&session)
}

#[tauri::command]
fn restore_password(id: String, state: State<AppState>) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    service::restore_entry(&mut session, &id)
}

#[tauri::command]
fn permanently_delete_password(id: String, state: State<AppState>) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    service::permanently_delete_entry(&mut session, &id)
}

#[tauri::command]
fn regenerate_recovery_key(state: State<AppState>) -> Result<String, String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "State lock poisoned.".to_string())?;
    security::ensure_unlocked(&session)?;
    service::regenerate_recovery_key(&mut session)
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
async fn recover_vault(recovery_key: String, state: State<'_, AppState>) -> Result<(), String> {
    // 1. Check for brute force lock
    {
        let attempts = state.login_attempts.lock().map_err(|_| "State lock poisoned.")?;
        if let Some(last) = attempts.last_failure {
            let elapsed = last.elapsed().as_secs();
            if attempts.count >= 3 {
                let wait_secs = 2u64.pow(attempts.count - 3).min(3600);
                if elapsed < wait_secs {
                    return Err(format!("Too many failed attempts. Please wait {} more seconds.", wait_secs - elapsed));
                }
            }
        }
    }

    let result = {
        let mut session = state.session.lock().map_err(|_| "State lock poisoned.")?;
        service::recover_vault(&mut session, &recovery_key)
    };

    match result {
        Ok(_) => {
            let mut attempts = state.login_attempts.lock().map_err(|_| "State lock poisoned.")?;
            attempts.count = 0;
            attempts.last_failure = None;
            Ok(())
        }
        Err(e) => {
            {
                let mut attempts = state.login_attempts.lock().map_err(|_| "State lock poisoned.")?;
                attempts.count += 1;
                attempts.last_failure = Some(std::time::Instant::now());
            }
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            Err(e)
        }
    }
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
            get_audit_stats,
            get_trash_passwords,
            restore_password,
            permanently_delete_password,
            regenerate_recovery_key,
            get_totp_code,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
