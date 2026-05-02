import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Clock, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import type { AuditStats } from "../types/vault";

export function SecurityDashboard() {
  const [stats, setStats] = useState<AuditStats | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await invoke<AuditStats>("get_audit_stats");
      setStats(data);
    } catch (err) {
      console.error("Failed to load audit stats:", err);
    }
  };

  if (!stats) return null;

  const totalStrength = stats.weakCount + stats.mediumCount + stats.strongCount;
  const weakPercent = totalStrength > 0 ? (stats.weakCount / totalStrength) * 100 : 0;
  const mediumPercent = totalStrength > 0 ? (stats.mediumCount / totalStrength) * 100 : 0;
  const strongPercent = totalStrength > 0 ? (stats.strongCount / totalStrength) * 100 : 100;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Password Strength Chart */}
      <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl overflow-hidden group">
        <div className="absolute inset-0 bg-linear-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h3 className="text-lg font-medium text-theme-text">Password Security</h3>
              <p className="text-xs text-theme-text-muted">Overall strength distribution</p>
            </div>
            <div className="size-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
              <ShieldCheck className="size-5 text-theme-text-muted" />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-10">
            <div className="relative size-36 shrink-0">
              <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                 <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke="var(--theme-border)"
                  strokeWidth="10"
                />
                
                {stats.strongCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="rgb(var(--theme-accent))"
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (stats.strongCount / totalStrength) * circumference}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                )}
                
                {stats.mediumCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="var(--theme-text-muted)"
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (stats.mediumCount / totalStrength) * circumference}
                    strokeLinecap="round"
                    transform={`rotate(${(stats.strongCount / totalStrength) * 360} 50 50)`}
                    className="transition-all duration-1000 ease-out"
                  />
                )}
                
                {stats.weakCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="var(--theme-border)"
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (stats.weakCount / totalStrength) * circumference}
                    strokeLinecap="round"
                    transform={`rotate(${((stats.strongCount + stats.mediumCount) / totalStrength) * 360} 50 50)`}
                    className="transition-all duration-1000 ease-out"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tracking-tight text-theme-text">{Math.round(strongPercent)}%</span>
                <span className="text-[9px] uppercase tracking-[0.2em] text-theme-text-muted font-medium">Safe</span>
              </div>
            </div>
            
            <div className="flex-1 w-full space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs uppercase tracking-widest text-theme-text-muted">
                  <span>Strong</span>
                  <span className="text-theme-text">{stats.strongCount}</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${strongPercent}%` }} />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs uppercase tracking-widest text-theme-text-muted">
                  <span>Medium</span>
                  <span className="text-theme-text">{stats.mediumCount}</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-white/40 rounded-full" style={{ width: `${mediumPercent}%` }} />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs uppercase tracking-widest text-theme-text-muted">
                  <span>Weak</span>
                  <span className="text-theme-text">{stats.weakCount}</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-white/10 rounded-full" style={{ width: `${weakPercent}%` }} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Alerts */}
      <div className="grid gap-6">
        <Card className={`rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl overflow-hidden transition-all duration-500 ${stats.reusedCount > 0 ? "ring-1 ring-red-500/20" : ""}`}>
          <CardContent className="p-6 flex items-center gap-5">
            <div className={`flex size-14 shrink-0 items-center justify-center rounded-[20px] ${stats.reusedCount > 0 ? "bg-red-500/10 text-red-400" : "bg-white/5 text-theme-text-muted"}`}>
              <ShieldAlert className="size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-theme-text">Reused Passwords</p>
              <p className="text-sm text-theme-text-muted mt-1 line-clamp-2">
                {stats.reusedCount > 0 
                  ? `${stats.reusedCount} accounts are sharing credentials, increasing breach risk.` 
                  : "Excellent! Every account has a unique password."}
              </p>
            </div>
            {stats.reusedCount > 0 && (
              <div className="size-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </CardContent>
        </Card>
 
        <Card className="rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl overflow-hidden">
          <CardContent className="p-6 flex items-center gap-5">
            <div className={`flex size-14 shrink-0 items-center justify-center rounded-[20px] ${stats.oldCount > 0 ? "bg-orange-500/10 text-orange-400" : "bg-white/5 text-theme-text-muted"}`}>
              <Clock className="size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-theme-text">Old Passwords</p>
              <p className="text-sm text-theme-text-muted mt-1 line-clamp-2">
                {stats.oldCount > 0 
                  ? `${stats.oldCount} passwords haven't been rotated in over 180 days.` 
                  : "All passwords have been recently updated."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
