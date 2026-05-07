import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  AlertTriangle,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Star,
  User,
  Briefcase,
  Share2,
  Wallet,
  Shield as ShieldIcon,
  Dice5,
  History,
  Eye,
  EyeOff,
  GraduationCap,
  Gamepad2,
  Menu
} from "lucide-react";
import { CommandPalette } from "./components/CommandPalette";
import arxLogo from "./assets/ARX.png";
import { Sidebar } from "./components/layout/Sidebar";

import {
  decideInitialMode,
  sortEntriesByUpdated,
  type VaultMode,
} from "./ai/agents/uiAgent";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./components/ui/alert-dialog";
import {
  Card,
  CardContent,
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
import { SecurityDashboard } from "./components/SecurityDashboard";
import { TrashPage } from "./pages/TrashPage";
import { SecureNotesPage } from "./pages/SecureNotesPage";
import { AuthenticatorPage } from "./pages/AuthenticatorPage";

import type {
  SidebarSection,
  VaultEntry,
  VaultEntryInput,
  VaultEntrySummary,
  VaultSettings,
  VaultStatus,
  PasswordHistoryEntry,
} from "./types/vault";

const EMPTY_ENTRY: VaultEntryInput = {
  label: "",
  username: "",
  password: "",
  url: "",
  notes: "",
  tags: [],
  category: "Other",
  isFavorite: false,
  entryType: "login",
};

const DEFAULT_SETTINGS: VaultSettings = {
  autoLockMinutes: 5,
  revealTimeoutSeconds: 10,
  clipboardClearSeconds: 15,
  defaultSection: "overview",
  theme: "obsidian",
  generator: {
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
  },
};

type AddAccountRow = {
  id: string;
  username: string;
  password: string;
};

function createAddAccountRow(overrides?: Partial<AddAccountRow>) {
  return {
    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    username: "",
    password: "",
    ...overrides,
  };
}

function generatePassword(settings: VaultSettings["generator"]) {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*_-";

  let alphabet = "";
  if (settings.includeUppercase) alphabet += uppercase;
  if (settings.includeLowercase) alphabet += lowercase;
  if (settings.includeNumbers) alphabet += numbers;
  if (settings.includeSymbols) alphabet += symbols;

  if (!alphabet) alphabet = lowercase + numbers;

  const length = settings.length;
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}


function App() {
  const [mode, setMode] = useState<VaultMode>("loading");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [masterPasswordHint, setMasterPasswordHint] = useState("");
  const [vaultHint, setVaultHint] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [isRecoveryKeyModalOpen, setIsRecoveryKeyModalOpen] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [entries, setEntries] = useState<VaultEntrySummary[]>([]);
  const [trashEntries, setTrashEntries] = useState<VaultEntrySummary[]>([]);
  const [newEntry, setNewEntry] = useState<VaultEntryInput>(EMPTY_ENTRY);
  const [addLabel, setAddLabel] = useState("");
  const [addWebsite, setAddWebsite] = useState("");
  const [addRows, setAddRows] = useState<AddAccountRow[]>([
    createAddAccountRow(),
  ]);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSection, setActiveSection] =
    useState<SidebarSection>("overview");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [isLockConfirmOpen, setIsLockConfirmOpen] = useState(false);
  const [settings, setSettings] = useState<VaultSettings>(DEFAULT_SETTINGS);
  const [currentHistory, setCurrentHistory] = useState<PasswordHistoryEntry[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [activityTick, setActivityTick] = useState(0);
  const [auditRunId, setAuditRunId] = useState(0);
  const [isAddModalMounted, setIsAddModalMounted] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [showRowPasswords, setShowRowPasswords] = useState<Record<string, boolean>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const clipboardTimer = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);

  useEffect(() => {
    if (mode === "unlocked") {
      document.documentElement.setAttribute("data-theme", settings.theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [settings.theme, mode]);

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    let base = entries;

    // Apply manual order if it exists
    if (manualOrder.length > 0) {
      const orderMap = new Map(manualOrder.map((id, index) => [id, index]));
      base = [...entries].sort((a, b) => {
        const posA = orderMap.has(a.id) ? (orderMap.get(a.id) ?? 9999) : 9999;
        const posB = orderMap.has(b.id) ? (orderMap.get(b.id) ?? 9999) : 9999;
        if (posA !== posB) return posA - posB;
        return b.updatedAt - a.updatedAt;
      });
    }

    if (!query) return base;
    return base.filter((entry) => {
      const haystack = [entry.label, entry.username, entry.url ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [entries, searchTerm, manualOrder]);

  const highlightedEntryId = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return null;

    const exactMatch = filteredEntries.find((entry) => {
      return (
        entry.label.trim().toLowerCase() === query ||
        entry.username.trim().toLowerCase() === query
      );
    });

    return (exactMatch ?? filteredEntries[0])?.id ?? null;
  }, [filteredEntries, searchTerm]);

  const totalItems = entries.length;
  const vaultHealth = useMemo(() => {
    if (entries.length === 0) return 0;
    const stored = window.localStorage.getItem("arx-audit-history");
    if (stored) {
      try {
        const history = JSON.parse(stored);
        if (history && history.length > 0) {
          return history[0].score;
        }
      } catch (e) {
        // ignore
      }
    }
    // Fallback to simple calculation if no audit run yet
    return Math.min(96, 68 + entries.length * 4);
  }, [entries.length, auditRunId]);

  const progressBucket = useMemo(() => {
    return Math.min(100, Math.max(0, Math.round(vaultHealth / 10) * 10));
  }, [vaultHealth]);

  const activeSectionTitle = useMemo(() => {
    switch (activeSection) {
      case "audit":
        return "Security Audit";
      case "passwords":
        return "Password Manager";
      case "notes":
        return "Secure Notes";
      case "trash":
        return "Trash Bin";
      case "settings":
        return "Settings";
      default:
        return "Vault Overview";
    }
  }, [activeSection]);

  useEffect(() => {
    let alive = true;
    const loadStatus = async () => {
      setIsBusy(true);
      setError(null);
      try {
        const status = await invoke<VaultStatus & { hint?: string }>(
          "vault_status",
        );
        if (!alive) return;
        setVaultHint(status.hint ?? null);
        setMode(
          status.isUnlocked ? "unlocked" : decideInitialMode(status.hasVault),
        );
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

  const refreshVaultStatus = async () => {
    try {
      const status = await invoke<VaultStatus>("vault_status");
      setVaultHint(status.hint ?? null);
      setMode(
        status.isUnlocked ? "unlocked" : decideInitialMode(status.hasVault),
      );
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => {
    const stored = window.localStorage.getItem("arx-settings");
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
      window.localStorage.removeItem("arx-settings");
    }
  }, []);

  useEffect(() => {
    const storedOrder = window.localStorage.getItem("arx-entry-order");
    if (storedOrder) {
      try {
        setManualOrder(JSON.parse(storedOrder) as string[]);
      } catch {
        window.localStorage.removeItem("arx-entry-order");
      }
    }
  }, []);

  useEffect(() => {
    if (mode !== "unlocked") return;
    loadEntries();
    loadTrashEntries();
  }, [mode]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

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

  const loadTrashEntries = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const data = await invoke<VaultEntrySummary[]>("get_trash_passwords");
      setTrashEntries(sortEntriesByUpdated(data));
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleInitVault = async () => {
    if (masterPassword.length < 6) {
      setError("Master password must be at least 6 characters.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const key = await invoke<string>("init_vault", {
        masterPassword,
        hint: masterPasswordHint.trim() || null,
      });
      setRecoveryKey(key);
      setMasterPassword("");
      setMasterPasswordHint("");
      setIsRecoveryKeyModalOpen(true);
      await refreshVaultStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (masterPassword.length < 6) {
      setError("Master password must be at least 6 characters.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await invoke("unlock_vault", { masterPassword });
      setMasterPassword("");
      await refreshVaultStatus();
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
      setNewEntry(EMPTY_ENTRY);
      setRevealId(null);
      setRevealedPassword(null);
      if (clipboardTimer.current) {
        window.clearTimeout(clipboardTimer.current);
        clipboardTimer.current = null;
      }
      setShowHint(false);
      await refreshVaultStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleRecoverVault = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await invoke("recover_vault", { recoveryKey: recoveryInput.trim() });
      setRecoveryInput("");
      setIsRecovering(false);
      await refreshVaultStatus();
      setSuccess(
        "Vault recovered successfully! You can now change your master password in Settings.",
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetVault = async () => {
    setIsBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await invoke("reset_vault");
      setEntries([]);
      setTrashEntries([]);
      setMode("setup");
      setIsRecoveryKeyModalOpen(false);
      setNewEntry(EMPTY_ENTRY);
      setAddLabel("");
      setAddWebsite("");
      setAddRows([createAddAccountRow()]);
      setSearchTerm("");
      setMasterPassword("");
      setMasterPasswordHint("");
      setVaultHint(null);
      setRecoveryKey(null);
      setRecoveryInput("");
      setIsRecovering(false);
      setRevealId(null);
      setRevealedPassword(null);
      setIsAddModalOpen(false);
      setEditingEntryId(null);
      setActiveSection("overview");
      setMode("setup");
      setSuccess("Vault has been wiped successfully.");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const openAddNoteModal = () => {
    setError(null);
    setEditingEntryId(null);
    setNewEntry({ ...EMPTY_ENTRY, entryType: "note" });
    setAddLabel("");
    setAddWebsite("");
    setAddRows([createAddAccountRow()]);
    setIsAddModalOpen(true);
  };

  const openAddAuthenticatorModal = () => {
    setError(null);
    setEditingEntryId(null);
    setNewEntry({ ...EMPTY_ENTRY, entryType: "totp" });
    setAddLabel("");
    setAddWebsite("");
    setAddRows([createAddAccountRow()]);
    setIsAddModalOpen(true);
  };

  const handleSaveEntry = async () => {
    const labelToValidate = editingEntryId ? newEntry.label : addLabel;
    if (!labelToValidate.trim()) {
      setError("Label is required.");
      return;
    }

    if (!editingEntryId && newEntry.entryType === "login") {
      const validRows = addRows.filter(
        (row) => row.username.trim() && row.password.length >= 6,
      );

      if (validRows.length === 0) {
        setError("Add at least one username and password row.");
        return;
      }
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
          notes: newEntry.notes?.trim() ? newEntry.notes.trim() : undefined,
          tags: [],
          category: newEntry.category,
          isFavorite: newEntry.isFavorite,
          entryType: newEntry.entryType,
          totpSecret: newEntry.totpSecret,
        };
        await invoke("update_password", { id: editingEntryId, entry: payload });
      } else if (newEntry.entryType === "note") {
        await invoke("add_password", {
          entry: {
            label: addLabel.trim(),
            username: "",
            password: "",
            url: undefined,
            notes: newEntry.notes?.trim() ? newEntry.notes.trim() : undefined,
            tags: [],
            category: newEntry.category,
            isFavorite: newEntry.isFavorite,
            entryType: "note",
          },
        });
      } else if (newEntry.entryType === "totp") {
        await invoke("add_password", {
          entry: {
            label: addLabel.trim(),
            username: newEntry.username.trim(),
            password: "",
            url: addWebsite.trim() ? addWebsite.trim() : undefined,
            notes: newEntry.notes?.trim() ? newEntry.notes.trim() : undefined,
            tags: [],
            category: newEntry.category,
            isFavorite: newEntry.isFavorite,
            entryType: "totp",
            totpSecret: newEntry.totpSecret,
          },
        });
      } else {
        const validRows = addRows.filter(
          (row) => row.username.trim() && row.password.length >= 6,
        );
        for (const row of validRows) {
          await invoke("add_password", {
            entry: {
              label: addLabel.trim(),
              username: row.username.trim(),
              password: row.password,
              url: addWebsite.trim() ? addWebsite.trim() : undefined,
              notes: newEntry.notes?.trim() ? newEntry.notes.trim() : undefined,
              tags: [],
              category: newEntry.category,
              isFavorite: newEntry.isFavorite,
              entryType: "login",
            },
          });
        }
      }
      setNewEntry(EMPTY_ENTRY);
      setAddLabel("");
      setAddWebsite("");
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
      await loadTrashEntries();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestore = async (id: string) => {
    setIsBusy(true);
    setError(null);
    try {
      await invoke("restore_password", { id });
      await loadEntries();
      await loadTrashEntries();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    setIsBusy(true);
    setError(null);
    try {
      await invoke("permanently_delete_password", { id });
      await loadTrashEntries();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleReveal = async (id: string) => {
    if (revealId === id) {
      setRevealId(null);
      setRevealedPassword(null);
      if (revealTimer.current) {
        window.clearTimeout(revealTimer.current);
        revealTimer.current = null;
      }
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const password = await invoke<string>("get_password", { id });
      setRevealId(id);
      setRevealedPassword(password);

      if (revealTimer.current) {
        window.clearTimeout(revealTimer.current);
      }

      revealTimer.current = window.setTimeout(() => {
        setRevealId(null);
        setRevealedPassword(null);
        revealTimer.current = null;
      }, settings.revealTimeoutSeconds * 1000);

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
      clipboardTimer.current = null;
    }
    if (settings.clipboardClearSeconds > 0) {
      clipboardTimer.current = window.setTimeout(() => {
        void navigator.clipboard.writeText("");
        clipboardTimer.current = null;
      }, settings.clipboardClearSeconds * 1000);
    }
  };

  const openAddModal = () => {
    setError(null);
    setEditingEntryId(null);
    setNewEntry(EMPTY_ENTRY);
    setAddLabel("");
    setAddWebsite("");
    setAddRows([createAddAccountRow()]);
    setIsAddModalOpen(true);
  };

  const openResetConfirm = () => {
    setError(null);
    setIsResetConfirmOpen(true);
  };

  const openLockConfirm = () => {
    setError(null);
    setIsSidebarOpen(false);
    setIsLockConfirmOpen(true);
  };

  const closeLockConfirm = () => {
    if (isBusy) return;
    setIsLockConfirmOpen(false);
  };

  const confirmLockVault = async () => {
    setIsLockConfirmOpen(false);
    await handleLock();
  };

  const closeResetConfirm = () => {
    if (isBusy) return;
    setIsResetConfirmOpen(false);
  };

  const confirmResetVault = async () => {
    setIsResetConfirmOpen(false);
    await handleResetVault();
  };

  const openImportConfirm = () => {
    setError(null);
    setIsImportConfirmOpen(true);
  };

  const closeImportConfirm = () => {
    if (isBusy) return;
    setIsImportConfirmOpen(false);
  };

  const confirmImportBackup = async () => {
    setIsImportConfirmOpen(false);
    await handleImportBackup();
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setAddLabel("");
    setAddWebsite("");
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
      setCurrentHistory(fullEntry.passwordHistory ?? []);
      setNewEntry({
        label: fullEntry.label,
        username: fullEntry.username,
        password: fullEntry.password,
        url: fullEntry.url ?? "",
        notes: fullEntry.notes ?? "",
        tags: fullEntry.tags,
        category: fullEntry.category,
        isFavorite: fullEntry.isFavorite,
        entryType: fullEntry.entryType,
      });
      setIsAddModalOpen(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleReorder = (newEntries: VaultEntrySummary[]) => {
    const newOrder = newEntries.map((e) => e.id);
    setManualOrder(newOrder);
    window.localStorage.setItem("arx-entry-order", JSON.stringify(newOrder));
  };

  const handleSettingsChange = (nextSettings: VaultSettings) => {
    setSettings(nextSettings);
  };

  const handleExportBackup = async () => {
    setError(null);
    setSuccess(null);
    try {
      const backup = await invoke<{ vaultFile: unknown }>("export_vault");
      const content = JSON.stringify(backup, null, 2);

      const filePath = await save({
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
        defaultPath: `arx-vault-backup-${Date.now()}.json`,
      });

      if (filePath) {
        await writeTextFile(filePath, content);
        setSuccess("Backup exported successfully.");
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleImportBackup = async () => {
    setError(null);
    setSuccess(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
      });

      if (selected && !Array.isArray(selected)) {
        const raw = await readTextFile(selected);
        const backup = JSON.parse(raw) as { vaultFile?: unknown };
        await invoke("import_vault", { backup });

        // Clear all state immediately to prevent confusion
        setEntries([]);
        setIsAddModalOpen(false);
        setAddLabel("");
        setAddWebsite("");
        setAddRows([createAddAccountRow()]);
        setEditingEntryId(null);
        setNewEntry(EMPTY_ENTRY);
        setRevealId(null);
        setRevealedPassword(null);

        // IMPORTANT: Clear recovery modal state so they don't think 
        // the "new" recovery key applies to the "old" imported vault
        setIsRecoveryKeyModalOpen(false);
        setRecoveryKey(null);

        setShowHint(false);
        await refreshVaultStatus();
        setSuccess(
          "Vault imported successfully. Please unlock using the backup's original master password.",
        );
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleFixEntry = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (entry) {
      setSearchTerm(entry.label);
      setActiveSection("passwords");
      await handleEditEntry(id);
    }
  };

  const handleRegenerateRecoveryKey = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const key = await invoke<string>("regenerate_recovery_key");
      setRecoveryKey(key);
      setIsRecoveryKeyModalOpen(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    if (mode !== "unlocked") return;

    const bumpActivity = () => setActivityTick((value) => value + 1);
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "mousemove",
      "focus",
      "touchstart",
      "wheel",
    ];

    events.forEach((eventName) =>
      window.addEventListener(eventName, bumpActivity, { passive: true }),
    );

    // Also lock when the window is hidden for more than 1 minute (optional but good for security)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // If hidden, we could potentially lock sooner, 
        // but for now we'll just keep the idle timer running.
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const timer = window.setTimeout(
      () => {
        void handleLock();
      },
      settings.autoLockMinutes * 60 * 1000,
    );

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      events.forEach((eventName) =>
        window.removeEventListener(eventName, bumpActivity),
      );
    };
  }, [activityTick, handleLock, mode, settings.autoLockMinutes]);

  useEffect(() => {
    if (mode !== "unlocked") return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      const isSpace = e.key === " ";

      // Support Ctrl+K or Ctrl+Space (fallback)
      if ((e.ctrlKey || e.metaKey) && (isK || isSpace)) {
        e.preventDefault();
        e.stopPropagation();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    // Use capture phase to ensure we catch it first
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [mode]);

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
      <StarsBackground className="min-h-screen text-white" starColor="var(--theme-star-color)">
        <div className="flex min-h-screen items-center justify-center px-4 text-white">
          <Card className="w-full max-w-sm border border-white/15 bg-zinc-950/95 shadow-[0_30px_120px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <CardContent className="flex flex-col items-center gap-6 px-8 py-10 text-center">
              <img
                src={arxLogo}
                alt="ARX"
                className="h-28 w-28 object-contain"
              />
              <CardTitle className="text-5xl font-semibold tracking-[0.35em] text-white">
                ARX
              </CardTitle>
            </CardContent>
          </Card>
        </div>
      </StarsBackground>
    );
  }

  if (mode !== "unlocked") {
    return (
      <>
        <StarsBackground className="min-h-screen text-white" starColor="var(--theme-star-color)">
          <div className="flex min-h-screen items-center justify-center px-4 text-white">
            <Card className="w-full max-w-sm border border-white/15 bg-zinc-950/95 shadow-[0_30px_120px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
              <CardContent className="space-y-6 px-8 py-10">
                <div className="flex flex-col items-center gap-5 text-center">
                  <img
                    src={arxLogo}
                    alt="ARX"
                    className="h-28 w-28 object-contain"
                  />
                  <CardTitle className="text-5xl font-semibold tracking-[0.35em] text-white">
                    ARX
                  </CardTitle>
                </div>

                {error && (
                  <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white">
                    <p className="font-medium">Action failed</p>
                    <p className="mt-1 text-white/75">{error}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="unlock-password"
                      className="text-sm text-white/80"
                    >
                      {mode === "setup"
                        ? "New master password"
                        : "Master password"}
                    </Label>
                    <div className="relative">
                      <Input
                        id="unlock-password"
                        type={showMasterPassword ? "text" : "password"}
                        value={masterPassword}
                        onChange={(event) =>
                          setMasterPassword(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void (mode === "setup" ? handleInitVault() : handleUnlock());
                          }
                        }}
                        placeholder={
                          mode === "setup"
                            ? "Create master password"
                            : "Enter master password"
                        }
                        className="h-12 rounded-2xl border-white/15 bg-black text-white placeholder:text-white/30 focus-visible:border-white focus-visible:ring-white/20 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMasterPassword(!showMasterPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                      >
                        {showMasterPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {mode === "setup" && (
                    <div className="space-y-2">
                      <Label
                        htmlFor="setup-hint"
                        className="text-sm text-white/80"
                      >
                        Password hint (optional)
                      </Label>
                      <Input
                        id="setup-hint"
                        value={masterPasswordHint}
                        onChange={(event) =>
                          setMasterPasswordHint(event.target.value)
                        }
                        placeholder="e.g. My childhood pet's name"
                        className="h-12 rounded-2xl border-white/15 bg-black text-white placeholder:text-white/30 focus-visible:border-white focus-visible:ring-white/20"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {isRecovering ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="space-y-2">
                        <Label
                          htmlFor="recovery-key"
                          className="text-sm text-white/80"
                        >
                          Emergency Recovery Key
                        </Label>
                        <Input
                          id="recovery-key"
                          value={recoveryInput}
                          onChange={(e) => setRecoveryInput(e.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleRecoverVault();
                            }
                          }}
                          placeholder="XXXX-XXXX-XXXX-XXXX"
                          className="h-12 rounded-2xl border-white/15 bg-black text-white placeholder:text-white/30 focus-visible:border-white focus-visible:ring-white/20 font-mono uppercase"
                        />
                        <p className="text-[10px] text-white/40 uppercase tracking-widest text-center px-4 leading-relaxed">
                          Enter your emergency key to restore access without
                          your password.
                        </p>
                      </div>
                      <Button
                        onClick={handleRecoverVault}
                        disabled={isBusy || !recoveryInput}
                        className="h-12 w-full rounded-2xl bg-white text-sm font-semibold text-black hover:bg-white/90"
                      >
                        Restore Access
                      </Button>
                      <button
                        onClick={() => setIsRecovering(false)}
                        className="w-full text-xs text-white/45 hover:text-white transition-colors"
                      >
                        Back to Login
                      </button>
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={
                          mode === "setup" ? handleInitVault : handleUnlock
                        }
                        disabled={isBusy}
                        size="lg"
                        className="h-12 w-full rounded-2xl border border-white bg-white text-sm font-semibold text-black shadow-none hover:bg-white/90"
                      >
                        {mode === "setup" ? "Create vault" : "Unlock vault"}
                      </Button>

                      {mode !== "setup" && (
                        <div className="text-center space-y-4">
                          <div className="flex flex-col gap-2">
                            {vaultHint && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setShowHint(!showHint)}
                                  className="text-xs text-white/45 hover:text-white transition-colors"
                                >
                                  View password hint
                                </button>
                                {showHint && (
                                  <p className="mt-1 text-sm text-white/70 italic bg-white/5 p-3 rounded-xl border border-white/10 animate-in fade-in slide-in-from-top-1 duration-300">
                                    Hint: {vaultHint}
                                  </p>
                                )}
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setIsRecovering(true)}
                              className="text-xs text-white/45 hover:text-white transition-colors"
                            >
                              Lost password? Use Recovery Key
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </StarsBackground>

      </>
    );
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto grid min-h-screen max-w-400 lg:grid-cols-[260px_1fr]">
        <Sidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          onLock={openLockConfirm}
          isBusy={isBusy}
          theme={settings.theme}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Floating Burger Button - Only visible on mobile */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsSidebarOpen(true)}
          className="fixed left-6 top-6 z-40 h-14 w-14 rounded-2xl border-white/10 bg-black/50 text-white backdrop-blur-md hover:bg-white/10 lg:hidden shadow-2xl"
        >
          <Menu className="size-7" />
        </Button>

        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex h-full flex-col gap-6">
            <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-5 md:flex-row md:items-center md:justify-between mt-12 lg:mt-0">
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <div className="relative w-full max-w-xl">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search vault (Ctrl + K)..."
                    className="h-11 rounded-full border-white/10 bg-black/25 pl-10 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
                  />
                </div>
              </div>

              <div className="flex w-full md:w-auto items-center gap-2 md:justify-end">
                <Button
                  variant="outline"
                  onClick={openAddModal}
                  className="flex-1 md:flex-none h-11 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <Plus className="mr-2 size-4" />
                  Add Item
                </Button>
                <Button
                  variant="outline"
                  onClick={openLockConfirm}
                  disabled={isBusy}
                  className="flex-1 md:flex-none h-11 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <LockKeyhole className="mr-2 size-4" />
                  Lock
                </Button>
              </div>
            </header>

            {error && (
              <Alert
                variant="destructive"
                className="border-white/10 bg-white/5 text-white"
              >
                <AlertTriangle className="size-4 text-white" />
                <AlertTitle className="text-white">Action failed</AlertTitle>
                <AlertDescription className="text-white/75">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-white/10 bg-white/5 text-white">
                <ShieldCheck className="size-4 text-white" />
                <AlertTitle className="text-white">Success</AlertTitle>
                <AlertDescription className="text-white/75">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            <section className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
                {activeSectionTitle}
              </h1>
            </section>

            {activeSection === "overview" && (
              <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <SecurityDashboard />

                <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.7fr)]">
                  <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
                    <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <CardTitle className="text-xl text-white">
                            Vault Health
                          </CardTitle>
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
                          Local encrypted storage active.
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
                            <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                              {item.label}
                            </p>
                            <p className="mt-2 text-base font-medium text-white">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1">
                    <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
                      <CardContent className="space-y-2 px-6 py-6">
                        <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                          Total items
                        </p>
                        <p className="text-5xl font-semibold tracking-tight text-white">
                          {totalItems}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
                      <CardContent className="space-y-3 px-6 py-6">
                        <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                          Recent activity
                        </p>
                        <div className="space-y-3">
                          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                            {totalItems > 0
                              ? `${totalItems} entries available.`
                              : "Awaiting first vault item."}
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                            No cloud sync. No plaintext secrets.
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </section>
              </section>
            )}

            {activeSection === "audit" && (
              <SecurityAuditPage
                entries={entries}
                auditRunId={auditRunId}
                onFixEntry={handleFixEntry}
              />
            )}
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
                onReorder={handleReorder}
                highlightedEntryId={highlightedEntryId}
              />
            )}
            {activeSection === "trash" && (
              <TrashPage
                entries={trashEntries}
                isBusy={isBusy}
                onRestore={handleRestore}
                onDeleteForever={handlePermanentDelete}
              />
            )}
            {activeSection === "settings" && (
              <SettingsPage
                settings={settings}
                onSettingsChange={handleSettingsChange}
                onExportBackup={handleExportBackup}
                onImportBackup={openImportConfirm}
                onRegenerateRecoveryKey={handleRegenerateRecoveryKey}
                onResetVault={openResetConfirm}
              />
            )}
            {activeSection === "notes" && (
              <SecureNotesPage
                entries={entries}
                searchTerm={searchTerm}
                onAddNote={openAddNoteModal}
                onEditNote={handleEditEntry}
                onDeleteNote={handleDelete}
              />
            )}
            {activeSection === "totp" && (
              <AuthenticatorPage
                entries={entries}
                searchTerm={searchTerm}
                onAddAuthenticator={openAddAuthenticatorModal}
                onDeleteAuthenticator={handleDelete}
              />
            )}
          </div>
        </main>
      </div>

        {isAddModalMounted && (
        <div
          className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm sm:items-center transition-opacity duration-200 ease-out ${isAddModalVisible ? "opacity-100" : "opacity-0"}`}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close add item dialog"
            onClick={closeAddModal}
          />
          <Card
            className={`relative z-10 flex w-full max-w-2xl max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-3xl border-white/10 bg-[#151a1c]/95 shadow-[0_30px_120px_rgba(0,0,0,0.55)] transition-opacity duration-200 ease-out ${isAddModalVisible ? "opacity-100" : "opacity-0"}`}
          >
            <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl text-white">
                    {editingEntryId ? "Edit Entry" : newEntry.entryType === "note" ? "New Secure Note" : "Login Details"}
                  </CardTitle>
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
            <CardContent className="flex-1 space-y-6 overflow-y-auto px-6 py-6 pr-3">
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">
                    Categorize & Prioritize
                  </p>
                  <p className="text-xs text-white/40">
                    Select a folder and toggle favorite status.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Toggle favorite"
                  title="Toggle favorite"
                  onClick={() =>
                    setNewEntry((prev) => ({
                      ...prev,
                      isFavorite: !prev.isFavorite,
                    }))
                  }
                  className={`p-2.5 rounded-xl border transition-all ${newEntry.isFavorite ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-500" : "bg-white/5 border-white/10 text-white/40 hover:text-white"}`}
                >
                  <Star
                    className={`size-5 ${newEntry.isFavorite ? "fill-current" : ""}`}
                  />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  ["Personal", "Work", "School", "Games", "Social", "Finance", "Other"] as const
                ).map((cat) => {
                  const Icon =
                    cat === "Personal"
                      ? User
                      : cat === "Work"
                        ? Briefcase
                        : cat === "School"
                          ? GraduationCap
                          : cat === "Games"
                            ? Gamepad2
                            : cat === "Social"
                              ? Share2
                              : cat === "Finance"
                                ? Wallet
                                : ShieldIcon;
                  return (
                    <button
                      key={cat}
                      onClick={() =>
                        setNewEntry((prev) => ({ ...prev, category: cat }))
                      }
                      className={`flex flex-1 justify-center items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-medium ${newEntry.category === cat ? "bg-white text-slate-950 border-white" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"}`}
                    >
                      <Icon className="size-3.5" />
                      {cat}
                    </button>
                  );
                })}
              </div>
              {newEntry.entryType === "note" && (
                <div className="space-y-2">
                  <Label htmlFor="note-label-modal" className="text-white/80">
                    Note Label
                  </Label>
                  <Input
                    id="note-label-modal"
                    value={editingEntryId ? newEntry.label : addLabel}
                    onChange={(e) => {
                      if (editingEntryId) {
                        setNewEntry(prev => ({ ...prev, label: e.target.value }));
                      } else {
                        setAddLabel(e.target.value);
                      }
                    }}
                    placeholder="e.g. My Recovery Phrase"
                    className="h-11 rounded-2xl border-white/10 bg-black/20 text-white focus-visible:border-white/35"
                  />
                </div>
              )}
              {newEntry.entryType === "totp" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="totp-label-modal" className="text-white/80">
                        Label
                      </Label>
                      <Input
                        id="totp-label-modal"
                        value={editingEntryId ? newEntry.label : addLabel}
                        onChange={(e) => {
                          if (editingEntryId) {
                            setNewEntry(prev => ({ ...prev, label: e.target.value }));
                          } else {
                            setAddLabel(e.target.value);
                          }
                        }}
                        placeholder="e.g. Gmail"
                        className="h-11 rounded-2xl border-white/10 bg-black/20 text-white focus-visible:border-white/35"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totp-username-modal" className="text-white/80">
                        Username / Email
                      </Label>
                      <Input
                        id="totp-username-modal"
                        value={newEntry.username}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="alex@example.com"
                        className="h-11 rounded-2xl border-white/10 bg-black/20 text-white focus-visible:border-white/35"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totp-secret-modal" className="text-white/80">
                      Secret Key / OTP URL
                    </Label>
                    <Input
                      id="totp-secret-modal"
                      value={newEntry.totpSecret || ""}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, totpSecret: e.target.value }))}
                      placeholder="Enter secret key or paste otpauth:// URI"
                      className="h-11 rounded-2xl border-white/10 bg-black/20 text-white focus-visible:border-white/35 font-mono"
                    />
                  </div>
                </div>
              )}

              {newEntry.entryType === "login" && (
                editingEntryId ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="entry-label-modal"
                        className="text-white/80"
                      >
                        Label
                      </Label>
                      <Input
                        id="entry-label-modal"
                        value={newEntry.label}
                        onChange={(e) =>
                          setNewEntry((prev) => ({
                            ...prev,
                            label: e.target.value,
                          }))
                        }
                        placeholder="e.g. Dribbble"
                        className="h-11 rounded-2xl border-white/10 bg-black/20 text-white focus-visible:border-white/35"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="entry-username-modal"
                        className="text-white/80"
                      >
                        Username
                      </Label>
                      <Input
                        id="entry-username-modal"
                        value={newEntry.username}
                        onChange={(e) =>
                          setNewEntry((prev) => ({
                            ...prev,
                            username: e.target.value,
                          }))
                        }
                        placeholder="alex@example.com"
                        className="h-11 rounded-2xl border-white/10 bg-black/20 text-white focus-visible:border-white/35"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="entry-password-modal"
                        className="text-white/80"
                      >
                        Password
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="entry-password-modal"
                            type={showModalPassword ? "text" : "password"}
                            value={newEntry.password}
                            onChange={(e) =>
                              setNewEntry((prev) => ({
                                ...prev,
                                password: e.target.value,
                              }))
                            }
                            placeholder="Minimum 6 characters"
                            className="h-11 rounded-2xl border-white/10 bg-black/20 text-white focus-visible:border-white/35 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowModalPassword(!showModalPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                          >
                            {showModalPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setNewEntry((prev) => ({
                              ...prev,
                              password: generatePassword(settings.generator),
                            }))
                          }
                          className="h-11 w-11 shrink-0 rounded-2xl border-white/10 bg-white/5 p-0 text-white hover:bg-white/10"
                          title="Generate password"
                        >
                          <Dice5 className="size-4" />
                        </Button>
                        {editingEntryId && currentHistory.length > 0 && (
                          <div className="relative group/history">
                            <Button
                              variant="outline"
                              className="h-11 w-11 shrink-0 rounded-2xl border-white/10 bg-white/5 p-0 text-white hover:bg-white/10"
                              title="View History"
                            >
                              <History className="size-4" />
                            </Button>
                            <div className="absolute right-0 top-full mt-2 w-64 p-3 rounded-2xl border border-white/10 bg-[#1a1f21] shadow-2xl opacity-0 scale-95 pointer-events-none group-hover/history:opacity-100 group-hover/history:scale-100 group-hover/history:pointer-events-auto transition-all duration-200 z-50">
                              <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-3 px-1">Password History</p>
                              <div className="space-y-1.5">
                                {currentHistory.map((h, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setNewEntry(prev => ({ ...prev, password: h.password }))}
                                    className="w-full text-left p-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group/item"
                                  >
                                    <p className="text-xs font-mono text-white/80 truncate">{h.password}</p>
                                    <p className="text-[9px] text-white/30 mt-0.5">Changed {new Date(h.changedAt * 1000).toLocaleDateString()}</p>
                                  </button>
                                )).reverse()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entry-url-modal" className="text-white/80">
                        Website
                      </Label>
                      <Input
                        id="entry-url-modal"
                        value={newEntry.url}
                        onChange={(e) =>
                          setNewEntry((prev) => ({
                            ...prev,
                            url: e.target.value,
                          }))
                        }
                        placeholder="https://"
                        className="h-11 rounded-2xl border-white/10 bg-black/20 text-white focus-visible:border-white/35"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label
                          htmlFor="entry-label-modal"
                          className="text-white/80"
                        >
                          Label
                        </Label>
                        <Input
                          id="entry-label-modal"
                          value={addLabel}
                          onChange={(e) => setAddLabel(e.target.value)}
                          placeholder="e.g. Gmail"
                          className="h-11 rounded-2xl border-white/10 bg-black/20 text-white focus-visible:border-white/35"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="entry-url-modal"
                          className="text-white/80"
                        >
                          Website
                        </Label>
                        <Input
                          id="entry-url-modal"
                          value={addWebsite}
                          onChange={(e) => setAddWebsite(e.target.value)}
                          placeholder="https://mail.google.com"
                          className="h-11 rounded-2xl border-white/10 bg-black/20 text-white focus-visible:border-white/35"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-[22px] border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">
                          Account rows
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setAddRows((current) => [
                              ...current,
                              createAddAccountRow(),
                            ])
                          }
                          className="h-9 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                        >
                          <Plus className="mr-2 size-4" />
                          Add row
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {addRows.map((row, index) => (
                          <div
                            key={row.id}
                            className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
                          >
                            <div className="space-y-2">
                              <Label
                                className="text-white/80"
                                htmlFor={`row-username-${row.id}`}
                              >
                                Username {index + 1}
                              </Label>
                              <Input
                                id={`row-username-${row.id}`}
                                value={row.username}
                                onChange={(e) =>
                                  setAddRows((current) =>
                                    current.map((item) =>
                                      item.id === row.id
                                        ? { ...item, username: e.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="john@gmail.com"
                                className="h-11 rounded-2xl border-white/10 bg-black/20 text-white focus-visible:border-white/35"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                className="text-white/80"
                                htmlFor={`row-password-${row.id}`}
                              >
                                Password
                              </Label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Input
                                    id={`row-password-${row.id}`}
                                    type={showRowPasswords[row.id] ? "text" : "password"}
                                    value={row.password}
                                    onChange={(e) =>
                                      setAddRows((current) =>
                                        current.map((item) =>
                                          item.id === row.id
                                            ? { ...item, password: e.target.value }
                                            : item,
                                        ),
                                      )
                                    }
                                    placeholder="Minimum 6 characters"
                                    className="h-11 rounded-2xl border-white/10 bg-black/20 text-white focus-visible:border-white/35 pr-10"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowRowPasswords(prev => ({ ...prev, [row.id]: !prev[row.id] }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                                  >
                                    {showRowPasswords[row.id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                  </button>
                                </div>
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    setAddRows((current) =>
                                      current.map((item) =>
                                        item.id === row.id
                                          ? { ...item, password: generatePassword(settings.generator) }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="h-11 w-11 shrink-0 rounded-2xl border-white/10 bg-white/5 p-0 text-white hover:bg-white/10"
                                  title="Generate strong password"
                                >
                                  <Dice5 className="size-4" />
                                </Button>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() =>
                                setAddRows((current) =>
                                  current.length === 1
                                    ? current
                                    : current.filter(
                                      (item) => item.id !== row.id,
                                    ),
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
                )
              )}

              <div className="space-y-2">
                <Label htmlFor="entry-notes-modal" className="text-white/80">
                  {newEntry.entryType === "note" ? "Note Content" : "Additional Notes"}
                </Label>
                <textarea
                  id="entry-notes-modal"
                  value={newEntry.notes}
                  onChange={(e) =>
                    setNewEntry((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder={newEntry.entryType === "note" ? "Paste your sensitive note content here..." : "Optional details..."}
                  className={`w-full ${newEntry.entryType === "note" ? "min-h-75" : "min-h-25"} rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all`}
                />
              </div>
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

      {isResetConfirmOpen && (
        <AlertDialog open={isResetConfirmOpen} onOpenChange={(open) => !open && closeResetConfirm()}>
          <AlertDialogContent className="rounded-4xl border-white/10 bg-[#0a0a0a]/90 backdrop-blur-3xl shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold text-white">Reset vault?</AlertDialogTitle>
              <AlertDialogDescription className="text-white/45 text-base">
                This cannot be undone. All passwords on this device will be permanently wiped.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-3 border-none bg-transparent mx-0 mb-0 p-0 sm:justify-end">
              <AlertDialogCancel className="rounded-full h-12 px-6 border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmResetVault}
                className="rounded-full h-12 px-8 font-semibold transition-all shadow-lg"
              >
                Reset vault
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isImportConfirmOpen && (
        <AlertDialog open={isImportConfirmOpen} onOpenChange={(open) => !open && closeImportConfirm()}>
          <AlertDialogContent className="rounded-4xl border-white/10 bg-[#0a0a0a]/90 backdrop-blur-3xl shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold text-white">Import backup?</AlertDialogTitle>
              <AlertDialogDescription className="text-white/45 text-base">
                This will replace your current vault data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-[22px] border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] text-red-400">
              <p className="mb-1 font-semibold">Important:</p>
              You must have the <span className="font-bold text-red-300 underline">original Master Password</span> or the <span className="font-bold text-red-300 underline">original Recovery Key</span> that belonged to the backup file. Any new keys you just saw will not work for this imported data.
            </div>
            <AlertDialogFooter className="mt-6 gap-3 border-none bg-transparent mx-0 mb-0 p-0 sm:justify-end">
              <AlertDialogCancel className="rounded-full h-12 px-6 border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmImportBackup}
                className="rounded-full h-12 px-8 font-semibold transition-all shadow-lg"
              >
                Confirm Import
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isLockConfirmOpen && (
        <AlertDialog open={isLockConfirmOpen} onOpenChange={(open) => !open && closeLockConfirm()}>
          <AlertDialogContent className="rounded-4xl border-white/10 bg-[#0a0a0a]/90 backdrop-blur-3xl shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold text-white">Lock vault?</AlertDialogTitle>
              <AlertDialogDescription className="text-white/45 text-base">
                You will be logged out and your vault data will be hidden until you unlock it again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-3 border-none bg-transparent mx-0 mb-0 p-0 sm:justify-end">
              <AlertDialogCancel className="rounded-full h-12 px-6 border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmLockVault}
                className="rounded-full h-12 px-8 font-semibold transition-all shadow-lg"
              >
                Lock Vault
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isRecoveryKeyModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">
                Your Emergency Recovery Key
              </h3>
              <p className="text-sm text-white/60">
                If you ever lose your master password, this is the{" "}
                <span className="text-white font-bold">ONLY WAY</span> to
                recover your data.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center space-y-4">
              <div
                className="p-4 bg-black/40 rounded-xl border border-white/20 font-mono text-xl tracking-wider select-all cursor-pointer hover:bg-black/60 transition-colors text-white"
                onClick={() => {
                  if (recoveryKey) {
                    navigator.clipboard.writeText(recoveryKey);
                    setSuccess("Recovery key copied to clipboard!");
                  }
                }}
              >
                {recoveryKey}
              </div>
              <p className="text-[10px] uppercase tracking-widest text-white/30">
                Click the key to copy. Save it somewhere secure.
              </p>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-white/70">
              <ShieldCheck className="size-5 shrink-0 text-white/40" />
              <p>
                Store this key in a physical safe, a printed document, or a
                separate secure location. Without it, your passwords are
                unrecoverable if you forget your password.
              </p>
            </div>

            <Button
              className="w-full h-12 rounded-2xl bg-white text-black font-semibold hover:bg-white/90"
              onClick={() => setIsRecoveryKeyModalOpen(false)}
            >
              I have saved my recovery key
            </Button>
          </div>
        </div>
      )}

      <CommandPalette
        open={isCommandPaletteOpen}
        entries={entries}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelect={(id) => {
          setIsCommandPaletteOpen(false);
          const entry = entries.find(e => e.id === id);
          if (entry) {
            setSearchTerm(entry.label);
            setActiveSection("passwords");
          }
        }}
      />
    </div>
  );
}

export default App;
