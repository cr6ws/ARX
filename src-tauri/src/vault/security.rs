use crate::vault::types::{VaultEntryInput, VaultSession};

pub fn ensure_unlocked(session: &VaultSession) -> Result<(), String> {
    if session.unlocked {
        Ok(())
    } else {
        Err("Vault is locked. Unlock first.".to_string())
    }
}

pub fn validate_entry_input(input: &VaultEntryInput) -> Result<(), String> {
    if input.label.trim().is_empty() {
        return Err("Entry label is required.".to_string());
    }
    if input.username.trim().is_empty() {
        return Err("Username is required.".to_string());
    }
    if input.password.is_empty() {
        return Err("Password is required.".to_string());
    }
    validate_password_strength(&input.password)?;
    Ok(())
}

pub fn normalize_entry_input(input: &VaultEntryInput) -> VaultEntryInput {
    VaultEntryInput {
        label: sanitize_output(&input.label),
        username: sanitize_output(&input.username),
        password: input.password.clone(),
        url: input
            .url
            .as_ref()
            .map(|value| sanitize_output(value))
            .filter(|value| !value.is_empty()),
        notes: input
            .notes
            .as_ref()
            .map(|value| sanitize_output(value))
            .filter(|value| !value.is_empty()),
    }
}

fn validate_password_strength(password: &str) -> Result<(), String> {
    if password.len() < 8 {
        return Err("Password must be at least 8 characters.".to_string());
    }
    Ok(())
}

fn sanitize_output(value: &str) -> String {
    value.trim().replace('\r', "").replace('\n', " ")
}
