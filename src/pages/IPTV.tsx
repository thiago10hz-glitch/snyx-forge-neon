import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { VipModal } from "@/components/VipModal";
import {
  ArrowLeft, Maximize2, Minimize2, ExternalLink, RefreshCw, MonitorPlay, Code2
} from "lucide-react";
import { Link } from "react-router-dom";

const PLEX_URL = "https://watch.plex.tv/pt-br";

export default function IPTV() {
  const { profile } = useAuth();
  const [showVipModal, setShowVipModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const hasAccess = profile?.is_dev;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Detect iframe load failure with timeout
  useEffect(() => {
    if (!hasAccess) return;
    const timer = setTimeout(() => {
      if (loading) {
        setIframeError(true);
        setLoading(false);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [hasAccess, loading]);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center mx-auto">
            <MonitorPlay size={40} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Plex Streaming</h1>
          <p className="text-white/50 text-sm">
            Acesso exclusivo para membros DEV. Assista filmes e séries gratuitamente via Plex.
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
        <VipModal open={showVipModal} onOpenChange={setShowVipModal} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-md border-b border-white/5 z-10">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-white/70 hover:text-white">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center">
              <MonitorPlay size={16} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                Plex Free
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">GRÁTIS</span>
              </h1>
              <p className="text-[10px] text-white/40">Filmes, Séries e TV ao Vivo</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={PLEX_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-white/50 hover:text-white"
            title="Abrir no Plex"
          >
            <ExternalLink size={16} />
          </a>
          <button
            onClick={() => {
              setLoading(true);
              setIframeError(false);
              if (iframeRef.current) {
                iframeRef.current.src = PLEX_URL;
              }
            }}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-white/50 hover:text-white"
            title="Recarregar"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-white/50 hover:text-white"
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all text-xs"
          >
            <Code2 size={12} /> SnyX
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {loading && !iframeError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f] z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center mb-4 animate-pulse">
              <MonitorPlay size={32} className="text-amber-400" />
            </div>
            <p className="text-white/50 text-sm">Carregando Plex...</p>
          </div>
        )}

        {iframeError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f] z-10 p-4">
            <div className="text-center max-w-md space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center mx-auto">
                <MonitorPlay size={40} className="text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Plex não permite embed</h2>
              <p className="text-white/50 text-sm">
                O Plex bloqueia a incorporação direta. Clique no botão abaixo para abrir em uma nova aba.
              </p>
              <div className="flex gap-3 justify-center">
                <a
                  href={PLEX_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:opacity-90 transition-all text-sm flex items-center gap-2"
                >
                  <ExternalLink size={16} /> Abrir Plex Free
                </a>
                <button
                  onClick={() => {
                    setLoading(true);
                    setIframeError(false);
                    if (iframeRef.current) {
                      iframeRef.current.src = PLEX_URL;
                    }
                  }}
                  className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all text-sm flex items-center gap-2"
                >
                  <RefreshCw size={14} /> Tentar Novamente
                </button>
              </div>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={PLEX_URL}
            className="w-full h-full absolute inset-0 border-0"
            style={{ minHeight: "calc(100vh - 52px)" }}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            onLoad={() => setLoading(false)}
            onError={() => {
              setIframeError(true);
              setLoading(false);
            }}
          />
        )}
      </div>

      <VipModal open={showVipModal} onOpenChange={setShowVipModal} />
    </div>
  );
}
