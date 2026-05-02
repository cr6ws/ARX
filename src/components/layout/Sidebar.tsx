import {
  LayoutGrid,
  KeyRound,
  FileText,
  ShieldCheck,
  FingerprintPattern,
  Trash2,
  Settings as SettingsIcon,
  LockKeyhole,
  LucideIcon
} from "lucide-react";
import { Button } from "../ui/button";
import arxLogo from "../../assets/ARX.png";
import arxLightLogo from "../../assets/ARX-LIGHT.png";
import type { SidebarSection, AppTheme } from "../../types/vault";

interface NavigationItem {
  icon: LucideIcon;
  label: string;
  section: SidebarSection;
}

const navigationItems: NavigationItem[] = [
  { icon: LayoutGrid, label: "All Items", section: "overview" },
  { icon: KeyRound, label: "Passwords", section: "passwords" },
  { icon: FileText, label: "Secure Notes", section: "notes" },
  { icon: ShieldCheck, label: "Authenticator", section: "totp" },
  { icon: FingerprintPattern, label: "Security Audit", section: "audit" },
  { icon: Trash2, label: "Trash Bin", section: "trash" },
  { icon: SettingsIcon, label: "Settings", section: "settings" },
];

interface SidebarProps {
  activeSection: SidebarSection;
  setActiveSection: (section: SidebarSection) => void;
  onLock: () => void;
  isBusy: boolean;
  theme: AppTheme;
}

export function Sidebar({
  activeSection,
  setActiveSection,
  onLock,
  isBusy,
  theme
}: SidebarProps) {
  return (
    <aside className="border-r border-white/10 bg-black/10 px-4 py-5 h-screen sticky top-0">
      <div className="flex h-full flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/80">
            <img
              src={theme === "frosted-silver" ? arxLightLogo : arxLogo}
              alt="ARX"
              className="size-4 rounded-full object-contain"
            />
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
            onClick={onLock}
            disabled={isBusy}
            className="h-11 w-full rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <LockKeyhole className="mr-2 size-4" />
            Lock Vault
          </Button>
        </div>
      </div>
    </aside>
  );
}
