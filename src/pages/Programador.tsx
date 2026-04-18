import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, Send, Sparkles, Brain, Zap, Code2, Eye, MessageSquare,
  Check, User as UserIcon, Mic, MicOff,
} from "lucide-react";

type Mode = "default" | "pro" | "think";
type BuilderErrorCode = "AI_CREDITS_EXHAUSTED" | "AI_RATE_LIMITED" | "AI_UNAVAILABLE" | "UNAUTHORIZED" | "BAD_REQUEST";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  thinking?: boolean;
  htmlSaved?: boolean;
}

interface BuilderErrorPayload {
  ok?: boolean;
  handled?: boolean;
  code?: BuilderErrorCode;
  error?: string;
  details?: string;
}

const MODES: { id: Mode; label: string; icon: any; desc: string }[] = [
  { id: "default", label: "Padrão", icon: Zap, desc: "Rápido — Gemini Flash" },
  { id: "pro", label: "Pro", icon: Sparkles, desc: "Mais capaz — Gemini Pro" },
  { id: "think", label: "Pensar", icon: Brain, desc: "Raciocínio profundo — GPT-5" },
];

const STARTER_HTML = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seu site</title><script src="https://cdn.tailwindcss.com"></script></head><body class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center"><div class="text-center p-8 max-w-md"><div class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/20 border border-orange-500/40 mb-4"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-orange-400"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div><h1 class="text-3xl font-bold mb-3 tracking-tight">Comece a construir</h1><p class="text-slate-400">Diga o que você quer criar no chat ao lado e veja a mágica acontecer aqui.</p></div></body></html>`;

const SUGGESTIONS = [
  "Landing page escura para uma barbearia",
  "Portfólio minimalista com hero animado",
  "Site para uma cafeteria com cardápio",
  "Página de captura para curso online",
];

