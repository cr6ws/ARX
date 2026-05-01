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
              <h3 className="text-lg font-medium text-white">Password Security</h3>
              <p className="text-xs text-white/40">Overall strength distribution</p>
            </div>
            <div className="size-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
              <ShieldCheck className="size-5 text-white/60" />
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
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="10"
                />
                
                {stats.strongCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="white"
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (stats.strongCount / totalStrength) * circumference}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                  />
                )}
                
                {stats.mediumCount > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.4)"
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
                    stroke="rgba(255,255,255,0.15)"
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
                <span className="text-3xl font-bold tracking-tight text-white">{Math.round(strongPercent)}%</span>
                <span className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-medium">Safe</span>
              </div>
            </div>
            
            <div className="flex-1 w-full space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/40">
                  <span>Strong</span>
                  <span className="text-white">{stats.strongCount}</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${strongPercent}%` }} />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/40">
                  <span>Medium</span>
                  <span className="text-white">{stats.mediumCount}</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-white/40 rounded-full" style={{ width: `${mediumPercent}%` }} />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/40">
                  <span>Weak</span>
                  <span className="text-white">{stats.weakCount}</span>
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
            <div className={`flex size-14 shrink-0 items-center justify-center rounded-[20px] ${stats.reusedCount > 0 ? "bg-red-500/10 text-red-400" : "bg-white/5 text-white/20"}`}>
              <ShieldAlert className="size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-white">Reused Passwords</p>
              <p className="text-sm text-white/50 mt-1 line-clamp-2">
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
            <div className={`flex size-14 shrink-0 items-center justify-center rounded-[20px] ${stats.oldCount > 0 ? "bg-orange-500/10 text-orange-400" : "bg-white/5 text-white/20"}`}>
              <Clock className="size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-white">Old Passwords</p>
              <p className="text-sm text-white/50 mt-1 line-clamp-2">
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
