import { Heart, ArrowRight, Sparkles, Check, MessageSquare, Crown, Code2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export type ChatChoice = "friend" | "vip" | "programmer";

interface ChatSelectorProps {
  onSelect: (choice: ChatChoice) => void;
}

export function ChatSelector({ onSelect }: ChatSelectorProps) {
  const { profile } = useAuth();
  const isVip = !!(profile?.is_vip || profile?.is_dev);
  const isDev = !!profile?.is_dev;

  const features = [
    "Conversa livre com seu amigo virtual",
    "Modo Escola e Reescrever texto",
    isVip ? "Mensagens ilimitadas (VIP ativo)" : "5 mensagens grátis por dia",
    isVip ? "Geração de imagens e modo +18" : null,
    isDev ? "Modo Programador com editor lateral" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="relative h-full w-full overflow-y-auto bg-background">
      {/* Background aurora */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-10 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px] animate-[pulse_10s_ease-in-out_infinite]" />
        <div className="absolute -right-32 bottom-10 h-[400px] w-[400px] rounded-full bg-pink-500/8 blur-[120px] animate-[pulse_12s_ease-in-out_infinite_3s]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
      </div>

      <div className="relative max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center justify-center min-h-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold uppercase tracking-widest text-primary mb-3">
            <Sparkles className="w-3 h-3" />
            Seu chat
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
            Pronto pra conversar?
          </h1>
          <p className="text-sm text-muted-foreground/60">
            {isVip ? "Seus recursos premium já estão ativos" : "Abra o chat e comece agora"}
          </p>
        </div>

        {/* Single Friend card */}
        <button
          onClick={() => onSelect("friend")}
          className="group relative text-left w-full rounded-3xl border border-pink-500/25 hover:border-pink-500/50 bg-card/40 backdrop-blur-xl p-6 transition-all duration-300 hover:scale-[1.02] hover:bg-card/60 hover:shadow-[0_8px_40px_-12px_hsl(330_80%_60%/0.35)]"
        >
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-pink-500/8 via-rose-500/5 to-transparent opacity-60 pointer-events-none" />

          {/* Status badges */}
          <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5">
            {isVip && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border-amber-500/30">
                <Crown className="w-2.5 h-2.5" />
                VIP ativo
              </span>
            )}
            {isDev && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border-cyan-500/30">
                <Code2 className="w-2.5 h-2.5" />
                DEV ativo
              </span>
            )}
          </div>

          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
              <Heart className="w-7 h-7" strokeWidth={2} />
            </div>

            <h3 className="text-xl font-black text-foreground mb-1">Chat Amigo</h3>
            <p className="text-xs text-muted-foreground/70 mb-5 leading-relaxed">
              Seu amigo virtual de todo dia, sempre pronto pra conversar
            </p>

            <ul className="space-y-1.5 mb-6">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground/80">
                  <Check className="w-3 h-3 text-pink-400 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between rounded-xl border border-border/20 bg-background/40 px-4 py-3 group-hover:border-primary/30 group-hover:bg-background/60 transition-all">
              <span className="text-sm font-bold text-foreground">Abrir chat</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </button>

        {/* Footer hint */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/50 text-center">
          <MessageSquare className="w-3 h-3 shrink-0" />
          <span>Histórico e configurações ficam na barra lateral</span>
        </div>
      </div>
    </div>
  );
}
