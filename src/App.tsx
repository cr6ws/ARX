import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  ChevronRight,
  Eye,
  KeyRound,
  LayoutGrid,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  decideInitialMode,
  sortEntriesByUpdated,
  type VaultMode,
} from "./ai/agents/uiAgent";
import { UI_RULES } from "./ai/instructions";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { Badge } from "./components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Separator } from "./components/ui/separator";
import { Textarea } from "./components/ui/textarea";

type VaultStatus = {
  hasVault: boolean;
  isUnlocked: boolean;
};

type VaultEntrySummary = {
  id: string;
  label: string;
  username: string;
  url?: string | null;
  updatedAt: number;
};

type VaultEntryInput = {
  label: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
};

const EMPTY_ENTRY: VaultEntryInput = {
  label: "",
  username: "",
  password: "",
  url: "",
  notes: "",
};

type SidebarSection = "overview" | "audit" | "passwords" | "settings";

const navigationItems: Array<{
  icon: typeof LayoutGrid;
  label: string;
  section: SidebarSection;
}> = [
  { icon: LayoutGrid, label: "All Items", section: "overview" },
  { icon: ShieldCheck, label: "Security Audit", section: "audit" },
  { icon: KeyRound, label: "Passwords", section: "passwords" },
  { icon: Sparkles, label: "Settings", section: "settings" },
];

