import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { 
  Globe, Trash2, ExternalLink, ArrowLeft, Upload, Code, 
  Crown, Zap, Loader2, Edit, Copy, RefreshCw, Sparkles, Send,
  Eye, Rocket, Shield, Monitor, Smartphone,
  Bot, User, MessageSquare, X, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";

interface HostedSite {
  id: string;
  site_name: string;
  html_content: string;
  vercel_project_id: string | null;
  vercel_url: string | null;
  custom_domain: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

type HostingLimit = {
  allowed: boolean;
  reason?: string;
  current: number;
  max: number;
  tier?: string;
};

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const TIER_LABELS: Record<string, string> = {
  none: "Sem Plano",
  basic: "Basic",
  pro: "Pro",
  unlimited: "Unlimited",
};

const Hosting = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [sites, setSites] = useState<HostedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState<HostingLimit | null>(null);
  const [showNewSite, setShowNewSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteHtml, setNewSiteHtml] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingSite, setEditingSite] = useState<HostedSite | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  const [activatingKey, setActivatingKey] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // AI Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [chatPanelOpen, setChatPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "sites">("chat");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadSites = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("hosted_sites")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (data) setSites(data as HostedSite[]);
    setLoading(false);
  }, [user]);

  const checkLimit = useCallback(async () => {
    const { data } = await supabase.rpc("check_hosting_limit");
    if (data) setLimit(data as unknown as HostingLimit);
  }, []);

  useEffect(() => {
    loadSites();
    checkLimit();
  }, [loadSites, checkLimit]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const deployToVercel = async (html: string, siteName: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const safeName = siteName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-vercel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ html, projectName: `snyx-${safeName}` }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Erro ao hospedar site");
    }
    return data;
  };

  // AI Chat - send message
  const handleSendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;

    if (limit && !limit.allowed) {
      if (limit.reason === "no_plan") {
        setShowPlans(true);
        return;
      }
      toast.error(`Limite atingido (${limit.current}/${limit.max} sites)`);
      return;
    }

    const userMsg: ChatMsg = { role: "user", content: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // If we have an existing site being edited via chat, use site-chat function
      // Otherwise, generate new site
      if (previewHtml && generatedHtml) {
        // Edit existing preview via site-chat-style approach
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-hosting`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            description: `O site atual tem este HTML:\n\n${generatedHtml.substring(0, 3000)}\n\nO usuário pede: ${msg}\n\nRetorne o HTML COMPLETO atualizado com a alteração pedida. Mantenha todo o resto igual.`,
            siteName: newSiteName || "Meu Site",
          }),
        });

        const data = await res.json();
        if (data.success && data.html) {
          setGeneratedHtml(data.html);
          setPreviewHtml(data.html);
          setChatMessages(prev => [...prev, { role: "assistant", content: "✅ Site atualizado! Confira o preview ao lado." }]);
        } else {
          setChatMessages(prev => [...prev, { role: "assistant", content: data.error || "❌ Não consegui aplicar essa alteração. Tente de outra forma." }]);
        }
      } else {
        // Generate new site
        if (!newSiteName) {
          setNewSiteName(msg.slice(0, 40).replace(/[^a-zA-Z0-9\s-]/g, "").trim());
        }

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-hosting`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            description: msg,
            siteName: newSiteName || msg.slice(0, 30),
          }),
        });

        const data = await res.json();
        if (data.success && data.html) {
          setGeneratedHtml(data.html);
          setPreviewHtml(data.html);
          setChatMessages(prev => [...prev, { role: "assistant", content: "🚀 Site criado! Confira o preview ao lado. Você pode me pedir alterações ou clicar em **Publicar** quando estiver satisfeito." }]);
        } else {
          setChatMessages(prev => [...prev, { role: "assistant", content: data.error || "❌ Erro ao gerar o site. Tente descrever de outra forma." }]);
        }
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "❌ Erro de conexão. Tente novamente." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!generatedHtml || !newSiteName.trim()) {
      toast.error("Preencha o nome do site");
      return;
    }
    setDeploying(true);
    try {
      const deployData = await deployToVercel(generatedHtml, newSiteName);

      const { error } = await supabase.from("hosted_sites").insert({
        user_id: user!.id,
        site_name: newSiteName.trim(),
        html_content: generatedHtml,
        vercel_project_id: deployData.projectId || null,
        vercel_url: deployData.url || null,
      });

      if (error) {
        toast.error("Site hospedado mas erro ao salvar");
      } else {
        toast.success("🚀 Site publicado e online!");
        setChatMessages(prev => [...prev, { role: "assistant", content: `✅ Site publicado com sucesso!\n\n🔗 ${deployData.url || "URL será gerada em breve"}\n\nVocê pode criar outro site ou editar os existentes.` }]);
        setNewSiteName("");
        setGeneratedHtml("");
        setPreviewHtml("");
        loadSites();
        checkLimit();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao hospedar");
    } finally {
      setDeploying(false);
    }
  };

  const handleDeploy = async () => {
    if (!newSiteName.trim() || !newSiteHtml.trim()) {
      toast.error("Preencha o nome e o código HTML do site");
      return;
    }
    if (limit && !limit.allowed) {
      if (limit.reason === "no_plan") { setShowPlans(true); return; }
      toast.error(`Limite atingido (${limit.current}/${limit.max} sites)`);
      return;
    }
    setDeploying(true);
    try {
      const deployData = await deployToVercel(newSiteHtml, newSiteName);

      const { error } = await supabase.from("hosted_sites").insert({
        user_id: user!.id,
        site_name: newSiteName.trim(),
        html_content: newSiteHtml,
        vercel_project_id: deployData.projectId || null,
        vercel_url: deployData.url || null,
      });

      if (error) {
        toast.error("Site hospedado mas erro ao salvar no banco");
      } else {
        toast.success("🚀 Site hospedado com sucesso!");
        setNewSiteName("");
        setNewSiteHtml("");
        setShowNewSite(false);
        loadSites();
        checkLimit();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao hospedar site");
    } finally {
      setDeploying(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingSite) return;
    setDeploying(true);
    try {
      const siteName = editingSite.vercel_url?.replace("https://", "").split(".")[0] || `snyx-${Date.now()}`;
      const deployData = await deployToVercel(editingSite.html_content, siteName);

      await supabase.from("hosted_sites").update({
        html_content: editingSite.html_content,
        vercel_url: deployData.url || editingSite.vercel_url,
        updated_at: new Date().toISOString(),
      }).eq("id", editingSite.id);

      toast.success("Site atualizado!");
      setEditingSite(null);
      loadSites();
    } catch {
      toast.error("Erro ao atualizar site");
    } finally {
      setDeploying(false);
    }
  };

  const handleDelete = async (site: HostedSite) => {
    if (!confirm(`Excluir "${site.site_name}"?`)) return;
    setDeletingId(site.id);
    await supabase.from("hosted_sites").update({ status: "deleted" }).eq("id", site.id);
    toast.success("Site excluído");
    setSites(prev => prev.filter(s => s.id !== site.id));
    setDeletingId(null);
    checkLimit();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      toast.error("Apenas arquivos HTML são aceitos");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setNewSiteHtml(content);
      if (!newSiteName) setNewSiteName(file.name.replace(/\.(html|htm)$/, ""));
    };
    reader.readAsText(file);
  };

  const handleNewChat = () => {
    setChatMessages([]);
    setPreviewHtml("");
    setGeneratedHtml("");
    setNewSiteName("");
  };

  const tier = (limit?.tier as string) || profile?.hosting_tier || "none";

  // No plan view
  if (tier === "none") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="h-14 flex items-center px-4 md:px-8 border-b border-border/10">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm">Voltar</span>
          </Link>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full space-y-8">
            {/* Hero */}
            <div className="relative rounded-3xl overflow-hidden border border-primary/20">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent" />
              <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />
              <div className="relative p-8 md:p-12 text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/30 to-purple-500/20 flex items-center justify-center border border-primary/20 shadow-2xl shadow-primary/20">
                  <Rocket size={36} className="text-primary" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                    Hospede Sites com <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">Inteligência Artificial</span>
                  </h2>
                  <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto">
                    Converse com a IA, ela cria o site, e você publica com um clique.
                  </p>
                </div>
                <Button onClick={() => setShowPlans(true)} size="lg" className="gap-2 px-8 shadow-xl shadow-primary/20">
                  <Zap size={18} /> Começar Agora
                </Button>
              </div>
            </div>

            {/* Plans */}
            {showPlans && (
              <div className="rounded-3xl border border-border/20 overflow-hidden bg-gradient-to-b from-muted/5 to-transparent p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Escolha seu Plano</h3>
                  <button onClick={() => setShowPlans(false)} className="w-8 h-8 rounded-full bg-muted/20 hover:bg-muted/40 flex items-center justify-center text-muted-foreground">✕</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: "Basic", sites: "3", color: "emerald", icon: Globe },
                    { name: "Pro", sites: "10", color: "primary", icon: Zap, popular: true },
                    { name: "Unlimited", sites: "∞", color: "amber", icon: Crown },
                  ].map(plan => (
                    <div key={plan.name} className={`relative rounded-2xl p-6 border transition-all ${
                      plan.popular ? "border-2 border-primary/30 bg-gradient-to-b from-primary/[0.05] scale-[1.02] shadow-xl shadow-primary/5" : `border-${plan.color}-500/15 bg-gradient-to-b from-${plan.color}-500/[0.03] hover:border-${plan.color}-500/30`
                    }`}>
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-primary/30">Popular</span>
                        </div>
                      )}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2.5">
                          <plan.icon size={16} className={plan.color === "primary" ? "text-primary" : `text-${plan.color}-400`} />
                          <h4 className={`font-bold ${plan.color === "primary" ? "text-primary" : `text-${plan.color}-400`}`}>{plan.name}</h4>
                        </div>
                        <p className="text-3xl font-extrabold">{plan.sites} <span className="text-sm font-normal text-muted-foreground">sites</span></p>
                      </div>
                    </div>
                  ))}
                </div>
                {/* License Key */}
                <div className="rounded-2xl p-5 border border-border/10 bg-muted/[0.03] space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-muted-foreground" />
                    <h4 className="text-sm font-bold">Ativar com Chave de Licença</h4>
                  </div>
                  <div className="flex gap-2">
                    <Input value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} placeholder="HOST-PRO-XXXXXX" className="text-sm font-mono" />
                    <Button
                      onClick={async () => {
                        if (!licenseKey.trim()) return;
                        setActivatingKey(true);
                        try {
                          const { data } = await supabase.rpc("redeem_license_key", { p_key_code: licenseKey.trim() });
                          const result = data as any;
                          if (result?.success) {
                            toast.success("Plano ativado! 🚀");
                            setShowPlans(false);
                            setLicenseKey("");
                            await refreshProfile();
                            await checkLimit();
                            // Plan activated, page will re-render
                          } else {
                            toast.error(result?.error || "Chave inválida");
                          }
                        } catch { toast.error("Erro ao ativar chave"); } finally { setActivatingKey(false); }
                      }}
                      disabled={activatingKey || !licenseKey.trim()}
                      size="sm"
                    >
                      {activatingKey ? <Loader2 size={14} className="animate-spin" /> : "Ativar"}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50">Adquira uma chave com o administrador do SnyX</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-3 md:px-6 shrink-0 border-b border-border/10 bg-background">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div className="w-px h-5 bg-border/20" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/30 to-purple-500/20 flex items-center justify-center border border-primary/20">
              <Rocket size={14} className="text-primary" />
            </div>
            <span className="text-sm font-bold hidden sm:inline">SnyX Hosting</span>
          </div>
          {!chatPanelOpen && (
            <button onClick={() => setChatPanelOpen(true)} className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors">
              <PanelLeftOpen size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Publish button when preview exists */}
          {previewHtml && (
            <Button size="sm" onClick={handlePublish} disabled={deploying || !newSiteName.trim()} className="gap-1.5 h-8 text-xs shadow-lg shadow-primary/20">
              {deploying ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />}
              {deploying ? "Publicando..." : "Publicar"}
            </Button>
          )}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${
            tier === "pro" ? "border-primary/30 bg-primary/10 text-primary" :
            tier === "basic" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
            "border-amber-500/30 bg-amber-500/10 text-amber-400"
          }`}>
            {tier === "unlimited" ? <Crown size={10} /> : <Zap size={10} />}
            {TIER_LABELS[tier]}
          </div>
          {limit && (
            <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">{limit.current}/{limit.max}</span>
          )}
        </div>
      </header>

      {/* Main Layout: Chat + Preview */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: AI Chat Panel */}
        {chatPanelOpen && (
          <div className="w-80 lg:w-96 border-r border-border/10 flex flex-col bg-background shrink-0">
            {/* Chat Header */}
            <div className="h-11 px-3 flex items-center justify-between border-b border-border/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500/20 to-primary/20 flex items-center justify-center">
                  <Bot size={12} className="text-purple-400" />
                </div>
                <span className="text-xs font-bold">IA Assistente</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="flex items-center gap-1">
                {(chatMessages.length > 0 || previewHtml) && (
                  <button onClick={handleNewChat} className="p-1.5 rounded-md hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors" title="Novo chat">
                    <RefreshCw size={12} />
                  </button>
                )}
                <button onClick={() => setChatPanelOpen(false)} className="p-1.5 rounded-md hover:bg-muted/20 text-muted-foreground transition-colors">
                  <PanelLeftClose size={14} />
                </button>
              </div>
            </div>

            {/* Site Name Input */}
            <div className="px-3 py-2 border-b border-border/5">
              <Input
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="Nome do site..."
                className="h-8 text-xs bg-muted/5 border-border/10"
              />
            </div>

            {/* Tabs: Chat / Sites */}
            <div className="flex border-b border-border/10 shrink-0">
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex-1 py-2 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === "chat" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare size={12} />
                Chat IA
              </button>
              <button
                onClick={() => setActiveTab("sites")}
                className={`flex-1 py-2 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === "sites" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Globe size={12} />
                Meus Sites
                {sites.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-muted/15 text-[9px]">{sites.length}</span>}
              </button>
            </div>

            {activeTab === "chat" ? (
              <>
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-6 space-y-4">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/10 to-primary/10 flex items-center justify-center border border-purple-500/10">
                        <Sparkles size={24} className="text-purple-400/60" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">Crie seu site com IA</p>
                        <p className="text-[10px] text-muted-foreground/50 max-w-52 mx-auto leading-relaxed">
                          Descreva o site que você quer e a IA vai criar. Depois, peça alterações no chat.
                        </p>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {[
                          "Portfolio moderno e escuro para designer",
                          "Landing page de startup de IA",
                          "Site institucional de advocacia",
                          "Loja virtual com produtos de exemplo",
                        ].map((s) => (
                          <button
                            key={s}
                            onClick={() => setChatInput(s)}
                            className="block w-full text-left text-[10px] px-3 py-2 rounded-lg bg-muted/5 border border-border/5 text-muted-foreground/70 hover:bg-muted/10 hover:border-border/15 hover:text-foreground transition-all"
                          >
                            ✨ {s}
                          </button>
                        ))}
                      </div>
                      {/* Manual HTML toggle */}
                      <button
                        onClick={() => setShowNewSite(!showNewSite)}
                        className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground flex items-center gap-1 mx-auto transition-colors"
                      >
                        <Code size={10} /> Hospedar com HTML
                      </button>
                    </div>
                  )}

                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple-500/20 to-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot size={10} className="text-purple-400" />
                        </div>
                      )}
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted/10 border border-border/10 rounded-bl-sm"
                      }`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-xs prose-invert max-w-none [&>p]:m-0 [&>p]:text-[11px]">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : msg.content}
                      </div>
                      {msg.role === "user" && (
                        <div className="w-5 h-5 rounded-md bg-muted/20 flex items-center justify-center shrink-0 mt-0.5">
                          <User size={10} className="text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex gap-2 items-start">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple-500/20 to-primary/20 flex items-center justify-center shrink-0">
                        <Bot size={10} className="text-purple-400" />
                      </div>
                      <div className="bg-muted/10 border border-border/10 rounded-xl rounded-bl-sm px-3 py-2.5">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Manual HTML form */}
                {showNewSite && !previewHtml && (
                  <div className="px-3 pb-2 space-y-2 border-t border-border/10 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground">HTML Manual</span>
                      <button onClick={() => setShowNewSite(false)} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground">✕</button>
                    </div>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/10 cursor-pointer hover:bg-muted/10 text-[10px]">
                      <Upload size={10} /> Upload .html
                      <input type="file" accept=".html,.htm" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <Textarea value={newSiteHtml} onChange={(e) => setNewSiteHtml(e.target.value)} placeholder="Cole o HTML aqui..." className="text-[10px] font-mono min-h-[100px]" />
                    <Button size="sm" onClick={handleDeploy} disabled={deploying} className="w-full gap-1 h-7 text-[10px]">
                      {deploying ? <Loader2 size={10} className="animate-spin" /> : <Rocket size={10} />}
                      Publicar HTML
                    </Button>
                  </div>
                )}

                {/* Chat Input */}
                <div className="p-3 border-t border-border/10 shrink-0">
                  <div className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                      placeholder={previewHtml ? "Peça uma alteração..." : "Descreva o site que você quer..."}
                      disabled={chatLoading}
                      className="flex-1 bg-muted/5 border border-border/10 rounded-lg px-3 py-2 text-xs placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={chatLoading || !chatInput.trim()}
                      className="p-2 rounded-lg bg-gradient-to-br from-primary to-purple-600 text-primary-foreground hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-40 disabled:shadow-none"
                    >
                      {chatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Sites List Tab */
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
                  </div>
                ) : sites.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Globe size={24} className="mx-auto text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground">Nenhum site ainda</p>
                    <button onClick={() => setActiveTab("chat")} className="text-xs text-primary hover:underline">Criar com IA →</button>
                  </div>
                ) : (
                  sites.map(site => (
                    <div key={site.id} className="rounded-xl border border-border/10 hover:border-primary/15 transition-all p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold truncate">{site.site_name}</h4>
                          {site.vercel_url && (
                            <a href={site.vercel_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary/50 hover:text-primary truncate flex items-center gap-1 w-fit">
                              <ExternalLink size={8} />
                              {site.vercel_url.replace("https://", "")}
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Link to={`/site/${site.id}`} className="p-1.5 rounded-md hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors" title="Gerenciar">
                            <Edit size={11} />
                          </Link>
                          {site.vercel_url && (
                            <button onClick={() => { navigator.clipboard.writeText(site.vercel_url!); toast.success("URL copiada!"); }} className="p-1.5 rounded-md hover:bg-muted/20 text-muted-foreground" title="Copiar URL">
                              <Copy size={11} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(site)} disabled={deletingId === site.id} className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors" title="Excluir">
                            {deletingId === site.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                          </button>
                        </div>
                      </div>
                      <p className="text-[9px] text-muted-foreground/30">{new Date(site.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* RIGHT: Preview Area */}
        <div className="flex-1 flex flex-col bg-muted/[0.02] overflow-hidden">
          {previewHtml ? (
            <>
              {/* Preview Header */}
              <div className="h-10 px-3 flex items-center justify-between border-b border-border/10 shrink-0 bg-background">
                <div className="flex items-center gap-2">
                  <Eye size={13} className="text-primary" />
                  <span className="text-[11px] font-bold">Preview</span>
                  <span className="text-[10px] text-muted-foreground/40">{newSiteName || "Sem nome"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-muted/10 border border-border/5">
                    <button onClick={() => setPreviewDevice("desktop")} className={`p-1 rounded transition-colors ${previewDevice === "desktop" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>
                      <Monitor size={11} />
                    </button>
                    <button onClick={() => setPreviewDevice("mobile")} className={`p-1 rounded transition-colors ${previewDevice === "mobile" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>
                      <Smartphone size={11} />
                    </button>
                  </div>
                  <button onClick={() => { setPreviewHtml(""); setGeneratedHtml(""); }} className="p-1.5 rounded-md hover:bg-muted/20 text-muted-foreground hover:text-foreground text-[10px]">
                    <X size={12} />
                  </button>
                </div>
              </div>
              {/* Preview Frame */}
              <div className="flex-1 flex items-start justify-center p-4 overflow-auto">
                <div className={`rounded-xl border border-border/15 overflow-hidden bg-white shadow-2xl shadow-black/20 transition-all duration-500 ${
                  previewDevice === "mobile" ? "w-[375px]" : "w-full max-w-5xl"
                }`}>
                  <div className="h-6 bg-[#1a1a1a] flex items-center gap-1.5 px-3">
                    <div className="w-2 h-2 rounded-full bg-red-500/60" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                    <div className="w-2 h-2 rounded-full bg-green-500/60" />
                    <div className="flex-1 mx-6">
                      <div className="h-3.5 rounded bg-white/10 flex items-center justify-center">
                        <span className="text-[8px] text-white/40 font-mono">snyx-{(newSiteName || "site").toLowerCase().replace(/[^a-z0-9-]/g, "-")}.vercel.app</span>
                      </div>
                    </div>
                  </div>
                  <iframe
                    srcDoc={previewHtml}
                    className={`w-full ${previewDevice === "mobile" ? "h-[667px]" : "h-[calc(100vh-10rem)]"}`}
                    title="Preview"
                    sandbox="allow-scripts"
                  />
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4 max-w-xs">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-purple-500/10 to-primary/5 flex items-center justify-center border border-purple-500/10">
                  <Sparkles size={32} className="text-purple-400/30" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-muted-foreground/60">Seu site aparecerá aqui</h3>
                  <p className="text-[11px] text-muted-foreground/30 leading-relaxed">
                    Use o chat ao lado para descrever o site que você quer. A IA vai criar e você pode pedir alterações em tempo real.
                  </p>
                </div>
                {!chatPanelOpen && (
                  <Button variant="outline" size="sm" onClick={() => setChatPanelOpen(true)} className="gap-1.5 text-xs">
                    <PanelLeftOpen size={12} /> Abrir Chat IA
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Hosting;
