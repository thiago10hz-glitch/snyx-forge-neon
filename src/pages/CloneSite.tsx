import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Globe, Sparkles, Palette, Crown, Server, Code, Rocket, Check, Loader2, Wand2, Shield, Zap, Clock, Eye, AlertTriangle, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMercadoPagoCheckout } from "@/hooks/useMercadoPagoCheckout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TiltCard } from "@/components/TiltCard";

const features = [
  { icon: Sparkles, title: "IA gera seu site", desc: "Clone completo do SnyX personalizado com seu nome e marca" },
  { icon: Palette, title: "Personalização total", desc: "Mude cores, textos, logo e tudo que quiser" },
  { icon: Globe, title: "Hospedado no SnyX", desc: "Seu site fica online 24/7 nos nossos servidores" },
  { icon: Code, title: "Chat IA incluído", desc: "Sua plataforma vem com chat IA funcional" },
  { icon: Shield, title: "Painel admin", desc: "Gerencie usuários e conteúdo do seu site" },
  { icon: Rocket, title: "Deploy automático", desc: "IA cria e publica seu site em minutos" },
];

const steps = [
  { num: "01", title: "Personalize", desc: "Diga o nome, cores e estilo que quer pro seu site" },
  { num: "02", title: "IA cria tudo", desc: "Nossa IA gera um clone completo personalizado pra você" },
  { num: "03", title: "Está online!", desc: "Seu site é publicado e você pode editar quando quiser" },
];

// Excluded sections in demo mode (no downloads, no tags, etc.)
const DEMO_EXCLUDED_SECTIONS = [
  "Downloads", "PackSteam", "Accelerator", "IPTV", "Optimization"
];

async function getFingerprint(): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillText("fingerprint", 2, 2);
  }
  const nav = navigator;
  const raw = [
    nav.userAgent, nav.language, screen.width, screen.height,
    screen.colorDepth, new Date().getTimezoneOffset(),
    canvas.toDataURL()
  ].join("|");
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getUserIP(): Promise<string | null> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip;
  } catch {
    return null;
  }
}

