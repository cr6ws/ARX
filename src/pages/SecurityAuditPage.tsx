import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck, ArrowRight, ShieldAlert, Clock, LayoutGrid, Sparkles } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import type { VaultEntrySummary, AuditStats } from "../types/vault";
import { SecurityDonut, SecurityBarChart } from "../components/ui/chart";

type Issue = {
  id?: string;
  title: string;
  description: string;
  severity: "Low" | "Medium" | "High";
  label: string;
  type: "weak" | "reused" | "stale" | "missing-url" | "duplicate-label";
};

type AuditReport = {
  generatedAt: string;
  stats: AuditStats;
  score: number;
  issues: Issue[];
};

type SecurityAuditPageProps = {
  entries: VaultEntrySummary[];
  auditRunId: number;
  onFixEntry?: (id: string) => void;
};

const HISTORY_KEY = "arx-audit-history";
const IGNORED_KEY = "arx-audit-ignored";

export function SecurityAuditPage({ entries, auditRunId: _auditRunId, onFixEntry }: SecurityAuditPageProps) {
  const [history, setHistory] = useState<AuditReport[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [showIgnored, setShowIgnored] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [_currentStats, setCurrentStats] = useState<AuditStats | null>(null);

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

  const runAudit = async () => {
    setIsRunning(true);
    setProgress(0);
    
    // Simulate progress for UI feel
    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      const stats = await invoke<AuditStats>("get_audit_stats");
      setCurrentStats(stats);
      
      window.clearInterval(interval);
      setProgress(100);

      // Map backend findings to issues
      const issues: Issue[] = [];
      
      // Add Reused Issues
      stats.reusedIds.forEach(id => {
        const entry = entries.find(e => e.id === id);
        if (entry) {
          issues.push({
            id: entry.id,
            title: "Reused Password",
            description: "This password is used across multiple accounts. If one is breached, all are at risk.",
            severity: "High",
            label: entry.label,
            type: "reused"
          });
        }
      });

      // Add Weak Issues
      stats.weakIds.forEach(id => {
        const entry = entries.find(e => e.id === id);
        if (entry) {
          issues.push({
            id: entry.id,
            title: "Weak Password",
            description: "This password is too short or lacks variety. It can be easily cracked.",
            severity: "High",
            label: entry.label,
            type: "weak"
          });
        }
      });

      // Add Medium Strength Issues
      stats.mediumIds.forEach(id => {
        const entry = entries.find(e => e.id === id);
        if (entry) {
          issues.push({
            id: entry.id,
            title: "Moderate Password",
            description: "Consider strengthening this password with more symbols or length.",
            severity: "Medium",
            label: entry.label,
            type: "weak"
          });
        }
      });

      // Add Old Issues
      stats.oldIds.forEach(id => {
        const entry = entries.find(e => e.id === id);
        if (entry) {
          issues.push({
            id: entry.id,
            title: "Stale Password",
            description: "This password hasn't been changed in over 6 months.",
            severity: "Medium",
            label: entry.label,
            type: "stale"
          });
        }
      });

      // Frontend-only checks (Metadata)
      entries.forEach(entry => {
        if (!entry.url) {
          issues.push({
            id: entry.id,
            title: "Missing Website",
            description: "Add a URL to enable auto-fill and security monitoring.",
            severity: "Low",
            label: entry.label,
            type: "missing-url"
          });
        }
      });

      // Calculate Score
      const score = Math.round(
        (stats.strongCount / (stats.totalEntries || 1)) * 100 * 0.6 +
        (1 - (stats.reusedCount / (stats.totalEntries || 1))) * 40
      );

      const report: AuditReport = {
        generatedAt: new Date().toISOString(),
        stats,
        score: Math.max(0, Math.min(100, score)),
        issues: issues.sort((a, b) => {
          const sev = { High: 3, Medium: 2, Low: 1 };
          return sev[b.severity] - sev[a.severity];
        })
      };

      const nextHistory = [report, ...history].slice(0, 20);
      setHistory(nextHistory);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
      
      window.setTimeout(() => setIsRunning(false), 500);
    } catch (err) {
      console.error("Audit failed:", err);
      setIsRunning(false);
      window.clearInterval(interval);
    }
  };

  const ignoreIssue = (issue: Issue) => {
    const key = `${issue.title}:${issue.label}`;
    setIgnored((current) => {
      const next = Array.from(new Set([...current, key]));
      window.localStorage.setItem(IGNORED_KEY, JSON.stringify(next));
      return next;
    });
  };

  const restoreIssue = (issue: Issue) => {
    const key = `${issue.title}:${issue.label}`;
    setIgnored((current) => {
      const next = current.filter((k) => k !== key);
      window.localStorage.setItem(IGNORED_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all audit history?")) {
      setHistory([]);
      window.localStorage.removeItem(HISTORY_KEY);
    }
  };

  const latestReport = useMemo(() => {
    if (history.length === 0) return null;
    const report = history[0];
    const filteredIssues = report.issues.filter((issue) => {
      const isIgnored = ignored.includes(`${issue.title}:${issue.label}`);
      return showIgnored || !isIgnored;
    });
    return {
      ...report,
      issues: filteredIssues,
    };
  }, [history, ignored, showIgnored]);

  const donutData = useMemo(() => {
    if (!latestReport) return [];
    return [
      { name: "Strong", value: latestReport.stats.strongCount, color: "rgb(var(--theme-accent))" },
      { name: "Medium", value: latestReport.stats.mediumCount, color: "rgba(var(--theme-accent), 0.4)" },
      { name: "Weak", value: latestReport.stats.weakCount, color: "rgba(var(--theme-accent), 0.1)" },
    ];
  }, [latestReport]);

  const barData = useMemo(() => {
    if (!latestReport) return [];
    return [
      { name: "Reused", value: latestReport.stats.reusedCount, color: "#ef4444" },
      { name: "Weak", value: latestReport.stats.weakCount, color: "#f97316" },
      { name: "Stale", value: latestReport.stats.oldCount, color: "#eab308" },
      { name: "Missing URL", value: latestReport.issues.filter(i => i.type === "missing-url").length, color: "#64748b" },
    ];
  }, [latestReport]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Security Audit</h1>
          <p className="text-white/45 mt-1">Comprehensive analysis of your digital perimeter.</p>
        </div>
        <Button 
          onClick={runAudit}
          disabled={isRunning}
          size="lg"
          className="rounded-full px-8 h-12 bg-white text-black hover:scale-105 transition-transform font-semibold shadow-xl"
        >
          {isRunning ? "Analyzing..." : "Run Security Scan"}
        </Button>
      </div>

      {isRunning ? (
        <Card className="rounded-[32px] border-white/10 bg-white/5 backdrop-blur-3xl p-12 text-center">
          <div className="max-w-md mx-auto space-y-8">
            <div className="relative size-24 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-white/10" />
              <div 
                className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin" 
                style={{ clipPath: `inset(0 0 0 ${100-progress}%)` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck className="size-10 text-white animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xl font-medium text-white">Scanning your vault</p>
              <p className="text-sm text-white/45 uppercase tracking-[0.2em]">Checking {entries.length} items • {Math.round(progress)}%</p>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </Card>
      ) : !latestReport ? (
        <Card className="rounded-[32px] border-white/10 bg-white/5 backdrop-blur-3xl p-20 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <div className="size-20 mx-auto rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Sparkles className="size-10 text-white/20" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-white">No Audit Data</h3>
              <p className="text-white/45">Run your first security scan to identify vulnerabilities and strengthen your vault.</p>
            </div>
            <Button onClick={runAudit} variant="outline" className="rounded-full border-white/20 text-white hover:bg-white/5 px-8">
              Start Scan
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Dashboard Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Score Card */}
            <Card className="lg:col-span-1 rounded-[32px] border-white/10 bg-white/5 backdrop-blur-3xl overflow-hidden group">
              <div className="p-8 flex flex-col items-center text-center">
                <p className="text-sm font-semibold uppercase tracking-widest text-white/45 mb-8">Overall Health</p>
                <div className="relative size-48 flex items-center justify-center">
                  <SecurityDonut data={donutData} height={200} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold text-white leading-none">{latestReport.score}</span>
                    <span className="text-[10px] uppercase tracking-widest text-white/45 mt-2 font-bold">Health Score</span>
                  </div>
                </div>
                <div className="mt-8 space-y-2">
                  <h4 className="text-lg font-medium text-white">
                    {latestReport.score >= 90 ? "Excellent Security" : latestReport.score >= 70 ? "Good Foundation" : "Action Required"}
                  </h4>
                  <p className="text-sm text-white/45">Based on strength, reuse, and rotation policies.</p>
                </div>
              </div>
            </Card>

            {/* Distribution Card */}
            <Card className="lg:col-span-2 rounded-[32px] border-white/10 bg-white/5 backdrop-blur-3xl p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-medium text-white">Risk Distribution</h3>
                  <p className="text-sm text-white/45">Detected vulnerabilities by category</p>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-red-500/10 text-red-400 border-0 rounded-full px-3">{latestReport.stats.reusedCount} Critical</Badge>
                  <Badge className="bg-orange-500/10 text-orange-400 border-0 rounded-full px-3">{latestReport.stats.weakCount} Warning</Badge>
                </div>
              </div>
              <div className="h-[220px] w-full">
                <SecurityBarChart data={barData} height={220} />
              </div>
            </Card>
          </div>

          {/* Detailed Findings */}
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Findings ({latestReport.issues.length})</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowIgnored(!showIgnored)}
                  className={`text-xs uppercase tracking-widest ${showIgnored ? "text-white" : "text-white/30"}`}
                >
                  {showIgnored ? "Hide Ignored" : "Show Ignored"}
                </Button>
              </div>
              
              <div className="space-y-3">
                {latestReport.issues.length === 0 ? (
                  <div className="p-12 rounded-[24px] border border-white/5 bg-white/2 flex flex-col items-center text-center gap-4">
                    <ShieldCheck className="size-12 text-white/10" />
                    <p className="text-white/45">Your vault is looking impeccable! No issues found.</p>
                  </div>
                ) : (
                  latestReport.issues.map((issue, idx) => {
                    const isIgnored = ignored.includes(`${issue.title}:${issue.label}`);
                    return (
                      <div 
                        key={`${issue.id}-${idx}`}
                        className={`group relative flex flex-col sm:flex-row items-center gap-4 p-5 rounded-[24px] border transition-all ${
                          isIgnored 
                            ? "border-white/5 bg-white/[0.02] opacity-60" 
                            : "border-white/10 bg-white/5 hover:bg-white/[0.08]"
                        }`}
                      >
                        <div className={`size-12 shrink-0 rounded-2xl flex items-center justify-center ${
                          isIgnored ? "bg-white/5 text-white/20" :
                          issue.severity === "High" ? "bg-red-500/10 text-red-400" : 
                          issue.severity === "Medium" ? "bg-orange-500/10 text-orange-400" : "bg-white/10 text-white/40"
                        }`}>
                          {issue.type === "reused" ? <ShieldAlert className="size-5" /> : 
                           issue.type === "stale" ? <Clock className="size-5" /> : 
                           issue.type === "missing-url" ? <LayoutGrid className="size-5" /> :
                           <AlertTriangle className="size-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-medium text-white truncate">{issue.label}</p>
                            <Badge variant="outline" className={`text-[10px] uppercase tracking-tighter py-0 px-1.5 rounded-md ${
                              isIgnored ? "border-white/10 text-white/20" :
                              issue.severity === "High" ? "border-red-500/20 text-red-400" : 
                              issue.severity === "Medium" ? "border-orange-500/20 text-orange-400" : "border-white/10 text-white/40"
                            }`}>
                              {issue.severity}
                            </Badge>
                          </div>
                          <p className={`text-sm font-medium ${isIgnored ? "text-white/30" : "text-white/60"}`}>{issue.title}</p>
                          <p className="text-xs text-white/40 mt-1 line-clamp-1">{issue.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {issue.id && onFixEntry && !isIgnored && (
                             <Button 
                              onClick={() => onFixEntry(issue.id!)}
                              variant="ghost" 
                              className="rounded-full h-10 px-4 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 group"
                            >
                              Fix Now <ArrowRight className="ml-2 size-3 group-hover:translate-x-1 transition-transform" />
                            </Button>
                          )}
                          <Button 
                            onClick={() => isIgnored ? restoreIssue(issue) : ignoreIssue(issue)}
                            variant="ghost" 
                            className={`rounded-full h-10 px-4 text-xs font-semibold hover:bg-white/10 ${
                              isIgnored ? "text-theme-accent hover:text-theme-accent" : "text-white/30 hover:text-white"
                            }`}
                          >
                            {isIgnored ? "Restore" : "Ignore"}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between h-8">
                <h3 className="text-xl font-semibold text-white">History</h3>
                <button 
                  onClick={clearHistory}
                  className="text-[10px] font-bold uppercase tracking-widest text-white/10 hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
              </div>
              
              <Card className="rounded-[32px] border-white/5 bg-white/[0.02] backdrop-blur-3xl overflow-hidden">
                <div className="p-0 h-[420px] overflow-y-auto custom-scrollbar relative">
                  {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-3 opacity-20">
                       <Clock className="size-8 mx-auto" />
                       <p className="text-[10px] uppercase tracking-widest font-bold">No History</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.03]">
                      {history.map((report) => (
                        <div 
                          key={report.generatedAt} 
                          className="relative group p-4 hover:bg-white/[0.02] transition-all duration-300 cursor-default"
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/0 group-hover:bg-white/10 transition-all" />
                          
                          <div className="flex items-center justify-between gap-4">
                            <div className="space-y-1.5">
                               <div className="flex items-center gap-2">
                                 <div className={`size-1.5 rounded-full ${report.score >= 90 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : report.score >= 70 ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"}`} />
                                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                                   {new Date(report.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                 </p>
                               </div>
                               <p className="text-sm font-bold text-white tracking-tight">
                                 {new Date(report.generatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                               </p>

                               <div className="flex items-center gap-1">
                                 {report.score >= 90 ? (
                                   <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                     <ShieldCheck className="size-2.5 text-emerald-400" />
                                     <span className="text-[8px] font-black uppercase text-emerald-400 tracking-widest">Safe</span>
                                   </div>
                                 ) : (
                                   <div className="flex items-center gap-1">
                                     {report.stats.reusedCount > 0 && (
                                       <div className="px-1 py-0.5 rounded bg-red-500/10 text-red-400 text-[8px] font-black border border-red-500/10">{report.stats.reusedCount}R</div>
                                     )}
                                     {report.stats.weakCount > 0 && (
                                       <div className="px-1 py-0.5 rounded bg-orange-500/10 text-orange-400 text-[8px] font-black border border-orange-500/10">{report.stats.weakCount}W</div>
                                     )}
                                   </div>
                                 )}
                                 <span className="text-[8px] font-black text-white/5 uppercase tracking-widest ml-1">{report.stats.totalEntries} Items</span>
                               </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xl font-black text-white/80 tabular-nums">
                                {report.score}
                              </div>
                              <p className="text-[8px] font-bold uppercase tracking-widest text-white/20">Score</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              {/* Security Tip Card */}
              <Card className="rounded-[32px] border-0 bg-linear-to-br from-white/10 to-white/5 p-6 space-y-3 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 size-24 bg-white/5 rounded-full blur-2xl" />
                <Sparkles className="size-6 text-white/60" />
                <h4 className="text-sm font-semibold text-white">Pro Tip</h4>
                <p className="text-xs text-white/60 leading-relaxed">
                  Using a unique password for every account is the single most effective way to prevent mass breaches. Use the password generator to create 16+ character random keys.
                </p>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
