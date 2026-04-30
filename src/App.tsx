import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  KeyRound,
  LayoutGrid,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import arxLogo from "./assets/ARX.png";

import {
  decideInitialMode,
  sortEntriesByUpdated,
  type VaultMode,
} from "./ai/agents/uiAgent";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
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
import { StarsBackground } from "./components/animate-ui/components/backgrounds/stars";

import { PasswordsPage } from "./pages/PasswordsPage";
import { SecurityAuditPage } from "./pages/SecurityAuditPage";
import { SettingsPage } from "./pages/SettingsPage";
import type {
  SidebarSection,
  VaultEntry,
  VaultEntryInput,
  VaultEntrySummary,
  VaultSettings,
  VaultStatus,
} from "./types/vault";

const EMPTY_ENTRY: VaultEntryInput = {
  label: "",
  username: "",
  password: "",
  url: "",
  notes: "",
  tags: [],
};

const DEFAULT_SETTINGS: VaultSettings = {
  autoLockMinutes: 5,
  revealTimeoutSeconds: 10,
  clipboardClearSeconds: 15,
  defaultSection: "overview",
  compactRows: false,
};

function generatePassword(length = 20) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-";
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function parseTagsText(tagsText: string) {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

type AddAccountRow = {
  id: string;
  username: string;
  password: string;
};

function createAddAccountRow(overrides?: Partial<AddAccountRow>) {
  return {
    id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    username: "",
    password: "",
    ...overrides,
  };
}

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
  const [entries, setEntries] = useState<VaultEntrySummary[]>([]);
  const [newEntry, setNewEntry] = useState<VaultEntryInput>(EMPTY_ENTRY);
  const [addLabel, setAddLabel] = useState("");
  const [addWebsite, setAddWebsite] = useState("");
  const [addTagsText, setAddTagsText] = useState("");
  const [addRows, setAddRows] = useState<AddAccountRow[]>([createAddAccountRow()]);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSection, setActiveSection] = useState<SidebarSection>("overview");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryTagsText, setEntryTagsText] = useState("");
  const [settings, setSettings] = useState<VaultSettings>(DEFAULT_SETTINGS);
  const [activityTick, setActivityTick] = useState(0);
  const [auditRunId, setAuditRunId] = useState(0);
  const [isAddModalMounted, setIsAddModalMounted] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const clipboardTimer = useRef<number | null>(null);

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => {
      const haystack = [entry.label, entry.username, entry.url ?? "", entry.tags.join(" ")]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [entries, searchTerm]);

  const highlightedEntryId = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return null;

    const exactMatch = filteredEntries.find((entry) => {
      return entry.label.trim().toLowerCase() === query || entry.username.trim().toLowerCase() === query;
    });

    return (exactMatch ?? filteredEntries[0])?.id ?? null;
  }, [filteredEntries, searchTerm]);

  const totalItems = entries.length;
  const vaultHealth = useMemo(() => {
    if (totalItems === 0) return 0;
    return Math.min(96, 68 + totalItems * 4);
  }, [totalItems]);

  const progressBucket = useMemo(() => {
    return Math.min(100, Math.max(0, Math.round(vaultHealth / 10) * 10));
  }, [vaultHealth]);

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
    const stored = window.localStorage.getItem("veryfied-settings");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Partial<VaultSettings>;
      setSettings({
        ...DEFAULT_SETTINGS,
        ...parsed,
      });
      if (parsed.defaultSection) {
        setActiveSection(parsed.defaultSection);
      }
    } catch {
      window.localStorage.removeItem("veryfied-settings");
    }
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
    setIsBusy(true);
    setError(null);
    try {
      await invoke("init_vault", { masterPassword });
      setMasterPassword("");
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
      setEditingEntryId(null);
      setEntryTagsText("");
      setNewEntry(EMPTY_ENTRY);
      setRevealId(null);
      setRevealedPassword(null);
      if (clipboardTimer.current) {
        window.clearTimeout(clipboardTimer.current);
        clipboardTimer.current = null;
      }
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
      setEntryTagsText("");
      setAddLabel("");
      setAddWebsite("");
      setAddTagsText("");
      setAddRows([createAddAccountRow()]);
      setSearchTerm("");
      setMasterPassword("");
      setRevealId(null);
      setRevealedPassword(null);
      setIsAddModalOpen(false);
      setEditingEntryId(null);
      setActiveSection("overview");
      setMode("setup");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveEntry = async () => {
    if (!addLabel.trim()) {
      setError("Label is required.");
      return;
    }

    const commonTags = parseTagsText(addTagsText);
    const validRows = addRows.filter((row) => row.username.trim() && row.password.length >= 8);

    if (validRows.length === 0) {
      setError("Add at least one username and password row.");
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      if (editingEntryId) {
        const payload: VaultEntryInput = {
          label: newEntry.label.trim(),
          username: newEntry.username.trim(),
          password: newEntry.password,
          url: newEntry.url?.trim() ? newEntry.url.trim() : undefined,
          tags: commonTags,
        };
        await invoke("update_password", { id: editingEntryId, entry: payload });
      } else {
        for (const row of validRows) {
          await invoke("add_password", {
            entry: {
              label: addLabel.trim(),
              username: row.username.trim(),
              password: row.password,
              url: addWebsite.trim() ? addWebsite.trim() : undefined,
              tags: commonTags,
            },
          });
        }
      }
      setNewEntry(EMPTY_ENTRY);
      setEntryTagsText("");
      setAddLabel("");
      setAddWebsite("");
      setAddTagsText("");
      setAddRows([createAddAccountRow()]);
      setEditingEntryId(null);
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
      if (clipboardTimer.current) {
        window.clearTimeout(clipboardTimer.current);
        clipboardTimer.current = null;
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleRunAudit = () => {
    setAuditRunId((value) => value + 1);
    setActiveSection("audit");
  };

  const handleCopyPassword = async (password: string) => {
    await navigator.clipboard.writeText(password);
    if (clipboardTimer.current) {
      window.clearTimeout(clipboardTimer.current);
    }
    clipboardTimer.current = window.setTimeout(() => {
      void navigator.clipboard.writeText("");
      clipboardTimer.current = null;
    }, settings.clipboardClearSeconds * 1000);
  };

  const openAddModal = () => {
    setError(null);
    setEditingEntryId(null);
    setNewEntry(EMPTY_ENTRY);
    setEntryTagsText("");
    setAddLabel("");
    setAddWebsite("");
    setAddTagsText("");
    setAddRows([createAddAccountRow()]);
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setAddLabel("");
    setAddWebsite("");
    setAddTagsText("");
    setAddRows([createAddAccountRow()]);
  };

  const handleEditEntry = async (id: string) => {
    const entry = entries.find((item) => item.id === id);
    if (!entry) {
      setError("Entry not found.");
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const fullEntry = await invoke<VaultEntry>("get_entry", { id });
      setEditingEntryId(id);
      setNewEntry({
        label: fullEntry.label,
        username: fullEntry.username,
        password: fullEntry.password,
        url: fullEntry.url ?? "",
        notes: fullEntry.notes ?? "",
        tags: fullEntry.tags,
      });
      setEntryTagsText(fullEntry.tags.join(", "));
      setIsAddModalOpen(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSettingsChange = (nextSettings: VaultSettings) => {
    setSettings(nextSettings);
  };

  const handleExportBackup = async () => {
    try {
      const backup = await invoke<{ vaultFile: unknown }>("export_vault");
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `veryfied-vault-backup-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleImportBackup = async (file: File) => {
    try {
      const raw = await file.text();
      const backup = JSON.parse(raw) as { vaultFile?: unknown };
      await invoke("import_vault", { backup });
      setEntries([]);
      setIsAddModalOpen(false);
      setAddLabel("");
      setAddWebsite("");
      setAddTagsText("");
      setAddRows([createAddAccountRow()]);
      setEditingEntryId(null);
      setNewEntry(EMPTY_ENTRY);
      setEntryTagsText("");
      setRevealId(null);
      setRevealedPassword(null);
      setMode("locked");
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => {
    if (mode !== "unlocked") return;

    const bumpActivity = () => setActivityTick((value) => value + 1);
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "mousemove", "focus"];

    events.forEach((eventName) => window.addEventListener(eventName, bumpActivity, { passive: true }));

    const timer = window.setTimeout(() => {
      void handleLock();
    }, settings.autoLockMinutes * 60 * 1000);

    return () => {
      window.clearTimeout(timer);
      events.forEach((eventName) => window.removeEventListener(eventName, bumpActivity));
    };
  }, [activityTick, handleLock, mode, settings.autoLockMinutes]);

  useEffect(() => {
    if (mode === "unlocked") {
      setActiveSection(settings.defaultSection);
    }
  }, [mode, settings.defaultSection]);

  useEffect(() => {
    if (isAddModalOpen) {
      setIsAddModalMounted(true);
      const timer = window.setTimeout(() => setIsAddModalVisible(true), 20);
      return () => window.clearTimeout(timer);
    }

    setIsAddModalVisible(false);
    const timer = window.setTimeout(() => setIsAddModalMounted(false), 220);
    return () => window.clearTimeout(timer);
  }, [isAddModalOpen]);

  useEffect(() => {
    if (!searchTerm.trim()) return;
    setActiveSection("passwords");
  }, [searchTerm]);

  if (mode === "loading") {
    return (
      <StarsBackground className="min-h-screen text-white">
        <div className="flex min-h-screen items-center justify-center px-4 text-white">
          <Card className="w-full max-w-sm border border-white/15 bg-zinc-950/95 shadow-[0_30px_120px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <CardContent className="flex flex-col items-center gap-6 px-8 py-10 text-center">
              <img src={arxLogo} alt="ARX" className="h-28 w-28 object-contain" />
              <CardTitle className="text-5xl font-semibold tracking-[0.35em] text-white">ARX</CardTitle>
            </CardContent>
          </Card>
        </div>
      </StarsBackground>
    );
  }

  if (mode !== "unlocked") {
    return (
      <StarsBackground className="min-h-screen text-white">
        <div className="flex min-h-screen items-center justify-center px-4 text-white">
          <Card className="w-full max-w-sm border border-white/15 bg-zinc-950/95 shadow-[0_30px_120px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <CardContent className="space-y-6 px-8 py-10">
              <div className="flex flex-col items-center gap-5 text-center">
                <img src={arxLogo} alt="ARX" className="h-28 w-28 object-contain" />
                <CardTitle className="text-5xl font-semibold tracking-[0.35em] text-white">ARX</CardTitle>
              </div>

              {error && (
                <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white">
                  <p className="font-medium">Action failed</p>
                  <p className="mt-1 text-white/75">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="unlock-password" className="text-sm text-white/80">
                  Master password
                </Label>
                <Input
                  id="unlock-password"
                  type="password"
                  value={masterPassword}
                  onChange={(event) => setMasterPassword(event.target.value)}
                  placeholder={mode === "setup" ? "Create master password" : "Enter master password"}
                  className="h-12 rounded-2xl border-white/15 bg-black text-white placeholder:text-white/30 focus-visible:border-white focus-visible:ring-white/20"
                />
              </div>

              <Button
                onClick={mode === "setup" ? handleInitVault : handleUnlock}
                disabled={isBusy}
                size="lg"
                className="h-12 w-full rounded-2xl border border-white bg-white text-sm font-semibold text-black shadow-none hover:bg-white/90"
              >
                {mode === "setup" ? "Create vault" : "Unlock vault"}
              </Button>

              <Button
                variant="outline"
                onClick={handleResetVault}
                disabled={isBusy}
                className="h-11 w-full rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Reset vault on this device
              </Button>
            </CardContent>
          </Card>
        </div>
      </StarsBackground>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(78,222,163,0.12),transparent_24%),radial-gradient(circle_at_85%_8%,rgba(192,193,255,0.10),transparent_20%),radial-gradient(circle_at_75%_85%,rgba(17,94,106,0.24),transparent_24%),linear-gradient(180deg,#0b0f10_0%,#101415_55%,#0b0f10_100%)] text-foreground">
      <div className="mx-auto grid min-h-screen max-w-400 lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-white/10 bg-black/20 px-4 py-5 backdrop-blur-2xl">
          <div className="flex h-full flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/80">
                <img src={arxLogo} alt="ARX" className="size-4 rounded-full object-contain" />
                ARX
              </div>
            </div>

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
                        ? "flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white shadow-[0_10px_30px_rgba(255,255,255,0.06)]"
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
                    className="h-11 rounded-full border-white/10 bg-black/25 pl-10 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
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
                <AlertTriangle className="size-4 text-white" />
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

            {activeSection === "overview" && (
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
                      onClick={handleRunAudit}
                      className="rounded-full border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
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
                        className={`vault-progress-${progressBucket} h-full rounded-full bg-linear-to-r from-white to-zinc-400 shadow-[0_0_24px_rgba(255,255,255,0.18)]`}
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
            )}

            {activeSection === "audit" && <SecurityAuditPage entries={entries} auditRunId={auditRunId} />}
            {activeSection === "passwords" && (
              <PasswordsPage
                entries={filteredEntries}
                isBusy={isBusy}
                onAddItem={openAddModal}
                onEditItem={handleEditEntry}
                onReveal={handleReveal}
                onDelete={handleDelete}
                onCopyPassword={handleCopyPassword}
                revealedEntryId={revealId}
                revealedPassword={revealedPassword}
                compactRows={settings.compactRows}
                highlightedEntryId={highlightedEntryId}
              />
            )}
            {activeSection === "settings" && (
              <SettingsPage
                settings={settings}
                onSettingsChange={handleSettingsChange}
                onExportBackup={handleExportBackup}
                onImportBackup={handleImportBackup}
              />
            )}
          </div>
        </main>
      </div>

      {isAddModalMounted && (
        <div className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm sm:items-center transition-opacity duration-200 ease-out ${isAddModalVisible ? "opacity-100" : "opacity-0"}`}>
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close add item dialog"
            onClick={closeAddModal}
          />
          <Card className={`relative z-10 flex w-full max-w-2xl max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-3xl border-white/10 bg-[#151a1c]/95 shadow-[0_30px_120px_rgba(0,0,0,0.55)] transition-opacity duration-200 ease-out ${isAddModalVisible ? "opacity-100" : "opacity-0"}`}>
            <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl text-white">
                    {editingEntryId ? "Edit Entry" : "Login Details"}
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    {editingEntryId
                      ? "Update the stored password entry without leaving the page."
                      : "Set one shared label and website, then add one or more username/password rows."}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  onClick={closeAddModal}
                  className="rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4 overflow-y-auto px-6 py-6 pr-3">
              <div className="flex items-center justify-end">
                <Button
                  variant="outline"
                  onClick={() => setNewEntry((current) => ({ ...current, password: generatePassword() }))}
                  className="h-10 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <Sparkles className="mr-2 size-4" />
                  Generate password
                </Button>
              </div>
              {editingEntryId ? (
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
                      className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
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
                      className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
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
                      className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
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
                      className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="entry-tags-modal" className="text-white/80">
                      Tags
                    </Label>
                    <Input
                      id="entry-tags-modal"
                      value={entryTagsText}
                      onChange={(event) => setEntryTagsText(event.target.value)}
                      placeholder="work, finance, shared"
                      className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="entry-label-modal" className="text-white/80">
                        Label
                      </Label>
                      <Input
                        id="entry-label-modal"
                        value={addLabel}
                        onChange={(event) => setAddLabel(event.target.value)}
                        placeholder="e.g. Gmail"
                        className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entry-url-modal" className="text-white/80">
                        Website
                      </Label>
                      <Input
                        id="entry-url-modal"
                        value={addWebsite}
                        onChange={(event) => setAddWebsite(event.target.value)}
                        placeholder="https://mail.google.com"
                        className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="entry-tags-modal" className="text-white/80">
                        Tags
                      </Label>
                      <Input
                        id="entry-tags-modal"
                        value={addTagsText}
                        onChange={(event) => setAddTagsText(event.target.value)}
                        placeholder="gmail, work, personal"
                        className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-[22px] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">Account rows</p>
                        <p className="text-xs text-white/55">Add one row per login. Each row becomes a separate saved entry.</p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setAddRows((current) => [...current, createAddAccountRow()])}
                        className="h-9 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                      >
                        <Plus className="mr-2 size-4" />
                        Add row
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {addRows.map((row, index) => (
                        <div key={row.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                          <div className="space-y-2">
                            <Label className="text-white/80" htmlFor={`row-username-${row.id}`}>
                              Username {index + 1}
                            </Label>
                            <Input
                              id={`row-username-${row.id}`}
                              value={row.username}
                              onChange={(event) =>
                                setAddRows((current) =>
                                  current.map((item) =>
                                    item.id === row.id ? { ...item, username: event.target.value } : item,
                                  ),
                                )
                              }
                              placeholder="john@gmail.com"
                              className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/80" htmlFor={`row-password-${row.id}`}>
                              Password
                            </Label>
                            <Input
                              id={`row-password-${row.id}`}
                              type="password"
                              value={row.password}
                              onChange={(event) =>
                                setAddRows((current) =>
                                  current.map((item) =>
                                    item.id === row.id ? { ...item, password: event.target.value } : item,
                                  ),
                                )
                              }
                              placeholder="Minimum 8 characters"
                              className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
                            />
                          </div>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setAddRows((current) =>
                                current.length === 1 ? current : current.filter((item) => item.id !== row.id),
                              )
                            }
                            disabled={addRows.length === 1}
                            className="h-11 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <Button
                onClick={handleSaveEntry}
                disabled={isBusy}
                className="h-11 w-full rounded-2xl bg-white text-sm font-semibold text-slate-950 shadow-[0_16px_30px_rgba(255,255,255,0.14)] hover:bg-white/90"
              >
                {editingEntryId ? "Update entry" : "Save entries"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default App;
