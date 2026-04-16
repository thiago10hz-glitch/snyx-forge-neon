import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMercadoPagoCheckout } from "@/hooks/useMercadoPagoCheckout";
import { TiltCard } from "@/components/TiltCard";
import { ArrowLeft, Gamepad2, Sparkles, Zap, Shield, Download, Star, Crown, Clock, ChevronRight, Trophy, Flame, Users, Monitor } from "lucide-react";

const InfinityIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>
);

const POPULAR_GAMES = [
  "GTA V", "CS2", "Elden Ring", "Cyberpunk 2077", "Red Dead 2",
  "Hogwarts Legacy", "God of War", "FIFA 24", "Forza Horizon 5", "Minecraft",
  "The Witcher 3", "Valorant", "Apex Legends", "Rust", "ARK",
];

export default function PackSteam() {
  const { profile, user } = useAuth();
  const { openCheckout, error } = useMercadoPagoCheckout();
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
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-green-500/8 blur-[160px] animate-glow-pulse" />
        <div className="absolute bottom-10 left-10 h-80 w-80 rounded-full bg-emerald-500/6 blur-[120px] animate-glow-pulse" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-green-400/4 blur-[140px] animate-glow-pulse" style={{ animationDelay: '6s' }} />
      </div>

      {/* Header */}
      <header className="border-b border-border/8 glass sticky top-0 z-10">
        <div className="h-12 flex items-center px-4 sm:px-6 gap-3">
          <Link to="/" className="p-1.5 -ml-1 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/15 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center border border-green-500/20 shadow-lg shadow-green-500/10">
              <Gamepad2 className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold">Pack Steam</h1>
              <p className="text-[9px] text-muted-foreground/40 hidden sm:block">+40.000 jogos • Acesso vitalício</p>
            </div>
          </div>
          {hasAccess && (
            <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-bold border border-green-500/20">
              ✅ Ativo
            </span>
          )}
        </div>
      </header>

      <div className="relative z-10 max-w-2xl mx-auto p-4 sm:p-6 mt-2 sm:mt-6 space-y-5">

        {/* Hero Section */}
        <div className="rounded-2xl border border-green-500/15 overflow-hidden glass-elevated animate-fade-in-up relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/8 via-transparent to-emerald-500/5 pointer-events-none" />
          
          {/* Decorative grid */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          <div className="relative p-6 sm:p-10 text-center space-y-5">
            {/* Icon hero */}
            <div className="relative mx-auto w-fit">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-green-500/25 via-green-500/10 to-emerald-500/5 flex items-center justify-center border border-green-500/20 shadow-2xl shadow-green-500/20">
                <Gamepad2 className="w-10 h-10 sm:w-12 sm:h-12 text-green-400" />
              </div>
              <div className="absolute -inset-4 rounded-3xl bg-green-500/10 blur-2xl -z-10 animate-breathe" />
              <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center border-2 border-background shadow-lg shadow-green-500/40">
                <Crown className="w-3.5 h-3.5 text-white" />
              </div>
              {/* Floating particles */}
              <div className="absolute -left-6 top-2 w-2 h-2 rounded-full bg-green-400/40 animate-float" style={{ animationDelay: '0s' }} />
              <div className="absolute -right-8 bottom-4 w-1.5 h-1.5 rounded-full bg-emerald-400/50 animate-float" style={{ animationDelay: '1s' }} />
              <div className="absolute left-4 -bottom-4 w-1 h-1 rounded-full bg-green-300/40 animate-float" style={{ animationDelay: '2s' }} />
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-green-400 via-emerald-300 to-green-400 bg-clip-text text-transparent tracking-tight">
                Pack Steam
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground/60 max-w-md mx-auto leading-relaxed">
                Acesse mais de <span className="text-green-400 font-bold">40.000 jogos</span> da Steam com acesso <span className="text-green-400 font-bold">vitalício</span>
              </p>
            </div>

            {/* Price Card */}
            <div className="relative inline-block">
              <div className="relative px-8 py-5 rounded-2xl bg-gradient-to-br from-green-500/10 via-green-500/5 to-emerald-500/10 border border-green-500/20 shadow-xl shadow-green-500/5">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-base text-muted-foreground/40 line-through font-medium">R$60</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">-50%</span>
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-sm text-muted-foreground/50 font-bold">R$</span>
                  <span className="text-5xl sm:text-6xl font-black text-foreground tracking-tight">30</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <InfinityIcon className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-bold text-green-400 tracking-wide">ACESSO VITALÍCIO</span>
                </div>
                <p className="text-[10px] text-muted-foreground/30 mt-2">Pagamento único • Sem mensalidade</p>
              </div>
              {/* Glow */}
              <div className="absolute -inset-1 rounded-2xl bg-green-500/5 blur-lg -z-10" />
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-2 animate-fade-in-up" style={{ animationDelay: '0.08s' }}>
          {[
            { icon: Gamepad2, value: "40K+", label: "Jogos", color: "green" },
            { icon: InfinityIcon, value: "∞", label: "Vitalício", color: "emerald" },
            { icon: Zap, value: "5min", label: "Setup", color: "green" },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-border/10 glass p-3 flex flex-col items-center gap-1 hover:border-green-500/15 transition-all group">
              <s.icon className="w-4 h-4 text-green-400/60 group-hover:text-green-400 transition-colors" />
              <span className="text-lg font-black text-foreground">{s.value}</span>
              <span className="text-[9px] text-muted-foreground/40 font-medium">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 animate-fade-in-up" style={{ animationDelay: '0.12s' }}>
          <FeatureCard icon={Gamepad2} title="+40.000 Jogos" description="Biblioteca gigante da Steam" />
          <FeatureCard icon={Zap} title="Setup Rápido" description="Configure em 5 minutos" />
          <FeatureCard icon={Shield} title="100% Seguro" description="Processo confiável e seguro" />
          <FeatureCard icon={Star} title="Atualizações" description="Novos jogos adicionados" />
          <FeatureCard icon={Monitor} title="Qualquer PC" description="Funciona em qualquer máquina" />
          <FeatureCard icon={Users} title="Multiplayer" description="Jogue com seus amigos" />
          <FeatureCard icon={Trophy} title="Conquistas" description="Desbloqueie achievements" />
          <FeatureCard icon={Flame} title="AAA Games" description="Os melhores lançamentos" />
        </div>

        {/* Popular Games Marquee */}
        <div className="rounded-2xl border border-border/10 glass-elevated overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.16s' }}>
          <div className="px-4 pt-3 pb-2">
            <h3 className="text-xs font-bold text-center flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-green-400" />
              Jogos Populares Inclusos
            </h3>
          </div>
          <div className="relative overflow-hidden py-2 px-1">
            <div className="flex gap-2 animate-marquee">
              {[...POPULAR_GAMES, ...POPULAR_GAMES].map((game, i) => (
                <span key={i} className="shrink-0 text-[10px] px-3 py-1.5 rounded-lg bg-muted/10 border border-border/10 text-muted-foreground/60 font-medium hover:text-green-400 hover:border-green-500/20 transition-colors whitespace-nowrap">
                  🎮 {game}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-border/10 glass-elevated p-5 sm:p-6 space-y-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-sm font-bold text-center flex items-center justify-center gap-1.5">
            <Clock className="w-4 h-4 text-green-400" />
            Como funciona?
          </h3>
          <div className="space-y-0">
            <Step number={1} title="Adquira o Pack Steam" description="Pagamento único de R$30 via Mercado Pago" isLast={false} />
            <Step number={2} title="Acesso ativado" description="Ativação instantânea na sua conta" isLast={false} />
            <Step number={3} title="Baixe o App" description="Download na aba Downloads do SnyX" isLast={false} />
            <Step number={4} title="Jogue para sempre!" description="+40.000 jogos com acesso vitalício" isLast={true} />
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-3 pb-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {hasAccess ? (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-bold text-green-400">Pack Steam Ativo</span>
              </div>
              <div>
                <Link
                  to="/downloads"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold rounded-xl transition-all text-sm shadow-xl shadow-green-500/25 hover:shadow-green-500/40 active:scale-[0.98] hover:-translate-y-0.5 group"
                >
                  <Download className="w-5 h-5" />
                  Baixar App e Jogar
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleBuyPackSteam}
                className="relative inline-flex items-center gap-2.5 px-10 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold rounded-xl transition-all text-sm shadow-xl shadow-green-500/30 hover:shadow-green-500/50 active:scale-[0.98] hover:-translate-y-0.5 group"
              >
                <Sparkles className="w-5 h-5" />
                Adquirir Pack Steam — R$30
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                {/* Button glow */}
                <div className="absolute -inset-1 rounded-xl bg-green-500/20 blur-lg -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <p className="text-[10px] text-muted-foreground/30">
                Pagamento seguro via Mercado Pago • Pix, cartão, boleto • Acesso imediato
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Marquee animation style */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-8px) scale(1.2); opacity: 0.8; }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <TiltCard className="rounded-xl border border-border/10 glass p-3 sm:p-4 space-y-2 hover:border-green-500/15 transition-all duration-300 group" glareColor="rgba(16, 185, 129, 0.15)">
      <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/15 group-hover:bg-green-500/15 group-hover:shadow-lg group-hover:shadow-green-500/10 transition-all">
        <Icon className="w-4 h-4 text-green-400" />
      </div>
      <h4 className="text-xs font-bold">{title}</h4>
      <p className="text-[10px] text-muted-foreground/50 leading-relaxed">{description}</p>
    </TiltCard>
  );
}

function Step({ number, title, description, isLast }: { number: number; title: string; description: string; isLast: boolean }) {
  return (
    <div className="flex items-start gap-3 group relative">
      {/* Connecting line */}
      {!isLast && (
        <div className="absolute left-[13px] top-8 w-px h-6 bg-gradient-to-b from-green-500/20 to-transparent" />
      )}
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500/15 to-emerald-500/10 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:from-green-500/25 group-hover:to-emerald-500/15 group-hover:shadow-md group-hover:shadow-green-500/10 transition-all">
        <span className="text-[10px] font-black text-green-400">{number}</span>
      </div>
      <div className="pt-0.5 pb-4">
        <h4 className="text-xs font-bold group-hover:text-green-400 transition-colors">{title}</h4>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
