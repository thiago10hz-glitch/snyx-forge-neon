import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, Send, X, Loader2, ShieldCheck, Minimize2, Maximize2, Phone, Bot, ImagePlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface SupportMessage {
  id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  image_url?: string | null;
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
  image_url?: string | null;
  created_at: string;
}

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mode, setMode] = useState<"menu" | "ticket" | "live">("menu");
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [liveChat, setLiveChat] = useState<LiveChat | null>(null);
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminOnline, setAdminOnline] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  // Check admins online
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
      if (data && data.length > 0) setTicket(data[0] as SupportTicket);
      setLoading(false);
    })();
  }, [user, isOpen, mode]);

  // Load existing live chat
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
      if (data && data.length > 0) setLiveChat(data[0] as LiveChat);
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticket.id}` }, (payload) => {
        setMessages(prev => [...prev, payload.new as SupportMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticket]);

  // Load live messages
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

  // Subscribe to live messages + status
  useEffect(() => {
    if (!liveChat) return;
    const msgChannel = supabase
      .channel(`live-msgs-user-${liveChat.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_live_messages", filter: `chat_id=eq.${liveChat.id}` }, (payload) => {
        setLiveMessages(prev => [...prev, payload.new as LiveMessage]);
      })
      .subscribe();

    const statusChannel = supabase
      .channel(`live-status-${liveChat.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "admin_live_chats", filter: `id=eq.${liveChat.id}` }, (payload) => {
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
  }, [messages, liveMessages, botThinking]);

  const createTicket = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user.id, subject: "Suporte" })
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

  // Upload image to storage
  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user) return null;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return null;
    }
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("support-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("support-images").getPublicUrl(path);
      return urlData.publicUrl;
    } catch (err) {
      toast.error("Erro ao enviar imagem");
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // Call bot AI
  const callBot = useCallback(async (userMessage: string, imageUrl?: string) => {
    setBotThinking(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-bot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ message: userMessage, imageUrl }),
      });

      const data = await res.json();
      return data.text || "Não foi possível gerar uma resposta automática.";
    } catch {
      return "Erro ao consultar o bot. Um admin será notificado.";
    } finally {
      setBotThinking(false);
    }
  }, []);

  const sendTicketMessage = async (imageUrl?: string) => {
    if ((!input.trim() && !imageUrl) || !ticket || !user || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    const { error } = await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_role: "user",
      content: content || (imageUrl ? "📷 Imagem enviada" : ""),
      image_url: imageUrl || null,
    });

    if (error) { toast.error("Erro ao enviar"); setInput(content); setSending(false); return; }
    setSending(false);

    // Bot auto-response (only for user messages, not admin replies)
    const botReply = await callBot(content || "Imagem enviada", imageUrl || undefined);
    if (botReply && ticket) {
      // Insert bot reply as a special "bot" role message
      await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_id: user.id, // will be overridden visually
        sender_role: "bot",
        content: botReply,
      });
    }
  };

  const sendLiveMessage = async (imageUrl?: string) => {
    if ((!input.trim() && !imageUrl) || !liveChat || !user || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    const { error } = await supabase.from("admin_live_messages").insert({
      chat_id: liveChat.id,
      sender_id: user.id,
      content: content || (imageUrl ? "📷 Imagem enviada" : ""),
      image_url: imageUrl || null,
    });
    if (error) { toast.error("Erro ao enviar"); setInput(content); }
    setSending(false);
  };

  const handleSend = () => {
    if (mode === "ticket") sendTicketMessage();
    else if (mode === "live") sendLiveMessage();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    
    if (!file.type.startsWith("image/")) {
      toast.error("Envie apenas imagens");
      return;
    }

    const imageUrl = await uploadImage(file);
    if (!imageUrl) return;

    if (mode === "ticket") sendTicketMessage(imageUrl);
    else if (mode === "live") sendLiveMessage(imageUrl);
  };

  if (!user) return null;

  const currentMessages = mode === "ticket" ? messages : liveMessages;
  const canSend = mode === "ticket"
    ? ticket && ticket.status === "open"
    : liveChat && liveChat.status === "active";

  return (
    <>
      {/* Suporte side tab */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-0 top-1/3 z-40 flex items-center gap-1.5 px-2 py-3 rounded-l-xl bg-emerald-500/90 hover:bg-emerald-500 backdrop-blur-sm text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:pr-3 transition-all duration-300 group writing-mode-vertical"
          title="Suporte"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          <MessageCircle size={14} className="rotate-90 shrink-0" />
          <span className="text-[11px] font-bold tracking-wider uppercase">Suporte</span>
          {adminOnline && (
            <div className="absolute -left-1 top-2 w-2.5 h-2.5 rounded-full bg-emerald-300 border-2 border-emerald-600 animate-pulse" />
          )}
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className={`fixed z-50 ${isMinimized ? "bottom-4 right-4 sm:bottom-6 sm:right-6 w-64 sm:w-72" : "bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-96 h-full sm:h-[560px] sm:rounded-2xl"} flex flex-col rounded-t-2xl sm:rounded-2xl border border-border/20 bg-background shadow-2xl shadow-black/30 overflow-hidden animate-in slide-in-from-bottom-4 duration-300`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/8 border-b border-border/15">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <ShieldCheck size={16} className="text-emerald-400" />
                </div>
                {adminOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {mode === "menu" ? "Suporte" : mode === "ticket" ? "Suporte" : "Chat com Admin"}
                </p>
                <p className="text-[10px] text-muted-foreground/50">
                  {mode === "live" && liveChat?.status === "pending"
                    ? "Aguardando admin..."
                    : mode === "live" && liveChat?.status === "active"
                    ? "Admin conectado"
                    : mode === "live" && liveChat?.status === "closed"
                    ? "Chat encerrado"
                    : adminOnline ? "Admin disponível" : "Bot IA ativo"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {mode !== "menu" && (
                <button onClick={() => { setMode("menu"); setTicket(null); setLiveChat(null); setMessages([]); setLiveMessages([]); }} className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground/50 transition-all text-[10px] font-medium">
                  ← Voltar
                </button>
              )}
              <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground/50 transition-all">
                {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground/50 transition-all">
                <X size={14} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {mode === "menu" ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/15">
                    <ShieldCheck size={28} className="text-emerald-400/60" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Como podemos ajudar?</p>
                  <p className="text-xs text-muted-foreground/40 text-center">Escolha uma opção abaixo</p>

                  <button
                    onClick={() => setMode("ticket")}
                    className="w-full px-4 py-3.5 bg-emerald-500/8 hover:bg-emerald-500/15 border border-emerald-500/15 rounded-2xl transition-all flex items-center gap-3 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/25 transition-colors">
                      <Bot size={18} className="text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">Suporte com Bot IA</p>
                      <p className="text-[10px] text-muted-foreground/45">Resposta automática + admin notificado</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setMode("live")}
                    className="w-full px-4 py-3.5 bg-primary/8 hover:bg-primary/15 border border-primary/15 rounded-2xl transition-all flex items-center gap-3 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                      <Phone size={18} className="text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">Chat ao Vivo</p>
                      <p className="text-[10px] text-muted-foreground/45">
                        {adminOnline ? "Admin online — resposta imediata" : "Admin offline — pode demorar"}
                      </p>
                    </div>
                  </button>
                </div>
              ) : (
                <>
                  {/* Messages area */}
                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={20} className="animate-spin text-muted-foreground/40" />
                      </div>
                    ) : mode === "ticket" && !ticket ? (
                      <div className="text-center py-8 space-y-3">
                        <Bot size={36} className="mx-auto text-emerald-400/40" />
                        <p className="text-sm text-muted-foreground">Precisa de ajuda?</p>
                        <p className="text-xs text-muted-foreground/40">O bot IA responde na hora. Admin é notificado automaticamente.</p>
                        <button onClick={createTicket} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-primary-foreground text-sm font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20">
                          Abrir Ticket
                        </button>
                      </div>
                    ) : mode === "live" && !liveChat ? (
                      <div className="text-center py-8 space-y-3">
                        <Phone size={36} className="mx-auto text-primary/40" />
                        <p className="text-sm text-muted-foreground">Falar com Admin ao vivo</p>
                        <p className="text-xs text-muted-foreground/40">Um admin será notificado e pode aceitar seu chat.</p>
                        <button onClick={requestLiveChat} className="px-5 py-2.5 bg-primary hover:bg-primary/80 text-primary-foreground text-sm font-semibold rounded-xl transition-all shadow-lg shadow-primary/20">
                          Solicitar Chat
                        </button>
                      </div>
                    ) : mode === "live" && liveChat?.status === "pending" ? (
                      <div className="text-center py-8 space-y-3">
                        <Loader2 size={28} className="mx-auto text-primary/50 animate-spin" />
                        <p className="text-sm text-muted-foreground">Aguardando admin aceitar...</p>
                        <p className="text-[10px] text-muted-foreground/35">Você será notificado quando um admin entrar</p>
                      </div>
                    ) : currentMessages.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-xs text-muted-foreground/35">
                          {mode === "live" ? "Chat ativo! Envie sua mensagem." : "Envie sua mensagem. O bot responde na hora!"}
                        </p>
                      </div>
                    ) : (
                      currentMessages.map(msg => {
                        const isUser = mode === "ticket"
                          ? (msg as SupportMessage).sender_role === "user"
                          : (msg as LiveMessage).sender_id === user?.id;
                        const isBot = mode === "ticket" && (msg as SupportMessage).sender_role === "bot";
                        const isAdmin = mode === "ticket" && (msg as SupportMessage).sender_role === "admin";
                        const msgImageUrl = (msg as any).image_url;

                        return (
                          <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"} animate-slide-up-fade`}>
                            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                              isBot
                                ? "bg-purple-500/8 text-foreground border border-purple-500/12 rounded-bl-md"
                                : isAdmin
                                ? "bg-emerald-500/8 text-foreground border border-emerald-500/12 rounded-bl-md"
                                : isUser
                                ? "bg-emerald-500/15 text-foreground rounded-br-md"
                                : "bg-muted/30 text-foreground rounded-bl-md"
                            }`}>
                              {isBot && (
                                <p className="text-[9px] font-bold text-purple-400 mb-1 flex items-center gap-1">
                                  <Bot size={10} /> Bot IA
                                </p>
                              )}
                              {isAdmin && (
                                <p className="text-[9px] font-bold text-emerald-400 mb-1 flex items-center gap-1">
                                  <ShieldCheck size={10} /> Admin
                                </p>
                              )}
                              {!isUser && !isBot && !isAdmin && mode === "live" && (
                                <p className="text-[9px] font-bold text-emerald-400 mb-1 flex items-center gap-1">
                                  <ShieldCheck size={10} /> Admin
                                </p>
                              )}
                              {msgImageUrl && (
                                <img
                                  src={msgImageUrl}
                                  alt="Imagem"
                                  className="rounded-xl max-w-full mb-2 border border-border/10"
                                  style={{ maxHeight: 200 }}
                                />
                              )}
                              {isBot ? (
                                <div className="prose prose-sm prose-invert max-w-none text-[13px] leading-relaxed">
                                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{msg.content}</p>
                              )}
                              <p className="text-[9px] text-muted-foreground/25 mt-1.5 text-right">
                                {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Bot thinking indicator */}
                    {botThinking && (
                      <div className="flex justify-start animate-slide-up-fade">
                        <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-purple-500/8 border border-purple-500/12">
                          <p className="text-[9px] font-bold text-purple-400 mb-1 flex items-center gap-1">
                            <Bot size={10} /> Bot IA
                          </p>
                          <div className="flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin text-purple-400/60" />
                            <span className="text-xs text-muted-foreground/50">Pensando...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  {canSend && (
                    <div className="p-3 border-t border-border/15">
                      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="p-2.5 rounded-xl text-muted-foreground/35 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-40 shrink-0"
                          title="Enviar imagem"
                        >
                          {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                        </button>
                        <input
                          value={input}
                          onChange={e => setInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                          placeholder="Digite sua mensagem..."
                          className="flex-1 bg-muted/15 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 border border-border/8 focus:outline-none focus:border-emerald-500/25 transition-colors"
                          disabled={sending || botThinking}
                        />
                        <button
                          onClick={handleSend}
                          disabled={!input.trim() || sending || botThinking}
                          className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-primary-foreground flex items-center justify-center disabled:opacity-30 transition-all shrink-0"
                        >
                          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === "live" && liveChat?.status === "closed" && (
                    <div className="p-3 border-t border-border/15 text-center">
                      <p className="text-xs text-muted-foreground/40">Este chat foi encerrado.</p>
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
