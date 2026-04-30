import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Download, Upload } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import type { AppTheme, SidebarSection, VaultSettings } from "../types/vault";

const STORAGE_KEY = "veryfied-settings";

type SettingsPageProps = {
  settings: VaultSettings;
  onSettingsChange: (settings: VaultSettings) => void;
  onExportBackup: () => Promise<void>;
  onImportBackup: () => Promise<void>;
  onResetVault: () => void;
};

export function SettingsPage({
  settings,
  onSettingsChange,
  onExportBackup,
  onImportBackup,
  onResetVault
}: SettingsPageProps) {
  const [saved, setSaved] = useState(false);
  const [newMasterPassword, setNewMasterPassword] = useState("");
  const [isChanging, setIsChanging] = useState(false);
  const [changeStatus, setChangeStatus] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    const timer = window.setTimeout(() => setSaved(false), 1000);
    return () => window.clearTimeout(timer);
  }, [settings]);

  const handleMasterPasswordChange = async () => {
    if (newMasterPassword.length < 8) {
      setChangeStatus("New password must be at least 8 characters.");
      return;
    }
    setIsChanging(true);
    setChangeStatus(null);
    try {
      await invoke("change_master_password", { new_password: newMasterPassword });
      setNewMasterPassword("");
      setChangeStatus("Master password updated successfully.");
    } catch (err) {
      setChangeStatus(String(err));
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Preferences & Data */}
        <div className="space-y-6">
          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-xl text-white">General</CardTitle>
                <Badge variant="secondary" className="rounded-full bg-white/10 text-white/70">
                  {saved ? "Saved" : "Auto-saved"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 px-6 py-10">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="auto-lock" className="text-xs uppercase tracking-widest text-white/40">Auto-lock (min)</Label>
                  <Input
                    id="auto-lock"
                    type="number"
                    min={1}
                    value={settings.autoLockMinutes}
                    onChange={(e) => onSettingsChange({ ...settings, autoLockMinutes: Number(e.target.value) || 1 })}
                    className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reveal-timeout" className="text-xs uppercase tracking-widest text-white/40">Reveal (sec)</Label>
                  <Input
                    id="reveal-timeout"
                    type="number"
                    min={5}
                    value={settings.revealTimeoutSeconds}
                    onChange={(e) => onSettingsChange({ ...settings, revealTimeoutSeconds: Number(e.target.value) || 5 })}
                    className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-section" className="text-xs uppercase tracking-widest text-white/40">Landing Page</Label>
                <select
                  id="default-section"
                  value={settings.defaultSection}
                  onChange={(e) => onSettingsChange({ ...settings, defaultSection: e.target.value as SidebarSection })}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-white/35"
                >
                  <option value="overview">All Items</option>
                  <option value="passwords">Passwords</option>
                  <option value="audit">Security Audit</option>
                  <option value="settings">Settings</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-white">Compact rows</p>
                  <p className="text-[11px] text-white/40">Denser table layout</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.compactRows}
                  onChange={(e) => onSettingsChange({ ...settings, compactRows: e.target.checked })}
                  className="size-5 accent-white"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-widest text-white/40">Glass Theme</Label>
                <div className="grid grid-cols-3 gap-3">
                  {(["obsidian", "midnight-purple", "frosted-silver"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => onSettingsChange({ ...settings, theme: t })}
                      className={`group relative h-20 overflow-hidden rounded-2xl border transition-all ${settings.theme === t ? "border-white ring-1 ring-white/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                    >
                      <div className={`absolute inset-0 opacity-40 transition-opacity group-hover:opacity-60 ${t === "obsidian" ? "bg-zinc-900" : t === "midnight-purple" ? "bg-purple-950" : "bg-slate-800"}`} />
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className={`size-4 rounded-full shadow-lg ${t === "obsidian" ? "bg-white" : t === "midnight-purple" ? "bg-purple-500 shadow-purple-500/50" : "bg-slate-200 shadow-slate-200/50"}`} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">{t.split("-")[0]}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Vault Backup</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onImportBackup} className="h-9 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10 px-4">
                      <Upload className="mr-2 size-3" />
                      Import
                    </Button>
                    <Button variant="outline" size="sm" onClick={onExportBackup} className="h-9 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10 px-4">
                      <Download className="mr-2 size-3" />
                      Export
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Security & Danger Zone */}
        <div className="space-y-6">
          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
              <CardTitle className="text-xl text-white">Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 px-6 py-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-master-password" className="text-xs uppercase tracking-widest text-white/40">Change Master Password</Label>
                  <Input
                    id="new-master-password"
                    type="password"
                    value={newMasterPassword}
                    onChange={(e) => setNewMasterPassword(e.target.value)}
                    placeholder="Enter new master password"
                    className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
                  />
                </div>
                {changeStatus && (
                  <p className={`text-xs ${changeStatus.includes("success") ? "text-green-400" : "text-red-400"}`}>
                    {changeStatus}
                  </p>
                )}
                <Button
                  onClick={handleMasterPasswordChange}
                  disabled={isChanging || !newMasterPassword}
                  className="h-11 w-full rounded-full bg-white text-slate-950 hover:bg-white/90 font-semibold"
                >
                  {isChanging ? "Updating..." : "Update Master Password"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5 shadow-2xl rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl text-red-500">Danger Zone</CardTitle>
              <CardDescription className="text-red-500/60">
                Irreversible actions that affect your entire vault.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">Wipe all data</p>
                <p className="text-xs text-white/40 leading-relaxed">
                  Permanently delete your vault and all saved passwords on this device.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full mb-4 h-11 rounded-2xl border-red-500/20 bg-transparent text-red-500 hover:bg-red-500 hover:text-white transition-all font-semibold"
                onClick={onResetVault}
              >
                Wipe vault on this device
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
