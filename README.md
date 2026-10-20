# ARX

ARX is a local-first desktop password manager built with Tauri, React, TypeScript, and Rust. It keeps vault persistence and cryptographic operations in the Rust backend while the React frontend provides the user interface.

> **Status:** early development (`0.1.0`). Review the implementation and test it with non-critical data before relying on ARX for production secrets.

## Features

- **Password vault** — create, edit, search, reorder, favorite, reveal, and copy login entries.
- **Secure notes** — store sensitive text such as recovery information and private snippets.
- **Authenticator** — generate rotating TOTP codes for accounts with two-factor authentication configured.
- **Security audit** — identify weak, reused, stale, or incomplete login entries and track audit history.
- **Trash** — restore deleted entries or permanently remove them.
- **Backups** — export and import vault backups from Settings.
- **Vault settings** — configure auto-lock and reveal timeouts, change the master password, manage a password hint, choose a theme, and reset the vault.
- **Local storage** — the MVP stores vault data on the local machine rather than syncing it to a server.

## Security model

ARX is designed around a split between the untrusted UI and the trusted Rust layer:

- Encryption, decryption, key derivation, and vault persistence are handled in Rust.
- The frontend requests narrowly scoped operations through Tauri commands.
- The Rust backend uses AES-GCM for authenticated encryption and Argon2 for password-based key derivation.
- TOTP secrets and vault contents are intended to remain local to the device.

These design choices do not replace a security audit. Protect your operating-system account, keep backups secure, and avoid storing production credentials in an unreleased build.

## Tech stack

- [Tauri 2](https://tauri.app/) for the desktop application shell
- [React 19](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/) for the frontend
- [Vite](https://vite.dev/) for development and builds
- [Rust](https://www.rust-lang.org/) for the vault backend
- [Tailwind CSS](https://tailwindcss.com/), Radix UI, Lucide, Motion, and Recharts for the interface
- AES-GCM, Argon2, TOTP, `zeroize`, and related Rust crates for vault functionality

## Prerequisites

Install the following before developing:

- [Node.js](https://nodejs.org/) with npm
- [Rust](https://www.rust-lang.org/tools/install) and Cargo
- The [Tauri prerequisites for your operating system](https://v2.tauri.app/start/prerequisites/)

On Windows, the Tauri toolchain also requires the Microsoft C++ build tools and WebView2. See the Tauri prerequisites guide for the current requirements.

## Getting started

Clone the repository, install the frontend dependencies, and start the Tauri development app:

```powershell
npm install
npm run tauri dev
```

The Tauri development configuration starts Vite on `http://localhost:1420`.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite frontend development server |
| `npm run tauri dev` | Start the complete Tauri desktop app in development mode |
| `npm run build` | Type-check the frontend and create a Vite production build |
| `npm run tauri build` | Build the frontend and package the desktop application |
| `npm run preview` | Preview the production frontend build |
| `npm run clean-vault` | Remove the local ARX vault directory on Windows |

`npm run clean-vault` is destructive: it removes the local vault data under `%APPDATA%\arx`. Export a backup first if the data matters.

## Project structure

```text
src/
  App.tsx                 Application state, navigation, and Tauri command orchestration
  pages/                  Passwords, notes, authenticator, audit, settings, and trash views
  components/             Shared UI, layout, dialogs, and vault forms
  types/                  Frontend vault and settings types
  ai/                     AI prompts and UI agent helpers
src-tauri/
  src/vault/              Vault models, encryption, persistence, and security operations
  src/system/             System-facing backend helpers
  src/lib.rs              Tauri command registration and application setup
  tauri.conf.json         Tauri build, window, and bundling configuration
```

## Development notes

- Keep encryption and decryption inside Rust. Do not move key handling or plaintext vault persistence into React.
- Treat all frontend values as untrusted input and validate them in the Rust command layer.
- Do not log master passwords, encryption keys, salts, TOTP secrets, or plaintext vault data.
- For UI-only changes, preserve the existing Tauri command contracts.
- Use the existing components and patterns in `src/components/ui` before adding new UI primitives.

## Building a release

To create platform installers and bundles:

```powershell
npm run tauri build
```

The generated artifacts are written under `src-tauri/target/release/bundle/`. Release builds should be tested on the target operating system with a disposable vault before distribution.

## License

No license has been declared for this repository yet. Add a license file before distributing ARX or accepting external contributions.
