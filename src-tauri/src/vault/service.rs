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
        category: input.category,
        is_favorite: input.is_favorite,
        password_history: Vec::new(),
        created_at: now,
        updated_at: now,
        deleted_at: None,
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
        .filter(|e| e.deleted_at.is_none())
        .map(VaultEntrySummary::from_entry)
        .collect();
    items.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(items)
}

pub fn list_trash_entries(session: &VaultSession) -> Result<Vec<VaultEntrySummary>, String> {
    let mut items: Vec<VaultEntrySummary> = session
        .vault_data
        .entries
        .iter()
        .filter(|e| e.deleted_at.is_some())
        .map(VaultEntrySummary::from_entry)
        .collect();
    items.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));
    Ok(items)
}

pub fn get_audit_stats(session: &VaultSession) -> Result<crate::vault::types::AuditStats, String> {
    let entries: Vec<&VaultEntry> = session.vault_data.entries.iter().filter(|e| e.deleted_at.is_none()).collect();
    let total_entries = entries.len();
    let mut weak_count = 0;
    let mut medium_count = 0;
    let mut strong_count = 0;
    let mut reused_count = 0;
    let mut old_count = 0;

    let mut passwords = std::collections::HashMap::new();
    let now = now_epoch();
    let six_months_secs = 180 * 24 * 60 * 60;

    for entry in entries {
        // Strength
        match calculate_strength(&entry.password) {
            Strength::Weak => weak_count += 1,
            Strength::Medium => medium_count += 1,
            Strength::Strong => strong_count += 1,
        }

        // Reuse
        let count = passwords.entry(entry.password.clone()).or_insert(0);
        *count += 1;

        // Old
        if now - entry.updated_at > six_months_secs {
            old_count += 1;
        }
    }

    // Count how many entries use a reused password
    // Actually, the user wants "accounts that share the same password".
    // If 3 accounts share password A, and 2 share password B, that's 5 entries.
    for (_, count) in passwords {
        if count > 1 {
            reused_count += count;
        }
    }

    Ok(crate::vault::types::AuditStats {
        total_entries,
        weak_count,
        medium_count,
        strong_count,
        reused_count,
        old_count,
    })
}

enum Strength {
    Weak,
    Medium,
    Strong,
}

fn calculate_strength(password: &str) -> Strength {
    let len = password.len();
    if len < 8 {
        return Strength::Weak;
    }

    let has_upper = password.chars().any(|c| c.is_uppercase());
    let has_lower = password.chars().any(|c| c.is_lowercase());
    let has_digit = password.chars().any(|c| c.is_digit(10));
    let has_special = password.chars().any(|c| !c.is_alphanumeric());

    let types_count = [has_upper, has_lower, has_digit, has_special]
        .iter()
        .filter(|&&b| b)
        .count();

    if len >= 12 && types_count >= 3 {
        Strength::Strong
    } else if len >= 8 && types_count >= 2 {
        Strength::Medium
    } else {
        Strength::Weak
    }
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
    let entry = session
        .vault_data
        .entries
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| "Entry not found.".to_string())?;

    entry.deleted_at = Some(now_epoch());
    save_session(session)
}

pub fn restore_entry(session: &mut VaultSession, id: &str) -> Result<(), String> {
    let entry = session
        .vault_data
        .entries
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| "Entry not found.".to_string())?;

    entry.deleted_at = None;
    entry.updated_at = now_epoch();
    save_session(session)
}

pub fn permanently_delete_entry(session: &mut VaultSession, id: &str) -> Result<(), String> {
    let before = session.vault_data.entries.len();
    session.vault_data.entries.retain(|entry| entry.id != id);
    if session.vault_data.entries.len() == before {
        return Err("Entry not found.".to_string());
    }
    save_session(session)
}

pub fn cleanup_trash(session: &mut VaultSession) -> Result<(), String> {
    let now = now_epoch();
    let thirty_days_secs = 30 * 24 * 60 * 60;
    let before = session.vault_data.entries.len();
    
    session.vault_data.entries.retain(|e| {
        match e.deleted_at {
            Some(deleted_at) => (now - deleted_at) < thirty_days_secs,
            None => true,
        }
    });

    if session.vault_data.entries.len() != before {
        save_session(session)?;
    }
    Ok(())
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

    if updated_entry.password != input.password {
        updated_entry.password_history.push(crate::vault::types::PasswordHistoryEntry {
            password: updated_entry.password.clone(),
            changed_at: updated_entry.updated_at,
        });
        if updated_entry.password_history.len() > 5 {
            updated_entry.password_history.remove(0);
        }
        updated_entry.password = input.password;
    }
    
    updated_entry.label = input.label;
    updated_entry.username = input.username;
    updated_entry.url = input.url;
    updated_entry.notes = input.notes;
    updated_entry.tags = input.tags;
    updated_entry.category = input.category;
    updated_entry.is_favorite = input.is_favorite;
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

pub fn regenerate_recovery_key(session: &mut VaultSession) -> Result<String, String> {
    let master_key = session
        .key
        .as_ref()
        .ok_or_else(|| "Vault is locked.".to_string())?;
    let path = session
        .vault_path
        .as_ref()
        .ok_or_else(|| "Vault path is missing.".to_string())?;

    // 1. Generate new recovery key
    let recovery_key = Uuid::new_v4().to_string().to_uppercase();
    let recovery_salt = crypto::generate_salt();
    let recovery_wrapper_key = crypto::derive_key(&recovery_key, &recovery_salt)?;
    let (recovery_wrapped_key, recovery_nonce) =
        crypto::encrypt_key(&recovery_wrapper_key, master_key)?;

    // 2. Update vault file
    let mut file = storage::read_vault_file(path)?;
    file.recovery_salt_b64 = STANDARD.encode(recovery_salt);
    file.recovery_wrapped_key_b64 = STANDARD.encode(recovery_wrapped_key);
    file.recovery_nonce_b64 = STANDARD.encode(recovery_nonce);

    storage::write_vault_file(path, &file)?;

    Ok(recovery_key)
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
    if !path.exists() {
        return Err("Vault file missing. Please lock and re-initialize the vault.".to_string());
    }
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
