import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { 
  Globe, Trash2, ExternalLink, ArrowLeft, Upload, Code, 
  Crown, Zap, Loader2, Edit, Copy, RefreshCw, Sparkles, Send,
  Eye, Rocket, Monitor, Smartphone,
  Bot, User, MessageSquare, X, PanelLeftClose, PanelLeftOpen,
  Mic, MicOff, Camera, ImagePlus, PenLine, Paperclip
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
  const { user, profile } = useAuth();
  const [sites, setSites] = useState<HostedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState<HostingLimit | null>(null);
  const [showNewSite, setShowNewSite] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteHtml, setNewSiteHtml] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [_editingSite, setEditingSite] = useState<HostedSite | null>(null);
  const [showPlans, setShowPlans] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

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

      // Add custom domain if provided and user is DEV
      let domainResult = null;
      if (customDomain.trim() && profile?.is_dev && deployData.projectId) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const authToken = sessionData?.session?.access_token;
          const domainRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-vercel`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ action: "add-domain", projectId: deployData.projectId, domain: customDomain.trim() }),
          });
          domainResult = await domainRes.json();
        } catch (e) {
          console.error("Erro ao adicionar domínio:", e);
        }
      }

      const { error } = await supabase.from("hosted_sites").insert({
        user_id: user!.id,
        site_name: newSiteName.trim(),
        html_content: generatedHtml,
        vercel_project_id: deployData.projectId || null,
        vercel_url: deployData.url || null,
        custom_domain: customDomain.trim() || null,
      });

      if (error) {
        toast.error("Site hospedado mas erro ao salvar");
      } else {
        const domainMsg = customDomain.trim() && domainResult?.success
          ? `\n\n🌐 Domínio **${customDomain.trim()}** adicionado! Configure o DNS:\n- **CNAME** → \`cname.vercel-dns.com\`\n- ou **A** → \`76.76.21.21\``
          : "";
        toast.success("🚀 Site publicado e online!");
        setChatMessages(prev => [...prev, { role: "assistant", content: `✅ Site publicado com sucesso!\n\n🔗 ${deployData.url || "URL será gerada em breve"}${domainMsg}\n\nVocê pode criar outro site ou editar os existentes.` }]);
        setNewSiteName("");
        setCustomDomain("");
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
    const editingSite = _editingSite;
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

  const handleVoiceToggle = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = SpeechRecognition ? new SpeechRecognition() : null;
      if (!recognition) {
        // Fallback: just record and tell user
        toast.error("Reconhecimento de voz não suportado neste navegador");
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      recognition.lang = "pt-BR";
      recognition.continuous = false;
      recognition.interimResults = false;
      setIsRecording(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(prev => prev ? prev + " " + transcript : transcript);
        setIsRecording(false);
        stream.getTracks().forEach(t => t.stop());
      };
      recognition.onerror = () => {
        setIsRecording(false);
        stream.getTracks().forEach(t => t.stop());
        toast.error("Erro ao captar áudio");
      };
      recognition.onend = () => {
        setIsRecording(false);
        stream.getTracks().forEach(t => t.stop());
      };
      recognition.start();
    } catch {
      toast.error("Permissão de microfone negada");
      setIsRecording(false);
    }
  };

  const handleChatFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.name.endsWith(".html") || file.name.endsWith(".htm")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setGeneratedHtml(content);
        setPreviewHtml(content);
        if (!newSiteName) setNewSiteName(file.name.replace(/\.(html|htm)$/, ""));
        setChatMessages(prev => [...prev,
          { role: "user", content: `📎 Arquivo enviado: ${file.name}` },
          { role: "assistant", content: "✅ HTML carregado no preview! Agora você pode me pedir alterações." }
        ]);
      };
      reader.readAsText(file);
    } else if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setChatMessages(prev => [...prev,
          { role: "user", content: `📎 Imagem enviada: ${file.name}` },
          { role: "assistant", content: `Imagem recebida! Use o chat para me dizer onde inserir no site.\n\n![preview](${dataUrl.substring(0, 100)}...)` }
        ]);
        // Store for AI to reference
        setChatInput(prev => prev ? prev + ` [imagem: ${file.name}]` : `Adicione esta imagem ao site: ${file.name}`);
      };
      reader.readAsDataURL(file);
    } else {
      toast.error("Envie arquivos HTML ou imagens");
    }
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
                {/* Contact admin */}
                <p className="text-center text-xs text-muted-foreground/50">Entre em contato com o admin do SnyX para ativar seu plano</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-11 flex items-center justify-between px-4 shrink-0 border-b border-border/10 bg-background/80  z-10">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-md hover:bg-muted/15 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={15} />
          </Link>
          <div className="w-px h-4 bg-border/15" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap size={11} className="text-primary-foreground" />
            </div>
            <span className="text-xs font-bold tracking-tight hidden sm:inline">SnyX Hosting</span>
          </div>
          {!chatPanelOpen && (
            <button onClick={() => setChatPanelOpen(true)} className="p-1.5 rounded-md hover:bg-muted/15 text-muted-foreground hover:text-foreground transition-colors ml-1" title="Abrir chat">
              <PanelLeftOpen size={15} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {previewHtml && (
            <>
              <Input
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="Nome do projeto..."
                className="h-7 w-40 text-[11px] bg-muted/5 border-border/10 rounded-md hidden md:flex"
              />
              {profile?.is_dev && (
                <Input
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="meudominio.com (opcional)"
                  className="h-7 w-44 text-[11px] bg-muted/5 border-border/10 rounded-md hidden md:flex"
                />
              )}
              <Button size="sm" onClick={handlePublish} disabled={deploying || !newSiteName.trim()} className="gap-1.5 h-7 text-[11px] px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 border-0">
                {deploying ? <Loader2 size={11} className="animate-spin" /> : <Rocket size={11} />}
                {deploying ? "Publicando..." : "Publicar"}
              </Button>
            </>
          )}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
            tier === "pro" ? "bg-primary/10 text-primary" :
            tier === "basic" ? "bg-emerald-500/10 text-emerald-400" :
            "bg-amber-500/10 text-amber-400"
          }`}>
            {tier === "unlimited" ? <Crown size={9} /> : <Zap size={9} />}
            {TIER_LABELS[tier]}
            {limit && <span className="text-[9px] opacity-60 ml-0.5">{limit.current}/{limit.max}</span>}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Chat Sidebar */}
        {chatPanelOpen && (
          <div className="w-[340px] lg:w-[380px] border-r border-border/10 flex flex-col bg-background shrink-0">
            {/* Sidebar Header */}
            <div className="h-10 px-3 flex items-center justify-between shrink-0 border-b border-border/5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500/25 to-primary/15 flex items-center justify-center">
                  <Sparkles size={10} className="text-violet-400" />
                </div>
                <span className="text-[11px] font-semibold text-foreground/80">Assistente IA</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              </div>
              <div className="flex items-center gap-0.5">
                {(chatMessages.length > 0 || previewHtml) && (
                  <button onClick={handleNewChat} className="p-1 rounded-md hover:bg-muted/15 text-muted-foreground/50 hover:text-foreground transition-colors" title="Nova conversa">
                    <RefreshCw size={11} />
                  </button>
                )}
                <button onClick={() => setChatPanelOpen(false)} className="p-1 rounded-md hover:bg-muted/15 text-muted-foreground/50 hover:text-foreground transition-colors">
                  <PanelLeftClose size={13} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex shrink-0 px-3 pt-2 gap-1">
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex-1 py-1.5 text-[10px] font-medium flex items-center justify-center gap-1.5 rounded-md transition-all ${
                  activeTab === "chat" ? "bg-muted/15 text-foreground shadow-sm" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/5"
                }`}
              >
                <MessageSquare size={10} />
                Chat
              </button>
              <button
                onClick={() => setActiveTab("sites")}
                className={`flex-1 py-1.5 text-[10px] font-medium flex items-center justify-center gap-1.5 rounded-md transition-all ${
                  activeTab === "sites" ? "bg-muted/15 text-foreground shadow-sm" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/5"
                }`}
              >
                <Globe size={10} />
                Sites
                {sites.length > 0 && <span className="px-1 py-px rounded bg-muted/20 text-[8px]">{sites.length}</span>}
              </button>
            </div>

            {activeTab === "chat" ? (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin">
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center flex-1 py-8 space-y-6">
                      {/* Icon with glow */}
                      <div className="relative mx-auto w-fit">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto bg-gradient-to-br from-violet-500/10 to-primary/5 border border-violet-500/10 shadow-2xl">
                          <Rocket size={36} className="text-primary/50 hidden md:block" />
                          <Rocket size={28} className="text-primary/50 md:hidden" />
                        </div>
                        <div className="absolute -inset-6 bg-violet-500/5 rounded-full blur-3xl -z-10" />
                      </div>

                      {/* Title */}
                      <div className="space-y-2 text-center">
                        <h2 className="text-lg md:text-xl font-black text-foreground tracking-tight">SnyX Hosting</h2>
                        <p className="text-xs text-muted-foreground/50 leading-relaxed max-w-[240px] mx-auto">
                          Descreva o site que você quer e a IA cria em segundos. Peça alterações quantas vezes quiser.
                        </p>
                      </div>

                      {/* Suggestion pills */}
                      <div className="flex flex-wrap justify-center gap-2">
                        {[
                          "Portfolio moderno",
                          "Landing Page",
                          "Loja Virtual",
                          "Site Institucional",
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => setChatInput(`Crie um ${suggestion.toLowerCase()} profissional e bonito`)}
                            className="text-[11px] px-4 py-2 rounded-xl bg-muted/[0.04] text-muted-foreground/60 border border-border/10 hover:bg-muted/15 hover:text-foreground hover:border-border/25 hover:shadow-xl active:scale-[0.97] transition-all duration-300"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>

                      {/* Keyboard hint */}
                      <p className="text-[10px] text-muted-foreground/20">
                        Pressione <kbd className="px-1.5 py-0.5 rounded-md bg-muted/15 border border-border/10 text-muted-foreground/35 font-mono text-[9px]">Enter</kbd> para enviar
                      </p>

                      <button
                        onClick={() => setShowNewSite(!showNewSite)}
                        className="text-[9px] text-muted-foreground/25 hover:text-muted-foreground/50 flex items-center gap-1 transition-colors"
                      >
                        <Code size={9} /> Ou cole HTML manualmente
                      </button>
                    </div>
                  )}

                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500/20 to-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot size={9} className="text-violet-400" />
                        </div>
                      )}
                      <div className={`max-w-[82%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary/90 text-primary-foreground rounded-br-sm"
                          : "bg-muted/[0.06] border border-border/8 rounded-bl-sm"
                      }`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-xs prose-invert max-w-none [&>p]:m-0 [&>p]:text-[11px] [&>p]:leading-relaxed">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : msg.content}
                      </div>
                      {msg.role === "user" && (
                        <div className="w-5 h-5 rounded-md bg-muted/15 flex items-center justify-center shrink-0 mt-0.5">
                          <User size={9} className="text-muted-foreground/60" />
                        </div>
                      )}
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex gap-2 items-start">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500/20 to-primary/15 flex items-center justify-center shrink-0">
                        <Bot size={9} className="text-violet-400" />
                      </div>
                      <div className="bg-muted/[0.06] border border-border/8 rounded-xl rounded-bl-sm px-3 py-2.5">
                        <div className="flex gap-1">
                          <span className="w-1 h-1 rounded-full bg-violet-400/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1 h-1 rounded-full bg-violet-400/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1 h-1 rounded-full bg-violet-400/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Manual HTML */}
                {showNewSite && !previewHtml && (
                  <div className="px-3 pb-2 space-y-2 border-t border-border/5 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground/60">HTML Manual</span>
                      <button onClick={() => setShowNewSite(false)} className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground">✕</button>
                    </div>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/8 cursor-pointer hover:bg-muted/5 text-[10px] text-muted-foreground/60">
                      <Upload size={10} /> Upload .html
                      <input type="file" accept=".html,.htm" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <Textarea value={newSiteHtml} onChange={(e) => setNewSiteHtml(e.target.value)} placeholder="Cole o HTML aqui..." className="text-[10px] font-mono min-h-[80px] bg-muted/[0.03] border-border/8" />
                    <Button size="sm" onClick={handleDeploy} disabled={deploying} className="w-full gap-1 h-7 text-[10px]">
                      {deploying ? <Loader2 size={10} className="animate-spin" /> : <Rocket size={10} />}
                      Publicar
                    </Button>
                  </div>
                )}

                {/* Input Bar - same style as main chat */}
                <div className="p-2 sm:p-3 border-t border-border/5 shrink-0">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".html,.htm,image/*"
                    className="hidden"
                    onChange={handleChatFileUpload}
                  />
                  <div className="flex items-end gap-1 bg-muted/[0.04] rounded-2xl px-2 sm:px-3 py-2 border border-border/6 focus-within:border-primary/15 focus-within:shadow-2xl focus-within:shadow-primary/5 transition-all duration-500">
                    {/* Image upload button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-xl text-muted-foreground/30 hover:text-foreground/70 hover:bg-muted/10 transition-all duration-300 shrink-0 mb-0.5"
                      title="📸 Enviar imagem de referência"
                    >
                      <Camera size={18} />
                    </button>
                    {/* Image gen placeholder */}
                    <button
                      className="p-2 rounded-xl text-muted-foreground/30 hover:text-purple-400 hover:bg-purple-500/10 transition-all duration-300 shrink-0 mb-0.5 hidden sm:block"
                      title="🎨 Criar imagem com IA"
                      onClick={() => setChatInput("Adicione uma imagem hero gerada por IA ao site")}
                    >
                      <ImagePlus size={18} />
                    </button>
                    {/* Edit/rewrite */}
                    <button
                      className="p-2 rounded-xl text-muted-foreground/30 hover:text-sky-400 hover:bg-sky-500/10 transition-all duration-300 shrink-0 mb-0.5 hidden sm:block"
                      title="✍️ Reescrever conteúdo"
                      onClick={() => setChatInput("Reescreva todo o texto do site de forma mais profissional")}
                    >
                      <PenLine size={18} />
                    </button>
                    {/* File attach */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-xl text-muted-foreground/30 hover:text-foreground/70 hover:bg-muted/10 transition-all duration-300 shrink-0 mb-0.5"
                      title="Anexar arquivo"
                    >
                      <Paperclip size={18} />
                    </button>
                    {/* Mic */}
                    <button
                      onClick={handleVoiceToggle}
                      className={`p-2 rounded-xl transition-all duration-300 shrink-0 mb-0.5 ${
                        isRecording
                          ? "bg-destructive/10 text-destructive animate-pulse"
                          : "text-muted-foreground/30 hover:text-foreground/70 hover:bg-muted/10"
                      }`}
                      title={isRecording ? "Parar gravação" : "Gravar áudio"}
                    >
                      {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    {/* Text input */}
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChat();
                        }
                      }}
                      placeholder={previewHtml ? "Peça uma alteração... 💬" : "Descreva o site que quer criar... 🚀"}
                      rows={1}
                      disabled={chatLoading}
                      className="flex-1 min-w-0 bg-transparent py-1.5 text-[12px] sm:text-[13px] outline-none placeholder:text-muted-foreground/20 resize-none max-h-[120px] leading-relaxed disabled:opacity-40"
                    />
                    {/* Send */}
                    <button
                      onClick={handleSendChat}
                      disabled={chatLoading || !chatInput.trim()}
                      className={`p-2 rounded-xl transition-all duration-300 shrink-0 mb-0.5 ${
                        chatInput.trim()
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/35 hover:scale-105'
                          : 'bg-muted/10 text-muted-foreground/15'
                      } disabled:opacity-40 disabled:hover:scale-100`}
                    >
                      {chatLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Sites List */
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
                  </div>
                ) : sites.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <Globe size={20} className="mx-auto text-muted-foreground/15" />
                    <p className="text-[11px] text-muted-foreground/40">Nenhum site publicado</p>
                    <button onClick={() => setActiveTab("chat")} className="text-[10px] text-primary/60 hover:text-primary transition-colors">Criar com IA →</button>
                  </div>
                ) : (
                  sites.map(site => (
                    <div key={site.id} className="group rounded-lg border border-border/5 hover:border-border/15 transition-all p-2.5 hover:bg-muted/[0.03]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[11px] font-semibold truncate">{site.site_name}</h4>
                          {site.vercel_url && (
                            <a href={site.vercel_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-muted-foreground/30 hover:text-primary/60 truncate flex items-center gap-1 w-fit transition-colors">
                              <ExternalLink size={7} />
                              {site.vercel_url.replace("https://", "")}
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link to={`/site/${site.id}`} className="p-1 rounded hover:bg-muted/15 text-muted-foreground/40 hover:text-foreground transition-colors" title="Editar">
                            <Edit size={10} />
                          </Link>
                          {site.vercel_url && (
                            <button onClick={() => { navigator.clipboard.writeText(site.vercel_url!); toast.success("URL copiada!"); }} className="p-1 rounded hover:bg-muted/15 text-muted-foreground/40 hover:text-foreground transition-colors" title="Copiar">
                              <Copy size={10} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(site)} disabled={deletingId === site.id} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors" title="Excluir">
                            {deletingId === site.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* RIGHT: Preview */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[hsl(var(--background))]/50">
          {previewHtml ? (
            <>
              {/* Preview toolbar */}
              <div className="h-9 px-3 flex items-center justify-between shrink-0 border-b border-border/5 bg-background/50 ">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted/8 border border-border/5">
                    <button onClick={() => setPreviewDevice("desktop")} className={`p-1 rounded-sm transition-all ${previewDevice === "desktop" ? "bg-muted/20 text-foreground shadow-sm" : "text-muted-foreground/40 hover:text-muted-foreground"}`}>
                      <Monitor size={11} />
                    </button>
                    <button onClick={() => setPreviewDevice("mobile")} className={`p-1 rounded-sm transition-all ${previewDevice === "mobile" ? "bg-muted/20 text-foreground shadow-sm" : "text-muted-foreground/40 hover:text-muted-foreground"}`}>
                      <Smartphone size={11} />
                    </button>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/5 border border-border/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                    <span className="text-[9px] text-muted-foreground/40 font-mono">snyx-{(newSiteName || "site").toLowerCase().replace(/[^a-z0-9-]/g, "-")}.vercel.app</span>
                  </div>
                </div>
                <button onClick={() => { setPreviewHtml(""); setGeneratedHtml(""); }} className="p-1 rounded-md hover:bg-muted/15 text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                  <X size={12} />
                </button>
              </div>
              {/* Preview iframe */}
              <div className="flex-1 flex items-start justify-center p-3 overflow-auto bg-[hsl(var(--muted))]/[0.02]">
                <div className={`rounded-lg border border-border/10 overflow-hidden bg-white shadow-2xl shadow-black/30 transition-all duration-500 ${
                  previewDevice === "mobile" ? "w-[375px]" : "w-full max-w-6xl"
                }`}>
                  <div className="h-7 bg-[#141414] flex items-center gap-1.5 px-3 border-b border-white/[0.04]">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="flex-1 mx-8">
                      <div className="h-4 rounded-md bg-white/[0.06] flex items-center justify-center">
                        <span className="text-[9px] text-white/30 font-mono">snyx-{(newSiteName || "site").toLowerCase().replace(/[^a-z0-9-]/g, "-")}.vercel.app</span>
                      </div>
                    </div>
                  </div>
                  <iframe
                    srcDoc={previewHtml}
                    className={`w-full border-0 ${previewDevice === "mobile" ? "h-[667px]" : "h-[calc(100vh-8rem)]"}`}
                    title="Preview"
                    sandbox="allow-scripts"
                  />
                </div>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-5 max-w-xs">
                <div className="relative mx-auto w-fit">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500/[0.06] to-primary/[0.03] flex items-center justify-center border border-violet-500/[0.06]">
                    <Eye size={36} className="text-violet-400/20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-muted-foreground/50">Preview em tempo real</h3>
                  <p className="text-[11px] text-muted-foreground/25 leading-relaxed">
                    Descreva seu site no chat e veja ele sendo construído aqui. Peça ajustes e publique quando quiser.
                  </p>
                </div>
                {!chatPanelOpen && (
                  <Button variant="outline" size="sm" onClick={() => setChatPanelOpen(true)} className="gap-1.5 text-[11px] h-8 border-border/10">
                    <PanelLeftOpen size={12} /> Abrir Chat
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
