export type VaultStatus = {
  hasVault: boolean;
  isUnlocked: boolean;
};

export type VaultEntrySummary = {
  id: string;
  label: string;
  username: string;
  url?: string | null;
  tags: string[];
  updatedAt: number;
};

export type VaultEntry = {
  id: string;
  label: string;
  username: string;
  password: string;
  url?: string | null;
  notes?: string | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export type VaultEntryInput = {
  label: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  tags: string[];
};

export type VaultSettings = {
  autoLockMinutes: number;
  revealTimeoutSeconds: number;
  clipboardClearSeconds: number;
  defaultSection: SidebarSection;
  compactRows: boolean;
};

export type SidebarSection = "overview" | "audit" | "passwords" | "settings";
