export type VaultMode = "loading" | "setup" | "locked" | "unlocked";

export function decideInitialMode(hasVault: boolean): VaultMode {
  return hasVault ? "locked" : "setup";
}

export function sortEntriesByUpdated<T extends { updatedAt: number }>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
}
