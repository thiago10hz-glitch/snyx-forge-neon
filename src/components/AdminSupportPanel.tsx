import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, ShieldCheck, MessageCircle, X, CheckCircle, Bell, BellOff, ImagePlus, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  created_at: string;
  user_name?: string;
}

interface SupportMsg {
  id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  image_url?: string | null;
  created_at: string;
}

export function AdminSupportPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [newTicketIds, setNewTicketIds] = useState<Set<string>>(new Set());
  const [uploadingImage, setUploadingImage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  // Notification sound
  const playNotification = useCallback(() => {
    if (!notifications) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.15;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }, [notifications]);

  // Load tickets
  const loadTickets = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });

    if (data) {
      const enriched: Ticket[] = [];
      for (const t of data) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", t.user_id)
          .single();
        enriched.push({ ...t, user_name: profile?.display_name || "Usuário" });
      }
      setTickets(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTickets();

    const channel = supabase
      .channel("admin-support-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newTicket = payload.new as Ticket;
          setNewTicketIds(prev => new Set(prev).add(newTicket.id));
          playNotification();
          toast.info("🎫 Novo ticket de suporte!", { duration: 5000 });
        }
        loadTickets();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadTickets, playNotification]);

  // Load messages
  useEffect(() => {
    if (!selectedTicket) { setMessages([]); return; }
    (async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    })();
    // Mark as seen
    setNewTicketIds(prev => {
      const next = new Set(prev);
      next.delete(selectedTicket.id);
      return next;
    });
  }, [selectedTicket]);

  // Subscribe to messages
  useEffect(() => {
    if (!selectedTicket) return;
    const channel = supabase
      .channel(`admin-support-msgs-${selectedTicket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${selectedTicket.id}` }, (payload) => {
        const newMsg = payload.new as SupportMsg;
        setMessages(prev => [...prev, newMsg]);
        if (newMsg.sender_role === "user") playNotification();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket, playNotification]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user) return null;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return null;
    }
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `admin/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("support-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("support-images").getPublicUrl(path);
      return urlData.publicUrl;
    } catch {
      toast.error("Erro ao enviar imagem");
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const sendMessage = async (imageUrl?: string) => {
    if ((!input.trim() && !imageUrl) || !selectedTicket || !user || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selectedTicket.id,
      sender_id: user.id,
      sender_role: "admin",
      content: content || (imageUrl ? "📷 Imagem enviada" : ""),
      image_url: imageUrl || null,
    });

    if (error) {
      toast.error("Erro ao enviar mensagem");
      setInput(content);
    }
    setSending(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!file.type.startsWith("image/")) { toast.error("Envie apenas imagens"); return; }
    const imageUrl = await uploadImage(file);
    if (imageUrl) sendMessage(imageUrl);
  };

  const closeTicket = async (ticketId: string) => {
    await supabase.from("support_tickets").update({ status: "closed" }).eq("id", ticketId);
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: "closed" } : t));
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, status: "closed" } : null);
    }
    toast.success("Ticket fechado");
  };

  const openTickets = tickets.filter(t => t.status === "open");
  const closedTickets = tickets.filter(t => t.status === "closed");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex gap-4 h-[calc(100vh-180px)]">
        {/* Ticket list */}
        <div className="w-80 shrink-0 border border-border/15 rounded-2xl bg-muted/5 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MessageCircle size={16} className="text-emerald-400" />
                Tickets
              </h3>
              <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                {openTickets.length} aberto{openTickets.length !== 1 ? "s" : ""}
                {newTicketIds.size > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold animate-pulse">
                    {newTicketIds.size} novo{newTicketIds.size > 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`p-2 rounded-lg transition-all ${notifications ? "text-emerald-400 bg-emerald-500/10" : "text-muted-foreground/30 hover:bg-muted/20"}`}
              title={notifications ? "Notificações ativadas" : "Notificações desativadas"}
            >
              {notifications ? <Bell size={14} /> : <BellOff size={14} />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-muted-foreground/40" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-xs text-muted-foreground/35 text-center py-8">Nenhum ticket</p>
            ) : (
              <>
                {openTickets.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`w-full text-left p-3 border-b border-border/8 hover:bg-muted/15 transition-all ${
                      selectedTicket?.id === t.id ? "bg-emerald-500/8 border-l-2 border-l-emerald-400" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-foreground">{t.user_name}</p>
                      <div className="flex items-center gap-1.5">
                        {newTicketIds.has(t.id) && (
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        )}
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                      {new Date(t.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </button>
                ))}
                {closedTickets.length > 0 && (
                  <>
                    <p className="text-[9px] text-muted-foreground/25 uppercase tracking-wider px-3 py-2 bg-muted/8">Fechados</p>
                    {closedTickets.slice(0, 10).map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTicket(t)}
                        className={`w-full text-left p-3 border-b border-border/8 hover:bg-muted/10 transition-all opacity-40 ${
                          selectedTicket?.id === t.id ? "bg-muted/15 opacity-100" : ""
                        }`}
                      >
                        <p className="text-xs text-muted-foreground">{t.user_name}</p>
                        <p className="text-[10px] text-muted-foreground/25 mt-0.5">Fechado</p>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 border border-border/15 rounded-2xl bg-muted/5 overflow-hidden flex flex-col">
          {!selectedTicket ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <ShieldCheck size={40} className="mx-auto text-emerald-400/20 mb-3" />
                <p className="text-sm text-muted-foreground/40">Selecione um ticket para responder</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">{selectedTicket.user_name}</p>
                  <p className="text-[10px] text-muted-foreground/40">
                    {selectedTicket.status === "open" ? "Ticket aberto" : "Ticket fechado"}
                  </p>
                </div>
                {selectedTicket.status === "open" && (
                  <button
                    onClick={() => closeTicket(selectedTicket.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl bg-muted/15 text-muted-foreground hover:bg-muted/25 transition-all"
                  >
                    <CheckCircle size={12} /> Fechar
                  </button>
                )}
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground/35 text-center py-4">Sem mensagens</p>
                ) : (
                  messages.map(msg => {
                    const isBot = msg.sender_role === "bot";
                    const isAdmin = msg.sender_role === "admin";
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                          isBot
                            ? "bg-purple-500/8 text-foreground border border-purple-500/10 rounded-bl-md"
                            : isAdmin
                            ? "bg-emerald-500/15 text-foreground rounded-br-md"
                            : "bg-muted/25 text-foreground rounded-bl-md"
                        }`}>
                          {isBot && (
                            <p className="text-[9px] font-bold text-purple-400 mb-1 flex items-center gap-1">
                              <Bot size={10} /> Bot IA
                            </p>
                          )}
                          {msg.image_url && (
                            <img
                              src={msg.image_url}
                              alt="Imagem"
                              className="rounded-xl max-w-full mb-2 border border-border/10 cursor-pointer"
                              style={{ maxHeight: 200 }}
                              onClick={() => window.open(msg.image_url!, '_blank')}
                            />
                          )}
                          {isBot ? (
                            <div className="prose prose-sm prose-invert max-w-none text-[13px]">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-[13px]">{msg.content}</p>
                          )}
                          <p className="text-[9px] text-muted-foreground/25 mt-1.5 text-right">
                            {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedTicket.status === "open" && (
                <div className="p-3 border-t border-border/10">
                  <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="p-2.5 rounded-xl text-muted-foreground/30 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all disabled:opacity-40 shrink-0"
                      title="Enviar imagem"
                    >
                      {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                    </button>
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder="Responder como admin..."
                      className="flex-1 bg-muted/15 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 border border-border/8 focus:outline-none focus:border-emerald-500/25 transition-colors"
                      disabled={sending}
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || sending}
                      className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-primary-foreground flex items-center justify-center disabled:opacity-30 transition-all"
                    >
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
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
