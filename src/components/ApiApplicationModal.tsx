import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bot, Send, AlertTriangle, ShieldCheck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  planSlug: string;
  planName: string;
  onApproved: (apiKey: string) => void;
}

type Msg = { role: "user" | "assistant"; content: string };

const PLAN_GREETINGS: Record<string, string> = {
  free:
    "Olá! 👋 Sou o atendente virtual da SnyX. Vou fazer umas perguntinhas rápidas pra liberar sua chave grátis. Pra começar — qual seu nome?",
  pro:
    "Olá! 👋 Sou o atendente da SnyX e vou te ajudar a liberar o **teste grátis do Pro** (5.000 req/dia). Antes, preciso conhecer um pouco do seu projeto. Pra começar — qual seu nome completo?",
  business:
    "Olá. Sou o atendente da SnyX, responsável pela liberação de **trials Business**. Vou fazer uma breve entrevista de qualificação antes de liberar a chave (50.000 req/dia, modelos premium). Por gentileza, pode me dizer seu nome completo e cargo?",
};

export function ApiApplicationModal({ open, onClose, planSlug, planName, onApproved }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Saudação inicial
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: PLAN_GREETINGS[planSlug] || PLAN_GREETINGS.free }]);
    }
    if (!open) {
      setMessages([]);
      setInput("");
      setRejected(null);
    }
  }, [open, planSlug]);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      // Envia tudo MENOS a saudação inicial scriptada (o bot já tem system prompt próprio)
      const historyForAI = next.slice(1);
      const { data, error } = await supabase.functions.invoke("api-trial-interview", {
        body: { plan_slug: planSlug, messages: historyForAI },
      });
      if (error) throw error;
      const res = data as any;

      if (res?.status === "approved" && res.api_key) {
        setMessages((p) => [
          ...p,
          { role: "assistant", content: `✅ Aprovado! Sua chave de API foi gerada. Vou te mostrar agora.` },
        ]);
        setTimeout(() => onApproved(res.api_key), 600);
      } else if (res?.status === "rejected") {
        setRejected(res.message || "Solicitação recusada após análise.");
      } else if (res?.status === "chatting" && res.reply) {
        setMessages((p) => [...p, { role: "assistant", content: res.reply }]);
      } else if (res?.error) {
        toast.error(res.message || res.error);
      }
    } catch (err: any) {
      toast.error("Erro no atendimento", { description: err?.message });
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    if (sending) return;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-[0_0_12px_-2px_hsl(var(--primary)/0.6)]">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            Atendimento SnyX — Trial {planName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Conversa com nosso atendente virtual. Responda com sinceridade — ele decide a liberação na hora.
          </DialogDescription>
        </DialogHeader>

        {rejected ? (
          <div className="p-5 space-y-4">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-foreground whitespace-pre-wrap">{rejected}</div>
            </div>
            <Button onClick={close} variant="outline" className="w-full">Entendi</Button>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/10 min-h-[300px] max-h-[55vh]">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border border-border/50 rounded-bl-md"
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <div className="bg-card border border-border/50 rounded-2xl rounded-bl-md px-4 py-2.5 flex gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border/40 p-3 flex gap-2 shrink-0 bg-background">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Digite sua resposta..."
                disabled={sending}
                maxLength={1000}
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={sending || !input.trim()} size="icon">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>

            <div className="px-4 pb-3 text-[10px] text-muted-foreground/70 flex items-center gap-1.5 shrink-0">
              <ShieldCheck className="w-3 h-3" />
              Conversa analisada pela IA · termos serão explicados antes da liberação
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
