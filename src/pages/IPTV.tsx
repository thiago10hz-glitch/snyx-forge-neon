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
      className="group relative rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
    >
      {/* Gradient top bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${service.color}`} />

      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center text-2xl shadow-lg`}>
              {service.logo}
            </div>
            <div>
              <h3 className="text-white font-bold text-base group-hover:text-white/90 transition-colors">
                {service.name}
              </h3>
              {service.tag && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10">
                  {service.tag}
                </span>
              )}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100">
            <ExternalLink size={14} className="text-white/50" />
          </div>
        </div>

        <p className="text-white/40 text-xs leading-relaxed line-clamp-2">
          {service.description}
        </p>

        <div className="flex items-center gap-2 pt-1">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r ${service.color} text-white text-xs font-medium opacity-90 group-hover:opacity-100 transition-opacity`}>
            <Play size={12} fill="currentColor" /> Assistir Grátis
          </div>
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
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center mx-auto">
            <MonitorPlay size={40} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Streaming Hub</h1>
          <p className="text-white/50 text-sm">
            Acesso exclusivo para membros DEV. Assista filmes e séries gratuitamente.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/" className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all text-sm flex items-center gap-2">
              <ArrowLeft size={14} /> Voltar
            </Link>
            <button onClick={() => setShowVipModal(true)} className="px-6 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium hover:opacity-90 transition-all text-sm">
              Obter Acesso
            </button>
          </div>
        </div>
        <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-white/70 hover:text-white">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center">
              <MonitorPlay size={16} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Streaming Hub</h1>
              <p className="text-[10px] text-white/40">Filmes e séries gratuitos</p>
            </div>
          </div>
        </div>
        <Link
          to="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all text-xs"
        >
          <Code2 size={12} /> SnyX
        </Link>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
        <div className="relative px-6 py-12 max-w-5xl mx-auto text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Assista <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Grátis</span>
          </h2>
          <p className="text-white/40 text-sm max-w-lg mx-auto">
            Filmes, séries e TV ao vivo sem pagar nada. Escolha um serviço abaixo e comece a assistir agora.
          </p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="px-6 pb-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((service) => (
            <ServiceCard key={service.name} service={service} />
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center">
          <p className="text-white/20 text-xs">
            Todos os serviços são 100% gratuitos e legais. Os links abrem em nova aba.
          </p>
        </div>
      </div>

      <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
    </div>
  );
}
