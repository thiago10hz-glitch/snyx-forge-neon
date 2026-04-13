import { useState, useRef, useEffect } from "react";
import { Send, Loader2, ShieldCheck, MessageCircle, X, CheckCircle } from "lucide-react";
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
  created_at: string;
}

export function AdminSupportPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Load tickets
  useEffect(() => {
    const loadTickets = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .order("updated_at", { ascending: false });

      if (data) {
        // Enrich with user names
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
    };
    loadTickets();

    // Subscribe to new tickets
    const channel = supabase
      .channel("admin-support-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        loadTickets();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Load messages for selected ticket
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
  }, [selectedTicket]);

  // Subscribe to messages
  useEffect(() => {
    if (!selectedTicket) return;
    const channel = supabase
      .channel(`admin-support-msgs-${selectedTicket.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `ticket_id=eq.${selectedTicket.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as SupportMsg]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedTicket || !user || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selectedTicket.id,
      sender_id: user.id,
      sender_role: "admin",
      content,
    });

    if (error) {
      toast.error("Erro ao enviar mensagem");
      setInput(content);
    }
    setSending(false);
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
        <div className="w-80 shrink-0 border border-border/20 rounded-2xl bg-muted/5 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border/10">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MessageCircle size={16} className="text-emerald-400" />
              Tickets de Suporte
            </h3>
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              {openTickets.length} aberto{openTickets.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-muted-foreground/40" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-xs text-muted-foreground/40 text-center py-8">Nenhum ticket</p>
            ) : (
              <>
                {openTickets.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`w-full text-left p-3 border-b border-border/10 hover:bg-muted/20 transition-all ${
                      selectedTicket?.id === t.id ? "bg-emerald-500/10 border-l-2 border-l-emerald-400" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-foreground">{t.user_name}</p>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {new Date(t.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </button>
                ))}
                {closedTickets.length > 0 && (
                  <>
                    <p className="text-[9px] text-muted-foreground/30 uppercase tracking-wider px-3 py-2 bg-muted/10">Fechados</p>
                    {closedTickets.slice(0, 10).map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTicket(t)}
                        className={`w-full text-left p-3 border-b border-border/10 hover:bg-muted/10 transition-all opacity-50 ${
                          selectedTicket?.id === t.id ? "bg-muted/20 opacity-100" : ""
                        }`}
                      >
                        <p className="text-xs text-muted-foreground">{t.user_name}</p>
                        <p className="text-[10px] text-muted-foreground/30 mt-0.5">Fechado</p>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 border border-border/20 rounded-2xl bg-muted/5 overflow-hidden flex flex-col">
          {!selectedTicket ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <ShieldCheck size={40} className="mx-auto text-emerald-400/30 mb-3" />
                <p className="text-sm text-muted-foreground/50">Selecione um ticket para responder</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedTicket.user_name}</p>
                  <p className="text-[10px] text-muted-foreground/50">
                    {selectedTicket.status === "open" ? "Ticket aberto" : "Ticket fechado"}
                  </p>
                </div>
                {selectedTicket.status === "open" && (
                  <button
                    onClick={() => closeTicket(selectedTicket.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-muted/20 text-muted-foreground hover:bg-muted/30 transition-all"
                  >
                    <CheckCircle size={12} /> Fechar ticket
                  </button>
                )}
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground/40 text-center py-4">Sem mensagens ainda</p>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                        msg.sender_role === "admin"
                          ? "bg-emerald-500/20 text-foreground rounded-br-sm"
                          : "bg-muted/40 text-foreground rounded-bl-sm"
                      }`}>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className="text-[9px] text-muted-foreground/30 mt-1 text-right">
                          {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              {selectedTicket.status === "open" && (
                <div className="p-3 border-t border-border/10">
                  <div className="flex items-center gap-2">
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder="Responder como admin..."
                      className="flex-1 bg-muted/20 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 border border-border/10 focus:outline-none focus:border-emerald-500/30"
                      disabled={sending}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || sending}
                      className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40 transition-all"
                    >
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
