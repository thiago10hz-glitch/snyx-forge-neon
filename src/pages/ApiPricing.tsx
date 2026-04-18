import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMercadoPagoCheckout } from "@/hooks/useMercadoPagoCheckout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Code2, Loader2, Sparkles, Zap, Crown, ArrowLeft, Copy, KeyRound } from "lucide-react";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ApiApplicationModal } from "@/components/ApiApplicationModal";
import apiHero from "@/assets/api-hero.jpg";

interface ApiPlan {
  id: string;
  slug: string;
  name: string;
  price_brl: number;
  daily_request_limit: number;
  monthly_request_limit: number;
  rate_limit_per_minute: number;
  models_allowed: string[];
}

const PLAN_META: Record<string, { icon: any; tag?: string; highlight?: boolean }> = {
  free: { icon: Sparkles },
  starter: { icon: Zap },
  pro: { icon: Crown, tag: "Mais popular", highlight: true },
  business: { icon: Crown },
};

// Descrição amigável de cada modelo SnyX (sem revelar provider real)
const SNYX_MODEL_INFO: Record<string, { label: string; desc: string }> = {
  "snyx-fast": { label: "SnyX Fast", desc: "Respostas instantâneas, ideal para chat" },
  "snyx-pro": { label: "SnyX Pro", desc: "Raciocínio avançado, qualidade GPT-4 class" },
  "snyx-coder": { label: "SnyX Coder", desc: "Especializado em código e debugging" },
  "snyx-reasoning": { label: "SnyX Reasoning", desc: "Problemas complexos, matemática, lógica" },
  "snyx-vision": { label: "SnyX Vision", desc: "Análise de imagens e multimodal" },
  "snyx-search": { label: "SnyX Search", desc: "Respostas com busca em tempo real" },
};

