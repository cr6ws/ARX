import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopy, Eye, PencilLine, Plus, Trash2, Star, User, Briefcase, Share2, Wallet, Shield, GripVertical, GraduationCap, Gamepad2 } from "lucide-react";
import { Reorder, useDragControls, AnimatePresence, motion } from "motion/react";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import type { VaultEntrySummary } from "../types/vault";

type PasswordsPageProps = {
  entries: VaultEntrySummary[];
  isBusy: boolean;
  onAddItem: () => void;
  onEditItem: (id: string) => void;
  onReveal: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCopyPassword: (password: string) => Promise<void> | void;
  revealedEntryId: string | null;
  revealedPassword: string | null;
  highlightedEntryId: string | null;
  onReorder: (newEntries: VaultEntrySummary[]) => void;
};

function getEntryHost(entry: VaultEntrySummary) {
  if (entry.url) {
    try {
      return new URL(entry.url).hostname.replace(/^www\./, "");
    } catch {
      return entry.url.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
    }
  }

  const slug = entry.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || entry.label.trim().toLowerCase();
}

function getEntryInitials(entry: VaultEntrySummary) {
  const source = entry.label.trim() || entry.username.trim() || entry.url?.trim() || "?";
  const words = source
    .replace(/https?:\/\//g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  const first = words[0]?.[0] ?? source[0] ?? "?";
  const second = words[1]?.[0] ?? words[0]?.[1] ?? source[1] ?? "";
  return `${first}${second}`.toUpperCase().slice(0, 2);
}

function EntryLogo({ entry }: { entry: VaultEntrySummary }) {
  const [imageError, setImageError] = useState(false);
  const host = useMemo(() => getEntryHost(entry), [entry]);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  const initials = useMemo(() => getEntryInitials(entry), [entry]);

  if (!host || imageError) {
    return (
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white">
        {initials}
      </div>
    );
  }

  return (
    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <img
        src={faviconUrl}
        alt={`${entry.label} logo`}
        className="size-7 rounded-md object-contain"
        loading="lazy"
        onError={() => setImageError(true)}
      />
    </div>
  );
}
const EntryRow = memo(({ 
  entry, 
  rowClassName, 
  pulseEntryId, 
  revealedEntryId, 
  revealedPassword, 
  onReveal, 
  onEditItem, 
  onDelete, 
  onCopyPassword,
  isBusy,
  rowRefs
}: { 
  entry: VaultEntrySummary; 
  rowClassName: string;
  pulseEntryId: string | null;
  revealedEntryId: string | null;
  revealedPassword: string | null;
  onReveal: (id: string) => void;
  onEditItem: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyPassword: (password: string) => void;
  isBusy: boolean;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}) => {
  const controls = useDragControls();
  const CategoryIcon = entry.category === "Personal" ? User : entry.category === "Work" ? Briefcase : entry.category === "School" ? GraduationCap : entry.category === "Games" ? Gamepad2 : entry.category === "Social" ? Share2 : entry.category === "Finance" ? Wallet : Shield;

  return (
    <Reorder.Item
      value={entry}
      dragListener={false}
      dragControls={controls}
      key={entry.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      ref={(node: any) => {
        if (node) rowRefs.current[entry.id] = node as unknown as HTMLDivElement;
      }}
      className={`px-6 py-3 transition-colors duration-200 hover:bg-white/[0.02] cursor-default border-b border-white/5 last:border-0 select-none ${pulseEntryId === entry.id ? "rounded-2xl bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.2)]" : ""} ${entry.isFavorite ? "bg-white/[0.03]" : ""}`}
    >
      <div className={rowClassName}>
        <div 
          className="flex items-center justify-center text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing p-2 -m-2 touch-none"
          onPointerDown={(e) => controls.start(e)}
        >
          <GripVertical className="size-4" />
        </div>
        <div className="flex items-center justify-center relative">
          <EntryLogo entry={entry} />
          {entry.isFavorite && (
            <div className="absolute -top-1 -right-1 size-5 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-[#151a1c] shadow-lg">
              <Star className="size-2.5 text-black fill-current" />
            </div>
          )}
        </div>
        <div className="min-w-0 text-center flex flex-col items-center gap-1">
          <p className="truncate text-[13px] font-semibold text-white sm:text-sm">{entry.label}</p>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
            <CategoryIcon className="size-3 text-white/40" />
            <span className="text-[9px] uppercase tracking-wider text-white/40 font-medium">{entry.category}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(entry.username);
          }}
          className="truncate text-[13px] text-white/70 hover:text-white transition-colors sm:text-sm text-center"
          title="Click to copy username"
        >
          {entry.username}
        </button>
        <p className="text-[13px] text-white/70 sm:text-sm text-center">{new Date(entry.updatedAt * 1000).toLocaleDateString()}</p>
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="outline"
            onClick={() => onReveal(entry.id)}
            disabled={isBusy}
            className={`h-8 w-8 rounded-full border-white/10 bg-white/5 p-0 text-white hover:bg-white/10 ${revealedEntryId === entry.id ? "bg-white text-black hover:bg-white/90 border-white" : ""}`}
            aria-label={revealedEntryId === entry.id ? "Hide password" : `Reveal password for ${entry.label}`}
          >
            <Eye className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            onClick={() => onEditItem(entry.id)}
            disabled={isBusy}
            className="h-8 w-8 rounded-full border-white/10 bg-white/5 p-0 text-white hover:bg-white/10"
            aria-label={`Edit ${entry.label}`}
          >
            <PencilLine className="size-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={isBusy}
                className="h-8 w-8 rounded-full border-white/20 bg-white/10 p-0 text-white hover:bg-white/15"
                aria-label={`Delete ${entry.label}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/10 bg-zinc-950/95 text-white backdrop-blur-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
                <AlertDialogDescription className="text-white/60">
                  This item will be moved to the Trash Bin. You can restore it within 30 days before it's permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(entry.id)}
                  variant="destructive"
                  className="bg-red-500 text-white hover:bg-red-600 border-none"
                >
                  Move to Trash
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <AnimatePresence>
        {revealedEntryId === entry.id && revealedPassword && (
          <motion.div
            key="reveal-container"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.33, 1, 0.68, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-[22px] border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Revealed password</p>
                  <p className="mt-2 break-all font-mono text-sm text-white">{revealedPassword}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => onCopyPassword(revealedPassword)}
                  className="h-9 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <ClipboardCopy className="mr-2 size-4" />
                  Copy
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
});

export function PasswordsPage({
  entries,
  isBusy,
  onAddItem,
  onEditItem,
  onReveal,
  onDelete,
  onCopyPassword,
  revealedEntryId,
  revealedPassword,
  highlightedEntryId,
  onReorder,
}: PasswordsPageProps) {
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pulseEntryId, setPulseEntryId] = useState<string | null>(null);
  
  // Ensure favorites are always at the top
  const sortFavoritesFirst = (list: VaultEntrySummary[]) =>
    [...list].sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));

  // Filter to only show logins (passwords)
  const loginEntries = useMemo(() => 
    entries.filter(e => e.entryType === "login"), 
    [entries]
  );

  // Initialize local entries sorted
  const [localEntries, setLocalEntries] = useState(() => sortFavoritesFirst(loginEntries));

  // Keep localEntries in sync when filtered loginEntries change
  useEffect(() => {
    setLocalEntries(sortFavoritesFirst(loginEntries));
  }, [loginEntries]);

  // Update handleLocalReorder to keep favorites on top after reorder
  const handleLocalReorder = (newEntries: VaultEntrySummary[]) => {
    const sorted = sortFavoritesFirst(newEntries);
    setLocalEntries(sorted);
    onReorder(sorted);
  };

  const rowClassName = "grid grid-cols-[30px_76px_minmax(0,1.1fr)_0.9fr_0.75fr_0.8fr] items-center gap-3 text-center text-[11px] sm:text-xs";

  useEffect(() => {
    if (!highlightedEntryId) return;
    const row = rowRefs.current[highlightedEntryId];
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulseEntryId(highlightedEntryId);
    const timer = window.setTimeout(() => setPulseEntryId(null), 2600);
    return () => window.clearTimeout(timer);
  }, [highlightedEntryId]);


  return (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl text-white">Passwords</CardTitle>
            </div>
            <Button onClick={onAddItem} className="h-11 rounded-full bg-white text-slate-950 hover:bg-white/90">
              <Plus className="mr-2 size-4" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {entries.length === 0 ? (
            <div className="px-6 py-8 text-sm text-white/60">
              No saved passwords yet.
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="grid grid-cols-[30px_76px_minmax(0,1.1fr)_0.9fr_0.75fr_0.8fr] items-center gap-3 border-b border-white/10 px-6 py-3 text-center text-[10px] uppercase tracking-[0.26em] text-white/45 sm:text-[11px]">
                <span></span>
                <span>Icon</span>
                <span>Label</span>
                <span>Username</span>
                <span>Updated</span>
                <span>Actions</span>
              </div>
              <Reorder.Group 
                axis="y" 
                values={localEntries} 
                onReorder={handleLocalReorder} 
                className="divide-y divide-white/10"
              >
                <AnimatePresence initial={false}>
                  {localEntries.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      rowClassName={rowClassName}
                      pulseEntryId={pulseEntryId}
                      revealedEntryId={revealedEntryId}
                      revealedPassword={revealedPassword}
                      onReveal={onReveal}
                      onEditItem={onEditItem}
                      onDelete={onDelete}
                      onCopyPassword={onCopyPassword}
                      isBusy={isBusy}
                      rowRefs={rowRefs}
                    />
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
