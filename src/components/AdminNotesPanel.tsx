import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Send, Trash2, CheckCircle2, Circle, AlertTriangle, Loader2,
  StickyNote, Clock, ArrowUpCircle, Filter
} from "lucide-react";
import { toast } from "sonner";

type Priority = "low" | "medium" | "high";
type Status = "pending" | "done" | "cancelled";

interface Note {
  id: string;
  content: string;
  status: Status;
  priority: Priority;
  created_at: string;
  user_id: string;
}

const priorityConfig: Record<Priority, { label: string; color: string; icon: typeof Circle }> = {
  low: { label: "Baixa", color: "text-muted-foreground", icon: Circle },
  medium: { label: "Média", color: "text-yellow-400", icon: Clock },
  high: { label: "Alta", color: "text-destructive", icon: AlertTriangle },
};

const statusConfig: Record<Status, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "border-l-yellow-400" },
  done: { label: "Feito", color: "border-l-emerald-400" },
  cancelled: { label: "Cancelado", color: "border-l-muted-foreground/30" },
};

export function AdminNotesPanel() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchNotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_notes")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) toast.error("Erro ao carregar notas");
    else setNotes((data as unknown as Note[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes]);

  const addNote = async () => {
    if (!input.trim() || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("admin_notes").insert({
      content: input.trim(),
      priority,
      user_id: user.id,
    } as Record<string, unknown>);
    if (error) toast.error("Erro ao salvar nota");
    else {
      setInput("");
      fetchNotes();
    }
    setSending(false);
  };

  const toggleStatus = async (note: Note) => {
    const next: Status = note.status === "pending" ? "done" : note.status === "done" ? "cancelled" : "pending";
    const { error } = await supabase
      .from("admin_notes")
      .update({ status: next, updated_at: new Date().toISOString() } as Record<string, unknown>)
      .eq("id", note.id);
    if (error) toast.error("Erro ao atualizar");
    else setNotes(prev => prev.map(n => n.id === note.id ? { ...n, status: next } : n));
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("admin_notes").delete().eq("id", id);
    if (error) toast.error("Erro ao deletar");
    else setNotes(prev => prev.filter(n => n.id !== id));
  };

  const filtered = filterStatus === "all" ? notes : notes.filter(n => n.status === filterStatus);
  const pendingCount = notes.filter(n => n.status === "pending").length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold">Notas Dev</h2>
          {pendingCount > 0 && (
            <span className="text-[10px] bg-yellow-400/15 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
              {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-muted-foreground mr-1" />
          {(["all", "pending", "done", "cancelled"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2 py-1 text-[10px] rounded-md transition-all ${
                filterStatus === s
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-muted-foreground/50 hover:text-foreground"
              }`}
            >
              {s === "all" ? "Todos" : statusConfig[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-4 scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <StickyNote className="w-8 h-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground/40">
              {filterStatus === "all" ? "Nenhuma nota ainda. Escreva algo abaixo!" : "Nenhuma nota com esse filtro."}
            </p>
          </div>
        ) : (
          filtered.map(note => {
            const pConfig = priorityConfig[note.priority];
            const sConfig = statusConfig[note.status];
            const PIcon = pConfig.icon;
            return (
              <div
                key={note.id}
                className={`group relative bg-muted/15 border border-border/15 rounded-xl p-3 pl-4 border-l-2 ${sConfig.color} transition-all hover:bg-muted/25 ${
                  note.status === "done" ? "opacity-60" : ""
                } ${note.status === "cancelled" ? "opacity-30" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${note.status === "done" ? "line-through" : ""}`}>
                      {note.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="flex items-center gap-1 text-[10px]">
                        <PIcon className={`w-2.5 h-2.5 ${pConfig.color}`} />
                        <span className={pConfig.color}>{pConfig.label}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground/30">
                        {new Date(note.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleStatus(note)}
                      className="p-1 rounded-md hover:bg-muted/30 text-muted-foreground/50 hover:text-foreground transition-all"
                      title="Mudar status"
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${note.status === "done" ? "text-emerald-400" : ""}`} />
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="p-1 rounded-md hover:bg-destructive/15 text-muted-foreground/50 hover:text-destructive transition-all"
                      title="Deletar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/15 pt-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-muted-foreground/40">Prioridade:</span>
          {(["low", "medium", "high"] as const).map(p => {
            const cfg = priorityConfig[p];
            const PIcon = cfg.icon;
            return (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md transition-all ${
                  priority === p
                    ? `bg-muted/30 ${cfg.color} border border-border/20`
                    : "text-muted-foreground/30 hover:text-muted-foreground/60"
                }`}
              >
                <PIcon className="w-2.5 h-2.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && addNote()}
            placeholder="Ex: Arrumar bug no chat, mudar cor do botão..."
            className="flex-1 bg-muted/10 border border-border/15 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/30 transition-all"
          />
          <button
            onClick={addNote}
            disabled={!input.trim() || sending}
            className="p-2.5 bg-primary/15 text-primary rounded-xl hover:bg-primary/25 transition-all disabled:opacity-20 border border-primary/10"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
