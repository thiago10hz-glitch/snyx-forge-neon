import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, X, Loader2, ShieldCheck, Minimize2, Maximize2, Phone, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface SupportMessage {
  id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  created_at: string;
}

interface SupportTicket {
  id: string;
  status: string;
  subject: string;
  created_at: string;
}

interface LiveChat {
  id: string;
  user_id: string;
  admin_id: string | null;
  status: string;
  subject: string;
  created_at: string;
}

interface LiveMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mode, setMode] = useState<"menu" | "ticket" | "live">("menu");
  // Ticket mode
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  // Live chat mode
  const [liveChat, setLiveChat] = useState<LiveChat | null>(null);
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminOnline, setAdminOnline] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Check if any admin is online
  useEffect(() => {
    const checkAdmins = async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("admin_presence")
        .select("user_id")
        .gte("last_seen_at", fiveMinutesAgo);
      setAdminOnline((data?.length || 0) > 0);
    };
    checkAdmins();
    const interval = setInterval(checkAdmins, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load existing open ticket
  useEffect(() => {
    if (!user || !isOpen || mode !== "ticket") return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setTicket(data[0] as SupportTicket);
      }
      setLoading(false);
    })();
  }, [user, isOpen, mode]);

  // Load existing active live chat
  useEffect(() => {
    if (!user || !isOpen || mode !== "live") return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("admin_live_chats")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["pending", "active"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLiveChat(data[0] as LiveChat);
      }
      setLoading(false);
    })();
  }, [user, isOpen, mode]);

  // Load ticket messages
  useEffect(() => {
    if (!ticket) return;
    (async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as SupportMessage[]);
    })();
  }, [ticket]);

  // Subscribe to ticket messages
  useEffect(() => {
    if (!ticket) return;
    const channel = supabase
      .channel(`support-${ticket.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `ticket_id=eq.${ticket.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as SupportMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticket]);

  // Load live chat messages
  useEffect(() => {
    if (!liveChat) return;
    (async () => {
      const { data } = await supabase
        .from("admin_live_messages")
        .select("*")
        .eq("chat_id", liveChat.id)
        .order("created_at", { ascending: true });
      if (data) setLiveMessages(data as LiveMessage[]);
    })();
  }, [liveChat]);

  // Subscribe to live chat messages + status changes
  useEffect(() => {
    if (!liveChat) return;
    const msgChannel = supabase
      .channel(`live-msgs-user-${liveChat.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "admin_live_messages",
        filter: `chat_id=eq.${liveChat.id}`,
      }, (payload) => {
        setLiveMessages(prev => [...prev, payload.new as LiveMessage]);
      })
      .subscribe();

    const statusChannel = supabase
      .channel(`live-status-${liveChat.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "admin_live_chats",
        filter: `id=eq.${liveChat.id}`,
      }, (payload) => {
        const updated = payload.new as LiveChat;
        setLiveChat(updated);
        if (updated.status === "active") toast.success("Admin entrou no chat!");
        if (updated.status === "closed") toast.info("Chat encerrado pelo admin");
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(statusChannel);
    };
  }, [liveChat?.id]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, liveMessages]);

  const createTicket = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user.id, subject: "Suporte ao vivo" })
      .select()
      .single();
    if (error) { toast.error("Erro ao criar ticket"); return; }
    setTicket(data as SupportTicket);
  };

  const requestLiveChat = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("admin_live_chats")
      .insert({ user_id: user.id, subject: "Chat ao vivo" })
      .select()
      .single();
    if (error) { toast.error("Erro ao solicitar chat"); return; }
    setLiveChat(data as LiveChat);
    toast.success("Solicitação enviada! Aguarde um admin aceitar.");
  };

  const sendTicketMessage = async () => {
    if (!input.trim() || !ticket || !user || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_role: "user",
      content,
    });
    if (error) { toast.error("Erro ao enviar"); setInput(content); }
    setSending(false);
  };

  const sendLiveMessage = async () => {
    if (!input.trim() || !liveChat || !user || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    const { error } = await supabase.from("admin_live_messages").insert({
      chat_id: liveChat.id,
      sender_id: user.id,
      content,
    });
    if (error) { toast.error("Erro ao enviar"); setInput(content); }
    setSending(false);
  };

  const handleSend = () => {
    if (mode === "ticket") sendTicketMessage();
    else if (mode === "live") sendLiveMessage();
  };

  if (!user) return null;

  const currentMessages = mode === "ticket" ? messages : liveMessages;
  const canSend = mode === "ticket"
    ? ticket && ticket.status === "open"
    : liveChat && liveChat.status === "active";

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 hover:scale-110 transition-all group"
          title="Suporte ao vivo"
        >
          <MessageCircle size={20} className="sm:hidden" />
          <MessageCircle size={22} className="hidden sm:block" />
          {adminOnline && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
          )}
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className={`fixed z-50 ${isMinimized ? "bottom-4 right-4 sm:bottom-6 sm:right-6 w-64 sm:w-72" : "bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-96 h-full sm:h-[520px] sm:rounded-2xl"} flex flex-col rounded-t-2xl sm:rounded-2xl border border-border/30 bg-background shadow-2xl shadow-black/20 overflow-hidden animate-in slide-in-from-bottom-4 duration-300`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/10 border-b border-border/20">
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShieldCheck size={18} className="text-emerald-400" />
                {adminOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {mode === "menu" ? "Suporte" : mode === "ticket" ? "Suporte ao vivo" : "Chat com Admin"}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  {mode === "live" && liveChat?.status === "pending"
                    ? "Aguardando admin aceitar..."
                    : mode === "live" && liveChat?.status === "active"
                    ? "Admin conectado"
                    : mode === "live" && liveChat?.status === "closed"
                    ? "Chat encerrado"
                    : adminOnline ? "Admin disponível" : "Admin offline"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {mode !== "menu" && (
                <button onClick={() => { setMode("menu"); setTicket(null); setLiveChat(null); setMessages([]); setLiveMessages([]); }} className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground/60 transition-all text-[10px] font-medium">
                  ← Voltar
                </button>
              )}
              <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground/60 transition-all">
                {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground/60 transition-all">
                <X size={14} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {mode === "menu" ? (
                /* Menu de opções */
                <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
                  <ShieldCheck size={40} className="text-emerald-400/50" />
                  <p className="text-sm font-medium text-foreground">Como podemos ajudar?</p>
                  <p className="text-xs text-muted-foreground/50 text-center">Escolha uma opção abaixo</p>

                  <button
                    onClick={() => setMode("ticket")}
                    className="w-full px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-3"
                  >
                    <MessageCircle size={18} className="text-emerald-400 shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">Ticket de Suporte</p>
                      <p className="text-[10px] text-muted-foreground/50">Deixe uma mensagem, respondemos em breve</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setMode("live")}
                    className="w-full px-4 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl transition-all flex items-center gap-3"
                  >
                    <Phone size={18} className="text-primary shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">Chat ao Vivo com Admin</p>
                      <p className="text-[10px] text-muted-foreground/50">
                        {adminOnline ? "Admin online — resposta imediata" : "Admin offline — pode demorar"}
                      </p>
                    </div>
                  </button>
                </div>
              ) : (
                <>
                  {/* Messages area */}
                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={20} className="animate-spin text-muted-foreground/40" />
                      </div>
                    ) : mode === "ticket" && !ticket ? (
                      <div className="text-center py-8 space-y-3">
                        <MessageCircle size={36} className="mx-auto text-emerald-400/50" />
                        <p className="text-sm text-muted-foreground">Precisa de ajuda?</p>
                        <button onClick={createTicket} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-all">
                          Abrir Ticket
                        </button>
                      </div>
                    ) : mode === "live" && !liveChat ? (
                      <div className="text-center py-8 space-y-3">
                        <Phone size={36} className="mx-auto text-primary/50" />
                        <p className="text-sm text-muted-foreground">Falar com um Admin ao vivo</p>
                        <p className="text-xs text-muted-foreground/50">Um administrador será notificado e poderá aceitar seu chat.</p>
                        <button onClick={requestLiveChat} className="px-4 py-2 bg-primary hover:bg-primary/80 text-white text-sm font-medium rounded-xl transition-all">
                          Solicitar Chat
                        </button>
                      </div>
                    ) : mode === "live" && liveChat?.status === "pending" ? (
                      <div className="text-center py-8 space-y-3">
                        <Loader2 size={28} className="mx-auto text-primary/60 animate-spin" />
                        <p className="text-sm text-muted-foreground">Aguardando um admin aceitar...</p>
                        <p className="text-[10px] text-muted-foreground/40">Você será notificado quando um admin entrar</p>
                      </div>
                    ) : currentMessages.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-xs text-muted-foreground/40">
                          {mode === "live" ? "Chat ativo! Envie sua mensagem." : "Envie sua mensagem. Um admin responderá em breve."}
                        </p>
                      </div>
                    ) : (
                      currentMessages.map(msg => {
                        const isUser = mode === "ticket"
                          ? (msg as SupportMessage).sender_role === "user"
                          : (msg as LiveMessage).sender_id === user?.id;
                        const isAI = mode === "live" && (msg as LiveMessage).sender_id === "00000000-0000-0000-0000-000000000000";
                        return (
                          <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                              isAI
                                ? "bg-purple-500/10 text-foreground border border-purple-500/15 rounded-bl-sm"
                                : isUser
                                ? "bg-emerald-500/20 text-foreground rounded-br-sm"
                                : "bg-muted/40 text-foreground rounded-bl-sm"
                            }`}>
                              {isAI ? (
                                <>
                                  <p className="text-[9px] font-bold text-purple-400 mb-0.5 flex items-center gap-1">
                                    <Bot size={10} /> SnyX IA
                                  </p>
                                  <div className="prose prose-sm prose-invert max-w-none">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {!isUser && (
                                    <p className="text-[9px] font-bold text-emerald-400 mb-0.5 flex items-center gap-1">
                                      <ShieldCheck size={10} /> Admin
                                    </p>
                                  )}
                                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                </>
                              )}
                              <p className="text-[9px] text-muted-foreground/30 mt-1 text-right">
                                {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Input */}
                  {canSend && (
                    <div className="p-3 border-t border-border/20">
                      <div className="flex items-center gap-2">
                        <input
                          value={input}
                          onChange={e => setInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                          placeholder="Digite sua mensagem..."
                          className="flex-1 bg-muted/20 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/10 focus:outline-none focus:border-emerald-500/30"
                          disabled={sending}
                        />
                        <button
                          onClick={handleSend}
                          disabled={!input.trim() || sending}
                          className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40 transition-all"
                        >
                          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === "live" && liveChat?.status === "closed" && (
                    <div className="p-3 border-t border-border/20 text-center">
                      <p className="text-xs text-muted-foreground/50">Este chat foi encerrado.</p>
                      <button
                        onClick={() => { setLiveChat(null); setLiveMessages([]); }}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        Iniciar novo chat
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
