import { memo, useMemo, useState } from "react";
import { RotateCcw, Trash2, User, Briefcase, Share2, Wallet, Shield, AlertCircle, GraduationCap, Gamepad2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

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

type TrashPageProps = {
  entries: VaultEntrySummary[];
  isBusy: boolean;
  onRestore: (id: string) => Promise<void>;
  onDeleteForever: (id: string) => Promise<void>;
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
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white/40">
        {initials}
      </div>
    );
  }

  return (
    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <img
        src={faviconUrl}
        alt={`${entry.label} logo`}
        className="size-7 rounded-md object-contain opacity-50 grayscale"
        loading="lazy"
        onError={() => setImageError(true)}
      />
    </div>
  );
}

const TrashEntryRow = memo(({ 
  entry, 
  onRestore, 
  onDeleteForever,
  isBusy
}: { 
  entry: VaultEntrySummary; 
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  isBusy: boolean;
}) => {
  const CategoryIcon = entry.category === "Personal" ? User : entry.category === "Work" ? Briefcase : entry.category === "School" ? GraduationCap : entry.category === "Games" ? Gamepad2 : entry.category === "Social" ? Share2 : entry.category === "Finance" ? Wallet : Shield;
  
  const daysLeft = entry.deletedAt 
    ? Math.max(0, 30 - Math.floor((Date.now() / 1000 - entry.deletedAt) / (24 * 60 * 60)))
    : 30;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="px-6 py-4 transition-colors duration-200 hover:bg-white/[0.02] border-b border-white/5 last:border-0"
    >
      <div className="grid grid-cols-[48px_minmax(0,1fr)_120px_140px] items-center gap-4 text-[13px] sm:text-sm">
        <EntryLogo entry={entry} />
        
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{entry.label}</p>
          <div className="mt-1 flex items-center gap-2 text-white/40 text-[11px]">
            <CategoryIcon className="size-3" />
            <span className="truncate">{entry.username}</span>
          </div>
        </div>

        <div className="text-center">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${daysLeft < 5 ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-white/5 text-white/60 border-white/10"}`}>
            <AlertCircle className="size-3" />
            {daysLeft}d left
          </span>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onRestore(entry.id)}
            disabled={isBusy}
            className="h-9 px-3 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <RotateCcw className="mr-2 size-3.5" />
            Restore
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={isBusy}
                className="h-9 w-9 rounded-xl border-red-500/20 bg-red-500/10 p-0 text-red-400 hover:bg-red-500/20 hover:text-red-300"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/10 bg-zinc-950/95 text-white backdrop-blur-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Forever?</AlertDialogTitle>
                <AlertDialogDescription className="text-white/60">
                  This action cannot be undone. This account and its password will be permanently removed from your vault.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDeleteForever(entry.id)}
                  variant="destructive"
                  className="bg-red-500 text-white hover:bg-red-600 border-none"
                >
                  Delete Forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </motion.div>
  );
});

export function TrashPage({
  entries,
  isBusy,
  onRestore,
  onDeleteForever,
}: TrashPageProps) {
  return (
    <section className="space-y-6">
      <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl text-white">Trash Bin</CardTitle>
              <p className="mt-1 text-sm text-white/40">Items here will be automatically deleted after 30 days.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex size-16 items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02] text-white/20">
                <Trash2 className="size-8" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-white/60">Trash is empty</h3>
              <p className="mt-1 text-sm text-white/30">Deleted items will appear here for 30 days.</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="grid grid-cols-[48px_minmax(0,1fr)_120px_140px] border-b border-white/10 px-6 py-3 text-[10px] uppercase tracking-[0.26em] text-white/45 sm:text-[11px] gap-4">
                <span></span>
                <span>Account</span>
                <span className="text-center">Auto-Delete</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-white/10">
                <AnimatePresence initial={false}>
                  {entries.map((entry) => (
                    <TrashEntryRow
                      key={entry.id}
                      entry={entry}
                      onRestore={onRestore}
                      onDeleteForever={onDeleteForever}
                      isBusy={isBusy}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
