export type VaultStatus = {
  hasVault: boolean;
  isUnlocked: boolean;
  hint?: string | null;
};

export type VaultCategory = "Personal" | "Work" | "School" | "Games" | "Social" | "Finance" | "Other";

export type VaultEntrySummary = {
  id: string;
  label: string;
  username: string;
  url?: string | null;
  tags: string[];
  category: VaultCategory;
  isFavorite: boolean;
  updatedAt: number;
  deletedAt?: number | null;
};

export type PasswordHistoryEntry = {
  password: string;
  changedAt: number;
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
  passwordHistory?: PasswordHistoryEntry[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
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

export type PasswordGeneratorSettings = {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
};

export type VaultSettings = {
  autoLockMinutes: number;
  revealTimeoutSeconds: number;
  clipboardClearSeconds: number;
  defaultSection: SidebarSection;
  theme: AppTheme;
  generator: PasswordGeneratorSettings;
};

export type SidebarSection = "overview" | "audit" | "passwords" | "trash" | "settings";

export type AuditStats = {
  totalEntries: number;
  weakCount: number;
  mediumCount: number;
  strongCount: number;
  reusedCount: number;
  oldCount: number;
  weakIds: string[];
  mediumIds: string[];
  reusedIds: string[];
  oldIds: string[];
};

