import { useEffect, useState, useRef } from "react";
import { Search, Globe, User, Shield, Hash, ArrowRight } from "lucide-react";
import type { VaultEntrySummary } from "../types/vault";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

type CommandPaletteProps = {
  open: boolean;
  entries: VaultEntrySummary[];
  onClose: () => void;
  onSelect: (id: string) => void;
};

export function CommandPalette({ open, entries, onClose, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredEntries = entries.filter((entry) => {
    const searchStr = `${entry.label} ${entry.username} ${entry.url ?? ""}`.toLowerCase();
    return searchStr.includes(query.toLowerCase());
  }).slice(0, 8); // Keep it fast

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredEntries.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredEntries.length) % filteredEntries.length);
      } else if (e.key === "Enter" && filteredEntries[selectedIndex]) {
        e.preventDefault();
        onSelect(filteredEntries[selectedIndex].id);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredEntries, selectedIndex, onClose, onSelect]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />
      
      <Card className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border-white/10 bg-[#151a1c]/90 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <div className="flex items-center px-4 py-3 border-b border-white/5">
          <Search className="size-5 text-white/40 mr-3" />
          <Input
            ref={inputRef}
            placeholder="Type to search anything..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent border-none text-white placeholder:text-white/20 focus-visible:ring-0 h-10 p-0 text-lg"
          />
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-white/40 uppercase tracking-widest">
            Esc
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
          {filteredEntries.length > 0 ? (
            <div className="space-y-1">
              {filteredEntries.map((entry, index) => (
                <button
                  key={entry.id}
                  onClick={() => onSelect(entry.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-200 group ${
                    index === selectedIndex 
                      ? "bg-white text-slate-950" 
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`size-10 flex items-center justify-center rounded-xl border ${
                      index === selectedIndex ? "border-black/10 bg-black/5" : "border-white/10 bg-white/5"
                    }`}>
                      {entry.category === "Work" ? <Shield className="size-4" /> : 
                       entry.category === "Social" ? <User className="size-4" /> :
                       entry.category === "Finance" ? <Hash className="size-4" /> :
                       <Globe className="size-4" />}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm leading-tight">{entry.label}</p>
                      <p className={`text-xs ${index === selectedIndex ? "text-slate-900/60" : "text-white/30"}`}>
                        {entry.username} • {entry.url || "No URL"}
                      </p>
                    </div>
                  </div>
                  {index === selectedIndex && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-right-2 fade-in duration-200">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Enter to open</span>
                      <ArrowRight className="size-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center space-y-2">
              <div className="size-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <Search className="size-6 text-white/20" />
              </div>
              <p className="text-white/60 font-medium">No results found for "{query}"</p>
              <p className="text-white/20 text-xs">Try searching for a label, username, or URL</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase tracking-widest">
              <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-white/60 border border-white/10">↑↓</span> Navigate
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase tracking-widest">
              <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-white/60 border border-white/10">Enter</span> Select
            </div>
          </div>
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">ARX Search</p>
        </div>
      </Card>
    </div>
  );
}