export default function Programador() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [html, setHtml] = useState(STARTER_HTML);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("default");
  const [view, setView] = useState<"chat" | "preview">("chat");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Seu navegador não suporta gravação por voz.");
      return;
    }
    const recognition = new SR();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    let finalText = input;
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t + " ";
        else interim += t;
      }
      setInput((finalText + interim).trim());
    };
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") toast.error("Permita o acesso ao microfone.");
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    setIsRecording(true);
  };

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  async function sendPrompt(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || busy) return;
    if (!overrideText) setInput("");

    const baseChat: ChatMsg[] = [...chat, { role: "user", content: text }];
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
          prompt: text,
          current_html: html,
          history: chat.slice(-6).map(m => ({ role: m.role, content: m.content })),
          mode,
        }),
      });

      const contentType = resp.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");

      if (isJson) {
        const payload = await resp.json() as BuilderErrorPayload;
        throw new Error(payload.error || "Erro na IA");
      }

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeMode = MODES.find(m => m.id === mode)!;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Aurora background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-primary/25 blur-[140px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute top-1/3 -right-32 h-[420px] w-[420px] rounded-full bg-primary/15 blur-[140px] animate-pulse" style={{ animationDuration: "11s", animationDelay: "2s" }} />
        <div className="absolute -bottom-40 left-1/3 h-[460px] w-[460px] rounded-full bg-primary/10 blur-[160px] animate-pulse" style={{ animationDuration: "13s", animationDelay: "4s" }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,hsl(var(--primary)/0.08),transparent_60%)]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/5 bg-background/40 px-4 py-3 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="h-9 w-9 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/40 shadow-lg shadow-primary/40">
              <Code2 className="h-5 w-5 text-primary-foreground" />
              <div className="absolute inset-0 rounded-xl bg-primary/40 blur-xl -z-10 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                SnyX Programador
              </h1>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5 flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Construindo com IA · {activeMode.label}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-1 md:hidden">
          <Button
            size="sm"
            variant={view === "chat" ? "default" : "outline"}
            onClick={() => setView("chat")}
            className="h-8"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant={view === "preview" ? "default" : "outline"}
            onClick={() => setView("preview")}
            className={`h-8 ${view === "preview" ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/40" : "border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Chat */}
        <section
          className={`${view === "chat" ? "flex" : "hidden"} md:flex w-full flex-col border-r border-white/5 bg-background/30 backdrop-blur-xl md:w-[480px]`}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5">
            {chat.length === 0 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center pt-6">
                  <div className="relative inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 via-primary/15 to-transparent border border-primary/40 mb-4 shadow-2xl shadow-primary/20">
                    <Sparkles className="h-7 w-7 text-primary" />
                    <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-2xl -z-10 animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                    O que vamos criar?
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                    Descreva sua ideia e veja o site nascer ao lado em tempo real
                  </p>
                </div>

                <div className="grid gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendPrompt(s)}
                      disabled={busy}
                      className="group relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-white/5 bg-card/30 px-3.5 py-3 text-left text-xs text-muted-foreground backdrop-blur transition-all hover:border-primary/40 hover:bg-card/60 hover:text-foreground hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
                      <Sparkles className="relative h-3.5 w-3.5 text-primary/60 shrink-0 transition-all group-hover:text-primary group-hover:scale-110" />
                      <span className="relative">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 animate-fade-in ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-md ${
                      m.role === "user"
                        ? "bg-gradient-to-br from-primary/30 to-primary/10 text-primary border border-primary/30"
                        : "bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-primary/30"
                    }`}
                  >
                    {m.role === "user" ? (
                      <UserIcon className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap shadow-lg backdrop-blur ${
                      m.role === "user"
                        ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-tr-sm shadow-primary/20"
                        : m.thinking
                          ? "bg-muted/40 italic text-muted-foreground rounded-tl-sm border border-white/5"
                          : "bg-card/60 text-foreground rounded-tl-sm border border-white/10"
                    }`}
                  >
                    {m.content || (m.thinking ? "pensando..." : "")}
                    {m.thinking && (
                      <span className="ml-1.5 inline-flex gap-0.5 align-middle">
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                    {m.htmlSaved && (
                      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-400 not-italic font-medium">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/40">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                        Site atualizado no preview
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-white/5 bg-background/40 p-3 backdrop-blur-2xl">
            <div className="rounded-2xl border border-white/10 bg-card/40 p-2 shadow-xl shadow-black/20 backdrop-blur transition-all focus-within:border-primary/50 focus-within:shadow-primary/20 focus-within:bg-card/60">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPrompt(); } }}
                placeholder="Descreva o que você quer construir..."
                rows={2}
                className="resize-none border-0 bg-transparent text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
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
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                          active
                            ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/40 scale-105"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    title={isRecording ? "Parar gravação" : "Falar (microfone)"}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                      isRecording
                        ? "bg-destructive/20 text-destructive animate-pulse shadow-lg shadow-destructive/30"
                        : "bg-primary/10 text-primary hover:bg-primary/20 shadow-md shadow-primary/20 hover:shadow-primary/40"
                    }`}
                  >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <Button
                    onClick={() => sendPrompt()}
                    disabled={busy || !input.trim()}
                    size="icon"
                    className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50 hover:scale-105 transition-all disabled:from-muted disabled:to-muted disabled:shadow-none disabled:scale-100"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
              Enter para enviar · Shift+Enter para quebrar linha
            </p>
          </div>
        </section>

        {/* Preview */}
        <section className={`${view === "preview" ? "flex" : "hidden"} md:flex flex-1 flex-col p-3`}>
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/40 ring-1 ring-primary/10">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-border/40 bg-gradient-to-b from-muted/60 to-muted/30 px-3 py-2.5">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400/90 shadow-sm" />
                <div className="h-3 w-3 rounded-full bg-yellow-400/90 shadow-sm" />
                <div className="h-3 w-3 rounded-full bg-green-400/90 shadow-sm" />
              </div>
              <div className="ml-2 flex-1 rounded-md bg-background/80 px-3 py-1 text-[11px] text-muted-foreground font-mono">
                preview · seu-site.snyx.app
              </div>
            </div>
            <iframe
              title="preview"
              srcDoc={html}
              sandbox="allow-scripts allow-forms allow-same-origin"
              className="h-full w-full bg-white"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
