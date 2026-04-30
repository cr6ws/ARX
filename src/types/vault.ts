export type VaultStatus = {
  hasVault: boolean;
  isUnlocked: boolean;
  hint?: string | null;
};

export type VaultCategory = "Personal" | "Work" | "Social" | "Finance" | "Other";

export type VaultEntrySummary = {
  id: string;
  label: string;
  username: string;
  url?: string | null;
  tags: string[];
  category: VaultCategory;
  isFavorite: boolean;
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
  category: VaultCategory;
  isFavorite: boolean;
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
  category: VaultCategory;
  isFavorite: boolean;
};

export type AppTheme = "obsidian" | "midnight-purple" | "frosted-silver";

export type VaultSettings = {
  autoLockMinutes: number;
  revealTimeoutSeconds: number;
  clipboardClearSeconds: number;
  defaultSection: SidebarSection;
  compactRows: boolean;
  theme: AppTheme;
};

export type SidebarSection = "overview" | "audit" | "passwords" | "settings";

export type AuditStats = {
  totalEntries: number;
  weakCount: number;
  mediumCount: number;
  strongCount: number;
  reusedCount: number;
  oldCount: number;
};

