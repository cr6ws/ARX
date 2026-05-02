import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Star,
  Clock
} from "lucide-react";
import type { VaultEntrySummary } from "../types/vault";
import { Badge } from "../components/ui/badge";

type SecureNotesPageProps = {
  entries: VaultEntrySummary[];
  searchTerm: string;
  onAddNote: () => void;
  onEditNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
};

export function SecureNotesPage({ 
  entries, 
  searchTerm, 
  onAddNote, 
  onEditNote, 
  onDeleteNote 
}: SecureNotesPageProps) {
  const notes = entries.filter(e => e.entryType === "note");
  
  const filteredNotes = notes.filter(note => {
    const query = searchTerm.toLowerCase();
    return note.label.toLowerCase().includes(query) || 
           note.tags.some(t => t.toLowerCase().includes(query));
  }).sort((a, b) => {
    // Sort favorites first
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    // Then sort by update time (newest first)
    return b.updatedAt - a.updatedAt;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Secure Notes</h1>
          <p className="text-white/45 mt-1">Encrypted storage for your sensitive documents and snippets.</p>
        </div>
        <Button 
          onClick={onAddNote}
          className="rounded-full px-8 h-12 bg-white text-black hover:scale-105 transition-transform font-semibold shadow-xl"
        >
          <Plus className="mr-2 size-5" />
          Add Note
        </Button>
      </div>

      {filteredNotes.length === 0 ? (
        <Card className="rounded-[32px] border-white/10 bg-white/5 backdrop-blur-3xl p-20 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <div className="size-20 mx-auto rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
              <FileText className="size-10 text-white/20" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-white">
                {searchTerm ? "No results found" : "No Secure Notes"}
              </h3>
              <p className="text-white/45">
                {searchTerm 
                  ? `We couldn't find anything matching "${searchTerm}"`
                  : "Store recovery phrases, private keys, or sensitive text here."}
              </p>
            </div>
            {!searchTerm && (
              <Button onClick={onAddNote} variant="outline" className="rounded-full border-white/20 text-white hover:bg-white/5 px-8">
                Create First Note
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => (
            <Card 
              key={note.id}
              onClick={() => onEditNote(note.id)}
              className="group relative rounded-[24px] border-white/10 bg-white/5 hover:bg-white/[0.08] transition-all cursor-pointer overflow-hidden p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 group-hover:text-white transition-colors">
                  <FileText className="size-6" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Button 
                    variant="ghost" 
                    size="icon" 
                    className="size-8 rounded-full hover:bg-white/10 text-white/40 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNote(note.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white truncate">{note.label}</h3>
                  {note.isFavorite && <Star className="size-3 fill-yellow-500 text-yellow-500" />}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-widest font-bold">
                  <Clock className="size-3" />
                  {new Date(note.updatedAt * 1000).toLocaleDateString()}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[9px] uppercase tracking-tighter border-white/10 text-white/40">
                  {note.category}
                </Badge>
                {note.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-[9px] uppercase tracking-tighter border-theme-accent/20 text-theme-accent/60">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
