import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  decideInitialMode,
  sortEntriesByUpdated,
  type VaultMode,
} from "./ai/agents/uiAgent";
import { UI_RULES } from "./ai/instructions";
import "./App.css";

type VaultStatus = {
  hasVault: boolean;
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

  useEffect(() => {
    let alive = true;
    const loadStatus = async () => {
      setIsBusy(true);
      setError(null);
      try {
        const status = await invoke<VaultStatus>("vault_status");
        if (!alive) return;
        setMode(decideInitialMode(status.hasVault));
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

  const securityNotice = useMemo(() => UI_RULES.slice(0, 2), []);

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
      await invoke("init_vault", { master_password: masterPassword });
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
      await invoke("unlock_vault", { master_password: masterPassword });
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
      setMode("locked");
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Veryfied Vault</p>
          <h1>Password Manager MVP</h1>
        </div>
        <div className="status-pill">
          {mode === "unlocked" ? "Unlocked" : "Locked"}
        </div>
      </header>

      <main className="app-main">
        <section className="card hero">
          <h2>Security baseline</h2>
          <ul>
            {securityNotice.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>

        {error && <div className="card error">{error}</div>}

        {mode === "loading" && (
          <section className="card">Checking vault status...</section>
        )}

        {mode === "setup" && (
          <section className="card">
            <h2>Create your vault</h2>
            <p>
              Choose a master password. You will need it every time you unlock
              the vault.
            </p>
            <div className="form-grid">
              <label>
                Master password
                <input
                  type="password"
                  value={masterPassword}
                  onChange={(event) => setMasterPassword(event.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  value={masterConfirm}
                  onChange={(event) => setMasterConfirm(event.target.value)}
                  placeholder="Repeat master password"
                />
              </label>
            </div>
            <button
              className="primary"
              onClick={handleInitVault}
              disabled={isBusy}
              type="button"
            >
              Create vault
            </button>
          </section>
        )}

        {mode === "locked" && (
          <section className="card">
            <h2>Unlock your vault</h2>
            <p>Enter your master password to access your entries.</p>
            <div className="form-grid">
              <label>
                Master password
                <input
                  type="password"
                  value={masterPassword}
                  onChange={(event) => setMasterPassword(event.target.value)}
                  placeholder="Your master password"
                />
              </label>
            </div>
            <button
              className="primary"
              onClick={handleUnlock}
              disabled={isBusy}
              type="button"
            >
              Unlock vault
            </button>
          </section>
        )}

        {mode === "unlocked" && (
          <section className="grid">
            <div className="card">
              <div className="card-header">
                <h2>Add entry</h2>
                <button
                  className="ghost"
                  onClick={handleLock}
                  disabled={isBusy}
                  type="button"
                >
                  Lock vault
                </button>
              </div>
              <div className="form-grid">
                <label>
                  Label
                  <input
                    value={newEntry.label}
                    onChange={(event) =>
                      setNewEntry((prev) => ({
                        ...prev,
                        label: event.target.value,
                      }))
                    }
                    placeholder="e.g. Work email"
                  />
                </label>
                <label>
                  Username
                  <input
                    value={newEntry.username}
                    onChange={(event) =>
                      setNewEntry((prev) => ({
                        ...prev,
                        username: event.target.value,
                      }))
                    }
                    placeholder="e.g. alex@company.com"
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={newEntry.password}
                    onChange={(event) =>
                      setNewEntry((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Minimum 8 characters"
                  />
                </label>
                <label>
                  URL
                  <input
                    value={newEntry.url}
                    onChange={(event) =>
                      setNewEntry((prev) => ({
                        ...prev,
                        url: event.target.value,
                      }))
                    }
                    placeholder="https://"
                  />
                </label>
                <label className="span-2">
                  Notes
                  <textarea
                    value={newEntry.notes}
                    onChange={(event) =>
                      setNewEntry((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Optional context or recovery info"
                  />
                </label>
              </div>
              <button
                className="primary"
                onClick={handleAddEntry}
                disabled={isBusy}
                type="button"
              >
                Save entry
              </button>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>Vault entries</h2>
                <span className="count">{entries.length} items</span>
              </div>
              <div className="entry-list">
                {entries.length === 0 && (
                  <p className="muted">No entries yet. Add one on the left.</p>
                )}
                {entries.map((entry) => (
                  <div className="entry" key={entry.id}>
                    <div>
                      <h3>{entry.label}</h3>
                      <p className="muted">
                        {entry.username}
                        {entry.url ? ` • ${entry.url}` : ""}
                      </p>
                      {revealId === entry.id && revealedPassword && (
                        <div className="reveal">
                          <span>{revealedPassword}</span>
                          <span className="pill">Auto-hide</span>
                        </div>
                      )}
                    </div>
                    <div className="entry-actions">
                      <button
                        className="ghost"
                        onClick={() => handleReveal(entry.id)}
                        disabled={isBusy}
                        type="button"
                      >
                        Reveal
                      </button>
                      <button
                        className="danger"
                        onClick={() => handleDelete(entry.id)}
                        disabled={isBusy}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
