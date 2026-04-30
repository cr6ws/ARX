use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use zeroize::Zeroize;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum VaultCategory {
    Personal,
    Work,
    Social,
    Finance,
    Other,
}

impl Default for VaultCategory {
    fn default() -> Self {
        VaultCategory::Other
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntryInput {
    pub label: String,
    pub username: String,
    pub password: String,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub category: VaultCategory,
    #[serde(default)]
    pub is_favorite: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntry {
    pub id: String,
    pub label: String,
    pub username: String,
    pub password: String,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub category: VaultCategory,
    #[serde(default)]
    pub is_favorite: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntrySummary {
    pub id: String,
    pub label: String,
    pub username: String,
    pub url: Option<String>,
    pub tags: Vec<String>,
    pub category: VaultCategory,
    pub is_favorite: bool,
    pub updated_at: i64,
}

impl VaultEntrySummary {
    pub fn from_entry(entry: &VaultEntry) -> Self {
        Self {
            id: entry.id.clone(),
            label: entry.label.clone(),
            username: entry.username.clone(),
            url: entry.url.clone(),
            tags: entry.tags.clone(),
            category: entry.category.clone(),
            is_favorite: entry.is_favorite,
            updated_at: entry.updated_at,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VaultData {
    pub entries: Vec<VaultEntry>,
}

impl VaultData {
    pub fn empty() -> Self {
        Self { entries: Vec::new() }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct VaultFile {
    pub version: u8,
    pub salt_b64: String,
    pub wrapped_key_b64: String, // Master key wrapped by password
    pub nonce_b64: String,
    pub ciphertext_b64: String,  // Vault data wrapped by master key
    pub data_nonce_b64: String,
    pub hint_b64: Option<String>,
    // Recovery
    pub recovery_salt_b64: String,
    pub recovery_wrapped_key_b64: String,
    pub recovery_nonce_b64: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VaultBackup {
    pub vault_file: VaultFile,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub has_vault: bool,
    pub is_unlocked: bool,
    pub hint: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AuditStats {
    pub total_entries: usize,
    pub weak_count: usize,
    pub medium_count: usize,
    pub strong_count: usize,
    pub reused_count: usize,
    pub old_count: usize,
}


pub struct VaultSession {
    pub unlocked: bool,
    pub key: Option<Vec<u8>>,
    pub salt: Option<Vec<u8>>,
    pub vault_data: VaultData,
    pub vault_path: Option<PathBuf>,
    pub hint: Option<String>,
}

impl VaultSession {
    pub fn new() -> Self {
        Self {
            unlocked: false,
            key: None,
            salt: None,
            vault_data: VaultData::empty(),
            vault_path: None,
            hint: None,
        }
    }

    pub fn clear(&mut self) {
        if let Some(key) = self.key.as_mut() {
            key.zeroize();
        }
        self.key = None;
        self.salt = None;
        self.vault_data = VaultData::empty();
        self.vault_path = None;
        self.unlocked = false;
        self.hint = None;
    }
}
