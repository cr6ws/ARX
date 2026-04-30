import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, Clock, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import type { AuditStats } from "../types/vault";

export function SecurityDashboard() {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [isBreachScanning, setIsBreachScanning] = useState(false);
  const [breachResults, setBreachResults] = useState<{ email: string; count: number } | null>(null);

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

  const simulateBreachWatch = () => {
    setIsBreachScanning(true);
    setBreachResults(null);
    
    // Simulate a network delay
    setTimeout(() => {
      setIsBreachScanning(false);
      setBreachResults({
        email: "user@example.com",
        count: Math.floor(Math.random() * 5) + 1
      });
    }, 2000);
  };

  if (!stats) return null;

  const totalStrength = stats.weakCount + stats.mediumCount + stats.strongCount;
  const weakPercent = totalStrength > 0 ? (stats.weakCount / totalStrength) * 100 : 0;
  const mediumPercent = totalStrength > 0 ? (stats.mediumCount / totalStrength) * 100 : 0;
  const strongPercent = totalStrength > 0 ? (stats.strongCount / totalStrength) * 100 : 100;

  // Simple Donut calculation
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
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="10"
                />
                
                {/* Strong segment */}
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
                
                {/* Medium segment */}
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
                
                {/* Weak segment */}
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

      {/* Breach Watch Simulation */}
      <Card className="col-span-full rounded-3xl border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl overflow-hidden group">
        <div className="absolute inset-0 bg-linear-to-r from-white/[0.03] to-transparent pointer-events-none" />
        <CardContent className="p-8 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-white/60 mb-2">
                <ShieldAlert className="size-3" />
                Live Monitoring
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-white">Breach Watch</h3>
              <p className="text-sm text-white/50 max-w-md">Our simulation engine scans thousands of dark web leaks to see if your information has been compromised.</p>
            </div>
            
            {breachResults ? (
              <div className="flex items-center gap-5 bg-red-500/10 border border-red-500/20 px-6 py-4 rounded-[28px] animate-in zoom-in-95 duration-500">
                <div className="size-12 rounded-2xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="size-6 text-red-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{breachResults.count} Data Breaches</p>
                  <p className="text-sm text-red-400/80">Compromised on the dark web</p>
                </div>
                <button 
                  onClick={simulateBreachWatch}
                  className="ml-4 size-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
                  title="Rescan"
                >
                  <Clock className="size-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={simulateBreachWatch}
                disabled={isBreachScanning}
                className="relative group h-14 px-8 rounded-2xl bg-white text-slate-950 font-bold overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {isBreachScanning ? (
                  <div className="flex items-center gap-3">
                    <div className="size-5 border-3 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="size-5" />
                    <span>Run Dark Web Scan</span>
                  </div>
                )}
              </button>
            )}
          </div>

          {isBreachScanning && (
            <div className="mt-8 space-y-4">
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-white animate-breach-scan shadow-[0_0_20px_rgba(255,255,255,0.6)]" style={{ width: '40%' }} />
              </div>
              <div className="flex justify-between items-center text-[10px] text-white/20 uppercase tracking-[0.25em] font-medium">
                <span>Indexing Leaks...</span>
                <span>Found 14.2B records</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
