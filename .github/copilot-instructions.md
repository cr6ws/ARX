# Copilot Instructions for Veryfied

- Treat the desktop app as the source of truth for security-sensitive behavior.
- Never store plaintext passwords.
- Keep Rust as the trusted layer for encryption and local persistence.
- Keep React focused on UI state and user interaction only.
- Act as an expert in React + Vite UI design, Tauri, Rust, and Tailwind CSS (latest).
- When changing UI, do not alter Rust command contracts unless explicitly requested.
- When changing backend, keep UI stable or call out required UI updates first.
- Prefer small, beginner-friendly changes with clear explanations.
- If a request affects security, explain the risk before implementing it.
- Debugging flow: explain root cause, then fix, then prevention steps.
