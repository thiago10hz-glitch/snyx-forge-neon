import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2, Rocket, Plus, ExternalLink, ArrowLeft, Send, Globe,
  Sparkles, Brain, Zap,
} from "lucide-react";

interface DevProject {
  id: string;
  name: string;
  html_content: string;
  vercel_url: string | null;
  vercel_project_name: string | null;
  last_deployed_at: string | null;
  updated_at: string;
}

type Mode = "default" | "pro" | "think";
interface ChatMsg {
  role: "user" | "assistant";
  content: string;        // texto visível (pensamento)
  thinking?: boolean;     // mostra spinner enquanto streama
  htmlSaved?: boolean;    // se o HTML foi extraído e salvo
}

const MODES: { id: Mode; label: string; icon: any; desc: string }[] = [
  { id: "default", label: "Padrão", icon: Zap, desc: "Rápido — Gemini Flash" },
  { id: "pro", label: "Pro", icon: Sparkles, desc: "Mais capaz — Gemini Pro" },
  { id: "think", label: "Pensar", icon: Brain, desc: "Raciocínio profundo — GPT-5" },
];

export default function DevBuilder() {
  const { user, profile, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const devExpires = (profile as any)?.dev_expires_at as string | null | undefined;
  const isDev = !!profile?.is_dev && (!devExpires || new Date(devExpires) > new Date());
  const allowed = isAdmin || isDev;

  const [projects, setProjects] = useState<DevProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = projects.find(p => p.id === activeId) || null;
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [mode, setMode] = useState<Mode>("default");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    if (!loading && user && !allowed) {
      toast.error("Acesso restrito a DEV ou Admin");
      navigate("/");
    }
  }, [loading, user, allowed, navigate]);

  useEffect(() => { if (user && allowed) loadProjects(); /* eslint-disable-next-line */ }, [user, allowed]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  async function loadProjects() {
    const { data, error } = await supabase
      .from("dev_projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setProjects((data || []) as DevProject[]);
    if (!activeId && data && data.length > 0) setActiveId(data[0].id);
  }

  async function createProject() {
    if (!newName.trim()) { toast.error("Dá um nome pro projeto"); return; }
    setCreating(true);
    const { data, error } = await supabase
      .from("dev_projects")
      .insert({ user_id: user!.id, name: newName.trim() })
      .select()
      .single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setNewName("");
    await loadProjects();
    setActiveId(data.id);
    setChat([]);
    toast.success("Projeto criado");
  }

  async function sendPrompt() {
    if (!active || !input.trim() || busy) return;
    const userMsg = input.trim();
    setInput("");

    const baseChat: ChatMsg[] = [...chat, { role: "user", content: userMsg }];
    setChat([...baseChat, { role: "assistant", content: "", thinking: true }]);
    setBusy(true);

    let fullText = "";
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dev-chat-builder`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: userMsg,
          current_html: active.html_content,
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
              // Mostra só o pensamento (antes do <<<HTML>>>)
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

      // Extrai HTML
      const htmlMatch = fullText.match(/<<<HTML>>>([\s\S]*?)<<<END>>>/);
      const finalThinking = fullText.split("<<<HTML>>>")[0].trim();

      if (htmlMatch) {
        const html = htmlMatch[1].trim();
        const { error: upErr } = await supabase
          .from("dev_projects")
          .update({ html_content: html })
          .eq("id", active.id);
        if (upErr) throw upErr;
        setProjects(prev => prev.map(p => p.id === active.id ? { ...p, html_content: html } : p));
        setChat(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: finalThinking || "Pronto.", thinking: false, htmlSaved: true };
          return copy;
        });
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

  async function publish() {
    if (!active || deploying) return;
    setDeploying(true);
    try {
      const { data, error } = await supabase.functions.invoke("dev-deploy-vercel", {
        body: { project_id: active.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any).url;
      toast.success("Publicado na Vercel!");
      await loadProjects();
      if (url) window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Falha ao publicar");
    } finally {
      setDeploying(false);
    }
  }

  if (loading || !user || !allowed) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-base font-semibold">DEV Builder</h1>
            <p className="text-xs text-muted-foreground">{active?.name || "Selecione ou crie um projeto"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {active?.vercel_url && (
            <Button variant="outline" size="sm" onClick={() => window.open(active.vercel_url!, "_blank")}>
              <ExternalLink className="mr-1 h-3 w-3" /> Ver site
            </Button>
          )}
          <Button size="sm" onClick={publish} disabled={!active || deploying}>
            {deploying ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Rocket className="mr-1 h-3 w-3" />}
            Publicar
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 flex-col border-r border-border md:flex">
          <div className="space-y-2 border-b border-border p-3">
            <Input placeholder="Nome do novo site" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && createProject()} />
            <Button size="sm" className="w-full" onClick={createProject} disabled={creating}>
              {creating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />} Novo projeto
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => { setActiveId(p.id); setChat([]); }}
                className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${activeId === p.id ? "bg-primary/15 text-primary" : "hover:bg-muted"}`}
              >
                <div className="truncate font-medium">{p.name}</div>
                {p.vercel_url && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Globe className="h-3 w-3" /> publicado</div>}
              </button>
            ))}
            {projects.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Nenhum projeto ainda</p>}
          </div>
        </aside>

        <section className="flex w-full flex-col border-r border-border md:w-[460px]">
          <div className="flex-1 overflow-y-auto p-3">
            {!active && <p className="mt-8 text-center text-sm text-muted-foreground">Crie ou selecione um projeto para começar</p>}
            {active && chat.length === 0 && (
              <Card className="bg-muted/30 p-3 text-sm text-muted-foreground">
                💬 Diga o que quer construir. Ex: <em>"Crie uma landing page escura para minha barbearia, com hero, serviços e contato"</em>.
              </Card>
            )}
            <div className="space-y-3">
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

          {/* Input + seletor de modo (estilo Lovable) */}
          <div className="border-t border-border p-2">
            <div className="rounded-xl border border-border bg-background/60 p-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPrompt(); } }}
                placeholder="O que você quer mudar?"
                rows={2}
                className="resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={!active || busy}
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
                <Button onClick={sendPrompt} disabled={!active || busy || !input.trim()} size="icon" className="h-8 w-8">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="hidden flex-1 flex-col bg-white md:flex">
          {active ? (
            <iframe
              title="preview"
              srcDoc={active.html_content}
              sandbox="allow-scripts allow-forms allow-same-origin"
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem preview</div>
          )}
        </section>
      </div>
    </div>
  );
}
