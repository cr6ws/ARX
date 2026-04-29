use std::fs;
use std::path::{Path, PathBuf};

use crate::vault::types::VaultFile;

pub fn vault_path() -> Result<PathBuf, String> {
    let base_dir = dirs::data_dir().ok_or("Unable to resolve data directory.")?;
    let app_dir = base_dir.join("veryfied");
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join("vault.json"))
}

pub fn vault_exists() -> Result<bool, String> {
    let path = vault_path()?;
    Ok(path.exists())
}

pub fn read_vault_file(path: &Path) -> Result<VaultFile, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}

pub fn write_vault_file(path: &Path, file: &VaultFile) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let bytes = serde_json::to_vec(file).map_err(|e| e.to_string())?;
    fs::write(path, bytes).map_err(|e| e.to_string())
}
