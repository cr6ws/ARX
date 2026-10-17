# Security rules for ARX (always follow)

- Rust code for encryption, key derivation, key wrapping, recovery keys,
  and brute-force protection is PROTECTED. You may read it. Do NOT edit it
  unless I explicitly say so. If you think it needs a change, explain the
  change and wait for my approval.
- Never change the crypto algorithms, their parameters, or the vault file
  format.
- Never log, print, or store the master password, master key, recovery key,
  or decrypted vault data. No console.log of vault data.
- Never add network requests, analytics, or telemetry. This app is offline.
- Do not add a new dependency (npm or Rust) without asking me first and
  explaining why.
- Never read, copy, or edit real vault files or backup exports. Use fake test
  data only.
- Secrets must not go into localStorage or into the frontend state longer than
  needed. Clear sensitive state when the vault locks.
- If a task would touch anything above, stop and ask.