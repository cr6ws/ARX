import { useEffect, useMemo, useState } from "react";
import { Dice5, X, Eye, EyeOff } from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { PasswordGeneratorSettings, VaultEntryInput } from "../../types/vault";

const EMPTY_ENTRY: VaultEntryInput = {
  label: "",
  username: "",
  password: "",
  url: "",
  notes: "",
  tags: [],
  category: "Other",
  isFavorite: false,
  entryType: "login",
};

type EntryModalProps = {
  open: boolean;
  mode: "add" | "edit";
  initialEntry?: VaultEntryInput;
  initialTags?: string[];
  isBusy: boolean;
  generatorSettings: PasswordGeneratorSettings;
  onClose: () => void;
  onSave: (entry: VaultEntryInput) => Promise<void> | void;
};

function generatePassword(settings: PasswordGeneratorSettings) {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*_-";
  
  let alphabet = "";
  if (settings.includeUppercase) alphabet += uppercase;
  if (settings.includeLowercase) alphabet += lowercase;
  if (settings.includeNumbers) alphabet += numbers;
  if (settings.includeSymbols) alphabet += symbols;
  
  if (!alphabet) alphabet = lowercase + numbers; // Fallback

  const length = settings.length;
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function toTagsText(tags: string[]) {
  return tags.join(", ");
}

function parseTagsText(tagsText: string) {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function EntryModal({
  open,
  mode,
  initialEntry,
  initialTags,
  isBusy,
  generatorSettings,
  onClose,
  onSave,
}: EntryModalProps) {
  const [entry, setEntry] = useState<VaultEntryInput>(EMPTY_ENTRY);
  const [tagsText, setTagsText] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isMounted, setIsMounted] = useState(open);
  const [isVisible, setIsVisible] = useState(false);

  const title = mode === "edit" ? "Edit Entry" : "Login Details";
  const description = useMemo(
    () =>
      mode === "edit"
        ? "Update the stored password entry while keeping the vault encrypted locally."
        : "Add a password entry without leaving the page.",
    [mode],
  );

  useEffect(() => {
    if (!open) return;
    setEntry(
      initialEntry ?? {
        ...EMPTY_ENTRY,
        password: generatePassword(generatorSettings),
      },
    );
    setTagsText(toTagsText(initialTags ?? initialEntry?.tags ?? []));
  }, [initialEntry, initialTags, open, generatorSettings]);

  useEffect(() => {
    if (open) {
      setIsMounted(true);
      const timer = window.setTimeout(() => setIsVisible(true), 20);
      return () => window.clearTimeout(timer);
    }

    setIsVisible(false);
    const timer = window.setTimeout(() => setIsMounted(false), 220);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!isMounted) {
    return null;
  }

  const handleSave = async () => {
    await onSave({
      ...entry,
      label: entry.label.trim(),
      username: entry.username.trim(),
      url: entry.url?.trim() ? entry.url.trim() : undefined,
      notes: entry.notes?.trim() ? entry.notes.trim() : undefined,
      tags: parseTagsText(tagsText),
    });
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm sm:items-center transition-opacity duration-200 ease-out ${isVisible ? "opacity-100" : "opacity-0"
        }`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close entry dialog"
        onClick={onClose}
      />
      <Card
        className={`relative z-10 flex w-full max-w-2xl max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-3xl border-white/10 bg-[#151a1c]/95 shadow-[0_30px_120px_rgba(0,0,0,0.55)] transition-opacity duration-200 ease-out ${isVisible ? "opacity-100" : "opacity-0"
          }`}
      >
        <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl text-white">{title}</CardTitle>
              <CardDescription className="text-white/60">{description}</CardDescription>
            </div>
            <Button
              variant="ghost"
              onClick={onClose}
              className="rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-4 overflow-y-auto px-6 py-6 pr-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry-label-modal" className="text-white/80">
                Label
              </Label>
              <Input
                id="entry-label-modal"
                value={entry.label}
                onChange={(event) =>
                  setEntry((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder="e.g. Dribbble"
                className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-username-modal" className="text-white/80">
                Username
              </Label>
              <Input
                id="entry-username-modal"
                value={entry.username}
                onChange={(event) =>
                  setEntry((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                placeholder="alex@example.com"
                className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="entry-password-modal" className="text-white/80">
                Password
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="entry-password-modal"
                    type={showPassword ? "text" : "password"}
                    value={entry.password}
                    onChange={(event) =>
                      setEntry((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Minimum 8 characters"
                    className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setEntry((current) => ({
                      ...current,
                      password: generatePassword(generatorSettings),
                    }))
                  }
                  className="h-11 w-11 shrink-0 rounded-2xl border-white/10 bg-white/5 p-0 text-white hover:bg-white/10"
                  title="Generate strong password"
                >
                  <Dice5 className="size-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-url-modal" className="text-white/80">
                Website
              </Label>
              <Input
                id="entry-url-modal"
                value={entry.url ?? ""}
                onChange={(event) =>
                  setEntry((current) => ({
                    ...current,
                    url: event.target.value,
                  }))
                }
                placeholder="https://"
                className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="entry-tags-modal" className="text-white/80">
                Tags
              </Label>
              <Input
                id="entry-tags-modal"
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                placeholder="work, finance, shared"
                className="h-11 rounded-2xl border-white/10 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-white/35 focus-visible:ring-white/15"
              />
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={isBusy}
            className="h-11 w-full rounded-2xl bg-white text-sm font-semibold text-slate-950 shadow-[0_16px_30px_rgba(255,255,255,0.14)] hover:bg-white/90"
          >
            {mode === "edit" ? "Update entry" : "Save entry"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
