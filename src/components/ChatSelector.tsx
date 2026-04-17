import { Heart, Crown, Code, Lock, ArrowRight, Sparkles, Check, Star, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { VipModal } from "./VipModal";

export type ChatChoice = "friend" | "vip" | "programmer";

interface ChatSelectorProps {
  onSelect: (choice: ChatChoice) => void;
}

const CHATS = [
  {
    key: "friend" as const,
    icon: Heart,
    title: "Amigo",
    tagline: "Seu amigo virtual de todo dia",
    requires: null as null | "vip" | "programmer",
    badge: "Grátis",
    badgeClass: "bg-muted/30 text-muted-foreground border-border/30",
    iconColor: "text-pink-400",
    iconBg: "bg-pink-500/10",
    border: "border-pink-500/20 hover:border-pink-500/40",
    glow: "hover:shadow-[0_8px_40px_-12px_hsl(330_80%_60%/0.3)]",
    accent: "from-pink-500/8 via-rose-500/5 to-transparent",
    features: ["Conversa livre", "Modo Escola", "Reescrever texto", "5 mensagens/dia"],
  },
  {
    key: "vip" as const,
    icon: Crown,
    title: "VIP",
    tagline: "Tudo do Amigo + recursos premium",
    requires: "vip" as const,
    badge: "VIP",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10",
    border: "border-amber-500/25 hover:border-amber-500/50",
    glow: "hover:shadow-[0_8px_40px_-12px_hsl(45_100%_60%/0.4)]",
    accent: "from-amber-500/10 via-yellow-500/5 to-transparent",
    features: ["Mensagens ilimitadas", "Geração de imagens", "Modo +18 sem censura", "Acesso prioritário"],
  },
  {
    key: "programmer" as const,
    icon: Code,
    title: "Programador",
    tagline: "Chat dev + editor de código ao lado",
    requires: "programmer" as const,
    badge: "DEV",
    badgeClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-500/10",
    border: "border-cyan-500/25 hover:border-cyan-500/50",
    glow: "hover:shadow-[0_8px_40px_-12px_hsl(190_90%_55%/0.4)]",
    accent: "from-cyan-500/10 via-blue-500/5 to-transparent",
    features: ["Tudo do VIP", "Cria sites completos", "Deploy automático", "Editor lateral live"],
  },
];

export function ChatSelector({ onSelect }: ChatSelectorProps) {
  const { profile } = useAuth();
  const [vipOpen, setVipOpen] = useState(false);
  const [highlightPlan, setHighlightPlan] = useState<"vip" | "programmer">("vip");

  const hasAccess = (req: null | "vip" | "programmer"): boolean => {
    if (!req) return true;
    if (req === "vip") return !!(profile?.is_vip || profile?.is_dev);
    if (req === "programmer") return !!profile?.is_dev;
    return false;
  };

  const handleClick = (chat: typeof CHATS[number]) => {
    if (hasAccess(chat.requires)) {
      onSelect(chat.key);
    } else {
      setHighlightPlan(chat.requires === "programmer" ? "programmer" : "vip");
      setVipOpen(true);
    }
  };

  return (
    <div className="relative h-full w-full overflow-y-auto bg-background">
      {/* Background aurora */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-10 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px] animate-[pulse_10s_ease-in-out_infinite]" />
        <div className="absolute -right-32 bottom-10 h-[400px] w-[400px] rounded-full bg-amber-500/8 blur-[120px] animate-[pulse_12s_ease-in-out_infinite_3s]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold uppercase tracking-widest text-primary mb-3">
            <Sparkles className="w-3 h-3" />
            Escolha seu chat
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
            Qual chat você quer abrir?
          </h1>
          <p className="text-sm text-muted-foreground/60">
            Cada chat tem uma personalidade e recursos diferentes
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CHATS.map((chat) => {
            const ChatIcon = chat.icon;
            const locked = !hasAccess(chat.requires);

            return (
              <button
                key={chat.key}
                onClick={() => handleClick(chat)}
                className={`group relative text-left rounded-2xl border ${chat.border} bg-card/40 backdrop-blur-xl p-5 transition-all duration-300 hover:scale-[1.02] hover:bg-card/60 ${chat.glow} ${locked ? 'opacity-90' : ''}`}
              >
                {/* Accent gradient overlay */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${chat.accent} opacity-50 pointer-events-none`} />

                {/* Locked overlay */}
                {locked && (
                  <div className="absolute top-3 right-3 z-10">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-background/70 backdrop-blur border border-border/30 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Lock className="w-2.5 h-2.5" />
                      Bloqueado
                    </div>
                  </div>
                )}

                {/* Top badge (when unlocked) */}
                {!locked && (
                  <div className="absolute top-3 right-3 z-10">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${chat.badgeClass}`}>
                      {chat.requires && <Star className="w-2.5 h-2.5" />}
                      {chat.badge}
                    </span>
                  </div>
                )}

                <div className="relative">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl ${chat.iconBg} ${chat.iconColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner`}>
                    <ChatIcon className="w-6 h-6" strokeWidth={2} />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-black text-foreground mb-1">
                    Chat {chat.title}
                  </h3>
                  <p className="text-xs text-muted-foreground/70 mb-4 leading-relaxed">
                    {chat.tagline}
                  </p>

                  {/* Features */}
                  <ul className="space-y-1.5 mb-5">
                    {chat.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground/80">
                        <Check className={`w-3 h-3 ${chat.iconColor} shrink-0 mt-0.5`} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className={`flex items-center justify-between rounded-xl border border-border/20 bg-background/40 px-3 py-2.5 group-hover:border-primary/30 group-hover:bg-background/60 transition-all`}>
                    <span className="text-xs font-bold text-foreground">
                      {locked ? "Desbloquear agora" : "Abrir chat"}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/50">
          <MessageSquare className="w-3 h-3" />
          <span>Você pode trocar de chat a qualquer momento pelo menu lateral</span>
        </div>
      </div>

      <VipModal open={vipOpen} onClose={() => setVipOpen(false)} highlightPlan={highlightPlan} />
    </div>
  );
}
