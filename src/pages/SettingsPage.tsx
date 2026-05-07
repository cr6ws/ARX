import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Download, Upload, Eye, EyeOff } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import type { SidebarSection, VaultSettings } from "../types/vault";

const STORAGE_KEY = "arx-settings";

const THEME_SWATCH_CLASSES = {
  obsidian: "bg-[#18181b]",
  "midnight-purple": "bg-[#3b0764]",
  "frosted-silver": "bg-slate-200",
} as const;

const THEME_DOT_CLASSES = {
  obsidian: "bg-white",
  "midnight-purple": "bg-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.5)]",
  "frosted-silver": "bg-slate-900 shadow-[0_0_12px_rgba(15,23,42,0.3)]",
} as const;

type SettingsPageProps = {
  settings: VaultSettings;
  onSettingsChange: (settings: VaultSettings) => void;
  onExportBackup: () => Promise<void>;
  onImportBackup: () => void;
  onRegenerateRecoveryKey: () => void;
  onResetVault: () => void;
};

export function SettingsPage({
  settings,
  onSettingsChange,
  onExportBackup,
  onImportBackup,
  onRegenerateRecoveryKey,
  onResetVault
}: SettingsPageProps) {
  const [saved, setSaved] = useState(false);
  const [newMasterPassword, setNewMasterPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [changeStatus, setChangeStatus] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    const timer = window.setTimeout(() => setSaved(false), 1000);
    return () => window.clearTimeout(timer);
  }, [settings]);

  const handleMasterPasswordChange = async () => {
    if (newMasterPassword.length < 6) {
      setChangeStatus("New password must be at least 6 characters.");
      return;
    }
    setIsChanging(true);
    setChangeStatus(null);
    try {
      await invoke("change_master_password", { newPassword: newMasterPassword });
      setNewMasterPassword("");
      setChangeStatus("Master password updated successfully.");
    } catch (err) {
      setChangeStatus(String(err));
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Preferences & Data */}
        <div className="flex flex-col">
          <Card className="flex flex-col h-full rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl overflow-hidden">
            <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-xl text-white">General Preferences</CardTitle>
                <Badge variant="secondary" className="rounded-full bg-white/10 text-white/70">
                  {saved ? "Saved" : "Auto-saved"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-6 px-6 py-8 overflow-y-auto">
              <div className="grid gap-4 sm:grid-cols-3">
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
                <div className="space-y-2">
                  <Label htmlFor="clipboard-clear" className="text-xs uppercase tracking-widest text-white/40">Clipboard (sec)</Label>
                  <Input
                    id="clipboard-clear"
                    type="number"
                    min={0}
                    value={settings.clipboardClearSeconds}
                    onChange={(e) => onSettingsChange({ ...settings, clipboardClearSeconds: Number(e.target.value) || 0 })}
                    className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-section" className="text-xs uppercase tracking-widest text-white/40">Landing Page</Label>
                <div className="relative group">
                  <select
                    id="default-section"
                    title="Landing Page"
                    value={settings.defaultSection}
                    onChange={(e) => onSettingsChange({ ...settings, defaultSection: e.target.value as SidebarSection })}
                    className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-black/40 px-4 text-sm text-white transition-all hover:border-white/20 focus:border-white/40 focus:ring-4 focus:ring-white/5 outline-none cursor-pointer"
                  >
                    <option value="overview" className="bg-[#1a1f21] text-white">All Items</option>
                    <option value="passwords" className="bg-[#1a1f21] text-white">Passwords</option>
                    <option value="audit" className="bg-[#1a1f21] text-white">Security Audit</option>
                    <option value="settings" className="bg-[#1a1f21] text-white">Settings</option>
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40 group-hover:text-white/60 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
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
                      <div className={`absolute inset-0 opacity-40 transition-opacity group-hover:opacity-60 ${THEME_SWATCH_CLASSES[t]}`} />
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className={`size-4 rounded-full shadow-lg ${THEME_DOT_CLASSES[t]}`} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                          {t === "frosted-silver" ? "Frosted Light" : t.split("-")[0]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 flex-1 flex flex-col justify-end">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Vault Backup</p>
                  <div className="flex flex-col gap-3">
                    <Button variant="outline" onClick={onImportBackup} className="h-14 w-full rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 text-base font-semibold">
                      <Upload className="mr-3 size-5" />
                      Import Vault Backup
                    </Button>
                    <Button variant="outline" onClick={onExportBackup} className="h-14 w-full rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 text-base font-semibold">
                      <Download className="mr-3 size-5" />
                      Export Vault Backup
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Security */}
        <div className="flex flex-col">
          <Card className="flex flex-col h-full rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl overflow-hidden">
            <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
              <CardTitle className="text-xl text-white">Security & Access</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-6 px-6 py-8 overflow-y-auto">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-master-password" className="text-xs uppercase tracking-widest text-white/40">Change Master Password</Label>
                  <div className="relative">
                    <Input
                      id="new-master-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newMasterPassword}
                      onChange={(e) => setNewMasterPassword(e.target.value)}
                      placeholder="Enter new master password"
                      className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                {changeStatus && (
                  <p className={`text-xs ${changeStatus.includes("success") ? "text-green-400" : "text-red-400"}`}>
                    {changeStatus}
                  </p>
                )}
                <Button
                  onClick={handleMasterPasswordChange}
                  disabled={isChanging || !newMasterPassword}
                  className="h-11 w-full rounded-2xl bg-white text-slate-950 hover:bg-white/90 font-semibold"
                >
                  {isChanging ? "Updating..." : "Update Master Password"}
                </Button>
              </div>

              <div className="pt-6 border-t border-white/10 space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-widest text-white/40 font-semibold">Recovery Options</Label>
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    Generate a brand new recovery code for your current vault.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={onRegenerateRecoveryKey}
                  className="h-11 w-full rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 font-medium"
                >
                  Regenerate Recovery Key
                </Button>
              </div>

              <div className="pt-6 border-t border-white/10 space-y-4">
                <Label className="text-xs uppercase tracking-widest text-white/40 font-semibold">Password Generator Defaults</Label>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gen-length" className="text-sm text-white/70">Length: {settings.generator.length}</Label>
                  </div>
                  <input
                    id="gen-length"
                    type="range"
                    min="6"
                    max="64"
                    aria-label="Password generator length"
                    value={settings.generator.length}
                    onChange={(e) => onSettingsChange({
                      ...settings,
                      generator: { ...settings.generator, length: Math.max(6, parseInt(e.target.value)) }
                    })}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'includeUppercase', label: 'A-Z' },
                    { key: 'includeLowercase', label: 'a-z' },
                    { key: 'includeNumbers', label: '0-9' },
                    { key: 'includeSymbols', label: '!@#' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => onSettingsChange({
                        ...settings,
                        generator: {
                          ...settings.generator,
                          [opt.key]: !settings.generator[opt.key as keyof typeof settings.generator]
                        }
                      })}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${settings.generator[opt.key as keyof typeof settings.generator] ? "bg-white/10 border-white/30 text-white" : "bg-white/5 border-white/5 text-white/30"}`}
                    >
                      <span className="text-xs font-bold">{opt.label}</span>
                      <div className={`size-2 rounded-full ${settings.generator[opt.key as keyof typeof settings.generator] ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "bg-white/10"}`} />
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Danger Zone: Full Width */}
      <Card className="border-red-500/20 bg-red-500/5 shadow-2xl rounded-3xl overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-6 p-6">
          <div className="flex-1 space-y-1 text-center md:text-left">
            <h3 className="text-xl font-bold text-red-500">Danger Zone</h3>
            <p className="text-sm text-red-500/60 leading-relaxed">
              Permanently delete your vault and all saved passwords on this device. This action is irreversible.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full md:w-auto h-12 px-8 rounded-2xl border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all font-bold whitespace-nowrap"
            onClick={onResetVault}
          >
            Wipe vault on this device
          </Button>
        </div>
      </Card>
    </div>
  );
}
