import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Trash2, Plus, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { ChatChoice } from "./ChatSelector";

interface Conversation {
  id: string;
  title: string;
  mode: string;
  updated_at: string;
}

interface SidebarConversationsProps {
  activeConversationId: string | null;
  onPickConversation: (choice: ChatChoice, conversationId: string) => void;
  onNewChat: () => void;
}

const modeToChoice = (mode: string): ChatChoice => {
  if (mode === "programmer" || mode === "code") return "programmer";
  if (mode === "premium") return "vip";
  return "friend";
};

const groupByDate = (convs: Conversation[]) => {
  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const last7: Conversation[] = [];
  const older: Conversation[] = [];
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfDay - 86400000;
  const sevenDaysAgo = startOfDay - 7 * 86400000;

  for (const c of convs) {
    const t = new Date(c.updated_at).getTime();
    if (t >= startOfDay) today.push(c);
    else if (t >= startOfYesterday) yesterday.push(c);
    else if (t >= sevenDaysAgo) last7.push(c);
    else older.push(c);
  }
  return { today, yesterday, last7, older };
};

export function SidebarConversations({
  activeConversationId,
  onPickConversation,
  onNewChat,
}: SidebarConversationsProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, mode, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data) setConversations(data as Conversation[]);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`sidebar-conv-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_conversations", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? conversations.filter((c) => c.title.toLowerCase().includes(q))
    : conversations;

  const { today, yesterday, last7, older } = groupByDate(filtered);

  const renderGroup = (label: string, items: Conversation[]) => {
    if (items.length === 0) return null;
    return (
      <div key={label} className="mb-3">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </div>
        <div className="flex flex-col gap-0.5">
          {items.map((conv) => {
            const active = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                onClick={() => onPickConversation(modeToChoice(conv.mode), conv.id)}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-[12.5px] transition-colors ${
                  active
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-card/40 hover:text-foreground"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" strokeWidth={1.6} />
                <span className="flex-1 truncate">{conv.title || "Nova conversa"}</span>
                <button
                  onClick={(e) => handleDelete(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-0.5"
                  aria-label="Apagar"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Ações topo: nova conversa + busca */}
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={onNewChat}
          className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-card/40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
          <span>Nova conversa</span>
        </button>
        <button
          onClick={() => setShowSearch((v) => !v)}
          className={`p-1.5 rounded-md transition-colors ${
            showSearch ? "text-foreground bg-card/40" : "text-muted-foreground hover:text-foreground hover:bg-card/40"
          }`}
          aria-label="Buscar"
        >
          <Search className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
      </div>

      {showSearch && (
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar conversas..."
          className="mb-2 w-full px-2 py-1.5 text-[12px] rounded-md bg-card/40 border border-border/30 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
        />
      )}

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {conversations.length === 0 ? (
          <div className="px-2 py-6 text-center text-[11.5px] text-muted-foreground/60">
            Nenhuma conversa ainda
          </div>
        ) : (
          <>
            {renderGroup("Hoje", today)}
            {renderGroup("Ontem", yesterday)}
            {renderGroup("7 dias", last7)}
            {renderGroup("Mais antigas", older)}
          </>
        )}
      </div>
    </div>
  );
}
