import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { TiltCard } from "@/components/TiltCard";
import { ArrowLeft, Gamepad2, Sparkles, Zap, Shield, Download, Star, Crown, Clock } from "lucide-react";
const InfinityIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>
);

export default function PackSteam() {
  const { profile, user } = useAuth();
  const { openCheckout, isOpen, CheckoutForm, closeCheckout } = useStripeCheckout();
  const hasAccess = profile?.is_vip || profile?.is_dev || profile?.is_pack_steam;

  const handleBuyPackSteam = () => {
    openCheckout({
      priceId: "pack_steam_lifetime",
      quantity: 1,
      customerEmail: user?.email || undefined,
      userId: user?.id || "",
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  if (isOpen && CheckoutForm) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-2xl w-full glass-elevated rounded-2xl overflow-hidden border border-border/20">
          <div className="p-4 flex items-center justify-between border-b border-border/10">
            <h2 className="text-sm font-bold">Finalizar Pagamento — Pack Steam</h2>
            <button onClick={closeCheckout} className="p-1.5 rounded-xl text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 transition-all">
              ✕
            </button>
          </div>
          <PaymentTestModeBanner />
          <div className="p-4">
            <CheckoutForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-green-500/6 blur-[120px] animate-glow-pulse" />
        <div className="absolute bottom-20 left-1/4 h-64 w-64 rounded-full bg-emerald-500/4 blur-[100px] animate-glow-pulse" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/3 right-1/3 h-72 w-72 rounded-full bg-green-400/3 blur-[110px] animate-glow-pulse" style={{ animationDelay: '5s' }} />
      </div>

      {/* Header */}
      <header className="border-b border-border/8 glass sticky top-0 z-10">
        <div className="h-14 flex items-center px-4 sm:px-6 gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-xl text-muted-foreground/50 hover:text-foreground hover:bg-muted/15 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/15">
              <Gamepad2 className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold">Pack Steam</h1>
              <p className="text-[9px] text-muted-foreground/40 hidden sm:block">+40.000 jogos • Acesso vitalício</p>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-2xl mx-auto p-5 sm:p-8 mt-6 sm:mt-12 space-y-6">
        {/* Hero Card */}
        <div className="rounded-3xl border border-green-500/15 overflow-hidden glass-elevated animate-fade-in-up relative">
          {/* Glow border effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-green-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
          
          <div className="relative p-6 sm:p-10 text-center space-y-6">
            {/* Icon */}
            <div className="relative mx-auto w-fit">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-green-500/25 via-green-500/10 to-emerald-500/5 flex items-center justify-center border border-green-500/20 shadow-2xl shadow-green-500/15">
                <Gamepad2 className="w-10 h-10 sm:w-12 sm:h-12 text-green-400" />
              </div>
              <div className="absolute -inset-5 rounded-3xl bg-green-500/8 blur-2xl -z-10 animate-breathe" />
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center border-2 border-background shadow-lg shadow-green-500/30">
                <Crown className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-green-400 via-emerald-300 to-green-400 bg-clip-text text-transparent">
                Pack Steam
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground/60 max-w-md mx-auto leading-relaxed">
                Acesse mais de <span className="text-green-400 font-bold">40.000 jogos</span> da Steam com acesso <span className="text-green-400 font-bold">vitalício</span>
              </p>
            </div>

            {/* Price - Lifetime */}
            <div className="relative">
              <div className="inline-flex flex-col items-center gap-1 px-8 py-5 rounded-2xl bg-green-500/5 border border-green-500/15">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg text-muted-foreground/40 line-through">$60</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl sm:text-6xl font-black text-foreground">$30</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <InfinityIcon className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-bold text-green-400">Acesso Vitalício</span>
                </div>
              </div>
              {/* Sale badge */}
              <div className="absolute -top-3 -right-3 sm:-top-3 sm:-right-6 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-black rotate-12 shadow-lg shadow-primary/30">
                -50% OFF
              </div>
            </div>

            <p className="text-xs text-muted-foreground/30">Pagamento único • Sem mensalidade • Para sempre</p>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <FeatureCard icon={Gamepad2} title="+40.000 Jogos" description="Biblioteca gigante com os melhores títulos" />
          <FeatureCard icon={Zap} title="Instalação Rápida" description="Configure em poucos minutos" />
          <FeatureCard icon={Shield} title="100% Seguro" description="Processo confiável, sem riscos" />
          <FeatureCard icon={Star} title="Atualizações" description="Novos jogos sempre" />
        </div>

        {/* Highlights bar */}
        <div className="flex items-center justify-center gap-4 sm:gap-8 py-4 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <HighlightStat icon={Gamepad2} value="40K+" label="Jogos" />
          <div className="w-px h-8 bg-border/15" />
          <HighlightStat icon={InfinityIcon} value="∞" label="Vitalício" />
          <div className="w-px h-8 bg-border/15" />
          <HighlightStat icon={Zap} value="5min" label="Setup" />
        </div>

        {/* How it works */}
        <div className="rounded-3xl border border-border/10 glass-elevated p-6 sm:p-8 space-y-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-lg font-bold text-center flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-green-400" />
            Como funciona?
          </h3>
          <div className="space-y-4">
            <Step number={1} title="Adquira o Pack Steam" description="Entre em contato via WhatsApp e faça o pagamento único de $30" />
            <Step number={2} title="Acesso ativado" description="Seu Pack Steam é ativado instantaneamente após confirmação" />
            <Step number={3} title="Baixe o App" description="Faça o download do SnyX App na aba Downloads" />
            <Step number={4} title="Jogue para sempre!" description="Aproveite +40.000 jogos com acesso vitalício" />
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4 pb-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {hasAccess ? (
            <Link
              to="/downloads"
              className="inline-flex items-center gap-2.5 px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl transition-all text-sm shadow-xl shadow-green-500/25 hover:shadow-green-500/40 active:scale-[0.98] hover:-translate-y-0.5"
            >
              <Download className="w-5 h-5" />
              Baixar App e Começar a Jogar
            </Link>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleBuyPackSteam}
                className="inline-flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-2xl transition-all text-sm shadow-xl shadow-green-500/25 hover:shadow-green-500/40 active:scale-[0.98] hover:-translate-y-0.5"
              >
                <Sparkles className="w-5 h-5" />
                Adquirir Pack Steam — $30 Vitalício
              </button>
              <p className="text-xs text-muted-foreground/30">
                Pagamento seguro via Stripe • Acesso imediato
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <TiltCard className="rounded-2xl border border-border/10 glass p-4 sm:p-5 space-y-2.5 hover:border-green-500/15 transition-all duration-300 group" glareColor="rgba(16, 185, 129, 0.15)">
      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/15 group-hover:bg-green-500/15 transition-colors">
        <Icon className="w-5 h-5 text-green-400" />
      </div>
      <h4 className="text-sm font-bold">{title}</h4>
      <p className="text-[11px] text-muted-foreground/50 leading-relaxed">{description}</p>
    </TiltCard>
  );
}

function HighlightStat({ icon: Icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Icon className="w-4 h-4 text-green-400/60" />
      <span className="text-lg font-black text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground/40 font-medium">{label}</span>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 group">
      <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-green-500/15 transition-colors">
        <span className="text-xs font-black text-green-400">{number}</span>
      </div>
      <div className="pt-1">
        <h4 className="text-sm font-bold">{title}</h4>
        <p className="text-xs text-muted-foreground/50 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