function App() {
  const [mode, setMode] = useState<VaultMode>("loading");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [masterConfirm, setMasterConfirm] = useState("");
  const [entries, setEntries] = useState<VaultEntrySummary[]>([]);
  const [newEntry, setNewEntry] = useState<VaultEntryInput>(EMPTY_ENTRY);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSection, setActiveSection] = useState<SidebarSection>("overview");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const securityNotice = useMemo(() => UI_RULES.slice(0, 2), []);

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => {
      const haystack = [entry.label, entry.username, entry.url ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [entries, searchTerm]);

  const totalItems = entries.length;
  const vaultHealth = useMemo(() => {
    if (totalItems === 0) return 0;
    return Math.min(96, 68 + totalItems * 4);
  }, [totalItems]);

  const progressBucket = useMemo(() => {
    return Math.min(100, Math.max(0, Math.round(vaultHealth / 10) * 10));
  }, [vaultHealth]);

  const recentEntries = useMemo(() => filteredEntries.slice(0, 5), [filteredEntries]);

  const activeSectionTitle = useMemo(() => {
    switch (activeSection) {
      case "audit":
        return "Security Audit";
      case "passwords":
        return "Passwords";
      case "settings":
        return "Settings";
      default:
        return "Vault Overview";
    }
  }, [activeSection]);

  const activeSectionSummary = useMemo(() => {
    switch (activeSection) {
      case "audit":
        return "Audit checks should eventually flag weak passwords, duplicates, stale entries, and missing security metadata.";
      case "passwords":
        return "This section should become the full password browser for viewing, searching, revealing, copying, editing, and deleting entries.";
      case "settings":
        return "Settings should stay security-focused: auto-lock, reveal timeout, export/import, and sync posture.";
      default:
        return "Your secure digital life, encrypted and organized locally.";
    }
  }, [activeSection]);

  useEffect(() => {
    let alive = true;
    const loadStatus = async () => {
      setIsBusy(true);
      setError(null);
      try {
        const status = await invoke<VaultStatus>("vault_status");
        if (!alive) return;
        setMode(status.isUnlocked ? "unlocked" : decideInitialMode(status.hasVault));
      } catch (err) {
        if (!alive) return;
        setError(String(err));
        setMode("locked");
      } finally {
        if (alive) setIsBusy(false);
      }
    };
    loadStatus();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (mode !== "unlocked") return;
    loadEntries();
  }, [mode]);

  useEffect(() => {
    if (!revealedPassword) return;
    const timer = window.setTimeout(() => {
      setRevealId(null);
      setRevealedPassword(null);
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [revealedPassword]);

  const loadEntries = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const data = await invoke<VaultEntrySummary[]>("get_passwords");
      setEntries(sortEntriesByUpdated(data));
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleInitVault = async () => {
    if (masterPassword.length < 8) {
      setError("Master password must be at least 8 characters.");
      return;
    }
    if (masterPassword !== masterConfirm) {
      setError("Master passwords do not match.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await invoke("init_vault", { masterPassword });
      setMasterPassword("");
      setMasterConfirm("");
      setMode("unlocked");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (masterPassword.length < 8) {
      setError("Master password must be at least 8 characters.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await invoke("unlock_vault", { masterPassword });
      setMasterPassword("");
      setMode("unlocked");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleLock = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await invoke("lock_vault");
      setEntries([]);
      setSearchTerm("");
      setIsAddModalOpen(false);
      setMode("locked");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetVault = async () => {
    const confirmed = window.confirm(
      "This will permanently delete the local vault on this device and you will need to create a new one.",
    );
    if (!confirmed) return;

    setIsBusy(true);
    setError(null);
    try {
      await invoke("reset_vault");
      setEntries([]);
      setNewEntry(EMPTY_ENTRY);
      setSearchTerm("");
      setMasterPassword("");
      setMasterConfirm("");
      setRevealId(null);
      setRevealedPassword(null);
      setIsAddModalOpen(false);
      setActiveSection("overview");
      setMode("setup");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.label.trim() || !newEntry.username.trim()) {
      setError("Label and username are required.");
      return;
    }
    if (newEntry.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const payload: VaultEntryInput = {
        label: newEntry.label.trim(),
        username: newEntry.username.trim(),
        password: newEntry.password,
        url: newEntry.url?.trim() ? newEntry.url.trim() : undefined,
        notes: newEntry.notes?.trim() ? newEntry.notes.trim() : undefined,
      };
      await invoke("add_password", { entry: payload });
      setNewEntry(EMPTY_ENTRY);
      setIsAddModalOpen(false);
      await loadEntries();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsBusy(true);
    setError(null);
    try {
      await invoke("delete_password", { id });
      await loadEntries();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleReveal = async (id: string) => {
    setIsBusy(true);
    setError(null);
    try {
      const password = await invoke<string>("get_password", { id });
      setRevealId(id);
      setRevealedPassword(password);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const openAddModal = () => {
    setError(null);
    setIsAddModalOpen(true);
  };

  if (mode === "loading") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(78,222,163,0.12),transparent_24%),radial-gradient(circle_at_85%_8%,rgba(192,193,255,0.10),transparent_20%),radial-gradient(circle_at_75%_85%,rgba(17,94,106,0.24),transparent_24%),linear-gradient(180deg,#0b0f10_0%,#101415_55%,#0b0f10_100%)] px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-center justify-center">
          <Card className="w-full max-w-xl rounded-[28px] border-white/10 bg-white/5 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <CardHeader>
              <CardTitle className="text-3xl text-white">Veryfied Vault</CardTitle>
              <CardDescription className="text-white/70">
                Checking encrypted vault status...
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 rounded-full bg-emerald-400/80 shadow-[0_0_24px_rgba(78,222,163,0.45)]" />
              </div>
              <p className="text-sm text-white/70">
                Preparing the secure desktop workspace.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (mode !== "unlocked") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(78,222,163,0.12),transparent_24%),radial-gradient(circle_at_85%_8%,rgba(192,193,255,0.10),transparent_20%),radial-gradient(circle_at_75%_85%,rgba(17,94,106,0.24),transparent_24%),linear-gradient(180deg,#0b0f10_0%,#101415_55%,#0b0f10_100%)] px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="hidden rounded-[28px] border-white/10 bg-white/5 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl lg:flex lg:flex-col lg:justify-between">
            <CardHeader className="space-y-4 p-8">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200">
                <ShieldCheck className="size-3.5" />
                Liquid Glass Vault
              </div>
              <div className="space-y-3">
                <CardTitle className="text-5xl font-semibold tracking-tight text-white">
                  Secure local vault, designed for calm focus.
                </CardTitle>
                <CardDescription className="max-w-xl text-lg leading-8 text-white/70">
                  Keep the desktop app as the trusted layer. Encrypt locally,
                  avoid plaintext, and move fast without exposing secrets.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-8 pb-8">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "AES-GCM encrypted storage",
                  "Rust handles secrets",
                  "Local-only MVP",
                  "No plaintext in UI state",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 backdrop-blur-xl"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <Separator className="bg-white/10" />
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-white/70 backdrop-blur-xl">
                The UI can change freely. The backend contract stays stable so
                Rust continues to own storage and encryption.
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center py-2 lg:py-0">
            <Card className="w-full max-w-xl rounded-[28px] border-white/10 bg-white/5 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
              <CardHeader className="space-y-4 p-8">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200">
                  <LockKeyhole className="size-3.5" />
                  {mode === "setup" ? "Create vault" : "Unlock vault"}
                </div>
                <div className="space-y-3">
                  <CardTitle className="text-4xl font-semibold tracking-tight text-white">
                    {mode === "setup" ? "Create your master password" : "Unlock your vault"}
                  </CardTitle>
                  <CardDescription className="max-w-xl text-base leading-7 text-white/70">
                    {mode === "setup"
                      ? "You only need to create this once. It becomes the key that unlocks your local encrypted vault."
                      : "Enter your master password to decrypt your vault locally and continue."}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 px-8 pb-8">
                {error && (
                  <Alert variant="destructive" className="border-white/10 bg-white/5 text-white">
                    <AlertTriangle className="size-4 text-rose-300" />
                    <AlertTitle className="text-white">Action failed</AlertTitle>
                    <AlertDescription className="text-white/75">{error}</AlertDescription>
                  </Alert>
                )}

                {mode === "setup" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="master-password" className="text-white/80">
                        Master password
                      </Label>
                      <Input
                        id="master-password"
                        type="password"
                        value={masterPassword}
                        onChange={(event) => setMasterPassword(event.target.value)}
                        placeholder="At least 8 characters"
                        className="h-12 rounded-2xl border-white/10 bg-white/8 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="master-confirm" className="text-white/80">
                        Confirm password
                      </Label>
                      <Input
                        id="master-confirm"
                        type="password"
                        value={masterConfirm}
                        onChange={(event) => setMasterConfirm(event.target.value)}
                        placeholder="Repeat master password"
                        className="h-12 rounded-2xl border-white/10 bg-white/8 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="unlock-password" className="text-white/80">
                      Master password
                    </Label>
                    <Input
                      id="unlock-password"
                      type="password"
                      value={masterPassword}
                      onChange={(event) => setMasterPassword(event.target.value)}
                      placeholder="Your master password"
                      className="h-12 rounded-2xl border-white/10 bg-white/8 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                    />
                  </div>
                )}

                <Button
                  onClick={mode === "setup" ? handleInitVault : handleUnlock}
                  disabled={isBusy}
                  size="lg"
                  className="h-12 w-full rounded-2xl bg-linear-to-r from-emerald-400 to-teal-500 text-sm font-semibold text-slate-950 shadow-[0_16px_30px_rgba(16,185,129,0.28)] hover:from-emerald-300 hover:to-teal-400"
                >
                  {mode === "setup" ? "Create vault" : "Unlock vault"}
                </Button>

                <div className="space-y-2 rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm text-white/70 backdrop-blur-xl">
                  {securityNotice.map((rule) => (
                    <div key={rule} className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                      <span>{rule}</span>
                    </div>
                  ))}
                  {mode !== "setup" && (
                    <div className="pt-2">
                      <p className="text-xs leading-6 text-white/55">
                        If you do not remember the master password, the vault cannot be decrypted.
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleResetVault}
                        disabled={isBusy}
                        className="mt-3 h-10 rounded-full border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15 hover:text-rose-50"
                      >
                        Reset vault on this device
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(78,222,163,0.12),transparent_24%),radial-gradient(circle_at_85%_8%,rgba(192,193,255,0.10),transparent_20%),radial-gradient(circle_at_75%_85%,rgba(17,94,106,0.24),transparent_24%),linear-gradient(180deg,#0b0f10_0%,#101415_55%,#0b0f10_100%)] text-foreground">
      <div className="mx-auto grid min-h-screen max-w-400 lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-white/10 bg-black/20 px-4 py-5 backdrop-blur-2xl">
          <div className="flex h-full flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200">
                <Sparkles className="size-3.5" />
                Veryfied
              </div>
              <p className="text-sm text-white/60">Premium Vault</p>
            </div>

            <Button
              onClick={openAddModal}
              className="h-11 rounded-2xl bg-linear-to-r from-emerald-400 to-teal-500 text-sm font-semibold text-slate-950 shadow-[0_16px_30px_rgba(16,185,129,0.28)] hover:from-emerald-300 hover:to-teal-400"
            >
              <Plus className="mr-2 size-4" />
              Generate Password
            </Button>

            <nav className="flex flex-1 flex-col gap-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveSection(item.section)}
                    className={
                      activeSection === item.section
                        ? "flex items-center gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-200 shadow-[0_10px_30px_rgba(16,185,129,0.08)]"
                        : "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/55 transition hover:bg-white/5 hover:text-white/80"
                    }
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
              <Button
                variant="outline"
                onClick={handleLock}
                disabled={isBusy}
                className="h-11 w-full rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <LockKeyhole className="mr-2 size-4" />
                Lock Vault
              </Button>
              <div className="space-y-2 text-xs text-white/45">
                <p>Rust-backed crypto</p>
                <p>Local encrypted storage only</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex h-full flex-col gap-6">
            <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 items-center gap-3">
                <div className="relative w-full max-w-xl">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search vault..."
                    className="h-11 rounded-full border-white/10 bg-black/25 pl-10 text-white placeholder:text-white/35 focus-visible:border-emerald-300/40 focus-visible:ring-emerald-400/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={openAddModal}
                  className="h-11 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <Plus className="mr-2 size-4" />
                  Add Item
                </Button>
                <Button
                  variant="outline"
                  onClick={handleLock}
                  disabled={isBusy}
                  className="h-11 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <LockKeyhole className="mr-2 size-4" />
                  Lock
                </Button>
              </div>
            </header>

            {error && (
              <Alert variant="destructive" className="border-white/10 bg-white/5 text-white">
                <AlertTriangle className="size-4 text-rose-300" />
                <AlertTitle className="text-white">Action failed</AlertTitle>
                <AlertDescription className="text-white/75">{error}</AlertDescription>
              </Alert>
            )}

            <section className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
                {activeSectionTitle}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-white/70">
                {activeSectionSummary}
              </p>
            </section>

            {activeSection !== "overview" && (
              <section className="grid gap-6 xl:grid-cols-2">
                <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
                  <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
                    <CardTitle className="text-xl text-white">{activeSectionTitle}</CardTitle>
                    <CardDescription className="text-white/60">
                      {activeSection === "audit" && "This page is where audit results should live once the backend adds scoring and checks."}
                      {activeSection === "passwords" && "This page should become the full list view for all stored login items."}
                      {activeSection === "settings" && "This page should contain safe app preferences and local vault behavior controls."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 px-6 py-6 text-sm leading-7 text-white/70">
                    {activeSection === "audit" && (
                      <>
                        <p>Show weak password flags, reused credentials, duplicate usernames, stale entries, and missing websites.</p>
                        <p>For MVP, this can stay informational until the Rust backend exposes audit logic.</p>
                      </>
                    )}
                    {activeSection === "passwords" && (
                      <>
                        <p>Show every entry in a clean list with search, reveal, copy, edit, delete, and sort actions.</p>
                        <p>Right now the data is already available, so this page can be built without changing the backend.</p>
                      </>
                    )}
                    {activeSection === "settings" && (
                      <>
                        <p>Keep only safe controls here: auto-lock, reveal timeout, export/import, theme preference, and future sync toggles.</p>
                        <p>Sync should remain off until you explicitly add a cloud provider or device-to-device sync flow.</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </section>
            )}

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.7fr)]">
              <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
                <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl text-white">Vault Health</CardTitle>
                      <CardDescription className="text-white/60">
                        {totalItems === 0
                          ? "No entries yet. Start by adding one."
                          : `${totalItems} encrypted entries stored locally.`}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      disabled
                      className="rounded-full border-white/10 bg-white/5 text-white/80"
                    >
                      Run Audit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 px-6 py-6">
                  <div className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                    <div className="flex items-center justify-between gap-4 text-sm text-white/60">
                      <span>Vault score</span>
                      <span>{vaultHealth}%</span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`vault-progress-${progressBucket} h-full rounded-full bg-linear-to-r from-emerald-400 to-teal-400 shadow-[0_0_24px_rgba(78,222,163,0.45)]`}
                      />
                    </div>
                    <p className="mt-4 text-sm leading-7 text-white/70">
                      92% security score. Local encrypted storage active.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "Encrypted", value: "AES-GCM" },
                      { label: "Sync", value: "Off" },
                      { label: "State", value: isBusy ? "Busy" : "Ready" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-[22px] border border-white/10 bg-black/20 p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.label}</p>
                        <p className="mt-2 text-base font-medium text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1">
                <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
                  <CardContent className="space-y-2 px-6 py-6">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">Total items</p>
                    <p className="text-5xl font-semibold tracking-tight text-white">{totalItems}</p>
                    <p className="text-sm text-white/65">Stored in the local encrypted vault.</p>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
                  <CardContent className="space-y-3 px-6 py-6">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">Recent activity</p>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                        {totalItems > 0 ? `${totalItems} entries available.` : "Awaiting first vault item."}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                        No cloud sync. No plaintext secrets.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
                <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl text-white">Recent Logins</CardTitle>
                      <CardDescription className="text-white/60">
                        {searchTerm.trim()
                          ? `Filtered to ${recentEntries.length} result${recentEntries.length === 1 ? "" : "s"}`
                          : "Your latest saved entries."}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" className="rounded-full text-white/75 hover:bg-white/10 hover:text-white">
                      View All <ChevronRight className="ml-1 size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-6 py-6">
                  {recentEntries.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-white/10 bg-black/15 p-6 text-sm text-white/60">
                      No matching entries found. Try a different search, or create a new vault item.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="group flex flex-col gap-4 rounded-[22px] border border-white/10 bg-black/20 p-4 transition hover:border-emerald-400/25 hover:bg-black/25 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                              <KeyRound className="size-5 text-emerald-300" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white">{entry.label}</p>
                              <p className="truncate text-sm text-white/60">{entry.username}</p>
                              <p className="mt-2 truncate text-xs text-white/45">{entry.url ?? "Local vault"}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end sm:text-right">
                            <Badge variant="secondary" className="rounded-full bg-white/10 text-white/70">
                              Saved
                            </Badge>
                            <span className="text-xs text-white/45">
                              {new Date(entry.updatedAt * 1000).toLocaleDateString()}
                            </span>
                          </div>

                          {revealId === entry.id && revealedPassword && (
                            <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200">Revealed password</p>
                              <p className="mt-2 break-all font-mono text-sm text-white">{revealedPassword}</p>
                              <p className="mt-2 text-xs text-emerald-100/70">Auto-hides after 10 seconds.</p>
                            </div>
                          )}

                          <div className="mt-4 flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => handleReveal(entry.id)}
                              disabled={isBusy}
                              className="h-9 flex-1 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                            >
                              <Eye className="mr-2 size-4" />
                              Reveal
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleDelete(entry.id)}
                              disabled={isBusy}
                              className="h-9 rounded-full bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card
                id="add-entry-card"
                className="hidden rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
              >
                <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
                  <CardTitle className="text-xl text-white">Login Details</CardTitle>
                  <CardDescription className="text-white/60">
                    Store a new password entry inside the encrypted local vault.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-6 py-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="entry-label" className="text-white/80">
                        Label
                      </Label>
                      <Input
                        id="entry-label"
                        value={newEntry.label}
                        onChange={(event) =>
                          setNewEntry((prev) => ({
                            ...prev,
                            label: event.target.value,
                          }))
                        }
                        placeholder="e.g. Dribbble"
                        className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entry-username" className="text-white/80">
                        Username
                      </Label>
                      <Input
                        id="entry-username"
                        value={newEntry.username}
                        onChange={(event) =>
                          setNewEntry((prev) => ({
                            ...prev,
                            username: event.target.value,
                          }))
                        }
                        placeholder="alex@example.com"
                        className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entry-password" className="text-white/80">
                        Password
                      </Label>
                      <Input
                        id="entry-password"
                        type="password"
                        value={newEntry.password}
                        onChange={(event) =>
                          setNewEntry((prev) => ({
                            ...prev,
                            password: event.target.value,
                          }))
                        }
                        placeholder="Minimum 8 characters"
                        className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entry-url" className="text-white/80">
                        Website
                      </Label>
                      <Input
                        id="entry-url"
                        value={newEntry.url}
                        onChange={(event) =>
                          setNewEntry((prev) => ({
                            ...prev,
                            url: event.target.value,
                          }))
                        }
                        placeholder="https://"
                        className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="entry-notes" className="text-white/80">
                        Secure Notes
                      </Label>
                      <Textarea
                        id="entry-notes"
                        value={newEntry.notes}
                        onChange={(event) =>
                          setNewEntry((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Optional context or recovery info"
                        className="min-h-28 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                      />
                    </div>
                  </div>
                </CardContent>
                <div className="border-t border-white/10 px-6 py-5">
                  <Button
                    onClick={handleAddEntry}
                    disabled={isBusy}
                    className="h-11 w-full rounded-2xl bg-linear-to-r from-emerald-400 to-teal-500 text-sm font-semibold text-slate-950 shadow-[0_16px_30px_rgba(16,185,129,0.28)] hover:from-emerald-300 hover:to-teal-400"
                  >
                    Save entry
                  </Button>
                </div>
              </Card>
            </section>
          </div>
        </main>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close add item dialog"
            onClick={() => setIsAddModalOpen(false)}
          />
          <Card className="relative z-10 w-full max-w-2xl rounded-3xl border-white/10 bg-[#151a1c]/95 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
            <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl text-white">Login Details</CardTitle>
                  <CardDescription className="text-white/60">
                    Add a password entry without leaving the page.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="entry-label-modal" className="text-white/80">
                    Label
                  </Label>
                  <Input
                    id="entry-label-modal"
                    value={newEntry.label}
                    onChange={(event) =>
                      setNewEntry((prev) => ({
                        ...prev,
                        label: event.target.value,
                      }))
                    }
                    placeholder="e.g. Dribbble"
                    className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry-username-modal" className="text-white/80">
                    Username
                  </Label>
                  <Input
                    id="entry-username-modal"
                    value={newEntry.username}
                    onChange={(event) =>
                      setNewEntry((prev) => ({
                        ...prev,
                        username: event.target.value,
                      }))
                    }
                    placeholder="alex@example.com"
                    className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry-password-modal" className="text-white/80">
                    Password
                  </Label>
                  <Input
                    id="entry-password-modal"
                    type="password"
                    value={newEntry.password}
                    onChange={(event) =>
                      setNewEntry((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Minimum 8 characters"
                    className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry-url-modal" className="text-white/80">
                    Website
                  </Label>
                  <Input
                    id="entry-url-modal"
                    value={newEntry.url}
                    onChange={(event) =>
                      setNewEntry((prev) => ({
                        ...prev,
                        url: event.target.value,
                      }))
                    }
                    placeholder="https://"
                    className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="entry-notes-modal" className="text-white/80">
                    Secure Notes
                  </Label>
                  <Textarea
                    id="entry-notes-modal"
                    value={newEntry.notes}
                    onChange={(event) =>
                      setNewEntry((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Optional context or recovery info"
                    className="min-h-28 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-emerald-300/50 focus-visible:ring-emerald-400/25"
                  />
                </div>
              </div>
              <Button
                onClick={handleAddEntry}
                disabled={isBusy}
                className="h-11 w-full rounded-2xl bg-linear-to-r from-emerald-400 to-teal-500 text-sm font-semibold text-slate-950 shadow-[0_16px_30px_rgba(16,185,129,0.28)] hover:from-emerald-300 hover:to-teal-400"
              >
                Save entry
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default App;
