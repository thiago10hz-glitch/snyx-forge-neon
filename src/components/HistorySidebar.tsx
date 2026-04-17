import { useEffect, useState, useCallback } from "react";
import { Heart, Crown, Code, Trash2, MessageCircle, X, Search, Plus, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { ChatChoice } from "./ChatSelector";

interface Conversation {
  id: string;
  title: string;
  mode: string;
  updated_at: string;
}

interface HistorySidebarProps {
  open: boolean;
  onClose: () => void;
  onPickConversation: (choice: ChatChoice, conversationId: string) => void;
  onNewChat: (choice: ChatChoice) => void;
}

const GROUPS: { key: ChatChoice; label: string; icon: typeof Heart; modes: string[]; color: string; bg: string; border: string }[] = [
  { key: "friend", label: "Amigo", icon: Heart, modes: ["friend"], color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  { key: "vip", label: "VIP", icon: Crown, modes: ["premium"], color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25" },
  { key: "programmer", label: "Programador", icon: Code, modes: ["programmer", "code"], color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/25" },
];

export function HistorySidebar({ open, onClose, onPickConversation, onNewChat }: HistorySidebarProps) {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, mode, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data) setConversations(data as Conversation[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const hasAccess = (key: ChatChoice): boolean => {
    if (key === "friend") return true;
    if (key === "vip") return !!(profile?.is_vip || profile?.is_dev);
    if (key === "programmer") return !!profile?.is_dev;
    return false;
  };

  const filterConvs = (modes: string[]) => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((c) => modes.includes(c.mode))
      .filter((c) => !q || c.title.toLowerCase().includes(q));
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 left-0 z-50 w-[300px] sm:w-[340px] bg-sidebar border-r border-border/15 flex flex-col animate-in slide-in-from-left duration-300 shadow-2xl">
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-3 border-b border-border/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
              <MessageCircle className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-bold tracking-tight">Histórico</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border/10 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversas..."
              className="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-muted/15 border border-border/15 focus:border-primary/30 focus:bg-muted/25 outline-none transition-colors text-foreground placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading ? (
            <p className="text-[11px] text-muted-foreground/40 text-center py-8">Carregando...</p>
          ) : (
            GROUPS.map((g) => {
              const convs = filterConvs(g.modes);
              const Icon = g.icon;
              const locked = !hasAccess(g.key);

              return (
                <div key={g.key} className="py-2">
                  {/* Group header */}
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-md ${g.bg} ${g.color} border ${g.border} flex items-center justify-center`}>
                        <Icon className="w-3 h-3" strokeWidth={2.2} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                        {g.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40">({convs.length})</span>
                      {locked && <Lock className="w-2.5 h-2.5 text-muted-foreground/30 ml-1" />}
                    </div>
                    {!locked && (
                      <button
                        onClick={() => { onNewChat(g.key); onClose(); }}
                        className={`w-6 h-6 rounded-md ${g.bg} hover:scale-105 ${g.color} border ${g.border} flex items-center justify-center transition-transform`}
                        title={`Nova conversa ${g.label}`}
                      >
                        <Plus className="w-3 h-3" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>

                  {/* Conversations */}
                  <div className="px-2 space-y-0.5">
                    {convs.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/30 italic px-3 py-2">
                        {locked ? "Bloqueado" : "Nenhuma conversa"}
                      </p>
                    ) : (
                      convs.map((conv) => (
                        <div
                          key={conv.id}
                          onClick={() => { onPickConversation(g.key, conv.id); onClose(); }}
                          className="group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-[12px] text-muted-foreground hover:bg-muted/20 hover:text-foreground transition-colors"
                        >
                          <MessageCircle size={11} className="shrink-0 opacity-40" />
                          <span className="truncate flex-1">{conv.title}</span>
                          <button
                            onClick={(e) => handleDelete(conv.id, e)}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-border/10 shrink-0">
          <p className="text-[10px] text-muted-foreground/40 text-center">
            Suas conversas ficam salvas mesmo se a tag expirar
          </p>
        </div>
      </aside>
    </>
  );
}
