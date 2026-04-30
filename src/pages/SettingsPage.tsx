import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import type { SidebarSection, VaultSettings } from "../types/vault";

const STORAGE_KEY = "veryfied-settings";

type SettingsPageProps = {
  settings: VaultSettings;
  onSettingsChange: (settings: VaultSettings) => void;
  onExportBackup: () => Promise<void>;
  onImportBackup: (file: File) => Promise<void>;
};

export function SettingsPage({ settings, onSettingsChange, onExportBackup, onImportBackup }: SettingsPageProps) {
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    const timer = window.setTimeout(() => setSaved(false), 1000);
    return () => window.clearTimeout(timer);
  }, [settings]);

  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl text-white">Settings</CardTitle>
              <CardDescription className="text-white/60">
                Safe local preferences for the vault experience.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="rounded-full bg-white/10 text-white/70">
              {saved ? "Saved" : "Auto-saved"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="auto-lock" className="text-white/80">
              Auto-lock timeout (minutes)
            </Label>
            <Input
              id="auto-lock"
              type="number"
              min={1}
              value={settings.autoLockMinutes}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  autoLockMinutes: Number(event.target.value) || 1,
                })
              }
              className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reveal-timeout" className="text-white/80">
              Reveal timeout (seconds)
            </Label>
            <Input
              id="reveal-timeout"
              type="number"
              min={5}
              value={settings.revealTimeoutSeconds}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  revealTimeoutSeconds: Number(event.target.value) || 5,
                })
              }
              className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clipboard-clear" className="text-white/80">
              Clipboard clear timeout (seconds)
            </Label>
            <Input
              id="clipboard-clear"
              type="number"
              min={5}
              value={settings.clipboardClearSeconds}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  clipboardClearSeconds: Number(event.target.value) || 5,
                })
              }
              className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-section" className="text-white/80">
              Default landing page
            </Label>
            <select
              id="default-section"
              aria-label="Default landing page"
              value={settings.defaultSection}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  defaultSection: event.target.value as SidebarSection,
                })
              }
              className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-white/35"
            >
              <option value="overview">All Items</option>
              <option value="passwords">Passwords</option>
              <option value="audit">Security Audit</option>
              <option value="settings">Settings</option>
            </select>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm text-white/70">
            Sync is disabled for the MVP. This app is local-only, encrypted, and designed to keep secrets on the device.
          </div>

          <label className="flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm text-white/70">
            <div>
              <p className="font-medium text-white">Compact rows</p>
              <p className="text-white/55">Make the password table denser for larger vaults.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.compactRows}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  compactRows: event.target.checked,
                })
              }
              className="size-5 accent-white"
            />
          </label>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
          <CardTitle className="text-xl text-white">Additional controls</CardTitle>
          <CardDescription className="text-white/60">
            Useful security and workflow features you can add next.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-6 py-6 text-sm leading-7 text-white/70">
          <p>Compact rows mode can make the passwords table denser for large vaults.</p>
          <p>Auto-lock can be enforced after inactivity by wiring the timer into the app shell later.</p>
          <p>Export/import, password generation, copy confirmation, and audit reports are all good follow-up features.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
              <Upload className="mr-2 size-4" />
              Import encrypted vault
            </Button>
            <Button variant="outline" onClick={onExportBackup} className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
              <Download className="mr-2 size-4" />
              Export encrypted vault
            </Button>
          </div>
          <Button variant="outline" className="mt-2 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
            Settings are already saved locally
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            aria-label="Import encrypted vault file"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                await onImportBackup(file);
              }
              event.currentTarget.value = "";
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
}
