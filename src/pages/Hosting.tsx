import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { 
  Globe, Trash2, ExternalLink, ArrowLeft, Upload, Code, 
  Crown, Zap, Loader2, Edit, Copy, RefreshCw, Sparkles, Send,
  Eye, Rocket, Shield, Palette, Layout, Monitor, Smartphone, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteHtml, setNewSiteHtml] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingSite, setEditingSite] = useState<HostedSite | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  const [activatingKey, setActivatingKey] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [justActivated, setJustActivated] = useState(false);

  // AI generation
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");

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

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    if (limit && !limit.allowed) {
      if (limit.reason === "no_plan") {
        setShowPlans(true);
        return;
      }
      toast.error(`Limite atingido (${limit.current}/${limit.max} sites)`);
      return;
    }

    setAiGenerating(true);
    setGeneratedHtml("");
    setPreviewHtml("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-hosting`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ 
          description: aiPrompt, 
          siteName: newSiteName || aiPrompt.slice(0, 30) 
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Erro ao gerar site");
        return;
      }

      setGeneratedHtml(data.html);
      setPreviewHtml(data.html);
      if (!newSiteName) {
        setNewSiteName(aiPrompt.slice(0, 40).replace(/[^a-zA-Z0-9\s-]/g, "").trim());
      }
      toast.success("Site gerado com sucesso! Confira o preview 🚀");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar site com IA");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAiDeploy = async () => {
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
        toast.success("🚀 Site hospedado e online!");
        setAiPrompt("");
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

  const tier = (profile as any)?.hosting_tier || "none";
  const tierColor = tier === "pro" ? "text-primary" : tier === "basic" ? "text-emerald-400" : tier === "unlimited" ? "text-amber-400" : "text-muted-foreground";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header Premium */}
      <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-8 shrink-0 border-b border-border/10 bg-gradient-to-r from-background via-background to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-purple-500/[0.03]" />
        <div className="flex items-center gap-4 relative z-10">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group">
            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm hidden sm:inline">Voltar</span>
          </Link>
          <div className="w-px h-6 bg-border/20" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-purple-500/20 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
              <Rocket size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">SnyX Hosting</h1>
              <p className="text-[10px] text-muted-foreground/50 tracking-wider uppercase">Deploy Inteligente</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
            tier === "none" ? "border-border/20 bg-muted/10" :
            tier === "pro" ? "border-primary/30 bg-primary/10" :
            tier === "basic" ? "border-emerald-500/30 bg-emerald-500/10" :
            "border-amber-500/30 bg-amber-500/10"
          }`}>
            {tier !== "none" && (tier === "unlimited" ? <Crown size={12} className={tierColor} /> : <Zap size={12} className={tierColor} />)}
            <span className={`text-xs font-bold ${tierColor}`}>
              {TIER_LABELS[tier] || tier}
            </span>
          </div>
          {limit && tier !== "none" && (
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-20 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500"
                  style={{ width: `${Math.min((limit.current / limit.max) * 100, 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {limit.current}/{limit.max}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
          
          {/* Hero Banner - No Plan */}
          {tier === "none" && (
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
                  <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto leading-relaxed">
                    Descreva o site que você quer e nossa IA cria, estiliza e publica automaticamente com URL pública.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button onClick={() => setShowPlans(true)} size="lg" className="gap-2 px-8 shadow-xl shadow-primary/20">
                    <Zap size={18} /> Começar Agora
                  </Button>
                </div>
                <div className="flex items-center justify-center gap-6 pt-2">
                  {[
                    { icon: Shield, text: "SSL Grátis" },
                    { icon: Zap, text: "Deploy Instantâneo" },
                    { icon: Sparkles, text: "IA Inclusa" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                      <Icon size={12} />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Plans Panel */}
          {showPlans && (
            <div className="rounded-3xl border border-border/20 overflow-hidden bg-gradient-to-b from-muted/5 to-transparent">
              <div className="p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">Escolha seu Plano</h3>
                    <p className="text-xs text-muted-foreground mt-1">Hospede sites profissionais em segundos</p>
                  </div>
                  <button onClick={() => setShowPlans(false)} className="w-8 h-8 rounded-full bg-muted/20 hover:bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">✕</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Basic */}
                  <div className="group relative rounded-2xl p-6 border border-emerald-500/15 bg-gradient-to-b from-emerald-500/[0.03] to-transparent hover:border-emerald-500/30 transition-all duration-300">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                          <Globe size={16} className="text-emerald-400" />
                        </div>
                        <h4 className="font-bold text-emerald-400">Basic</h4>
                      </div>
                      <div>
                        <p className="text-3xl font-extrabold">3 <span className="text-sm font-normal text-muted-foreground">sites</span></p>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-2.5">
                        <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-emerald-500" /> Hospedagem instantânea</li>
                        <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-emerald-500" /> URL personalizada</li>
                        <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-emerald-500" /> SSL gratuito</li>
                        <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-emerald-500" /> Geração com IA</li>
                      </ul>
                    </div>
                  </div>

                  {/* Pro */}
                  <div className="group relative rounded-2xl p-6 border-2 border-primary/30 bg-gradient-to-b from-primary/[0.05] to-transparent shadow-xl shadow-primary/5 scale-[1.02]">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-primary/30">Popular</span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                          <Zap size={16} className="text-primary" />
                        </div>
                        <h4 className="font-bold text-primary">Pro</h4>
                      </div>
                      <div>
                        <p className="text-3xl font-extrabold">10 <span className="text-sm font-normal text-muted-foreground">sites</span></p>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-2.5">
                        <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary" /> Tudo do Basic</li>
                        <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary" /> Domínio customizado</li>
                        <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary" /> Prioridade no deploy</li>
                        <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary" /> Preview ao vivo</li>
                      </ul>
                    </div>
                  </div>

                  {/* Unlimited */}
                  <div className="group relative rounded-2xl p-6 border border-amber-500/15 bg-gradient-to-b from-amber-500/[0.03] to-transparent hover:border-amber-500/30 transition-all duration-300">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                          <Crown size={16} className="text-amber-400" />
                        </div>
                        <h4 className="font-bold text-amber-400">Unlimited</h4>
                      </div>
                      <div>
                        <p className="text-3xl font-extrabold">∞ <span className="text-sm font-normal text-muted-foreground">sites</span></p>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-2.5">
                        <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-amber-500" /> Tudo do Pro</li>
                        <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-amber-500" /> Sites ilimitados</li>
                        <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-amber-500" /> Suporte prioritário</li>
                        <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-amber-500" /> Analytics avançado</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* License Key */}
                <div className="rounded-2xl p-5 border border-border/10 bg-muted/[0.03] space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-muted-foreground" />
                    <h4 className="text-sm font-bold">Ativar com Chave de Licença</h4>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      placeholder="HOST-PRO-XXXXXX"
                      className="text-sm font-mono"
                    />
                    <Button
                      onClick={async () => {
                        if (!licenseKey.trim()) return;
                        setActivatingKey(true);
                        try {
                          const { data } = await supabase.rpc("redeem_license_key", { p_key_code: licenseKey.trim() });
                          const result = data as any;
                          if (result?.success) {
                            toast.success("Plano ativado com sucesso! 🎉");
                            setShowPlans(false);
                            setLicenseKey("");
                            checkLimit();
                            window.location.reload();
                          } else {
                            toast.error(result?.error || "Chave inválida");
                          }
                        } catch {
                          toast.error("Erro ao ativar chave");
                        } finally {
                          setActivatingKey(false);
                        }
                      }}
                      disabled={activatingKey || !licenseKey.trim()}
                      size="sm"
                      className="px-6"
                    >
                      {activatingKey ? <Loader2 size={14} className="animate-spin" /> : "Ativar"}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50">
                    Adquira uma chave com o administrador do SnyX
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Site Generator */}
          {tier !== "none" && (
            <div className="rounded-3xl border border-primary/15 overflow-hidden bg-gradient-to-b from-primary/[0.02] to-transparent">
              <div className="p-6 md:p-8 space-y-5">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/25 to-primary/15 flex items-center justify-center border border-purple-500/15 shadow-lg shadow-purple-500/10 shrink-0">
                    <Sparkles size={22} className="text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold tracking-tight">Criar Site com IA</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Descreva o que você precisa — a IA projeta, codifica e hospeda automaticamente
                    </p>
                  </div>
                </div>

                {/* Site Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nome do site</label>
                  <Input
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    placeholder="meu-portfolio"
                    className="text-sm h-10"
                  />
                </div>

                {/* AI Prompt */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Descreva seu site</label>
                  <div className="relative">
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Ex: 'Portfolio moderno e escuro para um designer chamado Lucas. Seções: hero com animação, sobre mim, projetos com cards e contato com formulário'"
                      className="text-sm min-h-[120px] pr-14 resize-none leading-relaxed"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAiGenerate();
                        }
                      }}
                    />
                    <button
                      onClick={handleAiGenerate}
                      disabled={aiGenerating || !aiPrompt.trim()}
                      className="absolute bottom-3 right-3 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-40 disabled:shadow-none flex items-center justify-center"
                    >
                      {aiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>

                {/* Quick Suggestions */}
                {!previewHtml && !aiGenerating && (
                  <div className="flex flex-wrap gap-2">
                    {[
                      { icon: Palette, text: "Portfolio criativo" },
                      { icon: Layout, text: "Landing page startup" },
                      { icon: Globe, text: "Site institucional" },
                    ].map(({ icon: Icon, text }) => (
                      <button
                        key={text}
                        onClick={() => setAiPrompt(text)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] border border-border/15 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
                      >
                        <Icon size={11} />
                        {text}
                      </button>
                    ))}
                  </div>
                )}

                {/* Loading State */}
                {aiGenerating && (
                  <div className="rounded-2xl p-6 bg-gradient-to-r from-purple-500/5 to-primary/5 border border-purple-500/10 flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <Loader2 size={22} className="animate-spin text-purple-400" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-purple-300">Gerando seu site...</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Design responsivo, moderno e otimizado</p>
                    </div>
                  </div>
                )}

                {/* Preview */}
                {previewHtml && (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Eye size={16} className="text-primary" />
                        <h3 className="text-sm font-bold">Preview</h3>
                        {/* Device Toggle */}
                        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/10 border border-border/10">
                          <button
                            onClick={() => setPreviewDevice("desktop")}
                            className={`p-1.5 rounded-md transition-all ${previewDevice === "desktop" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            <Monitor size={13} />
                          </button>
                          <button
                            onClick={() => setPreviewDevice("mobile")}
                            className={`p-1.5 rounded-md transition-all ${previewDevice === "mobile" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            <Smartphone size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => { setPreviewHtml(""); setGeneratedHtml(""); }}
                          className="text-xs"
                        >
                          Descartar
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleAiDeploy} 
                          disabled={deploying || !newSiteName.trim()}
                          className="gap-2 shadow-lg shadow-primary/20"
                        >
                          {deploying ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                          {deploying ? "Publicando..." : "Publicar Site"}
                        </Button>
                      </div>
                    </div>
                    <div className={`mx-auto rounded-2xl border border-border/15 overflow-hidden bg-white shadow-2xl shadow-black/20 transition-all duration-500 ${
                      previewDevice === "mobile" ? "max-w-[375px]" : "w-full"
                    }`}>
                      <div className="h-7 bg-[#1a1a1a] flex items-center gap-1.5 px-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                        <div className="flex-1 mx-8">
                          <div className="h-4 rounded-md bg-white/10 flex items-center justify-center">
                            <span className="text-[9px] text-white/40 font-mono">snyx-{newSiteName || "site"}.vercel.app</span>
                          </div>
                        </div>
                      </div>
                      <iframe
                        srcDoc={previewHtml}
                        className={`w-full transition-all duration-500 ${previewDevice === "mobile" ? "h-[667px]" : "h-[500px] md:h-[600px]"}`}
                        title="Preview"
                        sandbox="allow-scripts"
                      />
                    </div>
                  </div>
                )}

                {/* Manual Mode */}
                {!previewHtml && !aiGenerating && (
                  <div className="pt-2 border-t border-border/10">
                    <button
                      onClick={() => setShowNewSite(!showNewSite)}
                      className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center gap-1.5"
                    >
                      <Code size={12} /> Hospedar com código HTML
                      <ChevronDown size={12} className={`transition-transform ${showNewSite ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual HTML Form */}
          {showNewSite && tier !== "none" && !previewHtml && (
            <div className="rounded-2xl p-6 border border-border/15 bg-muted/[0.02] space-y-4 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code size={16} className="text-muted-foreground" />
                  <h3 className="font-bold text-sm">Hospedar com Código HTML</h3>
                </div>
                <button onClick={() => setShowNewSite(false)} className="w-6 h-6 rounded-full bg-muted/20 hover:bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors text-xs">✕</button>
              </div>
              
              <div className="flex gap-2">
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/15 cursor-pointer hover:bg-muted/10 transition-colors text-sm">
                  <Upload size={14} className="text-muted-foreground" />
                  <span className="text-xs font-medium">Upload .html</span>
                  <input type="file" accept=".html,.htm" className="hidden" onChange={handleFileUpload} />
                </label>
                <span className="text-[10px] text-muted-foreground/40 self-center">ou cole abaixo</span>
              </div>
              
              <Textarea
                value={newSiteHtml}
                onChange={(e) => setNewSiteHtml(e.target.value)}
                placeholder="<!DOCTYPE html>&#10;<html>&#10;  <head>...</head>&#10;  <body>...</body>&#10;</html>"
                className="text-xs font-mono min-h-[200px] leading-relaxed"
              />
              
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowNewSite(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleDeploy} disabled={deploying} className="gap-2">
                  {deploying ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                  {deploying ? "Publicando..." : "Publicar"}
                </Button>
              </div>
            </div>
          )}

          {/* Edit Site */}
          {editingSite && (
            <div className="rounded-2xl p-6 border border-primary/20 bg-primary/[0.02] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit size={16} className="text-primary" />
                  <h3 className="font-bold text-sm">Editando: {editingSite.site_name}</h3>
                </div>
                <button onClick={() => setEditingSite(null)} className="w-6 h-6 rounded-full bg-muted/20 hover:bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors text-xs">✕</button>
              </div>
              <Textarea
                value={editingSite.html_content}
                onChange={(e) => setEditingSite({ ...editingSite, html_content: e.target.value })}
                className="text-xs font-mono min-h-[300px] leading-relaxed"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditingSite(null)}>Cancelar</Button>
                <Button size="sm" onClick={handleUpdate} disabled={deploying} className="gap-2">
                  {deploying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {deploying ? "Atualizando..." : "Atualizar"}
                </Button>
              </div>
            </div>
          )}

          {/* Sites List */}
          {tier !== "none" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight">Seus Sites</h2>
                  <span className="px-2 py-0.5 rounded-full bg-muted/15 text-xs font-mono text-muted-foreground">{sites.length}</span>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                    <span className="text-xs text-muted-foreground">Carregando sites...</span>
                  </div>
                </div>
              ) : sites.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/10 flex items-center justify-center">
                    <Globe size={28} className="text-muted-foreground/20" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm font-medium">Nenhum site hospedado</p>
                    <p className="text-muted-foreground/40 text-xs">Use a IA acima para criar seu primeiro site ✨</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {sites.map((site) => (
                    <div 
                      key={site.id} 
                      className="group rounded-2xl border border-border/10 hover:border-primary/15 transition-all duration-300 overflow-hidden"
                    >
                      <div className="p-4 md:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-purple-500/10 flex items-center justify-center border border-primary/10 shrink-0 mt-0.5">
                              <Globe size={16} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm">{site.site_name}</h4>
                              {site.vercel_url && (
                                <a
                                  href={site.vercel_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary/60 hover:text-primary truncate mt-0.5 flex items-center gap-1 w-fit"
                                >
                                  <ExternalLink size={10} />
                                  {site.vercel_url.replace("https://", "")}
                                </a>
                              )}
                              <p className="text-[10px] text-muted-foreground/40 mt-1.5">
                                {new Date(site.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                                {site.updated_at !== site.created_at && ` • editado`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {site.vercel_url && (
                              <>
                                <button
                                  onClick={() => window.open(site.vercel_url!, "_blank")}
                                  className="p-2 rounded-lg hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
                                  title="Abrir"
                                >
                                  <ExternalLink size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(site.vercel_url!);
                                    toast.success("URL copiada!");
                                  }}
                                  className="p-2 rounded-lg hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
                                  title="Copiar URL"
                                >
                                  <Copy size={14} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setEditingSite(site)}
                              className="p-2 rounded-lg hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(site)}
                              disabled={deletingId === site.id}
                              className="p-2 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                              title="Excluir"
                            >
                              {deletingId === site.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Preview */}
                      {expandedSite === site.id && (
                        <div className="border-t border-border/10 bg-white">
                          <iframe
                            srcDoc={site.html_content}
                            className="w-full h-[300px]"
                            title={`Preview ${site.site_name}`}
                            sandbox="allow-scripts"
                          />
                        </div>
                      )}
                      
                      <button
                        onClick={() => setExpandedSite(expandedSite === site.id ? null : site.id)}
                        className="w-full py-1.5 border-t border-border/5 text-[10px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/5 transition-colors flex items-center justify-center gap-1"
                      >
                        <Eye size={10} />
                        {expandedSite === site.id ? "Fechar preview" : "Ver preview"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Hosting;
