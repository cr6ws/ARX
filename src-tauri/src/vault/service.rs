use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use uuid::Uuid;

use crate::vault::crypto;
use crate::vault::storage;
use crate::vault::types::{
    VaultBackup, VaultData, VaultEntry, VaultEntryInput, VaultEntrySummary, VaultFile, VaultSession,
};

const VAULT_VERSION: u8 = 1;

pub fn init_vault(session: &mut VaultSession, master_password: &str) -> Result<(), String> {
    if storage::vault_exists()? {
        return Err("Vault already exists.".to_string());
    }
    let salt = crypto::generate_salt();
    let key = crypto::derive_key(master_password, &salt)?;
    let data = VaultData::empty();
    let (ciphertext, nonce) = crypto::encrypt_vault(&key, &data)?;
    let file = VaultFile {
        version: VAULT_VERSION,
        salt_b64: STANDARD.encode(salt),
        nonce_b64: STANDARD.encode(nonce),
        ciphertext_b64: STANDARD.encode(ciphertext),
    };
    let path = storage::vault_path()?;
    storage::write_vault_file(&path, &file)?;

    session.clear();
    session.unlocked = true;
    session.key = Some(key);
    session.salt = Some(salt.to_vec());
    session.vault_data = data;
    session.vault_path = Some(path);
    Ok(())
}

pub fn unlock_vault(session: &mut VaultSession, master_password: &str) -> Result<(), String> {
    let path = storage::vault_path()?;
    if !path.exists() {
        return Err("Vault not found. Create a vault first.".to_string());
    }
    let file = storage::read_vault_file(&path)?;
    let salt = STANDARD
        .decode(file.salt_b64)
        .map_err(|_| "Vault salt is invalid.".to_string())?;
    let nonce = STANDARD
        .decode(file.nonce_b64)
        .map_err(|_| "Vault nonce is invalid.".to_string())?;
    let ciphertext = STANDARD
        .decode(file.ciphertext_b64)
        .map_err(|_| "Vault data is invalid.".to_string())?;
    let key = crypto::derive_key(master_password, &salt)?;
    let data = crypto::decrypt_vault(&key, &nonce, &ciphertext)?;

    session.clear();
    session.unlocked = true;
    session.key = Some(key);
    session.salt = Some(salt);
    session.vault_data = data;
    session.vault_path = Some(path);
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

fn save_session(session: &VaultSession) -> Result<(), String> {
    let key = session
        .key
        .as_ref()
        .ok_or_else(|| "Vault is locked.".to_string())?;
    let salt = session
        .salt
        .as_ref()
        .ok_or_else(|| "Vault salt is missing.".to_string())?;
    let path = session
        .vault_path
        .as_ref()
        .ok_or_else(|| "Vault path is missing.".to_string())?;
    let (ciphertext, nonce) = crypto::encrypt_vault(key, &session.vault_data)?;
    let file = VaultFile {
        version: VAULT_VERSION,
        salt_b64: STANDARD.encode(salt),
        nonce_b64: STANDARD.encode(nonce),
        ciphertext_b64: STANDARD.encode(ciphertext),
    };
    storage::write_vault_file(path, &file)
}

fn now_epoch() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}
