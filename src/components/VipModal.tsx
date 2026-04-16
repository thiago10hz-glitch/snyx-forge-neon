import { useState, useEffect } from "react";
import { Zap, Crown, Code, Heart, Check, X, Mic, Globe, Image, MessageCircle, Sparkles, Tv, Shield, Headphones, Palette, Rocket, Server, FileCode, MonitorPlay, Swords, Wand2, ScrollText, Users, Flame, Trophy, Loader2, Ban } from "lucide-react";
import { useMercadoPagoCheckout } from "@/hooks/useMercadoPagoCheckout";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface VipModalProps {
  open: boolean;
  onClose: () => void;
  highlightPlan?: "vip" | "rpg" | "programmer";
}

const vipFeatures = [
  { icon: Heart, text: "Chat Amigo ilimitado", desc: "Converse sem limites com sua IA amiga" },
  { icon: Crown, text: "Modo Premium desbloqueado", desc: "Acesso a funções avançadas do Amigo" },
  { icon: Image, text: "Geração de imagens com IA", desc: "Crie imagens incríveis por comando" },
  { icon: Mic, text: "Envio de áudio por voz", desc: "Fale com a IA pelo microfone" },
  { icon: MessageCircle, text: "Mensagens ilimitadas", desc: "Sem limite diário de mensagens" },
  { icon: Sparkles, text: "IA sem censura", desc: "Respostas completas sem restrições" },
  { icon: Palette, text: "Temas e personalização", desc: "Customize a aparência do chat" },
];

const rpgFeatures = [
  { icon: Swords, text: "RPG com IA avançada", desc: "Aventuras imersivas com narrativa inteligente" },
  { icon: Wand2, text: "Personagens exclusivos", desc: "Crie e use personagens premium ilimitados" },
  { icon: ScrollText, text: "Histórias infinitas", desc: "Narrativas sem limite de contexto" },
  { icon: Flame, text: "Batalhas épicas com IA", desc: "Sistema de combate dinâmico e realista" },
  { icon: Trophy, text: "Rankings e conquistas", desc: "Compita e desbloqueie conquistas únicas" },
  { icon: Users, text: "Multiplayer com amigos", desc: "Jogue com amigos no mesmo universo" },
  { icon: MessageCircle, text: "Mensagens ilimitadas", desc: "Sem limite em todas as sessões" },
  { icon: Image, text: "Geração de cenários", desc: "Imagens dos seus cenários com IA" },
  { icon: Shield, text: "Tudo do VIP incluído", desc: "Todos os benefícios VIP + RPG" },
];

const programmerFeatures = [
  { icon: Code, text: "Criar sites completos com IA", desc: "HTML, CSS, JS gerados automaticamente" },
  { icon: Globe, text: "Publicar sites online", desc: "Deploy automático com link público" },
  { icon: Rocket, text: "Código otimizado e rápido", desc: "Performance máxima nos projetos" },
  { icon: FileCode, text: "Todas as linguagens", desc: "Python, JS, TS, React e mais" },
  { icon: Server, text: "Backend e APIs", desc: "Crie sistemas completos" },
  { icon: MonitorPlay, text: "Preview em tempo real", desc: "Veja o resultado enquanto cria" },
  { icon: MessageCircle, text: "Chat ilimitado com a IA Dev", desc: "Sem limites de mensagens" },
  { icon: Tv, text: "Acesso ao IPTV/Streaming", desc: "Filmes e séries inclusos" },
  { icon: Shield, text: "Tudo do VIP + RPG incluído", desc: "Todos os benefícios anteriores + Dev" },
  { icon: Headphones, text: "Suporte prioritário", desc: "Atendimento rápido" },
];

type Period = "weekly" | "monthly" | "yearly";

const PLAN_PRICES: Record<string, Record<Period, number>> = {
  vip:        { weekly: 25,  monthly: 50,  yearly: 150 },
  rpg:        { weekly: 20,  monthly: 50,  yearly: 120 },
  programmer: { weekly: 100, monthly: 150, yearly: 250 },
};

const PERIOD_LABELS: Record<Period, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

const PERIOD_SUFFIX: Record<Period, string> = {
  weekly: "/sem",
  monthly: "/mês",
  yearly: "/ano",
};


