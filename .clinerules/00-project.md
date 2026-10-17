# ARX project brief

ARX is a local-first, offline password manager desktop app. All data is
encrypted and stored on the user's device. There is no cloud and no server.

## Stack
- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4
- UI: shadcn/ui (Radix), lucide-react icons, motion for animations, Recharts for charts
- Backend: Rust with Tauri v2 (frontend calls it through invoke())
- Crypto in Rust: AES-256-GCM, Argon2, TOTP, zeroize

## Structure
- App.tsx: dashboard plus the Setup, Unlock and Recovery screens
- pages/: PasswordsPage, SecureNotesPage, AuthenticatorPage,
  SecurityAuditPage, TrashPage, SettingsPage
- components/: layout/Sidebar, CommandPalette, SecurityDashboard, ui/ (shadcn)

## Run
- Check package.json "scripts" for the exact commands. Usually: npm install,
  then npm run tauri dev.

## Conventions
- Reuse existing components from components/ui before creating new ones.
- Match the style of the file you are editing.
- Use lucide-react for icons and Tailwind for styling (no new CSS files).
- Keep TypeScript types strict. No "any".
- Keep changes small and limited to the task.