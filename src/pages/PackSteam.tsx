import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Gamepad2, Sparkles, Zap, Shield, Download, CheckCircle2, Star } from "lucide-react";

export default function PackSteam() {
  const { profile } = useAuth();
  const hasAccess = profile?.is_vip || profile?.is_dev || profile?.is_pack_steam;

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-72 w-72 rounded-full bg-green-500/5 blur-[100px] animate-glow-pulse" />
        <div className="absolute bottom-20 left-1/4 h-56 w-56 rounded-full bg-primary/3 blur-[80px] animate-glow-pulse" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 right-1/4 h-64 w-64 rounded-full bg-green-500/3 blur-[90px] animate-glow-pulse" style={{ animationDelay: '5s' }} />
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
              <p className="text-[9px] text-muted-foreground/40 hidden sm:block">+40.000 jogos disponíveis</p>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-2xl mx-auto p-5 sm:p-8 mt-6 sm:mt-12 space-y-6">
        {/* Hero Card */}
        <div className="rounded-3xl border border-green-500/10 overflow-hidden glass-elevated animate-fade-in-up">
          <div className="relative p-6 sm:p-10 text-center space-y-5">
            {/* Icon */}
            <div className="relative mx-auto w-fit">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center border border-green-500/15 shadow-2xl shadow-green-500/10">
                <Gamepad2 className="w-10 h-10 sm:w-12 sm:h-12 text-green-400" />
              </div>
              <div className="absolute -inset-4 rounded-3xl bg-green-500/8 blur-xl -z-10 animate-breathe" />
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center border-2 border-background shadow-lg">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
                Pack Steam
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground/50 max-w-md mx-auto leading-relaxed">
                Acesse mais de <span className="text-green-400 font-bold">40.000 jogos</span> da Steam por um preço inacreditável
              </p>
            </div>

            {/* Price */}
            <div className="flex items-center justify-center gap-3">
              <div className="relative">
                <span className="text-5xl sm:text-6xl font-black text-foreground">$30</span>
                <span className="text-lg text-muted-foreground/40 font-medium ml-1">/mês</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground/30">Pagamento único mensal • Cancele quando quiser</p>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <FeatureCard icon={Gamepad2} title="+40.000 Jogos" description="Biblioteca gigante com os melhores títulos da Steam" />
          <FeatureCard icon={Zap} title="Instalação Rápida" description="Configure em poucos minutos, sem complicação" />
          <FeatureCard icon={Shield} title="100% Seguro" description="Processo seguro e confiável, sem riscos" />
          <FeatureCard icon={Star} title="Atualizações" description="Novos jogos adicionados constantemente" />
        </div>

        {/* How it works */}
        <div className="rounded-3xl border border-border/10 glass-elevated p-6 sm:p-8 space-y-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-lg font-bold text-center">Como funciona?</h3>
          <div className="space-y-4">
            <Step number={1} title="Adquira o Pack Steam" description="Entre em contato via WhatsApp para adquirir seu acesso" />
            <Step number={2} title="Receba seu acesso" description="Após o pagamento, seu Pack Steam é ativado instantaneamente" />
            <Step number={3} title="Baixe o App" description="Faça o download do SnyX App na aba Downloads" />
            <Step number={4} title="Aproveite!" description="Instale e jogue mais de 40.000 jogos da Steam" />
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {hasAccess ? (
            <Link
              to="/downloads"
              className="inline-flex items-center gap-2.5 px-8 py-4 bg-green-500 hover:bg-green-500/90 text-white font-bold rounded-2xl transition-all text-sm shadow-xl shadow-green-500/20 hover:shadow-green-500/30 active:scale-[0.98]"
            >
              <Download className="w-5 h-5" />
              Baixar App e Começar
            </Link>
          ) : (
            <div className="space-y-3">
              <a
                href="https://wa.me/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-8 py-4 bg-green-500 hover:bg-green-500/90 text-white font-bold rounded-2xl transition-all text-sm shadow-xl shadow-green-500/20 hover:shadow-green-500/30 active:scale-[0.98]"
              >
                <Sparkles className="w-5 h-5" />
                Adquirir Pack Steam — $30/mês
              </a>
              <p className="text-xs text-muted-foreground/30">
                Entre em contato pelo WhatsApp para adquirir
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
    <div className="rounded-2xl border border-border/10 glass p-4 sm:p-5 space-y-2">
      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/15">
        <Icon className="w-5 h-5 text-green-400" />
      </div>
      <h4 className="text-sm font-bold">{title}</h4>
      <p className="text-xs text-muted-foreground/50 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-xs font-bold text-green-400">{number}</span>
      </div>
      <div>
        <h4 className="text-sm font-bold">{title}</h4>
        <p className="text-xs text-muted-foreground/50">{description}</p>
      </div>
    </div>
  );
}
