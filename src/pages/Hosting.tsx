import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { 
  Globe, Plus, Trash2, ExternalLink, ArrowLeft, Upload, Code, 
  Crown, Zap, Loader2, Edit, Copy, RefreshCw, Server, Sparkles, Send
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
  basic: "Basic (3 sites)",
  pro: "Pro (10 sites)",
  unlimited: "Ilimitado",
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

  // AI generation
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMode, setAiMode] = useState(false);
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
      toast.success("Site gerado! Confira o preview e clique em Hospedar 🚀");
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
        toast.success("🚀 Site hospedado com sucesso!");
        setAiPrompt("");
        setNewSiteName("");
        setGeneratedHtml("");
        setPreviewHtml("");
        setAiMode(false);
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-12 md:h-14 flex items-center justify-between px-3 md:px-6 shrink-0 glass border-b border-border/20">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm hidden sm:inline">Voltar</span>
          </Link>
          <div className="w-px h-5 bg-border/30" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center border border-primary/15">
              <Server size={16} className="text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold">SnyX Hosting</h1>
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest hidden sm:block">Hospedagem de Sites</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] md:text-xs px-2 py-1 rounded-lg font-medium ${
            tier === "none" ? "bg-muted/20 text-muted-foreground" : 
            tier === "pro" ? "bg-primary/20 text-primary" : 
            tier === "basic" ? "bg-emerald-500/20 text-emerald-400" :
            "bg-amber-500/20 text-amber-400"
          }`}>
            {TIER_LABELS[tier] || tier}
          </span>
          {limit && tier !== "none" && (
            <span className="text-[10px] text-muted-foreground">
              {limit.current}/{limit.max} sites
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-3 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* No Plan Banner */}
          {tier === "none" && (
            <div className="glass rounded-2xl p-6 md:p-8 border border-primary/20 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center">
                <Crown size={28} className="text-primary" />
              </div>
              <h2 className="text-xl font-bold">Ative seu Plano de Hospedagem</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Hospede seus sites com velocidade máxima! Escolha um plano ou ative com uma chave de licença.
              </p>
              <Button onClick={() => setShowPlans(true)} className="gap-2">
                <Zap size={16} /> Ver Planos
              </Button>
            </div>
          )}

          {/* Plans Modal */}
          {showPlans && (
            <div className="glass rounded-2xl p-6 border border-border/20 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Planos de Hospedagem</h3>
                <button onClick={() => setShowPlans(false)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass rounded-xl p-5 border border-emerald-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe size={18} className="text-emerald-400" />
                    <h4 className="font-bold text-emerald-400">Basic</h4>
                  </div>
                  <p className="text-2xl font-bold">3 <span className="text-sm font-normal text-muted-foreground">sites</span></p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>✅ Hospedagem instantânea</li>
                    <li>✅ URL personalizada</li>
                    <li>✅ SSL gratuito</li>
                  </ul>
                </div>
                <div className="glass rounded-xl p-5 border border-primary/30 space-y-3 relative">
                  <span className="absolute -top-2 right-3 text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">POPULAR</span>
                  <div className="flex items-center gap-2">
                    <Zap size={18} className="text-primary" />
                    <h4 className="font-bold text-primary">Pro</h4>
                  </div>
                  <p className="text-2xl font-bold">10 <span className="text-sm font-normal text-muted-foreground">sites</span></p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>✅ Tudo do Basic</li>
                    <li>✅ Domínio customizado</li>
                    <li>✅ Prioridade no deploy</li>
                  </ul>
                </div>
                <div className="glass rounded-xl p-5 border border-amber-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Crown size={18} className="text-amber-400" />
                    <h4 className="font-bold text-amber-400">Unlimited</h4>
                  </div>
                  <p className="text-2xl font-bold">∞ <span className="text-sm font-normal text-muted-foreground">sites</span></p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>✅ Tudo do Pro</li>
                    <li>✅ Sites ilimitados</li>
                    <li>✅ Suporte prioritário</li>
                  </ul>
                </div>
              </div>
              
              <div className="glass rounded-xl p-4 border border-border/10 space-y-3">
                <h4 className="text-sm font-bold">Ativar com Chave de Licença</h4>
                <div className="flex gap-2">
                  <Input
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="Cole sua chave aqui..."
                    className="text-sm"
                  />
                  <Button
                    onClick={async () => {
                      if (!licenseKey.trim()) return;
                      setActivatingKey(true);
                      try {
                        const { data } = await supabase.rpc("redeem_license_key", { p_key_code: licenseKey.trim() });
                        const result = data as any;
                        if (result?.success) {
                          toast.success("Chave ativada! Plano de hospedagem liberado. 🎉");
                          setShowPlans(false);
                          setLicenseKey("");
                          checkLimit();
                        } else {
                          toast.error(result?.error || "Chave inválida");
                        }
                      } catch {
                        toast.error("Erro ao ativar chave");
                      } finally {
                        setActivatingKey(false);
                      }
                    }}
                    disabled={activatingKey}
                    size="sm"
                  >
                    {activatingKey ? <Loader2 size={14} className="animate-spin" /> : "Ativar"}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Adquira uma chave com o administrador do SnyX
                </p>
              </div>
            </div>
          )}

          {/* AI Site Generator — Main Feature */}
          {tier !== "none" && (
            <div className="glass rounded-2xl border border-primary/20 overflow-hidden">
              <div className="p-5 md:p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-primary/20 flex items-center justify-center border border-purple-500/20">
                    <Sparkles size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">Criar Site com IA ✨</h2>
                    <p className="text-xs text-muted-foreground">Descreva o site que você quer e a IA cria e hospeda automaticamente</p>
                  </div>
                </div>

                <Input
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  placeholder="Nome do site (ex: meu-portfolio)"
                  className="text-sm"
                />

                <div className="relative">
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Descreva o site que você quer... Ex: 'Um portfolio moderno e escuro para um designer chamado Lucas, com seções: sobre, projetos e contato'"
                    className="text-sm min-h-[100px] pr-12 resize-none"
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
                    className="absolute bottom-3 right-3 p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {aiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>

                {aiGenerating && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                    <Loader2 size={18} className="animate-spin text-purple-400" />
                    <div>
                      <p className="text-sm font-medium text-purple-400">Gerando seu site...</p>
                      <p className="text-xs text-muted-foreground">A IA está criando o design perfeito pra você</p>
                    </div>
                  </div>
                )}

                {/* Preview + Deploy */}
                {previewHtml && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Globe size={14} className="text-primary" />
                        Preview do Site
                      </h3>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => { setPreviewHtml(""); setGeneratedHtml(""); }}
                        >
                          Descartar
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleAiDeploy} 
                          disabled={deploying || !newSiteName.trim()}
                          className="gap-2"
                        >
                          {deploying ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                          {deploying ? "Hospedando..." : "Hospedar Agora 🚀"}
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/20 overflow-hidden bg-white">
                      <iframe
                        srcDoc={previewHtml}
                        className="w-full h-[400px] md:h-[500px]"
                        title="Preview"
                        sandbox="allow-scripts"
                      />
                    </div>
                  </div>
                )}

                {/* Manual mode toggle */}
                {!previewHtml && (
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => { setAiMode(false); setShowNewSite(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <Code size={12} /> Ou cole seu HTML manualmente
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual New Site Form */}
          {showNewSite && !aiMode && tier !== "none" && (
            <div className="glass rounded-2xl p-5 border border-border/20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Hospedar com Código HTML</h3>
                <button onClick={() => setShowNewSite(false)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
              </div>
              
              <Input
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="Nome do site (ex: meu-portfolio)"
                className="text-sm"
              />
              
              <div className="flex gap-2">
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl glass cursor-pointer hover:bg-muted/20 transition-colors text-sm border border-border/10">
                  <Upload size={14} />
                  <span>Upload HTML</span>
                  <input type="file" accept=".html,.htm" className="hidden" onChange={handleFileUpload} />
                </label>
                <span className="text-xs text-muted-foreground self-center">ou cole o código abaixo</span>
              </div>
              
              <Textarea
                value={newSiteHtml}
                onChange={(e) => setNewSiteHtml(e.target.value)}
                placeholder="Cole seu código HTML aqui..."
                className="text-xs font-mono min-h-[200px]"
              />
              
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowNewSite(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleDeploy} disabled={deploying} className="gap-2">
                  {deploying ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  {deploying ? "Hospedando..." : "Hospedar Agora"}
                </Button>
              </div>
            </div>
          )}

          {/* Edit Site Form */}
          {editingSite && (
            <div className="glass rounded-2xl p-5 border border-primary/20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Editar: {editingSite.site_name}</h3>
                <button onClick={() => setEditingSite(null)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
              </div>
              <Textarea
                value={editingSite.html_content}
                onChange={(e) => setEditingSite({ ...editingSite, html_content: e.target.value })}
                className="text-xs font-mono min-h-[300px]"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditingSite(null)}>Cancelar</Button>
                <Button size="sm" onClick={handleUpdate} disabled={deploying} className="gap-2">
                  {deploying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {deploying ? "Atualizando..." : "Atualizar Site"}
                </Button>
              </div>
            </div>
          )}

          {/* Sites List */}
          {tier !== "none" && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Seus Sites ({sites.length})</h2>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : sites.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <Globe size={40} className="mx-auto text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">Nenhum site hospedado ainda</p>
                  <p className="text-muted-foreground/50 text-xs">Descreva o site acima e a IA cria pra você! ✨</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {sites.map((site) => (
                    <div key={site.id} className="glass rounded-xl p-4 border border-border/10 hover:border-primary/15 transition-all group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Globe size={14} className="text-primary shrink-0" />
                            <h4 className="font-bold text-sm truncate">{site.site_name}</h4>
                          </div>
                          {site.vercel_url && (
                            <a
                              href={site.vercel_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary/70 hover:text-primary truncate mt-1 flex items-center gap-1"
                            >
                              <ExternalLink size={10} />
                              {site.vercel_url}
                            </a>
                          )}
                          <p className="text-[10px] text-muted-foreground/50 mt-1">
                            Criado em {new Date(site.created_at).toLocaleDateString("pt-BR")}
                            {site.updated_at !== site.created_at && ` • Atualizado ${new Date(site.updated_at).toLocaleDateString("pt-BR")}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {site.vercel_url && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(site.vercel_url!);
                                toast.success("URL copiada!");
                              }}
                              className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
                              title="Copiar URL"
                            >
                              <Copy size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => setEditingSite(site)}
                            className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
                            title="Editar"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(site)}
                            disabled={deletingId === site.id}
                            className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                            title="Excluir"
                          >
                            {deletingId === site.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Hosting;