export default function CloneSite() {
  const { user, profile } = useAuth();
  const { openCheckout, isLoading: checkoutLoading } = useMercadoPagoCheckout();
  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#ff0000");
  
  // Demo state
  const [demoStatus, setDemoStatus] = useState<"loading" | "available" | "active" | "expired" | "blocked">("loading");
  const [activeDemo, setActiveDemo] = useState<any>(null);
  const [demoTimeLeft, setDemoTimeLeft] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  // Check demo eligibility
  const checkDemoStatus = useCallback(async () => {
    if (!user) {
      setDemoStatus("available");
      return;
    }
    
    try {
      // Check for active demo
      const { data: demos } = await supabase
        .from("clone_demos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (demos && demos.length > 0) {
        const demo = demos[0];
        const expiresAt = new Date(demo.expires_at);
        
        if (demo.status === "active" && expiresAt > new Date()) {
          setActiveDemo(demo);
          setDemoStatus("active");
          setShowDemo(true);
          return;
        } else {
          // Expired
          if (demo.status === "active") {
            // Mark as expired
            await supabase.rpc("cleanup_expired_demos");
          }
          setDemoStatus("expired");
          return;
        }
      }

      // Check eligibility via fingerprint/IP
      const fingerprint = await getFingerprint();
      const ip = await getUserIP();
      
      const { data: canUse } = await supabase.rpc("can_use_demo", {
        p_fingerprint: fingerprint,
        p_ip: ip,
      });

      if (canUse && typeof canUse === "object" && "allowed" in canUse) {
        if (canUse.allowed) {
          setDemoStatus("available");
        } else {
          setDemoStatus("blocked");
          toast.error(String((canUse as any).message || "Demonstração não disponível"));
        }
      }
    } catch {
      setDemoStatus("available");
    }
  }, [user]);

  useEffect(() => {
    checkDemoStatus();
  }, [checkDemoStatus]);

  // Countdown timer for active demo
  useEffect(() => {
    if (demoStatus !== "active" || !activeDemo) return;

    const interval = setInterval(() => {
      const expiresAt = new Date(activeDemo.expires_at);
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setDemoStatus("expired");
        setShowDemo(false);
        setActiveDemo(null);
        toast.info("Sua demonstração expirou! Assine para ter acesso completo.", { duration: 10000 });
        supabase.rpc("cleanup_expired_demos");
        clearInterval(interval);
        return;
      }
      
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setDemoTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [demoStatus, activeDemo]);

  // Start demo
  const handleStartDemo = async () => {
    if (!user) {
      toast.error("Faça login para testar a demonstração");
      return;
    }
    if (!siteName.trim()) {
      toast.error("Digite o nome do seu site para a demonstração");
      return;
    }
    
    setDemoLoading(true);
    try {
      const fingerprint = await getFingerprint();
      const ip = await getUserIP();
      
      // Double-check eligibility
      const { data: canUse } = await supabase.rpc("can_use_demo", {
        p_fingerprint: fingerprint,
        p_ip: ip,
      });

      if (!canUse || !(canUse as any).allowed) {
        toast.error(String((canUse as any)?.message || "Você já usou sua demonstração gratuita"));
        setDemoStatus("blocked");
        return;
      }
      
      // Create demo
      const { data: demo, error } = await supabase
        .from("clone_demos")
        .insert({
          user_id: user.id,
          site_name: siteName.trim(),
          primary_color: primaryColor,
          description: siteDescription || null,
          device_fingerprint: fingerprint,
          ip_address: ip,
          demo_url: `demo-${siteName.trim().toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        })
        .select()
        .single();

      if (error) throw error;

      setActiveDemo(demo);
      setDemoStatus("active");
      setShowDemo(true);
      toast.success("Demonstração ativada! Você tem 1 hora para testar.", { duration: 8000 });
    } catch (err: any) {
      toast.error("Erro ao criar demonstração: " + (err?.message || "Tente novamente"));
    } finally {
      setDemoLoading(false);
    }
  };

  const handleBuy = () => {
    if (!user) {
      toast.error("Faça login para continuar");
      return;
    }
    if (!siteName.trim()) {
      toast.error("Digite o nome do seu site");
      return;
    }

    openCheckout({
      title: "SnyX Clone Site",
      description: `Clone personalizado: ${siteName.trim()}`,
      price: 350,
      quantity: 1,
      userEmail: user.email || undefined,
      userId: user.id,
    });
  };

  // Demo preview
  if (showDemo && activeDemo && demoStatus === "active") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Demo Banner */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-600/90 backdrop-blur-md text-black py-2 px-4 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span>DEMONSTRAÇÃO — {activeDemo.site_name}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span className="font-mono">{demoTimeLeft}</span>
            </div>
            <button
              onClick={() => { setShowDemo(false); }}
              className="px-3 py-1 bg-black/20 rounded-md hover:bg-black/30 transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>

        {/* Demo Site Content */}
        <div className="pt-10">
          <header className="sticky top-10 z-30 border-b border-border/15 bg-background/80 backdrop-blur-xl">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center border font-black text-sm"
                  style={{ 
                    backgroundColor: activeDemo.primary_color + "20", 
                    borderColor: activeDemo.primary_color + "40",
                    color: activeDemo.primary_color
                  }}
                >
                  {activeDemo.site_name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-black">{activeDemo.site_name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground/40">
                <Lock className="w-3 h-3" />
                Acesso privado
              </div>
            </div>
          </header>

          {/* Demo Hero */}
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[120px]" 
                style={{ backgroundColor: activeDemo.primary_color + "15" }} />
            </div>
            <div className="max-w-6xl mx-auto px-4 py-16 text-center relative z-10">
              <h1 className="text-3xl md:text-5xl font-black mb-4">
                Bem-vindo ao{" "}
                <span style={{ color: activeDemo.primary_color }}>{activeDemo.site_name}</span>
              </h1>
              <p className="text-muted-foreground/60 text-sm max-w-lg mx-auto mb-6">
                {activeDemo.description || `Plataforma ${activeDemo.site_name} — sua versão personalizada do SnyX com todas as funcionalidades.`}
              </p>
            </div>
          </section>

          {/* Demo Features - Show available modules (excluding blocked ones) */}
          <section className="max-w-6xl mx-auto px-4 pb-12">
            <h3 className="text-lg font-black text-center mb-6">Funcionalidades do seu site</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: "💬", title: "Chat IA", desc: "Chat inteligente com múltiplos modos" },
                { icon: "🎭", title: "Personagens IA", desc: "Crie e converse com personagens únicos" },
                { icon: "🎵", title: "Gerador de Música", desc: "Crie músicas com inteligência artificial" },
                { icon: "📞", title: "Chamada de Voz", desc: "Converse por voz com a IA" },
                { icon: "🌐", title: "Hospedagem de Sites", desc: "Hospede sites dos seus usuários" },
                { icon: "🛡️", title: "Painel Admin", desc: "Gerencie tudo do seu site" },
                { icon: "🎮", title: "RPG Interativo", desc: "Sistema de RPG com personagens" },
                { icon: "🔗", title: "Conexões", desc: "Sistema de amizades e chat compartilhado" },
                { icon: "🎨", title: "Temas", desc: "Personalização visual completa" },
              ].map((f, i) => (
                <div key={i} className="p-4 rounded-xl border border-border/15 bg-card/30 backdrop-blur-sm">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <h4 className="text-sm font-bold mb-1">{f.title}</h4>
                  <p className="text-xs text-muted-foreground/50">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Demo Chat Preview */}
          <section className="max-w-xl mx-auto px-4 pb-12">
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm p-6">
              <h3 className="text-sm font-black mb-4 flex items-center gap-2">
                <span className="text-lg">💬</span> Chat IA do {activeDemo.site_name}
              </h3>
              <div className="space-y-3 mb-4">
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: activeDemo.primary_color + "20", color: activeDemo.primary_color }}>
                    IA
                  </div>
                  <div className="bg-muted/20 rounded-xl rounded-tl-none px-3 py-2 text-xs max-w-[80%]">
                    Olá! Eu sou a IA do {activeDemo.site_name}. Como posso te ajudar? 🚀
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <div className="rounded-xl rounded-tr-none px-3 py-2 text-xs max-w-[80%]"
                    style={{ backgroundColor: activeDemo.primary_color + "20" }}>
                    Que legal! Esse é meu site?
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: activeDemo.primary_color + "20", color: activeDemo.primary_color }}>
                    IA
                  </div>
                  <div className="bg-muted/20 rounded-xl rounded-tl-none px-3 py-2 text-xs max-w-[80%]">
                    Sim! Essa é uma demonstração do seu {activeDemo.site_name}. Na versão completa, você terá 
                    chat IA ilimitado, personagens, músicas, hospedagem e muito mais! ✨
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/15">
                <input 
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/30" 
                  placeholder="Digite uma mensagem..." 
                  disabled
                />
                <button className="p-1.5 rounded-md text-xs opacity-50" style={{ backgroundColor: activeDemo.primary_color + "20" }} disabled>
                  Enviar
                </button>
              </div>
              <p className="text-[10px] text-center text-muted-foreground/30 mt-2">
                Chat de demonstração — Na versão completa, a IA responde de verdade
              </p>
            </div>
          </section>

          {/* CTA to buy */}
          <section className="max-w-xl mx-auto px-4 pb-20">
            <div className="rounded-2xl border-2 p-6 text-center space-y-4"
              style={{ borderColor: activeDemo.primary_color + "40", backgroundColor: activeDemo.primary_color + "05" }}>
              <AlertTriangle className="w-8 h-8 mx-auto" style={{ color: activeDemo.primary_color }} />
              <h3 className="text-lg font-black">Gostou do {activeDemo.site_name}?</h3>
              <p className="text-xs text-muted-foreground/60">
                Sua demonstração expira em <span className="font-bold text-foreground">{demoTimeLeft}</span>. 
                Assine agora para ter acesso completo e permanente!
              </p>
              <button
                onClick={handleBuy}
                disabled={checkoutLoading}
                className="w-full py-3 rounded-xl font-black text-sm text-white hover:opacity-90 transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: activeDemo.primary_color }}
              >
                {checkoutLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Assinar por R$350/mês
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/15 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-muted/30 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center border border-primary/20">
              <Globe className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-sm font-black tracking-wide">Clone Site</h1>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute bottom-0 -left-32 w-80 h-80 rounded-full bg-primary/5 blur-[100px]" />
        </div>

        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-6">
            <Wand2 className="w-3 h-3" />
            IA cria tudo pra você
          </div>

          <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
            Tenha seu próprio
            <span className="block gradient-text-subtle">SnyX personalizado</span>
          </h2>

          <p className="text-muted-foreground/60 text-sm md:text-base max-w-lg mx-auto mb-8">
            Nossa IA cria um clone completo da plataforma SnyX com seu nome, suas cores e sua marca. 
            Totalmente funcional e hospedado nos nossos servidores.
          </p>

          <div className="inline-flex items-baseline gap-1 mb-2">
            <span className="text-4xl md:text-6xl font-black gradient-text-subtle">R$350</span>
            <span className="text-muted-foreground/50 text-sm font-bold">/mês</span>
          </div>
          <p className="text-xs text-muted-foreground/40 mb-8">Hospedagem + personalização ilimitada</p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h3 className="text-lg font-black text-center mb-8">O que você recebe</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <TiltCard key={i} className="p-5 rounded-xl border border-border/15 bg-card/30 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 border border-primary/15">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-sm font-bold mb-1">{f.title}</h4>
              <p className="text-xs text-muted-foreground/50">{f.desc}</p>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <h3 className="text-lg font-black text-center mb-8">Como funciona</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="relative text-center">
              <div className="text-4xl font-black text-primary/15 mb-2">{s.num}</div>
              <h4 className="text-sm font-bold mb-1">{s.title}</h4>
              <p className="text-xs text-muted-foreground/50">{s.desc}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-6 -right-3 w-6 h-px bg-primary/20" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Customization Form + CTA */}
      <section className="max-w-xl mx-auto px-4 pb-8">
        <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm p-6 md:p-8 space-y-5">
          <div className="text-center mb-2">
            <h3 className="text-lg font-black mb-1">Monte seu site</h3>
            <p className="text-xs text-muted-foreground/50">Preencha e a IA faz o resto</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground/60 mb-1 block">Nome do seu site *</label>
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Ex: MeuApp, GameZone, TechHub..."
                className="bg-background/50 border-border/20 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground/60 mb-1 block">Cor principal</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-border/20 bg-transparent"
                />
                <span className="text-xs text-muted-foreground/50 font-mono">{primaryColor}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground/60 mb-1 block">Descreva seu site (opcional)</label>
              <Textarea
                value={siteDescription}
                onChange={(e) => setSiteDescription(e.target.value)}
                placeholder="O que quer mudar? Textos, funcionalidades, estilo..."
                className="bg-background/50 border-border/20 text-sm min-h-[80px] resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleBuy}
            disabled={checkoutLoading || !siteName.trim()}
            className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-primary to-primary/80 text-primary-foreground 
              hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {checkoutLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Assinar por R$350/mês
              </>
            )}
          </button>

          <p className="text-[10px] text-center text-muted-foreground/30">
            Pagamento seguro via Mercado Pago • Cancele quando quiser
          </p>
        </div>
      </section>

      {/* Demo Section */}
      <section className="max-w-xl mx-auto px-4 pb-20">
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 backdrop-blur-sm p-6 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs font-bold">
            <Eye className="w-3 h-3" />
            Teste grátis
          </div>
          
          <h3 className="text-base font-black">Quer ver antes de comprar?</h3>
          <p className="text-xs text-muted-foreground/50">
            Teste uma demonstração completa do seu site por <span className="text-yellow-500 font-bold">1 hora grátis</span>. 
            Sem compromisso. Funciona tudo, menos downloads e aplicativos.
          </p>

          {demoStatus === "loading" && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground/40">Verificando...</span>
            </div>
          )}

          {demoStatus === "available" && (
            <button
              onClick={handleStartDemo}
              disabled={demoLoading || !siteName.trim()}
              className="w-full py-3 rounded-xl font-black text-sm bg-yellow-500/20 text-yellow-500 border border-yellow-500/30
                hover:bg-yellow-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {demoLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Iniciar demonstração gratuita
                </>
              )}
            </button>
          )}

          {demoStatus === "expired" && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-muted-foreground/50">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold">Sua demonstração já expirou</span>
              </div>
              <p className="text-[10px] text-muted-foreground/30">
                Assine o plano acima para ter acesso completo e permanente
              </p>
            </div>
          )}

          {demoStatus === "blocked" && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold">Demonstração indisponível</span>
              </div>
              <p className="text-[10px] text-muted-foreground/30">
                Cada pessoa pode usar a demonstração apenas uma vez
              </p>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/20">
            Apenas 1 demonstração por pessoa • Acesso privado • Dados removidos após expirar
          </p>
        </div>
      </section>
    </div>
  );
}
