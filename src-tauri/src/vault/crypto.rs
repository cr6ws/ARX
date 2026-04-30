use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use argon2::Argon2;
use rand::RngCore;

use crate::vault::types::VaultData;

pub fn generate_salt() -> [u8; 16] {
    let mut salt = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut salt);
    salt
}

pub fn derive_key(password: &str, salt: &[u8]) -> Result<Vec<u8>, String> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| e.to_string())?;
    Ok(key.to_vec())
}

pub fn encrypt_vault(key: &[u8], data: &VaultData) -> Result<(Vec<u8>, [u8; 12]), String> {
    if key.len() != 32 {
        return Err("Invalid key length.".to_string());
    }
    let plaintext = serde_json::to_vec(data).map_err(|e| e.to_string())?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let mut nonce = [0u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut nonce);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext.as_ref())
        .map_err(|_| "Encryption failed.".to_string())?;
    Ok((ciphertext, nonce))
}

pub fn decrypt_vault(key: &[u8], nonce: &[u8], ciphertext: &[u8]) -> Result<VaultData, String> {
    if key.len() != 32 {
        return Err("Invalid key length.".to_string());
    }
    if nonce.len() != 12 {
        return Err("Invalid nonce length.".to_string());
    }
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| "Invalid password or corrupted vault.".to_string())?;
    serde_json::from_slice(&plaintext).map_err(|_| "Failed to parse vault.".to_string())
}

pub fn generate_master_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut key);
    key
}

pub fn encrypt_key(wrapper_key: &[u8], target_key: &[u8]) -> Result<(Vec<u8>, [u8; 12]), String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(wrapper_key));
    let mut nonce = [0u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut nonce);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), target_key)
        .map_err(|_| "Key wrapping failed.".to_string())?;
    Ok((ciphertext, nonce))
}

pub fn decrypt_key(wrapper_key: &[u8], nonce: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(wrapper_key));
    let target_key = cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| "Invalid key or recovery code.".to_string())?;
    Ok(target_key)
}
