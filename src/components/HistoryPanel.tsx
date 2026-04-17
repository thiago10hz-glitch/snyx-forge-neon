import { useEffect, useState, useCallback } from "react";
import { Heart, Crown, Code, Trash2, MessageCircle, Search, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { ChatChoice } from "./ChatSelector";

interface Conversation {
  id: string;
  title: string;
  mode: string;
  updated_at: string;
}

interface HistoryPanelProps {
  activeConversationId: string | null;
  onPickConversation: (choice: ChatChoice, conversationId: string) => void;
  onNewChat: (choice: ChatChoice) => void;
}

/**
 * Painel de histórico SEMPRE visível ao lado da sidebar.
 * Mostra apenas grupos que o usuário tem acesso (tag amigo = sempre, programador só dev, vip = se vip/dev).
 */
export function HistoryPanel({ activeConversationId, onPickConversation, onNewChat }: HistoryPanelProps) {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const isVip = !!(profile?.is_vip || profile?.is_dev);
  const isDev = !!profile?.is_dev;

  // Build groups dynamically based on user tags
  const groups: { key: ChatChoice; label: string; icon: typeof Heart; modes: string[]; color: string; bg: string; border: string }[] = [
    { key: "friend", label: "Amigo", icon: Heart, modes: ["friend"], color: "text-pink-300", bg: "bg-pink-500/10", border: "border-pink-500/25" },
    ...(isVip ? [{ key: "vip" as ChatChoice, label: "VIP", icon: Crown, modes: ["premium"], color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-400/25" }] : []),
    ...(isDev ? [{ key: "programmer" as ChatChoice, label: "Programador", icon: Code, modes: ["programmer", "code"], color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-400/25" }] : []),
  ];

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

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh when conversations change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`history-conv-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const filterConvs = (modes: string[]) => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((c) => modes.includes(c.mode))
      .filter((c) => !q || c.title.toLowerCase().includes(q));
  };

  return (
    <aside className="hidden lg:flex shrink-0 flex-col w-[260px] z-20 relative border-r border-border/15">
      <div className="absolute inset-0 bg-sidebar/55 backdrop-blur-2xl" />

      <div className="relative flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="h-14 shrink-0 flex items-center px-4 border-b border-border/15">
          <Sparkles className="w-3.5 h-3.5 text-primary mr-2" />
          <span className="text-[13px] font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Histórico
          </span>
        </div>

        {/* Search */}
        <div className="px-3 py-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/45" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversas..."
              className="w-full h-9 pl-8 pr-3 text-xs rounded-xl bg-muted/15 border border-border/15 focus:border-primary/35 focus:bg-muted/25 outline-none transition-all text-foreground placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-1.5 pb-3">
          {loading ? (
            <p className="text-[11px] text-muted-foreground/40 text-center py-8">Carregando...</p>
          ) : (
            groups.map((g) => {
              const convs = filterConvs(g.modes);
              const Icon = g.icon;
              return (
                <div key={g.key} className="py-1.5">
                  <div className="flex items-center justify-between px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-md ${g.bg} ${g.color} border ${g.border} flex items-center justify-center`}>
                        <Icon className="w-3 h-3" strokeWidth={2.2} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/65">
                        {g.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground/35">({convs.length})</span>
                    </div>
                    <button
                      onClick={() => onNewChat(g.key)}
                      className={`w-6 h-6 rounded-md ${g.bg} hover:scale-110 ${g.color} border ${g.border} flex items-center justify-center transition-transform`}
                      title={`Nova conversa ${g.label}`}
                    >
                      <Plus className="w-3 h-3" strokeWidth={2.5} />
                    </button>
                  </div>

                  <div className="px-1 space-y-0.5">
                    {convs.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground/30 italic px-3 py-1.5">Vazio</p>
                    ) : (
                      convs.map((conv) => {
                        const active = conv.id === activeConversationId;
                        return (
                          <div
                            key={conv.id}
                            onClick={() => onPickConversation(g.key, conv.id)}
                            className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-[12px] transition-all ${
                              active
                                ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_18px_-8px_hsl(var(--primary)/0.4)]"
                                : "text-muted-foreground/85 hover:bg-muted/15 hover:text-foreground border border-transparent"
                            }`}
                          >
                            <MessageCircle size={11} className={`shrink-0 ${active ? "opacity-90" : "opacity-40"}`} />
                            <span className="truncate flex-1">{conv.title}</span>
                            <button
                              onClick={(e) => handleDelete(conv.id, e)}
                              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
