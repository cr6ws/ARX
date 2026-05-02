import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  ShieldCheck,
  Plus,
  Copy,
  Clock,
  X
} from "lucide-react";
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

type AuthenticatorPageProps = {
  entries: VaultEntrySummary[];
  searchTerm: string;
  onAddAuthenticator: () => void;
  onDeleteAuthenticator: (id: string) => void;
};

type TOTPData = {
  code: string;
  nextStep: number;
};

export function AuthenticatorPage({
  entries,
  searchTerm,
  onAddAuthenticator,
  onDeleteAuthenticator
}: AuthenticatorPageProps) {
  const [totpCodes, setTotpCodes] = useState<Record<string, TOTPData>>({});
  const [progress, setProgress] = useState(0);

  // Filter entries that have TOTP enabled
  const totpEntries = entries.filter(e => e.hasTotp || e.entryType === "totp");

  const filteredEntries = totpEntries.filter(e => {
    const query = searchTerm.toLowerCase();
    return e.label.toLowerCase().includes(query) ||
      e.username.toLowerCase().includes(query);
  });

  const fetchCodes = async () => {
    if (totpEntries.length === 0) return;

    const newCodes: Record<string, TOTPData> = {};
    for (const entry of totpEntries) {
      try {
        const [code, nextStep] = await invoke<[string, number]>("get_totp_code", { id: entry.id });
        newCodes[entry.id] = { code, nextStep };
      } catch (err) {
        console.error(`Failed to fetch TOTP for ${entry.id}:`, err);
      }
    }
    setTotpCodes(newCodes);
  };

  useEffect(() => {
    fetchCodes();
    const interval = setInterval(fetchCodes, 10000); // Fetch every 10s as a backup
    return () => clearInterval(interval);
  }, [entries]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const step = 30;
      const elapsed = now % step;
      const remaining = step - elapsed;
      setProgress((remaining / step) * 100);

      // If we're at the very start of a step, refresh
      if (elapsed === 0) {
        fetchCodes();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Authenticator</h1>
          <p className="text-white/45 mt-1">Secure 2FA codes for your connected accounts.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
            <div className="relative size-4">
              <svg className="size-4 -rotate-90">
                <circle
                  cx="8"
                  cy="8"
                  r="7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-white/10"
                />
                <circle
                  cx="8"
                  cy="8"
                  r="7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={44}
                  strokeDashoffset={44 - (44 * progress) / 100}
                  className="text-theme-accent transition-all duration-1000"
                />
              </svg>
            </div>
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Refreshing in {Math.round(30 * progress / 100)}s</span>
          </div>
          <Button
            onClick={onAddAuthenticator}
            className="rounded-full px-8 h-12 bg-white text-black hover:scale-105 transition-transform font-semibold shadow-xl"
          >
            <Plus className="mr-2 size-5" />
            Add Account
          </Button>
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <Card className="rounded-[32px] border-white/10 bg-white/5 backdrop-blur-3xl p-20 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <div className="size-20 mx-auto rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-theme-accent">
              <ShieldCheck className="size-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-white">
                {searchTerm ? "No results found" : "No Authenticator Accounts"}
              </h3>
              <p className="text-white/45">
                {searchTerm
                  ? `We couldn't find anything matching "${searchTerm}"`
                  : "Add your 2FA accounts to generate secure login codes."}
              </p>
            </div>
            {!searchTerm && (
              <Button onClick={onAddAuthenticator} variant="outline" className="rounded-full border-white/20 text-white hover:bg-white/5 px-8">
                Setup First Account
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntries.map((entry) => {
            const data = totpCodes[entry.id];
            const code = data?.code || (entry.hasTotp ? "ERROR" : "------");

            return (
              <Card
                key={entry.id}
                className="group relative rounded-[28px] border-white/10 bg-white/5 hover:bg-white/[0.08] transition-all overflow-hidden"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-theme-accent shadow-inner">
                        <ShieldCheck className="size-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white truncate text-lg leading-tight">{entry.label}</h3>
                        <p className="text-xs text-white/30 truncate font-medium">{entry.username || "No account name"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-full bg-black/40 border border-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <X className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[32px] border-white/10 bg-[#0a0a0a]/90 backdrop-blur-3xl shadow-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-2xl font-bold text-white">Remove Account?</AlertDialogTitle>
                          <AlertDialogDescription className="text-white/45 text-base">
                            Are you sure you want to remove <span className="text-white font-semibold">{entry.label}</span>?
                            You'll lose access to your 2FA codes for this account unless you have a backup of the secret key.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-6 gap-3 border-none bg-transparent -mx-0 -mb-0 p-0 sm:justify-end">
                          <AlertDialogCancel className="rounded-full h-12 px-6 border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors">
                            Keep Account
                          </AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => onDeleteAuthenticator(entry.id)}
                            className="rounded-full h-12 px-8 font-semibold transition-all shadow-lg"
                          >
                            Delete Forever
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="relative group/code">
                    <div
                      onClick={() => code !== "------" && code !== "ERROR" && handleCopy(code)}
                      className={`flex items-center justify-between p-5 rounded-[22px] bg-black/40 border border-white/5 cursor-pointer hover:border-white/20 transition-all active:scale-[0.98] ${code === "ERROR" ? "border-red-500/50 bg-red-500/5" : ""}`}
                    >
                      <div className="flex gap-2">
                        {code === "ERROR" ? (
                          <span className="text-xl font-bold text-red-500 uppercase tracking-tight px-1">Invalid Secret Key</span>
                        ) : (
                          code.split('').map((char, i) => (
                            <span key={i} className={`text-3xl font-mono font-bold tracking-tighter ${i < 3 ? 'text-white' : 'text-theme-accent'}`}>
                              {char}
                            </span>
                          ))
                        )}
                      </div>
                      {code !== "ERROR" && code !== "------" && (
                        <Copy className="size-5 text-white/20 group-hover/code:text-white transition-colors" />
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className={`size-1.5 rounded-full ${progress < 20 ? 'bg-red-500 animate-pulse' : 'bg-theme-accent'}`} />
                      <span className="text-[10px] uppercase tracking-widest font-black text-white/20">
                        {entry.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-white/20 font-bold uppercase tracking-widest">
                      <Clock className="size-3" />
                      Updated {new Date(entry.updatedAt * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
