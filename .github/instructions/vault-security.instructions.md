---
description: "Project rules for vault security, secrets handling, and safe Tauri bridge usage."
applyTo: "src/**/*,src-tauri/**/*"
---

- Never log passwords, master passwords, keys, salts, or plaintext vault data.
- Keep encryption and decryption inside Rust.
- Only send summary data to the UI unless the user explicitly asks to reveal a secret.
- Treat the frontend as untrusted input.
- Keep vault file storage local to the machine for MVP.
- Avoid changing Rust command signatures when doing UI-only work.
