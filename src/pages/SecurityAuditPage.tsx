import { useEffect, useMemo, useState } from "react";
import { Download, AlertTriangle, ShieldCheck } from "lucide-react";

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

export function SecurityAuditPage({ entries, auditRunId }: SecurityAuditPageProps) {
  const [history, setHistory] = useState<AuditReport[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);

  const issues = useMemo(() => {
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
  }, [entries.length, issues]);

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

  useEffect(() => {
    const nextIssues = report.issues.filter((issue) => !ignored.includes(`${issue.title}:${issue.label}`));
    const nextReport = { ...report, issues: nextIssues };
    const nextHistory = [nextReport, ...history].slice(0, 5);
    setHistory(nextHistory);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  }, [auditRunId, ignored, report]);

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
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <CardHeader className="border-b border-white/10 bg-white/5 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl text-white">Security Audit Results</CardTitle>
              <CardDescription className="text-white/60">
                This page turns the stored vault metadata into actionable hygiene checks.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/45">
              <ShieldCheck className="size-4 text-white" />
              Live analysis
            </div>
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

          {issues.length === 0 ? (
            <div className="rounded-[22px] border border-white/10 bg-black/15 p-6 text-sm text-white/65">
              No obvious audit issues were found. Keep adding entries with websites and review them periodically.
            </div>
          ) : (
            <div className="space-y-3">
              {issues
                .filter((issue) => !ignored.includes(`${issue.title}:${issue.label}`))
                .map((issue, index) => (
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
          <CardTitle className="text-xl text-white">Recent reports</CardTitle>
          <CardDescription className="text-white/60">
            The last few runs are stored locally so you can compare audit changes over time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-6 py-6 text-sm leading-7 text-white/70">
          {history.length === 0 ? (
            <p>No audit history yet. Run the audit page a few times and the last reports will appear here.</p>
          ) : (
            history.map((entry) => (
              <div key={entry.generatedAt} className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-medium text-white">{new Date(entry.generatedAt).toLocaleString()}</p>
                <p className="mt-1 text-white/60">
                  {entry.totalEntries} entries, {entry.highCount} high, {entry.mediumCount} medium, {entry.lowCount} low.
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
