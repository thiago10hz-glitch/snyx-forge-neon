import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { VipModal } from "@/components/VipModal";
import {
  ArrowLeft, Code2, Search, RefreshCw, Play, Tv, X, ChevronDown, Loader2, Radio,
  List, Zap, Signal, Film, Clapperboard, MonitorPlay, ChevronRight, Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface Channel {
  n: string;
  u: string;
  l: string;
  g: string;
}

type MainCategory = "home" | "tv" | "filmes" | "series" | "cinema";


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const ChannelLogo = memo(function ChannelLogo({ src, name, size = "md", className = "" }: { src?: string; name?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const [failed, setFailed] = useState(false);
  const sizeClasses = size === "lg" ? "w-14 h-14" : size === "md" ? "w-11 h-11" : "w-10 h-10";
  const imgSizeClasses = size === "lg" ? "w-12 h-12" : size === "md" ? "w-9 h-9" : "w-8 h-8";
  const textSize = size === "lg" ? "text-sm" : "text-[10px]";
  const proxiedSrc = src ? proxyUrl(src) : "";

  if (!src || failed) {
    return (
      <div className={`${sizeClasses} rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/15 flex items-center justify-center shrink-0 border border-white/5 ${className}`}>
        {name ? (
          <span className={`${textSize} font-bold text-purple-300/60`}>{getInitials(name)}</span>
        ) : (
          <Tv size={size === "lg" ? 22 : 16} className="text-purple-400/40" />
        )}
      </div>
    );
  }

  return (
    <div className={`${sizeClasses} rounded-xl overflow-hidden bg-black/30 shrink-0 border border-white/5 flex items-center justify-center ${className}`}>
      <img src={proxiedSrc} alt="" className={`${imgSizeClasses} object-contain`} loading="lazy" decoding="async" onError={() => setFailed(true)} />
    </div>
  );
});

const CATEGORIES: { id: MainCategory; label: string; desc: string; icon: typeof Tv; gradient: string; shadow: string; keywords: string[] }[] = [
  { id: "tv", label: "TV ao Vivo", desc: "Canais abertos e fechados", icon: Tv, gradient: "from-blue-500 to-cyan-400", shadow: "shadow-blue-500/30", keywords: ["tv", "aberto", "ao vivo", "esporte", "sport", "news", "notícia", "canal", "hd", "fhd", "uhd", "4k", "educativo", "religioso", "infantil", "kids", "music", "adulto"] },
  { id: "filmes", label: "Filmes", desc: "Todos os gêneros", icon: Film, gradient: "from-purple-500 to-violet-400", shadow: "shadow-purple-500/30", keywords: ["filme", "filmes", "movie", "movies", "film"] },
  { id: "series", label: "Séries", desc: "Séries e animes", icon: MonitorPlay, gradient: "from-orange-500 to-amber-400", shadow: "shadow-orange-500/30", keywords: ["série", "series", "serie", "novela", "anime", "animação", "animes"] },
  { id: "cinema", label: "Cinema", desc: "Canais premium", icon: Clapperboard, gradient: "from-emerald-500 to-teal-400", shadow: "shadow-emerald-500/30", keywords: ["cinema", "premiere", "telecine", "hbo", "star", "paramount", "warner"] },
];

function classifyChannel(group: string): MainCategory[] {
  const g = group.toLowerCase();
  const matches: MainCategory[] = [];
  for (const cat of CATEGORIES) {
    if (cat.keywords.some(k => g.includes(k))) matches.push(cat.id);
  }
  return matches.length > 0 ? matches : ["tv"];
}

async function getInvokeErrorMessage(error: unknown) {
  const maybeResponse = (error as { context?: Response } | null)?.context;
  if (maybeResponse instanceof Response) {
    try {
      const payload = await maybeResponse.clone().json() as { error?: string; message?: string };
      return payload.error || payload.message || `Erro ${maybeResponse.status}`;
    } catch {
      try { return (await maybeResponse.clone().text()) || `Erro ${maybeResponse.status}`; } catch { return `Erro ${maybeResponse.status}`; }
    }
  }
  return error instanceof Error ? error.message : "Erro ao sincronizar";
}

const ChannelCard = memo(function ChannelCard({ ch, isPlaying, onPlay }: { ch: Channel; isPlaying: boolean; onPlay: (ch: Channel) => void }) {
  return (
    <button
      onClick={() => onPlay(ch)}
      className={`group flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all duration-300 text-left hover:scale-[1.02] active:scale-[0.98] ${
        isPlaying
          ? "bg-purple-500/10 border-purple-500/20 shadow-xl shadow-purple-500/10 ring-1 ring-purple-500/15"
          : "bg-card/25 border-border/5 hover:bg-card/60 hover:border-border/10 hover:shadow-xl hover:shadow-black/10"
      }`}
    >
      <ChannelLogo
        src={ch.l}
        name={ch.n}
        size="md"
        className={isPlaying ? "border-purple-500/30" : ""}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold truncate transition-colors ${isPlaying ? "text-purple-300" : "text-foreground/80 group-hover:text-foreground"}`}>{ch.n}</p>
        <p className="text-muted-foreground/25 text-[10px] truncate mt-0.5">{ch.g}</p>
      </div>
      <div className={`p-2 rounded-xl transition-all duration-300 ${
        isPlaying
          ? "bg-purple-500/20 text-purple-400"
          : "bg-transparent text-transparent group-hover:text-purple-400/50 group-hover:bg-purple-500/5"
      }`}>
        {isPlaying ? <Radio size={12} className="animate-pulse" /> : <Play size={12} fill="currentColor" />}
      </div>
    </button>
  );
});

export default function IPTV() {
  const { profile, session } = useAuth();
  const [showVipModal, setShowVipModal] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<MainCategory>("home");
  const [selectedGroup, setSelectedGroup] = useState("Todos");
  const [showGroups, setShowGroups] = useState(false);
  const [playingChannel, setPlayingChannel] = useState<Channel | null>(null);
  const [visibleCount, setVisibleCount] = useState(60);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const mpegtsRef = useRef<MpegtsPlayer | null>(null);

  const hasAccess = profile?.is_dev;

  const loadChannels = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = supabase.storage.from("iptv-cache").getPublicUrl("channels.json");
      const res = await fetch(data.publicUrl + "?t=" + Date.now());
      if (res.ok) {
        const json = await res.json();
        setChannels(Array.isArray(json) ? json : []);
      } else {
        setChannels([]);
      }
    } catch {
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncChannels = useCallback(async () => {
    if (!session?.access_token) {
      toast.error("Faça login para sincronizar.");
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("iptv-sync");
      if (error) throw error;

      if (data?.success) {
        toast.success(`${data.channels} canais sincronizados!`);
        await loadChannels();
      } else {
        toast.error(data?.error || "Erro ao sincronizar");
      }
    } catch (error) {
      toast.error(await getInvokeErrorMessage(error));
    } finally {
      setSyncing(false);
    }
  }, [session?.access_token, loadChannels]);

  const cleanupPlayers = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (mpegtsRef.current) {
      try {
        mpegtsRef.current.pause?.();
        mpegtsRef.current.unload?.();
        mpegtsRef.current.detachMediaElement?.();
        mpegtsRef.current.destroy();
      } catch {
        // ignore cleanup failures
      }
      mpegtsRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  }, []);

  useEffect(() => {
    if (hasAccess) loadChannels();
  }, [hasAccess, loadChannels]);

  useEffect(() => {
    setVisibleCount(60);
  }, [activeCategory, selectedGroup, search]);

  useEffect(() => cleanupPlayers, [cleanupPlayers]);

  const channelsByCategory = useMemo(() => {
    const map: Record<MainCategory, Channel[]> = { home: [], tv: [], filmes: [], series: [], cinema: [] };
    channels.forEach((ch) => {
      const cats = classifyChannel(ch.g);
      cats.forEach((cat) => map[cat].push(ch));
    });
    return map;
  }, [channels]);

  const categoryCounts = useMemo(() => ({
    tv: channelsByCategory.tv.length,
    filmes: channelsByCategory.filmes.length,
    series: channelsByCategory.series.length,
    cinema: channelsByCategory.cinema.length,
  }), [channelsByCategory]);

  const categoryChannels = useMemo(() => {
    if (activeCategory === "home") return [];
    return channelsByCategory[activeCategory];
  }, [activeCategory, channelsByCategory]);

  const subGroups = useMemo(() => {
    const set = new Set(categoryChannels.map((c) => c.g));
    return ["Todos", ...Array.from(set).sort()];
  }, [categoryChannels]);

  const filtered = useMemo(() => {
    let list = categoryChannels;

    if (selectedGroup !== "Todos") list = list.filter((c) => c.g === selectedGroup);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.n.toLowerCase().includes(q) || c.g.toLowerCase().includes(q));
    }

    return list;
  }, [categoryChannels, selectedGroup, search]);

  const playChannel = useCallback(async (ch: Channel) => {
    cleanupPlayers();
    setPlayingChannel(ch);

    const streamUrl = proxyUrl(ch.u);
    const video = videoRef.current;
    if (!video) return;

    try {
      // Safari native HLS
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        await video.play().catch(() => {});
        return;
      }

      // hls.js for all streams (most IPTV links are m3u8 or handled via proxy)
      const { default: Hls } = await import("hls.js");
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_: unknown, data: { fatal?: boolean }) => {
          if (data?.fatal) {
            toast.error("Canal indisponível. Tente outro.");
            cleanupPlayers();
            setPlayingChannel(null);
          }
        });
        return;
      }

      // Fallback: direct src
      video.src = streamUrl;
      await video.play().catch(() => {});
    } catch (error) {
      cleanupPlayers();
      setPlayingChannel(null);
      toast.error("Erro ao abrir o canal.");
    }
  }, [cleanupPlayers]);

  const stopPlaying = useCallback(() => {
    cleanupPlayers();
    setPlayingChannel(null);
  }, [cleanupPlayers]);

  const goBack = () => {
    if (activeCategory !== "home") {
      setActiveCategory("home");
      setSelectedGroup("Todos");
      setSearch("");
    }
  };

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + 60);
  }, []);

  const homePreviews = useMemo(() => {
    return CATEGORIES.map((cat) => ({
      ...cat,
      channels: channelsByCategory[cat.id].slice(0, 8),
      total: channelsByCategory[cat.id].length,
    }));
  }, [channelsByCategory]);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-pink-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative text-center max-w-md space-y-6 z-10">
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/30">
            <Tv size={40} className="text-white" />
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 border-[3px] border-background animate-pulse flex items-center justify-center">
              <span className="text-[7px] text-white font-bold">LIVE</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground font-mono tracking-tight">SnyX TV</h1>
            <p className="text-muted-foreground/60 text-sm mt-3 leading-relaxed max-w-xs mx-auto">Acesso exclusivo para membros DEV. Milhares de canais ao vivo, filmes e séries.</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Link to="/" className="px-5 py-3 rounded-2xl bg-card/50 border border-border/10 text-muted-foreground hover:bg-card hover:text-foreground transition-all text-sm flex items-center gap-2 backdrop-blur-sm"><ArrowLeft size={14} /> Voltar</Link>
            <button onClick={() => setShowVipModal(true)} className="px-7 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold hover:opacity-90 transition-all text-sm shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 active:scale-95 flex items-center gap-2">
              <Zap size={16} /> Obter Acesso
            </button>
          </div>
        </div>
        <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-30 backdrop-blur-2xl bg-background/70 border-b border-border/5">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            {activeCategory !== "home" ? (
              <button onClick={goBack} className="p-2 rounded-xl bg-card/50 hover:bg-card transition-all text-muted-foreground hover:text-foreground border border-border/5">
                <ArrowLeft size={16} />
              </button>
            ) : (
              <Link to="/" className="p-2 rounded-xl bg-card/50 hover:bg-card transition-all text-muted-foreground hover:text-foreground border border-border/5">
                <ArrowLeft size={16} />
              </Link>
            )}
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Tv size={15} className="text-white" />
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground font-mono tracking-tight">SnyX TV</h1>
                <div className="flex items-center gap-1.5">
                  <Signal size={8} className="text-green-400" />
                  <p className="text-[10px] text-muted-foreground/40">
                    {activeCategory === "home" ? `${channels.length.toLocaleString()} canais ao vivo` : CATEGORIES.find((c) => c.id === activeCategory)?.label}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={syncChannels} disabled={syncing} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card/50 border border-border/5 text-muted-foreground hover:text-foreground hover:bg-card transition-all text-xs disabled:opacity-50 group">
              <RefreshCw size={12} className={`${syncing ? "animate-spin" : "group-hover:rotate-90"} transition-transform duration-500`} />
              <span className="hidden sm:inline">{syncing ? "Sincronizando..." : "Sincronizar"}</span>
            </button>
            <Link to="/" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card/50 border border-border/5 text-muted-foreground hover:text-foreground hover:bg-card transition-all text-xs">
              <Code2 size={12} /><span className="hidden sm:inline">SnyX</span>
            </Link>
          </div>
        </div>

        {activeCategory === "home" && channels.length > 0 && (
          <div className="flex gap-1 px-4 sm:px-6 pb-3 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSelectedGroup("Todos");
                    setSearch("");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/40 border border-border/5 text-muted-foreground/60 hover:text-foreground hover:bg-card/80 transition-all text-xs whitespace-nowrap shrink-0"
                >
                  <Icon size={12} /> {cat.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {playingChannel && (
        <div className="relative bg-black w-full" style={{ maxHeight: "50vh" }}>
          <video ref={videoRef} controls autoPlay playsInline className="w-full max-h-[50vh] bg-black" />
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-xs font-semibold truncate max-w-[200px]">{playingChannel.n}</span>
              <span className="text-white/20">|</span>
              <span className="text-white/40 text-[10px] truncate max-w-[120px]">{playingChannel.g}</span>
            </div>
            <button onClick={stopPlaying} className="p-2.5 rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 text-white/60 hover:text-white hover:bg-red-500/40 transition-all">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {activeCategory === "home" && (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center backdrop-blur-sm border border-purple-500/10">
                  <Loader2 size={32} className="text-purple-400 animate-spin" />
                </div>
                <div className="absolute -inset-4 rounded-[28px] bg-purple-500/5 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-foreground/60 text-sm font-medium">Carregando canais...</p>
                <p className="text-muted-foreground/30 text-xs mt-1">Isso pode levar alguns segundos</p>
              </div>
            </div>
          ) : channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
              <div className="w-24 h-24 rounded-3xl bg-card/50 border border-border/10 flex items-center justify-center backdrop-blur-sm">
                <Tv size={40} className="text-muted-foreground/15" />
              </div>
              <div className="text-center">
                <p className="text-foreground/70 text-base font-semibold">Nenhum canal disponível</p>
                <p className="text-muted-foreground/30 text-sm mt-1.5">Sincronize para carregar a lista de canais</p>
              </div>
              <button onClick={syncChannels} disabled={syncing} className="px-8 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-xl shadow-purple-500/25 flex items-center gap-2">
                <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                {syncing ? "Sincronizando..." : "Sincronizar Canais"}
              </button>
            </div>
          ) : (
            <div className="px-4 sm:px-6 py-6 space-y-10">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900/40 via-card/60 to-pink-900/30 border border-purple-500/10 p-6 sm:p-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-500/10 rounded-full blur-[60px] pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-purple-400" />
                      <span className="text-purple-400 text-xs font-semibold uppercase tracking-wider">Streaming</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                      {channels.length.toLocaleString()} canais disponíveis
                    </h2>
                    <p className="text-muted-foreground/50 text-sm max-w-sm">TV ao vivo, filmes, séries e cinema em um só lugar. Escolha uma categoria para começar.</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                      <Tv size={28} className="text-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-foreground font-bold text-base mb-4">Categorias</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const count = categoryCounts[cat.id];
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setActiveCategory(cat.id);
                          setSelectedGroup("Todos");
                          setSearch("");
                        }}
                        className="group relative overflow-hidden rounded-2xl border border-border/5 p-5 sm:p-6 text-left transition-all duration-500 hover:scale-[1.03] active:scale-[0.97] hover:shadow-2xl bg-card/30 backdrop-blur-sm hover:bg-card/60"
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient} opacity-[0.04] group-hover:opacity-[0.12] transition-opacity duration-500`} />
                        <div className={`absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br ${cat.gradient} opacity-[0.06] group-hover:opacity-[0.15] blur-2xl transition-opacity duration-500`} />
                        <div className="relative z-10">
                          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center mb-4 shadow-xl ${cat.shadow} group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                            <Icon size={24} className="text-white" />
                          </div>
                          <h3 className="text-foreground font-bold text-base">{cat.label}</h3>
                          <p className="text-muted-foreground/30 text-xs mt-1">{cat.desc}</p>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-muted-foreground/40 text-[11px] font-medium">{count.toLocaleString()} canais</span>
                            <ChevronRight size={14} className="text-muted-foreground/20 group-hover:text-foreground/50 group-hover:translate-x-1 transition-all" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {homePreviews.filter((p) => p.channels.length > 0).map((preview) => {
                const Icon = preview.icon;
                return (
                  <div key={preview.id}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${preview.gradient} flex items-center justify-center shadow-lg ${preview.shadow}`}>
                          <Icon size={15} className="text-white" />
                        </div>
                        <div>
                          <h2 className="text-foreground font-bold text-sm">{preview.label}</h2>
                          <span className="text-muted-foreground/25 text-[10px]">{preview.total.toLocaleString()} canais</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setActiveCategory(preview.id);
                          setSelectedGroup("Todos");
                          setSearch("");
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-card/40 border border-border/5 text-muted-foreground/50 hover:text-foreground hover:bg-card/80 transition-all text-xs"
                      >
                        Ver todos <ChevronRight size={12} />
                      </button>
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:-mx-6 sm:px-6">
                      {preview.channels.map((ch, i) => (
                        <button
                          key={`${ch.n}-${i}`}
                          onClick={() => playChannel(ch)}
                          className="group flex flex-col items-center gap-2.5 p-3 rounded-2xl bg-card/30 border border-border/5 hover:bg-card/70 hover:border-border/15 hover:shadow-xl hover:shadow-black/10 transition-all duration-300 hover:scale-[1.04] active:scale-[0.96] shrink-0 w-[110px]"
                        >
                          <ChannelLogo src={ch.l} name={ch.n} size="lg" />
                          <p className="text-foreground/70 text-[10px] font-medium truncate w-full text-center group-hover:text-foreground transition-colors">{ch.n}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeCategory !== "home" && (
        <>
          <div className="sticky top-14 z-20 px-4 sm:px-6 py-3 backdrop-blur-2xl bg-background/70 border-b border-border/5">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/25" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar canal ou categoria..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-card/40 border border-border/5 text-foreground text-sm placeholder:text-muted-foreground/25 focus:outline-none focus:border-purple-500/30 focus:ring-2 focus:ring-purple-500/10 focus:bg-card/60 transition-all backdrop-blur-sm"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-foreground transition-colors">
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="relative">
                <button onClick={() => setShowGroups(!showGroups)} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-card/40 border border-border/5 text-muted-foreground text-sm hover:bg-card/70 transition-all whitespace-nowrap h-full backdrop-blur-sm">
                  <List size={14} />
                  <span className="hidden sm:inline max-w-[120px] truncate">{selectedGroup}</span>
                  <ChevronDown size={12} className={`transition-transform duration-300 ${showGroups ? "rotate-180" : ""}`} />
                </button>
                {showGroups && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowGroups(false)} />
                    <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto rounded-2xl bg-card/95 backdrop-blur-xl border border-border/10 shadow-2xl shadow-black/50 z-50 p-2">
                      {subGroups.map((g) => (
                        <button key={g} onClick={() => { setSelectedGroup(g); setShowGroups(false); }} className={`w-full text-left px-4 py-2.5 rounded-xl text-xs transition-all ${g === selectedGroup ? "text-purple-400 bg-purple-500/10 font-semibold" : "text-foreground/60 hover:bg-card hover:text-foreground"}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            {(selectedGroup !== "Todos" || search) && (
              <div className="flex items-center gap-2 mt-2.5">
                {selectedGroup !== "Todos" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/15 text-purple-400 text-[10px] font-semibold">
                    {selectedGroup}
                    <button onClick={() => setSelectedGroup("Todos")} className="hover:text-white transition-colors"><X size={10} /></button>
                  </span>
                )}
                <span className="text-muted-foreground/25 text-[10px]">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 gap-4">
                <div className="w-20 h-20 rounded-3xl bg-card/30 border border-border/5 flex items-center justify-center backdrop-blur-sm">
                  <Search size={32} className="text-muted-foreground/15" />
                </div>
                <p className="text-muted-foreground/40 text-sm">Nenhum canal encontrado</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {filtered.slice(0, visibleCount).map((ch, i) => (
                    <ChannelCard
                      key={`${ch.n}-${i}`}
                      ch={ch}
                      isPlaying={playingChannel?.u === ch.u}
                      onPlay={playChannel}
                    />
                  ))}
                </div>
                {filtered.length > visibleCount && (
                  <div className="text-center mt-6">
                    <button
                      onClick={loadMore}
                      className="px-8 py-3 rounded-2xl bg-card/40 border border-border/5 text-foreground/60 hover:text-foreground hover:bg-card/70 transition-all text-sm font-medium"
                    >
                      Carregar mais ({Math.min(60, filtered.length - visibleCount)} canais)
                    </button>
                    <p className="text-muted-foreground/25 text-[10px] mt-2">
                      Mostrando {visibleCount.toLocaleString()} de {filtered.length.toLocaleString()} canais
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
    </div>
  );
}