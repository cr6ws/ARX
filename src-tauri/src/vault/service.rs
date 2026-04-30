use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use uuid::Uuid;

use crate::vault::crypto;
use crate::vault::storage;
use crate::vault::types::{
    VaultBackup, VaultData, VaultEntry, VaultEntryInput, VaultEntrySummary, VaultFile, VaultSession,
};

const VAULT_VERSION: u8 = 1;

pub fn init_vault(
    session: &mut VaultSession,
    master_password: &str,
    hint: Option<String>,
) -> Result<String, String> {
    if storage::vault_exists()? {
        return Err("Vault already exists.".to_string());
    }

    // 1. Generate Master Key (The key that encrypts data)
    let master_key = crypto::generate_master_key();

    // 2. Wrap Master Key with Password
    let password_salt = crypto::generate_salt();
    let password_wrapper_key = crypto::derive_key(master_password, &password_salt)?;
    let (wrapped_key, password_nonce) = crypto::encrypt_key(&password_wrapper_key, &master_key)?;

    // 3. Wrap Master Key with Recovery Key
    let recovery_key = Uuid::new_v4().to_string().to_uppercase();
    let recovery_salt = crypto::generate_salt();
    let recovery_wrapper_key = crypto::derive_key(&recovery_key, &recovery_salt)?;
    let (recovery_wrapped_key, recovery_nonce) =
        crypto::encrypt_key(&recovery_wrapper_key, &master_key)?;

    // 4. Encrypt empty data with Master Key
    let data = VaultData::empty();
    let (ciphertext, data_nonce) = crypto::encrypt_vault(&master_key, &data)?;

    let file = VaultFile {
        version: VAULT_VERSION,
        salt_b64: STANDARD.encode(password_salt),
        wrapped_key_b64: STANDARD.encode(wrapped_key),
        nonce_b64: STANDARD.encode(password_nonce),
        ciphertext_b64: STANDARD.encode(ciphertext),
        data_nonce_b64: STANDARD.encode(data_nonce),
        hint_b64: hint.as_ref().map(|h| STANDARD.encode(h)),
        recovery_salt_b64: STANDARD.encode(recovery_salt),
        recovery_wrapped_key_b64: STANDARD.encode(recovery_wrapped_key),
        recovery_nonce_b64: STANDARD.encode(recovery_nonce),
    };

    let path = storage::vault_path()?;
    storage::write_vault_file(&path, &file)?;

    session.clear();
    session.unlocked = true;
    session.key = Some(master_key.to_vec());
    session.salt = Some(password_salt.to_vec());
    session.vault_data = data;
    session.vault_path = Some(path);
    session.hint = hint;

    Ok(recovery_key)
}

pub fn unlock_vault(session: &mut VaultSession, master_password: &str) -> Result<(), String> {
    let path = storage::vault_path()?;
    if !path.exists() {
        return Err("Vault not found. Create a vault first.".to_string());
    }
    let file = storage::read_vault_file(&path)?;

    // 1. Derive password wrapper key
    let salt = STANDARD
        .decode(&file.salt_b64)
        .map_err(|_| "Vault salt is invalid.".to_string())?;
    let wrapper_key = crypto::derive_key(master_password, &salt)?;

    // 2. Unwrap master key
    let nonce = STANDARD
        .decode(&file.nonce_b64)
        .map_err(|_| "Vault nonce is invalid.".to_string())?;
    let wrapped_key = STANDARD
        .decode(&file.wrapped_key_b64)
        .map_err(|_| "Wrapped key is invalid.".to_string())?;
    let master_key = crypto::decrypt_key(&wrapper_key, &nonce, &wrapped_key)?;

    // 3. Decrypt data with master key
    let data_nonce = STANDARD
        .decode(&file.data_nonce_b64)
        .map_err(|_| "Data nonce is invalid.".to_string())?;
    let ciphertext = STANDARD
        .decode(&file.ciphertext_b64)
        .map_err(|_| "Vault data is invalid.".to_string())?;
    let data = crypto::decrypt_vault(&master_key, &data_nonce, &ciphertext)?;

    let hint = file.hint_b64.and_then(|h| {
        STANDARD.decode(h).ok().and_then(|b| String::from_utf8(b).ok())
    });

    session.clear();
    session.unlocked = true;
    session.key = Some(master_key);
    session.salt = Some(salt);
    session.vault_data = data;
    session.vault_path = Some(path);
    session.hint = hint;
    Ok(())
}

pub fn add_entry(
    session: &mut VaultSession,
    input: VaultEntryInput,
) -> Result<VaultEntrySummary, String> {
    let now = now_epoch();
    let entry = VaultEntry {
        id: Uuid::new_v4().to_string(),
        label: input.label,
        username: input.username,
        password: input.password,
        url: input.url,
        notes: input.notes,
        tags: input.tags,
        created_at: now,
        updated_at: now,
    };
    session.vault_data.entries.push(entry.clone());
    save_session(session)?;
    Ok(VaultEntrySummary::from_entry(&entry))
}

pub fn list_entries(session: &VaultSession) -> Result<Vec<VaultEntrySummary>, String> {
    let mut items: Vec<VaultEntrySummary> = session
        .vault_data
        .entries
        .iter()
        .map(VaultEntrySummary::from_entry)
        .collect();
    items.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(items)
}

pub fn get_password(session: &VaultSession, id: &str) -> Result<String, String> {
    let entry = session
        .vault_data
        .entries
        .iter()
        .find(|entry| entry.id == id)
        .ok_or_else(|| "Entry not found.".to_string())?;
    Ok(entry.password.clone())
}

