import {
  LayoutGrid,
  KeyRound,
  FileText,
  ShieldCheck,
  FingerprintPattern,
  Trash2,
  Settings as SettingsIcon,
  LockKeyhole,
  LucideIcon,
  X
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
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  activeSection,
  setActiveSection,
  onLock,
  isBusy,
  theme,
  isOpen,
  onClose
}: SidebarProps) {
  return (
    <>
      {/* Mobile Overlay - Full screen as requested */}
      <div 
        className={`fixed inset-0 z-50 flex flex-col bg-black/40 backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] lg:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      >
        <div 
          className="flex h-full flex-col p-4 sm:p-6"
        >
          {/* Top Row: Close Left, Logo Center */}
          <div className="relative flex items-center justify-center mb-4">
            <button
              onClick={onClose}
              className="absolute left-0 rounded-xl border border-white/10 bg-white/5 p-2.5 text-white hover:bg-white/10 transition-colors"
            >
              <X className="size-5" />
            </button>
            
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-white/80">
              <img
                src={theme === "frosted-silver" ? arxLightLogo : arxLogo}
                alt="ARX"
                className="size-3.5 rounded-full object-contain"
              />
              ARX
            </div>
          </div>

          {/* Compact Navigation Items */}
          <nav className="mx-auto flex w-full max-w-xs flex-col gap-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setActiveSection(item.section);
                    onClose();
                  }}
                  className={
                    activeSection === item.section
                      ? "flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white shadow-[0_10px_30px_rgba(255,255,255,0.06)]"
                      : "flex items-center gap-4 rounded-xl px-5 py-3 text-sm text-white/50 transition hover:bg-white/5 hover:text-white/80"
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Bottom Lock Button */}
          <div className="mx-auto mt-auto w-full max-w-xs pt-2">
            <Button
              variant="outline"
              onClick={() => {
                onLock();
                onClose();
              }}
              disabled={isBusy}
              className="h-12 w-full rounded-xl border-white/10 bg-white/5 text-sm text-white hover:bg-white/10"
            >
              <LockKeyhole className="mr-2.5 size-4" />
              Lock Vault
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar - Restored original centered look */}
      <aside className="hidden lg:flex flex-col border-r border-white/10 bg-black/10 px-4 py-5 h-screen sticky top-0">
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
    </>
  );
}
