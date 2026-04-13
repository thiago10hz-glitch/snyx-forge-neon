import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, X, Loader2, ShieldCheck, Minimize2, Maximize2 } from "lucide-react";
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

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
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
    if (!user || !isOpen) return;
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
  }, [user, isOpen]);

  // Load messages when ticket is set
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

  // Subscribe to new messages
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

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const createTicket = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user.id, subject: "Suporte ao vivo" })
      .select()
      .single();
    if (error) {
      toast.error("Erro ao criar ticket de suporte");
      return;
    }
    setTicket(data as SupportTicket);
  };

  const sendMessage = async () => {
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

    if (error) {
      toast.error("Erro ao enviar mensagem");
      setInput(content);
    }
    setSending(false);
  };

  if (!user) return null;

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
                <p className="text-sm font-semibold text-foreground">Suporte ao vivo</p>
                <p className="text-[10px] text-muted-foreground/60">
                  {adminOnline ? "Admin disponível" : "Admin offline — deixe uma mensagem"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
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
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-muted-foreground/40" />
                  </div>
                ) : !ticket ? (
                  <div className="text-center py-8 space-y-3">
                    <ShieldCheck size={36} className="mx-auto text-emerald-400/50" />
                    <p className="text-sm text-muted-foreground">Precisa de ajuda?</p>
                    <p className="text-xs text-muted-foreground/50">
                      Inicie uma conversa com um administrador.
                    </p>
                    <button
                      onClick={createTicket}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-all"
                    >
                      Iniciar conversa
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground/40">
                      Envie sua mensagem. Um admin responderá em breve.
                    </p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender_role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                        msg.sender_role === "user"
                          ? "bg-emerald-500/20 text-foreground rounded-br-sm"
                          : "bg-muted/40 text-foreground rounded-bl-sm"
                      }`}>
                        {msg.sender_role === "admin" && (
                          <p className="text-[9px] font-bold text-emerald-400 mb-0.5 flex items-center gap-1">
                            <ShieldCheck size={10} /> Admin
                          </p>
                        )}
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
              {ticket && ticket.status === "open" && (
                <div className="p-3 border-t border-border/20">
                  <div className="flex items-center gap-2">
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder="Digite sua mensagem..."
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
      )}
    </>
  );
}
