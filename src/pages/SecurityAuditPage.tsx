import { useEffect, useMemo, useState } from "react";
import { Download, AlertTriangle, ShieldCheck, Trash2, X } from "lucide-react";

import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import type { VaultEntrySummary } from "../types/vault";

type Issue = {
  title: string;
  description: string;
  severity: "Low" | "Medium" | "High";
  label: string;
};

type AuditReport = {
  generatedAt: string;
  totalEntries: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  issues: Issue[];
};

type SecurityAuditPageProps = {
  entries: VaultEntrySummary[];
  auditRunId: number;
};

const HISTORY_KEY = "veryfied-audit-history";
const IGNORED_KEY = "veryfied-audit-ignored";

function getAgeDays(updatedAt: number) {
  const ageMs = Date.now() - updatedAt * 1000;
  return Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
}

export function SecurityAuditPage({ entries, auditRunId: _auditRunId }: SecurityAuditPageProps) {
  const [history, setHistory] = useState<AuditReport[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const rawIssues = useMemo(() => {
    const items: Issue[] = [];
    const labelCounts = new Map<string, number>();
    const usernameCounts = new Map<string, number>();

    for (const entry of entries) {
      const labelKey = entry.label.trim().toLowerCase();
      const usernameKey = entry.username.trim().toLowerCase();
      labelCounts.set(labelKey, (labelCounts.get(labelKey) ?? 0) + 1);
      usernameCounts.set(usernameKey, (usernameCounts.get(usernameKey) ?? 0) + 1);
    }

    for (const entry of entries) {
      const labelKey = entry.label.trim().toLowerCase();
      const usernameKey = entry.username.trim().toLowerCase();
      const ageDays = getAgeDays(entry.updatedAt);

      if (!entry.url) {
        items.push({
          title: "Missing website",
          description: "Add the website so the entry is easier to recognize and audit.",
          severity: "Low",
          label: entry.label,
        });
      }

      if ((labelCounts.get(labelKey) ?? 0) > 1) {
        items.push({
          title: "Duplicate label",
          description: "This label appears more than once in the vault.",
          severity: "Medium",
          label: entry.label,
        });
      }

      if ((usernameCounts.get(usernameKey) ?? 0) > 1) {
        items.push({
          title: "Reused username",
          description: "The same username is present on multiple entries.",
          severity: "Medium",
          label: entry.username,
        });
      }

      if (ageDays >= 180) {
        items.push({
          title: "Stale entry",
          description: `Last updated ${ageDays} days ago. Consider reviewing this login.`,
          severity: ageDays >= 365 ? "High" : "Medium",
          label: entry.label,
        });
      }
    }

    return items;
  }, [entries]);

  const report = useMemo<AuditReport>(() => {
    const issues = rawIssues.filter((issue) => !ignored.includes(`${issue.title}:${issue.label}`));
    const highCount = issues.filter((issue) => issue.severity === "High").length;
    const mediumCount = issues.filter((issue) => issue.severity === "Medium").length;
    const lowCount = issues.filter((issue) => issue.severity === "Low").length;

    return {
      generatedAt: new Date().toISOString(),
      totalEntries: entries.length,
      highCount,
      mediumCount,
      lowCount,
      issues,
    };
  }, [entries.length, rawIssues, ignored]);

  useEffect(() => {
    const ignoredStored = window.localStorage.getItem(IGNORED_KEY);
    if (ignoredStored) {
      try {
        setIgnored(JSON.parse(ignoredStored) as string[]);
      } catch {
        window.localStorage.removeItem(IGNORED_KEY);
      }
    }

    const stored = window.localStorage.getItem(HISTORY_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored) as AuditReport[]);
      } catch {
        window.localStorage.removeItem(HISTORY_KEY);
      }
    }
  }, []);

  const runAudit = () => {
    setIsRunning(true);
    setProgress(0);
    
    let currentProgress = 0;
    const interval = window.setInterval(() => {
      currentProgress += Math.random() * 30;
      if (currentProgress >= 100) {
        currentProgress = 100;
        window.clearInterval(interval);
        
        // Finalize
        const nextHistory = [report, ...history].slice(0, 3);
        setHistory(nextHistory);
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
        setIsRunning(false);
      }
      setProgress(currentProgress);
    }, 200);
  };

  const deleteHistoryEntry = (timestamp: string) => {
    const nextHistory = history.filter(h => h.generatedAt !== timestamp);
    setHistory(nextHistory);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    window.localStorage.removeItem(HISTORY_KEY);
  };

  const ignoreIssue = (issue: Issue) => {
    const key = `${issue.title}:${issue.label}`;
    setIgnored((current) => {
      const next = Array.from(new Set([...current, key]));
      window.localStorage.setItem(IGNORED_KEY, JSON.stringify(next));
      return next;
    });
  };

  const exportReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `veryfied-audit-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <CardContent className="px-6 py-8">
          <div className="flex flex-col items-center justify-center gap-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white">
              <ShieldCheck className="size-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">Security Audit</h2>
            </div>
            
            {isRunning ? (
              <div className="w-full max-w-md space-y-4">
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div 
                    className="h-full bg-white transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-white/45 uppercase tracking-widest">Analyzing vault... {Math.round(progress)}%</p>
              </div>
            ) : (
              <Button 
                onClick={runAudit}
                size="lg"
                className="h-12 px-8 rounded-full bg-white text-slate-950 hover:bg-white/90 font-semibold"
              >
                Run Audit Now
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && !isRunning && (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle className="text-xl text-white">Latest Results</CardTitle>
                <Button onClick={exportReport} variant="outline" className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
                  <Download className="mr-2 size-4" />
                  Export report
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-6 py-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {label: "High", value: report.highCount, tone: "text-white" },
                  {label: "Medium", value: report.mediumCount, tone: "text-white/80" },
                  {label: "Low", value: report.lowCount, tone: "text-white/60" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.label}</p>
                    <p className={`mt-2 text-3xl font-semibold ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {report.issues.length === 0 ? (
                <div className="rounded-[22px] border border-white/10 bg-black/15 p-6 text-sm text-white/65">
                  No obvious audit issues were found.
                </div>
              ) : (
                <div className="space-y-3">
                  {report.issues.map((issue, index) => (
                    <div
                      key={`${issue.title}-${issue.label}-${index}`}
                      className="flex flex-col gap-3 rounded-[22px] border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                          <AlertTriangle className="size-4 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">{issue.title}</p>
                            <Badge variant="secondary" className="rounded-full bg-white/10 text-white/70">
                              {issue.severity}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-white/65">{issue.description}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/45">{issue.label}</p>
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => ignoreIssue(issue)} className="h-9 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
                        Ignore
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-xl text-white">History</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearHistory}
                  className="h-8 rounded-full text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-colors px-3 text-[10px] uppercase tracking-widest"
                >
                  Clear All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-6 py-6">
              <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                {history.map((entry) => (
                  <div key={entry.generatedAt} className="relative pl-8 group">
                    <div className="absolute left-1.5 top-1.5 size-3 rounded-full bg-white border-4 border-zinc-950" />
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
                            {new Date(entry.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-white/20 uppercase tracking-[0.2em]">{entry.totalEntries} ENTRIES</span>
                            <button 
                              onClick={() => deleteHistoryEntry(entry.generatedAt)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-white/30 hover:text-red-400"
                              title="Delete entry"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {entry.highCount > 0 && <Badge className="bg-white text-black text-[10px] h-5 px-2 rounded-full border-0">{entry.highCount}H</Badge>}
                          {entry.mediumCount > 0 && <Badge className="bg-white/20 text-white/80 text-[10px] h-5 px-2 rounded-full border-0">{entry.mediumCount}M</Badge>}
                          {entry.lowCount > 0 && <Badge className="bg-white/5 text-white/40 text-[10px] h-5 px-2 rounded-full border-0">{entry.lowCount}L</Badge>}
                          {entry.highCount === 0 && entry.mediumCount === 0 && entry.lowCount === 0 && (
                            <span className="text-[10px] text-white/40 italic">Secure</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