export function VipModal({ open, onClose, highlightPlan = "vip" }: VipModalProps) {
  const { openCheckout, error } = useMercadoPagoCheckout();
  const { user, profile } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("monthly");
  const [isBanned, setIsBanned] = useState(false);

  // Check ban status on open
  useEffect(() => {
    if (!open || !user) return;
    if (profile?.banned_until) {
      const bannedUntil = new Date(profile.banned_until);
      if (bannedUntil > new Date()) {
        setIsBanned(true);
        return;
      }
    }
    setIsBanned(false);
  }, [open, user, profile?.banned_until]);

  if (!open) return null;

  const handleSubscribe = async (plan: "vip" | "rpg" | "programmer") => {
    if (isBanned) {
      toast.error("Sua conta está temporariamente suspensa por tentativa de fraude.");
      return;
    }

    setLoadingPlan(plan);
    const price = PLAN_PRICES[plan][period];
    const periodLabel = PERIOD_LABELS[period].toLowerCase();
    const planNames: Record<string, string> = {
      vip: "SnyX VIP",
      rpg: "SnyX RPG Premium",
      programmer: "SnyX Programador DEV",
    };

    openCheckout({
      title: planNames[plan],
      description: `Assinatura ${periodLabel} ${planNames[plan]}`,
      price,
      quantity: 1,
      userEmail: user?.email || undefined,
      userId: user?.id || "",
    });
  };

  if (isBanned) {
    const bannedUntil = profile?.banned_until ? new Date(profile.banned_until) : null;
    const minutesLeft = bannedUntil ? Math.max(1, Math.ceil((bannedUntil.getTime() - Date.now()) / 60000)) : 0;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="glass-elevated rounded-2xl max-w-md w-full p-8 text-center border border-red-500/30 animate-enter">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <Ban className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Conta Suspensa</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Sua conta foi temporariamente suspensa por tentativa de fraude no sistema de pagamento.
          </p>
          <p className="text-xs text-muted-foreground/60 mb-6">
            Tempo restante: <span className="text-red-400 font-bold">{minutesLeft} min</span>
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-muted/20 text-foreground text-sm font-medium hover:bg-muted/30 transition-all"
          >
            Entendi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-4">
      <div className="glass-elevated rounded-t-2xl sm:rounded-2xl max-w-5xl w-full overflow-hidden animate-enter border border-border/20 max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="relative p-4 sm:p-6 pb-3 sm:pb-4 shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 transition-all z-10"
          >
            <X size={18} />
          </button>
          <div className="relative flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/15 shadow-lg shadow-primary/10">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">SnyX Premium</h2>
              <p className="text-xs text-muted-foreground/50">Escolha o plano ideal para você</p>
            </div>
          </div>

          {/* Period Selector */}
          <div className="relative flex gap-1 bg-muted/10 rounded-xl p-1 border border-border/10">
            {(["weekly", "monthly", "yearly"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all duration-300 ${
                  period === p
                    ? "bg-primary/15 text-primary border border-primary/20 shadow-md shadow-primary/5"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/10"
                }`}
              >
                {PERIOD_LABELS[p]}
                {p === "yearly" && (
                  <span className="ml-1 text-[8px] text-emerald-400 font-bold">ECONOMIA</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div className="p-3 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 overflow-y-auto flex-1 scrollbar-thin">
          {/* VIP Plan */}
          <div className={`rounded-2xl border p-3 sm:p-5 transition-all flex flex-col ${
            highlightPlan === "vip"
              ? "border-yellow-500/25 bg-yellow-500/3 ring-1 ring-yellow-500/10"
              : "border-border/15 bg-muted/5"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Crown size={18} className="text-yellow-400" />
              <span className="text-base font-bold text-foreground">VIP</span>
              {highlightPlan === "vip" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-yellow-500/10 text-yellow-400 font-bold animate-pulse">POPULAR</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/50 mb-3">Para quem quer o máximo do chat</p>
            
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-bold border border-yellow-500/20">👑 VIP</span>
              </div>
              <span className="text-3xl font-black text-foreground">R${PLAN_PRICES.vip[period]}</span>
              <span className="text-xs text-muted-foreground/40">{PERIOD_SUFFIX[period]}</span>
            </div>

            <div className="space-y-2.5 flex-1">
              {vipFeatures.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 animate-slide-up-fade" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="w-5 h-5 rounded-md bg-emerald-500/8 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={11} className="text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-foreground/90">{f.text}</span>
                    <p className="text-[10px] text-muted-foreground/40">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleSubscribe("vip")}
              disabled={!!loadingPlan}
              className="mt-4 flex items-center justify-center gap-2 w-full bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 font-semibold rounded-xl py-3 transition-all duration-300 text-sm border border-yellow-500/15 hover:shadow-lg hover:shadow-yellow-500/5 disabled:opacity-50"
            >
              {loadingPlan === "vip" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
              ASSINAR VIP
            </button>
          </div>

          {/* RPG Premium Plan */}
          <div className={`rounded-2xl border p-3 sm:p-5 transition-all flex flex-col relative ${
            highlightPlan === "rpg"
              ? "border-purple-500/25 bg-purple-500/3 ring-1 ring-purple-500/10"
              : "border-border/15 bg-muted/5"
          }`}>
            <div className="absolute -top-2.5 right-4">
              <span className="text-[9px] px-2 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold shadow-lg shadow-purple-500/20">
                ⚔️ RPG
              </span>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <Swords size={18} className="text-purple-400" />
              <span className="text-base font-bold text-foreground">RPG Premium</span>
            </div>
            <p className="text-[11px] text-muted-foreground/50 mb-3">A experiência RPG definitiva</p>

            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-bold border border-purple-500/20">⚔️ RPG Premium</span>
              </div>
              <span className="text-3xl font-black text-foreground">R${PLAN_PRICES.rpg[period]}</span>
              <span className="text-xs text-muted-foreground/40">{PERIOD_SUFFIX[period]}</span>
            </div>

            <div className="space-y-2.5 flex-1">
              {rpgFeatures.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 animate-slide-up-fade" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="w-5 h-5 rounded-md bg-purple-500/8 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={11} className="text-purple-400" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-foreground/90">{f.text}</span>
                    <p className="text-[10px] text-muted-foreground/40">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleSubscribe("rpg")}
              disabled={!!loadingPlan}
              className="mt-4 flex items-center justify-center gap-2 w-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-purple-400 font-semibold rounded-xl py-3 transition-all duration-300 text-sm border border-purple-500/15 hover:shadow-lg hover:shadow-purple-500/10 disabled:opacity-50"
            >
              {loadingPlan === "rpg" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
              ASSINAR RPG
            </button>
          </div>

          {/* Programmer Plan */}
          <div className={`rounded-2xl border p-3 sm:p-5 transition-all flex flex-col relative ${
            highlightPlan === "programmer"
              ? "border-cyan-500/25 bg-cyan-500/3 ring-1 ring-cyan-500/10"
              : "border-border/15 bg-muted/5"
          }`}>
            <div className="absolute -top-2.5 right-4">
              <span className="text-[9px] px-2 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/20">
                🚀 MELHOR
              </span>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <Code size={18} className="text-cyan-400" />
              <span className="text-base font-bold text-foreground">Programador</span>
            </div>
            <p className="text-[11px] text-muted-foreground/50 mb-3">Crie projetos profissionais com IA</p>

            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-bold border border-cyan-500/20">💻 DEV</span>
              </div>
              <span className="text-3xl font-black text-foreground">R${PLAN_PRICES.programmer[period]}</span>
              <span className="text-xs text-muted-foreground/40">{PERIOD_SUFFIX[period]}</span>
            </div>

            <div className="space-y-2.5 flex-1">
              {programmerFeatures.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 animate-slide-up-fade" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="w-5 h-5 rounded-md bg-cyan-500/8 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={11} className="text-cyan-400" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-foreground/90">{f.text}</span>
                    <p className="text-[10px] text-muted-foreground/40">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleSubscribe("programmer")}
              disabled={!!loadingPlan}
              className="mt-4 flex items-center justify-center gap-2 w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-xl py-3 transition-all duration-300 text-sm shadow-lg shadow-cyan-500/15 hover:shadow-cyan-500/25 disabled:opacity-50"
            >
              {loadingPlan === "programmer" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              ASSINAR DEV
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 shrink-0">
          {error && (
            <p className="text-[11px] text-red-400 text-center mb-2">{error}</p>
          )}
          <p className="text-[10px] text-muted-foreground/30 text-center">
            Pagamento seguro via Mercado Pago • Pix, cartão, boleto • Cancele quando quiser
          </p>
        </div>
      </div>
    </div>
  );
}