pub fn get_entry(session: &VaultSession, id: &str) -> Result<VaultEntry, String> {
    session
        .vault_data
        .entries
        .iter()
        .find(|entry| entry.id == id)
        .cloned()
        .ok_or_else(|| "Entry not found.".to_string())
}

pub fn delete_entry(session: &mut VaultSession, id: &str) -> Result<(), String> {
    let before = session.vault_data.entries.len();
    session.vault_data.entries.retain(|entry| entry.id != id);
    if session.vault_data.entries.len() == before {
        return Err("Entry not found.".to_string());
    }
    save_session(session)
}

pub fn update_entry(
    session: &mut VaultSession,
    id: &str,
    input: VaultEntryInput,
) -> Result<VaultEntrySummary, String> {
    let updated_entry = session
        .vault_data
        .entries
        .iter_mut()
        .find(|entry| entry.id == id)
        .ok_or_else(|| "Entry not found.".to_string())?;

    updated_entry.label = input.label;
    updated_entry.username = input.username;
    updated_entry.password = input.password;
    updated_entry.url = input.url;
    updated_entry.notes = input.notes;
    updated_entry.tags = input.tags;
    updated_entry.updated_at = now_epoch();

    let entry = updated_entry.clone();

    save_session(session)?;
    Ok(VaultEntrySummary::from_entry(&entry))
}

pub fn export_backup(session: &VaultSession) -> Result<VaultBackup, String> {
    let path = session
        .vault_path
        .as_ref()
        .ok_or_else(|| "Vault path is missing.".to_string())?;
    let file = storage::read_vault_file(path)?;
    Ok(VaultBackup { vault_file: file })
}

pub fn import_backup(session: &mut VaultSession, backup: VaultBackup) -> Result<(), String> {
    let path = storage::vault_path()?;
    storage::write_vault_file(&path, &backup.vault_file)?;
    session.clear();
    session.vault_path = Some(path);
    Ok(())
}

pub fn change_master_password(session: &mut VaultSession, new_password: &str) -> Result<(), String> {
    let master_key = session
        .key
        .as_ref()
        .ok_or_else(|| "Vault is locked.".to_string())?;
    let path = session
        .vault_path
        .as_ref()
        .ok_or_else(|| "Vault path is missing.".to_string())?;

    // 1. Generate new password wrapper
    let password_salt = crypto::generate_salt();
    let password_wrapper_key = crypto::derive_key(new_password, &password_salt)?;
    let (wrapped_key, password_nonce) = crypto::encrypt_key(&password_wrapper_key, master_key)?;

    // 2. Update vault file
    let mut file = storage::read_vault_file(path)?;
    file.salt_b64 = STANDARD.encode(password_salt);
    file.wrapped_key_b64 = STANDARD.encode(wrapped_key);
    file.nonce_b64 = STANDARD.encode(password_nonce);

    storage::write_vault_file(path, &file)?;

    // 3. Update session salt (the one used for password wrapping)
    session.salt = Some(password_salt.to_vec());

    Ok(())
}

pub fn recover_vault(session: &mut VaultSession, recovery_key: &str) -> Result<(), String> {
    let path = storage::vault_path()?;
    if !path.exists() {
        return Err("Vault not found.".to_string());
    }
    let file = storage::read_vault_file(&path)?;

    // 1. Derive recovery wrapper key
    let salt = STANDARD
        .decode(&file.recovery_salt_b64)
        .map_err(|_| "Recovery salt is invalid.".to_string())?;
    let wrapper_key = crypto::derive_key(recovery_key, &salt)?;

    // 2. Unwrap master key
    let nonce = STANDARD
        .decode(&file.recovery_nonce_b64)
        .map_err(|_| "Recovery nonce is invalid.".to_string())?;
    let wrapped_key = STANDARD
        .decode(&file.recovery_wrapped_key_b64)
        .map_err(|_| "Recovery wrapped key is invalid.".to_string())?;
    let master_key = crypto::decrypt_key(&wrapper_key, &nonce, &wrapped_key)?;

    // 3. Decrypt data with master key
    let data_nonce = STANDARD
        .decode(&file.data_nonce_b64)
        .map_err(|_| "Data nonce is invalid.".to_string())?;
    let ciphertext = STANDARD
        .decode(&file.ciphertext_b64)
        .map_err(|_| "Vault data is invalid.".to_string())?;
    let data = crypto::decrypt_vault(&master_key, &data_nonce, &ciphertext)?;

    let hint = file.hint_b64.and_then(|h| {
        STANDARD.decode(h).ok().and_then(|b| String::from_utf8(b).ok())
    });

    session.clear();
    session.unlocked = true;
    session.key = Some(master_key);
    session.salt = Some(salt);
    session.vault_data = data;
    session.vault_path = Some(path);
    session.hint = hint;
    Ok(())
}

fn save_session(session: &VaultSession) -> Result<(), String> {
    let master_key = session
        .key
        .as_ref()
        .ok_or_else(|| "Vault is locked.".to_string())?;
    let path = session
        .vault_path
        .as_ref()
        .ok_or_else(|| "Vault path is missing.".to_string())?;

    // We need to re-read the file to preserve password and recovery wrapper keys
    let mut file = storage::read_vault_file(path)?;

    // Encrypt data with Master Key
    let (ciphertext, data_nonce) = crypto::encrypt_vault(master_key, &session.vault_data)?;

    file.ciphertext_b64 = STANDARD.encode(ciphertext);
    file.data_nonce_b64 = STANDARD.encode(data_nonce);

    storage::write_vault_file(path, &file)
}

fn now_epoch() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}
