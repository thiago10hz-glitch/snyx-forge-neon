import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Globe, Edit, ExternalLink, Loader2, Check, X, ArrowLeft, Lock, MessageSquare, Send, Bot, User, Link2, Plus, Trash2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";

interface SiteData {
  id: string;
  site_name: string;
  vercel_url: string | null;
  vercel_project_id: string | null;
  custom_domain: string | null;
  html_content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface DomainInfo {
  name: string;
  verified: boolean;
  verification: Array<{ type: string; domain: string; value: string }>;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SiteManage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  // Domain management
  const [showDomainPanel, setShowDomainPanel] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [removingDomain, setRemovingDomain] = useState<string | null>(null);

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const loadSite = async () => {
      if (!id) { setNotFound(true); setLoading(false); return; }
      const { data, error } = await supabase
        .from("hosted_sites")
        .select("id, site_name, vercel_url, html_content, created_at, updated_at, user_id")
        .eq("id", id)
        .eq("status", "active")
        .single();
      if (error || !data) {
        setNotFound(true);
      } else {
        setSite(data as SiteData);
        setNewName(data.site_name);
        setIsOwner(user?.id === data.user_id);
      }
      setLoading(false);
    };
    loadSite();
  }, [id, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const handleSaveName = async () => {
    if (!site || !newName.trim() || newName.trim() === site.site_name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("hosted_sites")
      .update({ site_name: newName.trim(), updated_at: new Date().toISOString() })
      .eq("id", site.id);
    if (error) {
      toast.error("Erro ao atualizar nome");
    } else {
      setSite({ ...site, site_name: newName.trim() });
      toast.success("Nome atualizado!");
    }
    setEditing(false);
    setSaving(false);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !site || chatLoading) return;
    const userMsg: ChatMsg = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast.error("Faça login novamente");
        setChatLoading(false);
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/site-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          siteId: site.id,
          message: userMsg.content,
          currentHtml: site.html_content,
          chatHistory: chatMessages.slice(-10),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || "Erro ao processar";
        setChatMessages(prev => [...prev, { role: "assistant", content: `❌ ${errMsg}` }]);
        setChatLoading(false);
        return;
      }

      setChatMessages(prev => [...prev, { role: "assistant", content: data.reply }]);

      if (data.hasChanges && data.updatedHtml) {
        setSite(prev => prev ? { ...prev, html_content: data.updatedHtml } : prev);
        toast.success("Site atualizado! ✨");
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "❌ Erro de conexão. Tente novamente." }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !site) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/10 flex items-center justify-center">
            <Globe size={28} className="text-muted-foreground/20" />
          </div>
          <p className="text-muted-foreground">Site não encontrado</p>
          <Link to="/" className="text-primary text-sm hover:underline">Voltar ao início</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 md:px-8 border-b border-border/10 shrink-0">
        <div className="flex items-center gap-3">
          <Link to={isOwner ? "/hosting" : "/"} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm hidden sm:inline">Voltar</span>
          </Link>
          <div className="w-px h-6 bg-border/20" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/10 flex items-center justify-center border border-primary/15">
            <Globe size={14} className="text-primary" />
          </div>

          {editing && isOwner ? (
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-sm w-48"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") { setEditing(false); setNewName(site.site_name); }
                }}
              />
              <button onClick={handleSaveName} disabled={saving} className="p-1.5 rounded-lg hover:bg-emerald-500/15 text-emerald-400 transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button onClick={() => { setEditing(false); setNewName(site.site_name); }} className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold">{site.site_name}</h1>
              {isOwner && (
                <button onClick={() => setEditing(true)} className="p-1 rounded-md hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors">
                  <Edit size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                chatOpen
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
              }`}
            >
              <MessageSquare size={14} />
              <span className="hidden sm:inline">Editar com IA</span>
            </button>
          )}
          {site.vercel_url && (
            <a
              href={site.vercel_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors"
            >
              <ExternalLink size={12} />
              <span className="hidden sm:inline">Abrir</span>
            </a>
          )}
        </div>
      </header>

      {/* Main content with optional chat */}
      <div className="flex-1 flex overflow-hidden">
        {/* Site Preview */}
        <div className="flex-1 relative">
          <iframe
            ref={iframeRef}
            srcDoc={site.html_content}
            className="w-full h-full absolute inset-0"
            title={site.site_name}
            sandbox="allow-scripts"
          />
        </div>

        {/* Chat Panel */}
        {chatOpen && isOwner && (
          <div className="w-80 md:w-96 border-l border-border/10 flex flex-col bg-background shrink-0">
            {/* Chat Header */}
            <div className="p-3 border-b border-border/10 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                <Bot size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">Assistente do Site</p>
                <p className="text-[10px] text-muted-foreground">Peça alterações no seu site</p>
              </div>
              <button onClick={() => setChatOpen(false)} className="p-1 rounded-md hover:bg-muted/20 text-muted-foreground">
                <X size={14} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center">
                    <MessageSquare size={20} className="text-primary/50" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Chat com IA</p>
                    <p className="text-[10px] text-muted-foreground/60 max-w-48 mx-auto">
                      Peça para mudar cores, textos, adicionar seções, e muito mais!
                    </p>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    {["Mude o nome do site para...", "Altere a cor principal para azul", "Adicione uma seção de contato"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setChatInput(s)}
                        className="block w-full text-left text-[10px] px-3 py-2 rounded-lg bg-muted/5 border border-border/5 text-muted-foreground hover:bg-muted/10 hover:border-border/15 transition-all"
                      >
                        "{s}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={12} className="text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted/10 border border-border/10 rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-xs prose-invert max-w-none [&>p]:m-0 [&>p]:text-xs">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-lg bg-muted/20 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={12} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {chatLoading && (
                <div className="flex gap-2 items-start">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center shrink-0">
                    <Bot size={12} className="text-primary" />
                  </div>
                  <div className="bg-muted/10 border border-border/10 rounded-xl rounded-bl-sm px-3 py-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border/10">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                  placeholder="Peça uma alteração..."
                  disabled={chatLoading}
                  className="flex-1 bg-muted/5 border border-border/10 rounded-lg px-3 py-2 text-xs placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
                />
                <button
                  onClick={handleSendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {chatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {isOwner && (
        <div className="border-t border-border/10 px-4 md:px-8 py-3 flex items-center justify-between bg-background/80 backdrop-blur-sm shrink-0">
          <div className="text-[10px] text-muted-foreground/50">
            Criado em {new Date(site.created_at).toLocaleDateString("pt-BR")}
            {site.updated_at !== site.created_at && ` • Editado em ${new Date(site.updated_at).toLocaleDateString("pt-BR")}`}
          </div>
          <button
            onClick={() => toast.info("Para remover seu projeto, entre em contato com o suporte. A remoção é um serviço pago.", { duration: 6000 })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Lock size={10} />
            Remover projeto
          </button>
        </div>
      )}
    </div>
  );
};

export default SiteManage;
