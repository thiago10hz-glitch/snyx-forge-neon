import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMercadoPagoCheckout } from "@/hooks/useMercadoPagoCheckout";
import { TiltCard } from "@/components/TiltCard";
import { ArrowLeft, Gamepad2, Sparkles, Zap, Shield, Download, Star, Crown, Clock } from "lucide-react";
const InfinityIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>
);

export default function PackSteam() {
  const { profile, user } = useAuth();
  const { openCheckout, isLoading, error } = useMercadoPagoCheckout();
  const hasAccess = profile?.is_vip || profile?.is_dev || profile?.is_pack_steam;

  const handleBuyPackSteam = () => {
    openCheckout({
      title: "Pack Steam — Acesso Vitalício",
      description: "+40.000 jogos da Steam com acesso vitalício",
      price: 30,
      quantity: 1,
      userEmail: user?.email || undefined,
      userId: user?.id || "",
    });
  };

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
        <div className="h-11 flex items-center px-3 sm:px-5 gap-2.5">
          <Link to="/" className="p-1.5 -ml-1 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/15 transition-all">
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-green-500/10 flex items-center justify-center border border-green-500/15">
              <Gamepad2 className="w-3.5 h-3.5 text-green-400" />
            </div>
            <div>
              <h1 className="text-xs font-bold">Pack Steam</h1>
              <p className="text-[8px] text-muted-foreground/40 hidden sm:block">+40.000 jogos • Acesso vitalício</p>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-xl mx-auto p-4 sm:p-6 mt-4 sm:mt-8 space-y-4">
        {/* Hero Card */}
        <div className="rounded-2xl border border-green-500/15 overflow-hidden glass-elevated animate-fade-in-up relative">
          {/* Glow border effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
          
          <div className="relative p-5 sm:p-7 text-center space-y-4">
            <div className="relative mx-auto w-fit">
              <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-green-500/25 via-green-500/10 to-emerald-500/5 flex items-center justify-center border border-green-500/20 shadow-xl shadow-green-500/15">
                <Gamepad2 className="w-8 h-8 sm:w-9 sm:h-9 text-green-400" />
              </div>
              <div className="absolute -inset-3 rounded-2xl bg-green-500/8 blur-xl -z-10 animate-breathe" />
              <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-background shadow-md shadow-green-500/30">
                <Crown className="w-3 h-3 text-white" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-green-400 via-emerald-300 to-green-400 bg-clip-text text-transparent">
                Pack Steam
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground/60 max-w-sm mx-auto leading-relaxed">
                Acesse mais de <span className="text-green-400 font-bold">40.000 jogos</span> da Steam com acesso <span className="text-green-400 font-bold">vitalício</span>
              </p>
            </div>

            {/* Price - Lifetime */}
            <div className="relative">
              <div className="inline-flex flex-col items-center gap-0.5 px-6 py-3.5 rounded-xl bg-green-500/5 border border-green-500/15">
                <span className="text-sm text-muted-foreground/40 line-through">$60</span>
                <span className="text-4xl sm:text-5xl font-black text-foreground">$30</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <InfinityIcon className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs font-bold text-green-400">Acesso Vitalício</span>
                </div>
              </div>
              <div className="absolute -top-2 -right-2 sm:-top-2 sm:-right-4 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-black rotate-12 shadow-md shadow-primary/30">
                -50% OFF
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/30">Pagamento único • Sem mensalidade • Para sempre</p>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-2 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <FeatureCard icon={Gamepad2} title="+40.000 Jogos" description="Biblioteca gigante" />
          <FeatureCard icon={Zap} title="Instalação Rápida" description="Configure em minutos" />
          <FeatureCard icon={Shield} title="100% Seguro" description="Processo confiável" />
          <FeatureCard icon={Star} title="Atualizações" description="Novos jogos sempre" />
        </div>

        {/* Highlights bar */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 py-3 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <HighlightStat icon={Gamepad2} value="40K+" label="Jogos" />
          <div className="w-px h-8 bg-border/15" />
          <HighlightStat icon={InfinityIcon} value="∞" label="Vitalício" />
          <div className="w-px h-8 bg-border/15" />
          <HighlightStat icon={Zap} value="5min" label="Setup" />
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-border/10 glass-elevated p-4 sm:p-6 space-y-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-sm font-bold text-center flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-green-400" />
            Como funciona?
          </h3>
          <div className="space-y-3">
            <Step number={1} title="Adquira o Pack Steam" description="Pagamento único de $30" />
            <Step number={2} title="Acesso ativado" description="Ativação instantânea" />
            <Step number={3} title="Baixe o App" description="Download na aba Downloads" />
            <Step number={4} title="Jogue para sempre!" description="+40.000 jogos vitalício" />
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-3 pb-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {hasAccess ? (
            <Link
              to="/downloads"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all text-xs shadow-lg shadow-green-500/25 hover:shadow-green-500/40 active:scale-[0.98] hover:-translate-y-0.5"
            >
              <Download className="w-5 h-5" />
              Baixar App e Começar a Jogar
            </Link>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleBuyPackSteam}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-xl transition-all text-xs shadow-lg shadow-green-500/25 hover:shadow-green-500/40 active:scale-[0.98] hover:-translate-y-0.5"
              >
                <Sparkles className="w-5 h-5" />
                Adquirir Pack Steam — $30 Vitalício
              </button>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <p className="text-xs text-muted-foreground/30">
                Pagamento seguro via Mercado Pago • Acesso imediato
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
    <TiltCard className="rounded-xl border border-border/10 glass p-3 sm:p-4 space-y-2 hover:border-green-500/15 transition-all duration-300 group" glareColor="rgba(16, 185, 129, 0.15)">
      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/15 group-hover:bg-green-500/15 transition-colors">
        <Icon className="w-4 h-4 text-green-400" />
      </div>
      <h4 className="text-xs font-bold">{title}</h4>
      <p className="text-[10px] text-muted-foreground/50 leading-relaxed">{description}</p>
    </TiltCard>
  );
}

function HighlightStat({ icon: Icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className="w-3.5 h-3.5 text-green-400/60" />
      <span className="text-base font-black text-foreground">{value}</span>
      <span className="text-[9px] text-muted-foreground/40 font-medium">{label}</span>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 group">
      <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-green-500/15 transition-colors">
        <span className="text-[10px] font-black text-green-400">{number}</span>
      </div>
      <div className="pt-0.5">
        <h4 className="text-xs font-bold">{title}</h4>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
