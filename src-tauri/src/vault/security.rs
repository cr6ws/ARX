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
    
    // Only validate username/password for Login types
    if matches!(input.entry_type, crate::vault::types::VaultEntryType::Login) {
        if input.username.trim().is_empty() {
            return Err("Username is required for logins.".to_string());
        }
        if input.password.is_empty() {
            return Err("Password is required for logins.".to_string());
        }
        validate_password_strength(&input.password)?;
    }

    if matches!(input.entry_type, crate::vault::types::VaultEntryType::Totp) {
        if let Some(secret) = &input.totp_secret {
            if secret.trim().is_empty() {
                return Err("Secret key is required for Authenticator.".to_string());
            }
        } else {
            return Err("Secret key is required for Authenticator.".to_string());
        }
    }

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
        tags: input
            .tags
            .iter()
            .map(|tag| tag.trim().to_string())
            .filter(|tag| !tag.is_empty())
            .collect(),
        category: input.category.clone(),
        is_favorite: input.is_favorite,
        entry_type: input.entry_type.clone(),
        totp_secret: input.totp_secret.as_ref().map(|s| s.replace(char::is_whitespace, "")).filter(|s| !s.is_empty()),
    }
}

fn validate_password_strength(password: &str) -> Result<(), String> {
    if password.len() < 8 {
        return Err("Password must be at least 8 characters.".to_string());
    }
    let lower = password.to_lowercase();
    let weak_patterns = [
        "password",
        "iloveyou",
        "qwerty",
        "asdf",
        "zxcv",
        "123456",
        "admin",
        "facebook",
    ];
    if weak_patterns.iter().any(|pattern| lower.contains(pattern)) {
        return Err("Password is too weak. Use a less common passphrase.".to_string());
    }
    let repeated_chars = lower.chars().collect::<Vec<_>>();
    if repeated_chars.windows(4).all(|window| window.windows(2).all(|pair| pair[0] == pair[1])) {
        return Err("Password is too weak. Avoid repeated characters.".to_string());
    }
    Ok(())
}

fn sanitize_output(value: &str) -> String {
    value.trim().replace('\r', "").replace('\n', " ")
}
