import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Send, MessageCircle, CheckCircle, XCircle, Clock, Bot, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface LiveChat {
  id: string;
  user_id: string;
  admin_id: string | null;
  status: string;
  subject: string;
  created_at: string;
  user_display_name?: string;
}

interface LiveMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

const AI_CONTENT_PREFIX = "🤖 **SnyX IA**:";

export function AdminLiveChatsPanel() {
  const { user, profile } = useAuth();
  const [chats, setChats] = useState<LiveChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<LiveChat | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchChats = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_live_chats")
      .select("*")
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const namesMap: Record<string, string> = {};
      (profiles || []).forEach(p => { namesMap[p.user_id] = p.display_name || "Sem nome"; });

      setChats(data.map(c => ({ ...c, user_display_name: namesMap[c.user_id] || "Sem nome" })));
    } else {
      setChats([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChats();
    const channel = supabase
      .channel("admin-live-chats")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_live_chats" }, () => {
        fetchChats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!selectedChat) { setMessages([]); return; }
    const loadMessages = async () => {
      const { data } = await supabase
        .from("admin_live_messages")
        .select("*")
        .eq("chat_id", selectedChat.id)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    loadMessages();

    const channel = supabase
      .channel(`live-msgs-${selectedChat.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "admin_live_messages",
        filter: `chat_id=eq.${selectedChat.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as LiveMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedChat?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const acceptChat = async (chat: LiveChat) => {
    if (!user) return;
    const { error } = await supabase
      .from("admin_live_chats")
      .update({ status: "active", admin_id: user.id })
      .eq("id", chat.id);
    if (error) { toast.error("Erro ao aceitar chat"); return; }
    toast.success("Chat aceito!");
    setSelectedChat({ ...chat, status: "active", admin_id: user.id });
    fetchChats();
  };

  const closeChat = async (chatId: string) => {
    const { error } = await supabase
      .from("admin_live_chats")
      .update({ status: "closed" })
      .eq("id", chatId);
    if (error) { toast.error("Erro ao fechar chat"); return; }
    toast.success("Chat encerrado");
    setSelectedChat(null);
    fetchChats();
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedChat || !user || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    const { error } = await supabase.from("admin_live_messages").insert({
      chat_id: selectedChat.id,
      sender_id: user.id,
      content,
    });
    if (error) { toast.error("Erro ao enviar mensagem"); setInput(content); }
    setSending(false);
  };

  const askAI = async () => {
    if (!selectedChat || aiLoading || !user) return;
    setAiLoading(true);

    try {
      const adminName = profile?.display_name || user?.email || "Admin";
      const userName = selectedChat.user_display_name || "Usuário";

      const aiMessages = messages
        .filter(msg => !msg.content.startsWith(AI_CONTENT_PREFIX))
        .slice(-20)
        .map(msg => ({
          role: msg.sender_id === user?.id ? "assistant" : "user",
          content: msg.content,
        }));

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-live-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: aiMessages,
          admin_name: adminName,
          user_name: userName,
        }),
      });

      if (!response.ok) throw new Error("Erro na IA");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream indisponível");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line || line === "data: [DONE]") continue;
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text) fullResponse += parsed.text;
          } catch { /* skip */ }
        }
      }

      if (fullResponse.trim()) {
        await supabase.from("admin_live_messages").insert({
          chat_id: selectedChat.id,
          sender_id: user!.id,
          content: `${AI_CONTENT_PREFIX}\n\n${fullResponse.trim()}`,
        });
      }
    } catch (e) {
      console.error("AI error:", e);
      toast.error("Erro ao consultar a IA");
    } finally {
      setAiLoading(false);
    }
  };

  const pendingChats = chats.filter(c => c.status === "pending");
  const activeChats = chats.filter(c => c.status === "active");
  const closedChats = chats.filter(c => c.status === "closed").slice(0, 10);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex gap-4 h-[calc(100vh-160px)]">
        {/* Chat list */}
        <div className="w-80 shrink-0 flex flex-col border border-border/20 rounded-2xl bg-muted/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <MessageCircle size={16} className="text-primary" />
              Chats ao Vivo
              {pendingChats.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded-full font-bold">
                  {pendingChats.length} pendente{pendingChats.length > 1 ? "s" : ""}
                </span>
              )}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-muted-foreground/40" />
              </div>
            ) : chats.length === 0 ? (
              <p className="text-xs text-muted-foreground/40 text-center py-8">Nenhum chat ao vivo</p>
            ) : (
              <>
                {pendingChats.length > 0 && <p className="text-[10px] font-bold text-yellow-400 px-2 pt-2">PENDENTES</p>}
                {pendingChats.map(chat => (
                  <button key={chat.id} onClick={() => setSelectedChat(chat)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${selectedChat?.id === chat.id ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/30"}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{chat.user_display_name}</p>
                      <Clock size={12} className="text-yellow-400 shrink-0" />
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{chat.subject}</p>
                  </button>
                ))}
                {activeChats.length > 0 && <p className="text-[10px] font-bold text-emerald-400 px-2 pt-3">ATIVOS</p>}
                {activeChats.map(chat => (
                  <button key={chat.id} onClick={() => setSelectedChat(chat)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${selectedChat?.id === chat.id ? "bg-emerald-500/15 border border-emerald-500/30" : "hover:bg-muted/30"}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{chat.user_display_name}</p>
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{chat.subject}</p>
                  </button>
                ))}
                {closedChats.length > 0 && <p className="text-[10px] font-bold text-muted-foreground/40 px-2 pt-3">ENCERRADOS</p>}
                {closedChats.map(chat => (
                  <button key={chat.id} onClick={() => setSelectedChat(chat)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all opacity-50 ${selectedChat?.id === chat.id ? "bg-muted/30 border border-border/30" : "hover:bg-muted/20"}`}>
                    <p className="text-sm font-medium truncate">{chat.user_display_name}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{chat.subject}</p>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col border border-border/20 rounded-2xl bg-muted/10 overflow-hidden">
          {!selectedChat ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle size={40} className="mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground/40">Selecione um chat para conversar</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{selectedChat.user_display_name}</p>
                  <p className="text-[10px] text-muted-foreground/50">{selectedChat.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedChat.status === "active" && (
                    <button
                      onClick={askAI}
                      disabled={aiLoading}
                      className="px-3 py-1.5 text-xs font-medium bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/20 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-40"
                      title="Pedir ajuda da IA SnyX"
                    >
                      {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      Chamar IA
                    </button>
                  )}
                  {selectedChat.status === "pending" && (
                    <button onClick={() => acceptChat(selectedChat)}
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all flex items-center gap-1">
                      <CheckCircle size={12} /> Aceitar
                    </button>
                  )}
                  {selectedChat.status === "active" && (
                    <button onClick={() => closeChat(selectedChat.id)}
                      className="px-3 py-1.5 text-xs font-medium bg-destructive/80 hover:bg-destructive text-white rounded-lg transition-all flex items-center gap-1">
                      <XCircle size={12} /> Encerrar
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground/40 text-center py-8">
                    {selectedChat.status === "pending" ? "Aceite o chat para começar a conversar" : "Nenhuma mensagem ainda"}
                  </p>
                ) : (
                  messages.map(msg => {
                    const isAdmin = msg.sender_id === user?.id;
                    const isAI = msg.content.startsWith("🤖 **SnyX IA**:");
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                          isAI
                            ? "bg-purple-500/10 text-foreground border border-purple-500/15 rounded-bl-sm"
                            : isAdmin
                            ? "bg-primary/20 text-foreground rounded-br-sm"
                            : "bg-muted/40 text-foreground rounded-bl-sm"
                        }`}>
                          {isAI ? (
                            <div className="prose prose-sm prose-invert max-w-none">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          )}
                          <p className="text-[9px] text-muted-foreground/30 mt-1 text-right">
                            {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-purple-500/10 border border-purple-500/15 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                      <Bot size={14} className="text-purple-400" />
                      <span className="text-xs text-purple-400">SnyX IA está pensando...</span>
                      <Loader2 size={12} className="text-purple-400 animate-spin" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              {selectedChat.status === "active" && (
                <div className="p-3 border-t border-border/20">
                  <div className="flex items-center gap-2">
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder="Digite sua resposta..."
                      className="flex-1 bg-muted/20 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/10 focus:outline-none focus:border-primary/30"
                      disabled={sending}
                    />
                    <button onClick={sendMessage} disabled={!input.trim() || sending}
                      className="w-10 h-10 rounded-xl bg-primary hover:bg-primary/80 text-white flex items-center justify-center disabled:opacity-40 transition-all">
                      {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
