import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, Send, Sparkles, Brain, Zap, Code2, Eye, MessageSquare,
} from "lucide-react";

type Mode = "default" | "pro" | "think";
interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  thinking?: boolean;
  htmlSaved?: boolean;
}

const MODES: { id: Mode; label: string; icon: any; desc: string }[] = [
  { id: "default", label: "Padrão", icon: Zap, desc: "Rápido — Gemini Flash" },
  { id: "pro", label: "Pro", icon: Sparkles, desc: "Mais capaz — Gemini Pro" },
  { id: "think", label: "Pensar", icon: Brain, desc: "Raciocínio profundo — GPT-5" },
];

const STARTER_HTML = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seu site</title><script src="https://cdn.tailwindcss.com"></script></head><body class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center"><div class="text-center p-8"><h1 class="text-4xl font-bold mb-3">Comece a construir</h1><p class="text-slate-300">Diga o que você quer criar no chat ao lado.</p></div></body></html>`;

export default function Programador() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [html, setHtml] = useState(STARTER_HTML);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("default");
  const [view, setView] = useState<"chat" | "preview">("chat");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  async function sendPrompt() {
    if (!input.trim() || busy) return;
    const userMsg = input.trim();
    setInput("");

    const baseChat: ChatMsg[] = [...chat, { role: "user", content: userMsg }];
    setChat([...baseChat, { role: "assistant", content: "", thinking: true }]);
    setBusy(true);

    let fullText = "";
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/programmer-builder`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: userMsg,
          current_html: html,
          history: chat.slice(-6).map(m => ({ role: m.role, content: m.content })),
          mode,
        }),
      });

      if (!resp.ok || !resp.body) {
        const t = await resp.text();
        let msg = "Erro na IA";
        try { msg = JSON.parse(t).error || msg; } catch { /* */ }
        throw new Error(msg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              const visible = fullText.split("<<<HTML>>>")[0];
              setChat(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: visible, thinking: true };
                return copy;
              });
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      const htmlMatch = fullText.match(/<<<HTML>>>([\s\S]*?)<<<END>>>/);
      const finalThinking = fullText.split("<<<HTML>>>")[0].trim();

      if (htmlMatch) {
        const newHtml = htmlMatch[1].trim();
        setHtml(newHtml);
        setChat(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: finalThinking || "Pronto.", thinking: false, htmlSaved: true };
          return copy;
        });
        // Em mobile, alterna pro preview
        if (window.innerWidth < 768) setView("preview");
      } else {
        setChat(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: finalThinking || fullText, thinking: false };
          return copy;
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar");
      setChat(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "❌ " + (e.message || "Erro"), thinking: false };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-semibold">SnyX Programador</h1>
          </div>
        </div>
        {/* Toggle Chat/Preview no mobile */}
        <div className="flex gap-1 md:hidden">
          <Button size="sm" variant={view === "chat" ? "default" : "outline"} onClick={() => setView("chat")} className="h-8">
            <MessageSquare className="h-3 w-3" />
          </Button>
          <Button size="sm" variant={view === "preview" ? "default" : "outline"} onClick={() => setView("preview")} className="h-8">
            <Eye className="h-3 w-3" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat */}
        <section className={`${view === "chat" ? "flex" : "hidden"} md:flex w-full flex-col border-r border-border md:w-[460px]`}>
          <div className="flex-1 overflow-y-auto p-3">
            {chat.length === 0 && (
              <Card className="bg-muted/30 p-3 text-sm text-muted-foreground">
                💬 Diga o que quer construir. Ex: <em>"Crie uma landing page escura para minha barbearia, com hero, serviços e contato"</em>.
              </Card>
            )}
            <div className="space-y-3 mt-3">
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : m.thinking
                        ? "bg-muted/60 italic text-muted-foreground"
                        : "bg-muted"
                  }`}>
                    {m.content || (m.thinking ? "pensando..." : "")}
                    {m.thinking && (
                      <Loader2 className="ml-2 inline h-3 w-3 animate-spin align-middle" />
                    )}
                    {m.htmlSaved && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-emerald-500 not-italic">
                        ✓ site atualizado no preview
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input + seletor de modo */}
          <div className="border-t border-border p-2">
            <div className="rounded-xl border border-border bg-background/60 p-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPrompt(); } }}
                placeholder="O que você quer construir?"
                rows={2}
                className="resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={busy}
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="flex gap-1">
                  {MODES.map(m => {
                    const Icon = m.icon;
                    const active = mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMode(m.id)}
                        title={m.desc}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                <Button onClick={sendPrompt} disabled={busy || !input.trim()} size="icon" className="h-8 w-8">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Preview */}
        <section className={`${view === "preview" ? "flex" : "hidden"} md:flex flex-1 flex-col bg-white`}>
          <iframe
            title="preview"
            srcDoc={html}
            sandbox="allow-scripts allow-forms allow-same-origin"
            className="h-full w-full"
          />
        </section>
      </div>
    </div>
  );
}
