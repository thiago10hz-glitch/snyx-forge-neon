import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Bot, User, Loader2, Sparkles, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function OwnerChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "👋 Olá, Dono! Sou o **SnyX Admin AI**.\n\nPosso analisar e corrigir problemas da plataforma. Pergunte-me sobre:\n- Estado dos usuários VIP/DEV\n- Tickets de suporte pendentes\n- Chaves expiradas\n- Saúde geral do app\n\nOu simplesmente diga **\"corrige tudo\"** e eu cuido do resto!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Only send conversation history (exclude the welcome message for cleaner context)
      const apiMessages = newMessages
        .filter((_, i) => i > 0 || newMessages[0].role === "user")
        .map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("owner-chat", {
        body: { messages: apiMessages },
      });

      if (error) {
        throw new Error(error.message || "Erro ao conectar com a IA");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data?.content || "Sem resposta da IA.",
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (data?.actions?.length > 0) {
        toast.success(`${data.actions.length} ação(ões) executada(s)!`);
      }
    } catch (e: any) {
      console.error("Owner chat error:", e);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `❌ **Erro:** ${e.message || "Falha na comunicação com a IA."}`
      }]);
      toast.error("Erro no chat: " + (e.message || "Tente novamente"));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      { role: "assistant", content: "🔄 Chat limpo! Como posso ajudar?" }
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-h-[700px] rounded-2xl border border-amber-500/20 bg-card/30 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/15 bg-gradient-to-r from-amber-950/20 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-400">SnyX Admin AI</h3>
            <p className="text-[9px] text-muted-foreground/50">Assistente do Dono • Corrige tudo</p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] text-emerald-400/60">Online</span>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="p-2 rounded-lg text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Limpar chat"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""} animate-fade-in`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              msg.role === "assistant"
                ? "bg-gradient-to-br from-amber-400/20 to-yellow-500/20"
                : "bg-gradient-to-br from-primary/20 to-primary/10"
            }`}>
              {msg.role === "assistant"
                ? <Bot className="w-3.5 h-3.5 text-amber-400" />
                : <User className="w-3.5 h-3.5 text-primary" />
              }
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === "assistant"
                ? "bg-muted/20 border border-border/15"
                : "bg-primary/15 border border-primary/20"
            }`}>
              <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed [&>p]:mb-2 [&>ul]:my-1 [&>ol]:my-1 [&_li]:my-0.5 [&_hr]:my-3 [&_hr]:border-border/20 [&_strong]:text-amber-400 [&_code]:text-primary [&_code]:bg-muted/30 [&_code]:px-1 [&_code]:rounded">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5 animate-fade-in">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400/20 to-yellow-500/20 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="bg-muted/20 border border-border/15 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                <Loader2 className="w-3 h-3 animate-spin" />
                Analisando...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-amber-500/15 p-3 bg-gradient-to-r from-amber-950/10 to-transparent">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreva o problema ou peça para corrigir..."
            rows={1}
            className="flex-1 resize-none bg-muted/20 border border-border/20 rounded-xl px-3 py-2.5 text-xs placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/30 transition-all"
            style={{ minHeight: "40px", maxHeight: "120px" }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "40px";
              t.style.height = Math.min(t.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-black disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-amber-500/20 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/30 mt-1.5 text-center">
          Comandos rápidos: "corrige tudo" • "status do app" • "limpar VIPs expirados"
        </p>
      </div>
    </div>
  );
}