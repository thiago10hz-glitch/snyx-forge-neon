import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Globe, Edit, ExternalLink, Loader2, Check, X, ArrowLeft, Lock, MessageSquare, Send, Bot, User, Link2, Plus, Trash2, AlertCircle, Copy } from "lucide-react";
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
  const { user, profile } = useAuth();
  const hasTag = profile?.is_dev || false;
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

  const getAuthHeaders = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("Não autenticado");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  };

  useEffect(() => {
    const loadSite = async () => {
      if (!id) { setNotFound(true); setLoading(false); return; }
      const { data, error } = await supabase
        .from("hosted_sites")
        .select("id, site_name, vercel_url, vercel_project_id, custom_domain, html_content, created_at, updated_at, user_id")
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

  // Load domains when panel opens
  useEffect(() => {
    if (showDomainPanel && site?.vercel_project_id) {
      loadDomains();
    }
  }, [showDomainPanel]);

  const loadDomains = async () => {
    if (!site?.vercel_project_id) return;
    setLoadingDomains(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-vercel`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "list-domains", projectId: site.vercel_project_id }),
      });
      const data = await res.json();
      if (data.success) {
        setDomains(data.domains || []);
      }
    } catch {
      toast.error("Erro ao carregar domínios");
    } finally {
      setLoadingDomains(false);
    }
  };

  const handleAddDomain = async () => {
    if (!domainInput.trim() || !site?.vercel_project_id) return;
    const domain = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    
    setAddingDomain(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-vercel`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "add-domain", projectId: site.vercel_project_id, domain }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Erro ao adicionar domínio");
        return;
      }

      // Update custom_domain in DB
      await supabase
        .from("hosted_sites")
        .update({ custom_domain: domain, updated_at: new Date().toISOString() })
        .eq("id", site.id);

      setSite(prev => prev ? { ...prev, custom_domain: domain } : prev);
      setDomainInput("");
      toast.success("Domínio adicionado! Configure o DNS para ativar.");
      await loadDomains();
    } catch {
      toast.error("Erro ao adicionar domínio");
    } finally {
      setAddingDomain(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    if (!site?.vercel_project_id) return;
    setRemovingDomain(domain);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-vercel`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "remove-domain", projectId: site.vercel_project_id, domain }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Erro ao remover domínio");
        return;
      }

      if (site.custom_domain === domain) {
        await supabase
          .from("hosted_sites")
          .update({ custom_domain: null, updated_at: new Date().toISOString() })
          .eq("id", site.id);
        setSite(prev => prev ? { ...prev, custom_domain: null } : prev);
      }

      setDomains(prev => prev.filter(d => d.name !== domain));
      toast.success("Domínio removido!");
    } catch {
      toast.error("Erro ao remover domínio");
    } finally {
      setRemovingDomain(null);
    }
  };

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
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/site-chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          siteId: site.id,
          message: userMsg.content,
          currentHtml: site.html_content,
          chatHistory: chatMessages.slice(-10),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setChatMessages(prev => [...prev, { role: "assistant", content: `❌ ${data.error || "Erro ao processar"}` }]);
        setChatLoading(false);
        return;
      }

      setChatMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      if (data.hasChanges && data.updatedHtml) {
        setSite(prev => prev ? { ...prev, html_content: data.updatedHtml } : prev);
        toast.success("Site atualizado! ✨");
      }
    } catch {
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
            <>
              <button
                onClick={() => {
                  if (!hasTag) {
                    toast.error("Recurso exclusivo para DEV. Adquira a tag DEV para usar domínios personalizados!");
                    return;
                  }
                  setShowDomainPanel(!showDomainPanel); setChatOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  !hasTag
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : showDomainPanel
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                    : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                }`}
              >
                {!hasTag ? <Lock size={14} /> : <Link2 size={14} />}
                <span className="hidden sm:inline">Domínio</span>
                {!hasTag && <span className="text-[9px] text-amber-400/70 hidden sm:inline">(DEV)</span>}
              </button>
              <button
                onClick={() => { setChatOpen(!chatOpen); setShowDomainPanel(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  chatOpen
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                }`}
              >
                <MessageSquare size={14} />
                <span className="hidden sm:inline">Editar com IA</span>
              </button>
            </>
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

      {/* Main content */}
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

        {/* Domain Panel */}
        {showDomainPanel && isOwner && (
          <div className="w-80 md:w-96 border-l border-border/10 flex flex-col bg-background shrink-0">
            <div className="p-3 border-b border-border/10 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                <Link2 size={14} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">Domínio Personalizado</p>
                <p className="text-[10px] text-muted-foreground">Conecte seu próprio domínio</p>
              </div>
              <button onClick={() => setShowDomainPanel(false)} className="p-1 rounded-md hover:bg-muted/20 text-muted-foreground">
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Current domain info */}
              {site.custom_domain && (
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3 space-y-1">
                  <p className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">Domínio ativo</p>
                  <p className="text-sm font-mono text-foreground">{site.custom_domain}</p>
                </div>
              )}

              {/* No vercel project warning */}
              {!site.vercel_project_id && (
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-3 flex gap-2">
                  <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-amber-400">Site não publicado</p>
                    <p className="text-[10px] text-muted-foreground">Publique o site primeiro para poder adicionar um domínio personalizado.</p>
                  </div>
                </div>
              )}

              {/* Add domain form */}
              {site.vercel_project_id && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Adicionar domínio</label>
                    <div className="flex gap-2">
                      <Input
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        placeholder="meusite.com"
                        className="h-9 text-xs font-mono"
                        onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                      />
                      <button
                        onClick={handleAddDomain}
                        disabled={addingDomain || !domainInput.trim()}
                        className="px-3 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors text-xs font-medium disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                      >
                        {addingDomain ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        Adicionar
                      </button>
                    </div>
                  </div>

                  {/* DNS Instructions */}
                  <div className="rounded-xl bg-muted/5 border border-border/10 p-3 space-y-2">
                    <p className="text-[11px] font-semibold text-foreground">Como configurar o DNS</p>
                    <div className="space-y-1.5 text-[10px] text-muted-foreground leading-relaxed">
                      <p>1. Acesse o painel do seu registrador de domínio</p>
                      <p>2. Adicione um registro <span className="font-mono bg-muted/10 px-1 rounded text-foreground">CNAME</span> apontando para:</p>
                      <div className="flex items-center gap-2 bg-muted/10 rounded-lg px-2.5 py-1.5 font-mono text-foreground">
                        <span className="flex-1 truncate text-[10px]">cname.vercel-dns.com</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText("cname.vercel-dns.com"); toast.success("Copiado!"); }}
                          className="p-0.5 rounded hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          <Copy size={10} />
                        </button>
                      </div>
                      <p>3. Para o domínio raiz (@), adicione um registro <span className="font-mono bg-muted/10 px-1 rounded text-foreground">A</span> apontando para <span className="font-mono text-foreground">76.76.21.21</span></p>
                      <p>4. Aguarde até 48h para a propagação do DNS</p>
                    </div>
                  </div>

                  {/* Domain list */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium text-muted-foreground">Domínios configurados</p>
                      <button
                        onClick={loadDomains}
                        disabled={loadingDomains}
                        className="text-[10px] text-primary hover:underline"
                      >
                        {loadingDomains ? "Carregando..." : "Atualizar"}
                      </button>
                    </div>

                    {loadingDomains ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 size={16} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : domains.length === 0 ? (
                      <div className="text-center py-6">
                        <Globe size={20} className="mx-auto text-muted-foreground/20 mb-2" />
                        <p className="text-[10px] text-muted-foreground/50">Nenhum domínio configurado</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {domains.map((d) => (
                          <div key={d.name} className="rounded-xl bg-muted/5 border border-border/10 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${d.verified ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
                                <span className="text-xs font-mono truncate">{d.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${d.verified ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                                  {d.verified ? "Ativo" : "Pendente"}
                                </span>
                                <button
                                  onClick={() => handleRemoveDomain(d.name)}
                                  disabled={removingDomain === d.name}
                                  className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors"
                                >
                                  {removingDomain === d.name ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                </button>
                              </div>
                            </div>

                            {/* DNS verification records if not verified */}
                            {!d.verified && d.verification.length > 0 && (
                              <div className="space-y-1.5 pt-1 border-t border-border/5">
                                <p className="text-[9px] text-amber-400 font-medium">Configure estes registros DNS:</p>
                                {d.verification.map((v, vi) => (
                                  <div key={vi} className="bg-muted/10 rounded-lg p-2 space-y-0.5">
                                    <p className="text-[9px] text-muted-foreground">
                                      <span className="font-mono font-medium text-foreground">{v.type}</span> → {v.domain}
                                    </p>
                                    <div className="flex items-center gap-1">
                                      <p className="text-[9px] font-mono text-foreground truncate flex-1">{v.value}</p>
                                      <button
                                        onClick={() => { navigator.clipboard.writeText(v.value); toast.success("Copiado!"); }}
                                        className="p-0.5 rounded hover:bg-muted/20 shrink-0"
                                      >
                                        <Copy size={8} className="text-muted-foreground" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {chatOpen && isOwner && (
          <div className="w-80 md:w-96 border-l border-border/10 flex flex-col bg-background shrink-0">
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
        <div className="border-t border-border/10 px-4 md:px-8 py-3 flex items-center justify-between bg-background/80  shrink-0">
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