export default function ApiPricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openCheckout, isLoading: checkoutLoading } = useMercadoPagoCheckout();
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [keyExisted, setKeyExisted] = useState(false);
  const [applyingPlan, setApplyingPlan] = useState<ApiPlan | null>(null);

  useEffect(() => {
    document.title = "API SnyX — Preços e Planos";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Planos da API SnyX: integre IA generativa (chat, código, imagem) ao seu app via REST. Free, Pro e Business em BRL.";
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description"; m.content = desc; document.head.appendChild(m);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("api_plans")
        .select("id, slug, name, price_brl, daily_request_limit, monthly_request_limit, rate_limit_per_minute, models_allowed")
        .eq("is_active", true)
        .order("price_brl", { ascending: true });
      setPlans((data || []) as ApiPlan[]);
      setLoading(false);
    })();
  }, []);

  const handleSubscribe = async (plan: ApiPlan) => {
    if (!user) { navigate("/auth"); return; }
    // Apenas o plano Free passa pela entrevista; Pro e Business vão direto pro checkout pago.
    if (plan.slug === "free" || Number(plan.price_brl) === 0) {
      setApplyingPlan(plan);
      return;
    }
    await handleBuyNow(plan);
  };

  const handleBuyNow = async (plan: ApiPlan) => {
    if (!user) { navigate("/auth"); return; }
    setActiveSlug(plan.slug);
    await openCheckout({
      title: `API SnyX — Plano ${plan.name}`,
      description: `Acesso mensal · ${plan.monthly_request_limit.toLocaleString("pt-BR")} requisições/mês`,
      price: Number(plan.price_brl),
      userId: user.id,
      userEmail: user.email,
    });
    setActiveSlug(null);
  };

  const copyKey = async () => {
    if (!issuedKey) return;
    await navigator.clipboard.writeText(issuedKey);
    toast.success("Chave copiada!");
  };

  const fmtNumber = (n: number) => n.toLocaleString("pt-BR");

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <AuroraBackground />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5">
            <Code2 className="w-3 h-3 mr-1.5" /> API Pública
          </Badge>
        </div>

        {/* Hero */}
        <header className="text-center mb-14 sm:mb-20">
          <div className="relative mx-auto mb-8 max-w-3xl rounded-3xl overflow-hidden border border-primary/30 shadow-[0_0_80px_-10px_hsl(var(--primary)/0.7)] animate-[float_6s_ease-in-out_infinite]">
            {/* Pulsing glow ring */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary via-primary/60 to-primary opacity-60 blur-2xl animate-pulse pointer-events-none" />
            <div className="relative">
              <img
                src={apiHero}
                alt="Esfera de IA holográfica vermelha com energia explosiva representando a API SnyX"
                width={1920}
                height={1080}
                className="w-full h-auto object-cover animate-[zoomBreath_8s_ease-in-out_infinite]"
              />
              {/* Animated shimmer overlay */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-foreground/10 to-transparent animate-[heroShimmer_4s_ease-in-out_infinite] pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4">
            API <span className="text-primary">SnyX</span> para devs
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Integre IA generativa ao seu app — chat, código e imagem — através de uma API REST simples.
            Compatível com a interface OpenAI.
          </p>
        </header>

        {/* Plans grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const meta = PLAN_META[plan.slug] || { icon: Sparkles };
              const Icon = meta.icon;
              const isFree = plan.price_brl === 0;
              const isLoadingThis = checkoutLoading && activeSlug === plan.slug;
              return (
                <article
                  key={plan.id}
                  className={`relative rounded-2xl border bg-card/60 backdrop-blur-xl p-6 flex flex-col transition-all hover:translate-y-[-2px] ${
                    meta.highlight
                      ? "border-primary/60 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.5)]"
                      : "border-border/50"
                  }`}
                >
                  {meta.tag && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[11px] font-bold rounded-full bg-primary text-primary-foreground shadow-lg">
                      {meta.tag}
                    </span>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      meta.highlight ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-bold">{plan.name}</h2>
                  </div>

                  <div className="mb-5">
                    {isFree ? (
                      <div className="text-3xl font-extrabold">Grátis</div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold">
                          R$ {Number(plan.price_brl).toFixed(2).replace(".", ",")}
                        </span>
                        <span className="text-sm text-muted-foreground">/mês</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2.5 text-sm mb-6 flex-1">
                    <li className="flex gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span><strong>{fmtNumber(plan.daily_request_limit)}</strong> requisições/dia</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span><strong>{fmtNumber(plan.monthly_request_limit)}</strong> requisições/mês</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span><strong>{plan.models_allowed.length}</strong> modelo{plan.models_allowed.length > 1 ? "s" : ""} SnyX inclusos</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>API key pessoal + dashboard</span>
                    </li>
                    {!isFree && (
                      <li className="flex gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>Suporte prioritário</span>
                      </li>
                    )}
                  </ul>

                  {/* Lista de modelos inclusos */}
                  <div className="mb-5 p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1.5">
                    {plan.models_allowed.map((m) => {
                      const info = SNYX_MODEL_INFO[m] || { label: m, desc: "" };
                      return (
                        <div key={m} className="flex items-start gap-2 text-xs">
                          <span className="font-mono text-primary font-semibold shrink-0">{info.label}</span>
                          <span className="text-muted-foreground">— {info.desc}</span>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    onClick={() => handleSubscribe(plan)}
                    disabled={isLoadingThis}
                    variant={meta.highlight ? "default" : "outline"}
                    className="w-full"
                  >
                    {isFree ? "Começar grátis" : (isLoadingThis ? "Abrindo checkout..." : "Assinar agora")}
                  </Button>
                </article>
              );
            })}
          </div>
        )}

        {/* Footer info */}
        <section className="mt-16 grid sm:grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div className="rounded-xl border border-border/40 bg-card/30 p-4">
            <div className="font-semibold text-foreground mb-1">Pagamento via Pix/Cartão</div>
            Cobrança mensal via Mercado Pago. Cancele quando quiser.
          </div>
          <div className="rounded-xl border border-border/40 bg-card/30 p-4">
            <div className="font-semibold text-foreground mb-1">Sem letras miúdas</div>
            Limites claros. Se atingir o teto, é só fazer upgrade.
          </div>
          <div className="rounded-xl border border-border/40 bg-card/30 p-4">
            <div className="font-semibold text-foreground mb-1">Precisa de mais?</div>
            Para volumes maiores, entre em contato pelo suporte.
          </div>
        </section>
      </div>

      {/* Modal: API key gerada */}
      <Dialog open={!!issuedKey} onOpenChange={(o) => !o && setIssuedKey(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {keyExisted ? "Sua chave de API" : "Chave gerada com sucesso!"}
            </DialogTitle>
            <DialogDescription>
              {keyExisted
                ? "Você já tinha uma chave ativa nesse plano. Guarde com segurança — não compartilhe."
                : "Copie e guarde essa chave agora. Trate como uma senha — não compartilhe."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-xs break-all select-all">
            {issuedKey}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={copyKey} className="flex-1">
              <Copy className="w-4 h-4" /> Copiar chave
            </Button>
            <Button variant="outline" onClick={() => setIssuedKey(null)} className="flex-1">
              Fechar
            </Button>
          </div>

          <div className="text-xs text-muted-foreground border-t border-border/40 pt-3 mt-1">
            <strong className="text-foreground">Como usar:</strong> envie o header
            <code className="mx-1 px-1.5 py-0.5 rounded bg-muted/50">Authorization: Bearer SUA_CHAVE</code>
            para os endpoints da API SnyX.
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: entrevista (apenas plano Free) */}
      {applyingPlan && (
        <ApiApplicationModal
          open={!!applyingPlan}
          planSlug={applyingPlan.slug}
          planName={applyingPlan.name}
          onClose={() => setApplyingPlan(null)}
          onApproved={(key) => {
            setApplyingPlan(null);
            setKeyExisted(false);
            setIssuedKey(key);
          }}
        />
      )}
    </div>
  );
}
