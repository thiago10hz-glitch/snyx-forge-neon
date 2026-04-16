import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Globe, Sparkles, Palette, Code, Rocket, Loader2, Wand2, Shield, Zap, Clock, Eye, AlertTriangle, ExternalLink } from "lucide-react";
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openCheckout, isLoading: checkoutLoading } = useMercadoPagoCheckout();
  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#ff0000");

  // Demo state
  const [demoStatus, setDemoStatus] = useState<"loading" | "available" | "active" | "expired" | "blocked">("loading");
  const [activeDemo, setActiveDemo] = useState<any>(null);
  const [demoTimeLeft, setDemoTimeLeft] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);

  // Check demo eligibility
  const checkDemoStatus = useCallback(async () => {
    if (!user) {
      setDemoStatus("available");
      return;
    }

    try {
      const { data: demos } = await (supabase
        .from("clone_demos" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1) as any);

      if (demos && demos.length > 0) {
        const demo = demos[0];
        const expiresAt = new Date(demo.expires_at);

        if (demo.status === "active" && expiresAt > new Date()) {
          setActiveDemo(demo);
          setDemoStatus("active");
          return;
        } else {
          setDemoStatus("expired");
          return;
        }
      }

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
        setActiveDemo(null);
        toast.info("Sua demonstração expirou! O site foi removido. Assine para ter acesso permanente.", { duration: 10000 });
        clearInterval(interval);
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setDemoTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [demoStatus, activeDemo]);

  // Start demo - deploys real site
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

      const { data, error } = await supabase.functions.invoke("deploy-demo-site", {
        body: {
          siteName: siteName.trim(),
          primaryColor,
          description: siteDescription || null,
          fingerprint,
          ip,
        },
      });

      if (error) throw new Error(error.message || "Erro ao criar demonstração");
      if (!data?.success) throw new Error(data?.error || "Falha ao criar demonstração");

      // Open the real site in a new tab
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Site criado! Aberto em nova aba. Você tem 1 hora!", { duration: 10000 });
      }

      // Refresh demo status
      setActiveDemo({
        ...data,
        site_name: siteName.trim(),
        primary_color: primaryColor,
        expires_at: data.expiresAt,
        hosted_url: data.url,
      });
      setDemoStatus("active");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar demonstração");
      if (err?.message?.includes("já utilizou") || err?.message?.includes("não disponível")) {
        setDemoStatus("blocked");
      }
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
            Crie uma demonstração real do seu site — hospedado de verdade por{" "}
            <span className="text-yellow-500 font-bold">1 hora grátis</span>.
            O site abre no Google, funciona tudo. Depois de 1 hora, é removido automaticamente.
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
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando seu site...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Criar demonstração gratuita
                </>
              )}
            </button>
          )}

          {demoStatus === "active" && activeDemo && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-green-400">
                <Globe className="w-4 h-4" />
                <span className="text-xs font-bold">Seu site está no ar!</span>
              </div>

              <div className="flex items-center justify-center gap-2 text-muted-foreground/60">
                <Clock className="w-3 h-3" />
                <span className="text-xs font-mono">{demoTimeLeft} restantes</span>
              </div>

              <button
                onClick={() => navigate("/demo")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 text-green-400 
                  border border-green-500/30 hover:bg-green-500/30 transition-all text-sm font-black"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir meu site — {activeDemo.site_name || "Demo"}
              </button>

              <p className="text-[10px] text-muted-foreground/30">
                O site será removido automaticamente após expirar
              </p>
            </div>
          )}

          {demoStatus === "expired" && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-muted-foreground/50">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold">Sua demonstração expirou</span>
              </div>
              <p className="text-[10px] text-muted-foreground/30">
                O site foi removido. Assine o plano acima para ter acesso permanente!
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
            1 demonstração por pessoa • Site real hospedado por 1h • Removido automaticamente
          </p>
        </div>
      </section>
    </div>
  );
}
