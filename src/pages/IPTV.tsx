import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { VipModal } from "@/components/VipModal";
import {
  ArrowLeft, ExternalLink, MonitorPlay, Code2, Play
} from "lucide-react";
import { Link } from "react-router-dom";

interface StreamingService {
  name: string;
  description: string;
  url: string;
  color: string;
  logo: string;
  tag?: string;
}

const SERVICES: StreamingService[] = [
  {
    name: "Plex Free",
    description: "Filmes, séries e TV ao vivo gratuitos. Milhares de títulos disponíveis.",
    url: "https://watch.plex.tv/pt-br",
    color: "from-amber-500 to-orange-600",
    logo: "🎬",
    tag: "Recomendado",
  },
  {
    name: "Pluto TV",
    description: "Canais ao vivo e filmes on-demand totalmente grátis.",
    url: "https://pluto.tv/pt-br/live-tv",
    color: "from-blue-500 to-indigo-600",
    logo: "📺",
    tag: "TV ao Vivo",
  },
  {
    name: "Tubi",
    description: "Grande catálogo de filmes e séries sem assinatura.",
    url: "https://tubitv.com",
    color: "from-red-500 to-pink-600",
    logo: "🎥",
  },
  {
    name: "Crackle",
    description: "Filmes e séries originais da Sony, gratuitos.",
    url: "https://www.crackle.com",
    color: "from-yellow-500 to-amber-600",
    logo: "⚡",
  },
  {
    name: "Plex TV ao Vivo",
    description: "Mais de 600 canais de TV ao vivo gratuitos via Plex.",
    url: "https://watch.plex.tv/pt-br/live-tv",
    color: "from-emerald-500 to-teal-600",
    logo: "📡",
    tag: "Ao Vivo",
  },
  {
    name: "YouTube Filmes",
    description: "Filmes gratuitos disponíveis no YouTube.",
    url: "https://www.youtube.com/feed/storefront?bp=ogUCKAQ%3D",
    color: "from-red-600 to-red-700",
    logo: "▶️",
  },
];


function ServiceCard({ service }: { service: StreamingService }) {
  return (
    <a
      href={service.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative rounded-xl overflow-hidden border border-border/10 bg-card/30 hover:bg-card/50 hover:border-border/20 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl"
    >
      <div className={`h-1 w-full bg-gradient-to-r ${service.color}`} />
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${service.color} flex items-center justify-center text-lg shadow-md`}>
            {service.logo}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-foreground font-bold text-[13px] truncate">{service.name}</h3>
              {service.tag && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground/60 border border-border/10 shrink-0">
                  {service.tag}
                </span>
              )}
            </div>
            <p className="text-muted-foreground/40 text-[11px] line-clamp-1 mt-0.5">{service.description}</p>
          </div>
          <div className="p-1.5 rounded-md bg-muted/10 group-hover:bg-muted/20 transition-all opacity-0 group-hover:opacity-100 shrink-0">
            <ExternalLink size={11} className="text-muted-foreground/50" />
          </div>
        </div>
        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gradient-to-r ${service.color} text-white text-[10px] font-medium opacity-90 group-hover:opacity-100 transition-opacity`}>
          <Play size={9} fill="currentColor" /> Assistir Grátis
        </div>
      </div>
    </a>
  );
}

export default function IPTV() {
  const { profile } = useAuth();
  const [showVipModal, setShowVipModal] = useState(false);

  const hasAccess = profile?.is_dev;

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center mx-auto">
            <MonitorPlay size={28} className="text-amber-400" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Streaming Hub</h1>
          <p className="text-muted-foreground/50 text-xs">
            Acesso exclusivo para membros DEV. Assista filmes e séries gratuitamente.
          </p>
          <div className="flex gap-2 justify-center">
            <Link to="/" className="px-3 py-1.5 rounded-lg bg-muted/10 border border-border/10 text-muted-foreground hover:bg-muted/20 transition-all text-xs flex items-center gap-1.5">
              <ArrowLeft size={12} /> Voltar
            </Link>
            <button onClick={() => setShowVipModal(true)} className="px-5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium hover:opacity-90 transition-all text-xs">
              Obter Acesso
            </button>
          </div>
        </div>
        <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 h-11 glass border-b border-border/10">
        <div className="flex items-center gap-2.5">
          <Link to="/" className="p-1.5 rounded-md bg-muted/10 hover:bg-muted/20 transition-all text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center">
              <MonitorPlay size={13} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-foreground">Streaming Hub</h1>
              <p className="text-[8px] text-muted-foreground/40 hidden sm:block">Filmes e séries gratuitos</p>
            </div>
          </div>
        </div>
        <Link
          to="/"
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/10 border border-border/10 text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 transition-all text-[10px]"
        >
          <Code2 size={10} /> SnyX
        </Link>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
        <div className="relative px-4 py-8 max-w-4xl mx-auto text-center space-y-2">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">
            Assista <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Grátis</span>
          </h2>
          <p className="text-muted-foreground/40 text-xs max-w-md mx-auto">
            Filmes, séries e TV ao vivo. Escolha um serviço e comece a assistir agora.
          </p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="px-4 pb-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SERVICES.map((service) => (
            <ServiceCard key={service.name} service={service} />
          ))}
        </div>

        <div className="mt-6 text-center">
          <p className="text-muted-foreground/20 text-[10px]">
            Todos os serviços são 100% gratuitos e legais. Os links abrem em nova aba.
          </p>
        </div>
      </div>

      <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
    </div>
  );
}
