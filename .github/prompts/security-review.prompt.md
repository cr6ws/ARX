---
description: "Use when reviewing security, encryption, and secret-handling logic."
---

Review the code for security risks and secret-handling issues.

Checklist:
- No plaintext password storage
- No secret logging
- Encryption and decryption only in Rust
- UI receives only summaries unless user explicitly reveals
- Storage is local-only for MVP
