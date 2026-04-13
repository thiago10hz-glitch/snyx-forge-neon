import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { VipModal } from "@/components/VipModal";
import {
  ArrowLeft, MonitorPlay, Maximize2, Minimize2, RefreshCw, Code2,
  Search, Play, Loader2, Radio, X, ChevronLeft, ChevronRight, Volume2, VolumeX,
  Film, Tv, Clapperboard, Sparkles, Baby, Heart, Skull, Swords, Popcorn
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const IPTV_PLAYLIST_URL = "http://dns.acesse.digital/get.php?username=59176152&password=77525563&type=m3u_plus&output=hls";

interface Channel {
  name: string;
  url: string;
  logo: string;
  group: string;
}

// Main categories mapping
const MAIN_CATEGORIES = [
  {
    id: "tv",
    label: "TV ao Vivo",
    icon: Tv,
    keywords: ["canais", "tv", "aberto", "esporte", "sport", "futebol", "ppv", "combate", "premiere", "sbt", "globo", "record", "band", "rede", "canal", "hbo", "telecine", "fox", "espn", "directv", "usa", "programas"],
    color: "from-red-600 to-red-800",
  },
  {
    id: "filmes",
    label: "Filmes",
    icon: Film,
    keywords: ["filmes", "filme", "cinema", "legendado", "legendadas", "movie"],
    color: "from-blue-600 to-blue-800",
  },
  {
    id: "series",
    label: "Séries",
    icon: Clapperboard,
    keywords: ["séries", "serie", "temporada", "season"],
    color: "from-purple-600 to-purple-800",
  },
  {
    id: "novelas",
    label: "Novelas",
    icon: Heart,
    keywords: ["novelas", "novela", "turcas", "turca", "doramas", "dorama", "drama"],
    color: "from-pink-600 to-pink-800",
  },
  {
    id: "animes",
    label: "Animes",
    icon: Sparkles,
    keywords: ["anime", "animes", "crunchyroll", "funimation", "animacao", "animação", "desenho"],
    color: "from-orange-600 to-orange-800",
  },
  {
    id: "kids",
    label: "Kids",
    icon: Baby,
    keywords: ["kids", "crianças", "infantil", "cartoon", "nick", "disney"],
    color: "from-green-500 to-green-700",
  },
  {
    id: "streaming",
    label: "Streaming",
    icon: Popcorn,
    keywords: ["netflix", "amazon", "prime", "globoplay", "max", "disney plus", "paramount", "apple tv", "star plus", "discovery", "hulu"],
    color: "from-indigo-600 to-indigo-800",
  },
  {
    id: "terror",
    label: "Terror",
    icon: Skull,
    keywords: ["terror", "horror", "suspense"],
    color: "from-gray-700 to-gray-900",
  },
  {
    id: "acao",
    label: "Ação",
    icon: Swords,
    keywords: ["acao", "ação", "aventura", "guerra"],
    color: "from-amber-600 to-amber-800",
  },
];

function categorizeGroup(group: string): string {
  const g = group.toLowerCase();
  // Skip adult content
  if (g.includes("xxx") || g.includes("adulto")) return "__hidden__";
  
  for (const cat of MAIN_CATEGORIES) {
    if (cat.keywords.some(kw => g.includes(kw))) return cat.id;
  }
  return "outros";
}

function parseM3U(content: string): Channel[] {
  const lines = content.split("\n");
  const channels: Channel[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#EXTINF:")) {
      const nameMatch = line.match(/,(.+)$/);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const url = lines[i + 1]?.trim();
      if (nameMatch && url && !url.startsWith("#")) {
        channels.push({
          name: nameMatch[1].trim(),
          url,
          logo: logoMatch?.[1] || "",
          group: groupMatch?.[1] || "Outros",
        });
      }
    }
  }
  return channels;
}

function groupColor(group: string): string {
  let hash = 0;
  for (let i = 0; i < group.length; i++) hash = group.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 50%, 20%)`;
}

function ChannelCard({ channel, isPlaying, onClick }: { channel: Channel; isPlaying: boolean; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`group relative flex-shrink-0 w-44 rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:z-10 focus:outline-none ${
        isPlaying ? "ring-2 ring-red-500 scale-105 z-10" : ""
      }`}
    >
      <div
        className="aspect-video w-full flex items-center justify-center relative"
        style={{ backgroundColor: groupColor(channel.group) }}
      >
        {visible && channel.logo && !imgError ? (
          <img src={channel.logo} alt="" loading="lazy" className="w-full h-full object-contain p-3" onError={() => setImgError(true)} />
        ) : (
          <Radio size={28} className="text-white/20" />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
          <div className={`w-10 h-10 rounded-full bg-white/90 flex items-center justify-center transition-all ${
            isPlaying ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
          }`}>
            <Play size={18} className="text-black ml-0.5" fill="black" />
          </div>
        </div>
        {isPlaying && (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-red-600 rounded text-[8px] font-bold text-white tracking-wider">AO VIVO</div>
        )}
      </div>
      <div className="bg-[#181818] p-2.5 text-left">
        <p className="text-[11px] font-medium text-white truncate">{channel.name}</p>
        <p className="text-[9px] text-white/40 truncate mt-0.5">{channel.group}</p>
      </div>
    </button>
  );
}

function CategoryRow({ title, channels, selectedChannel, onSelect }: {
  title: string;
  channels: Channel[];
  selectedChannel: Channel | null;
  onSelect: (ch: Channel) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [visible, setVisible] = useState(false);
  const [showCount, setShowCount] = useState(20);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    if (el.scrollLeft > el.scrollWidth - el.clientWidth - 400 && showCount < channels.length) {
      setShowCount(prev => Math.min(prev + 20, channels.length));
    }
  }, [showCount, channels.length]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -600 : 600, behavior: "smooth" });
  };

  const displayChannels = channels.slice(0, showCount);

  if (!visible) {
    return (
      <div ref={rowRef} className="mb-8">
        <h3 className="text-sm font-bold text-white mb-3 px-10">{title}</h3>
        <div className="flex gap-2 px-10">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="w-44 h-28 rounded-lg flex-shrink-0 bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={rowRef} className="mb-8">
      <h3 className="text-sm font-bold text-white mb-3 px-10">
        {title} <span className="text-white/20 font-normal text-xs ml-1">({channels.length})</span>
      </h3>
      <div className="relative group/row">
        {canScrollLeft && (
          <button onClick={() => scroll("left")} className="absolute left-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-r from-[#141414] to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
            <ChevronLeft size={24} className="text-white" />
          </button>
        )}
        <div ref={scrollRef} onScroll={checkScroll} className="flex gap-2 overflow-x-auto px-10 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {displayChannels.map((ch, i) => (
            <ChannelCard key={`${ch.url}-${i}`} channel={ch} isPlaying={selectedChannel?.url === ch.url} onClick={() => onSelect(ch)} />
          ))}
        </div>
        {canScrollRight && (
          <button onClick={() => scroll("right")} className="absolute right-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-l from-[#141414] to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
            <ChevronRight size={24} className="text-white" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function IPTV() {
  const { profile } = useAuth();
  const [showVipModal, setShowVipModal] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeCategory, setActiveCategory] = useState("tv");
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);

  const hasAccess = profile?.is_dev;

  // Load M3U
  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      setLoadingProgress(10);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("proxy-m3u", {
          body: { url: IPTV_PLAYLIST_URL },
        });
        if (cancelled) return;
        if (fnError) throw new Error(fnError.message);
        setLoadingProgress(50);

        const text = typeof data === "string" ? data : await new Response(data).text();
        if (cancelled) return;

        // Check if response is a fallback JSON error
        try {
          const jsonCheck = JSON.parse(text);
          if (jsonCheck?.fallback || jsonCheck?.error) {
            throw new Error(jsonCheck.message || jsonCheck.error || "Servidor IPTV indisponível");
          }
        } catch (parseErr) {
          // Not JSON = it's the actual M3U content, continue
          if (parseErr instanceof SyntaxError) {
            // Good - it's M3U text, not JSON
          } else {
            throw parseErr;
          }
        }

        setLoadingProgress(70);

        // Parse in next tick
        await new Promise(r => setTimeout(r, 0));
        const parsed = parseM3U(text);
        if (cancelled) return;
        if (parsed.length === 0) throw new Error("Nenhum canal encontrado");

        setLoadingProgress(100);
        setChannels(parsed);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Erro ao carregar lista");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [hasAccess]);

  // Build categorized data — only for the active category
  const { categoryGroups, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    const groups = new Map<string, Channel[]>();

    for (const ch of channels) {
      const catId = categorizeGroup(ch.group);
      if (catId === "__hidden__") continue;
      counts[catId] = (counts[catId] || 0) + 1;

      // Only build detailed groups for active category
      if (catId === activeCategory) {
        const q = search.toLowerCase();
        if (q && !ch.name.toLowerCase().includes(q) && !ch.group.toLowerCase().includes(q)) continue;
        if (!groups.has(ch.group)) groups.set(ch.group, []);
        groups.get(ch.group)!.push(ch);
      }
    }

    // Count "outros"
    const allCatIds = MAIN_CATEGORIES.map(c => c.id);
    let outrosCount = 0;
    for (const [id, c] of Object.entries(counts)) {
      if (!allCatIds.includes(id)) outrosCount += c;
    }
    counts["outros"] = outrosCount;

    return { categoryGroups: groups, categoryCounts: counts };
  }, [channels, activeCategory, search]);

  // Hero channel from active category
  const heroChannel = useMemo(() => {
    const first = categoryGroups.values().next().value;
    if (!first || first.length === 0) return null;
    return first[Math.floor(Math.random() * Math.min(first.length, 10))];
  }, [categoryGroups]);

  // HLS playback
  useEffect(() => {
    if (!selectedChannel || !videoRef.current) return;
    const video = videoRef.current;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const playStream = async () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = selectedChannel.url;
        video.play().catch(() => {});
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        hls.loadSource(selectedChannel.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      } else {
        video.src = selectedChannel.url;
        video.play().catch(() => {});
      }
    };
    playStream();
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [selectedChannel]);

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

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // No access
  if (!hasAccess) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <header className="h-12 border-b border-border/30 flex items-center px-4 gap-3 shrink-0">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-muted/50 transition-all"><ArrowLeft size={18} className="text-muted-foreground" /></Link>
          <MonitorPlay size={18} className="text-cyan-400" />
          <span className="text-sm font-bold">SnyX TV</span>
          <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-cyan-500/20 text-cyan-400 rounded">DEV</span>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
              <Code2 size={40} className="text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">SnyX TV</h2>
            <p className="text-sm text-muted-foreground mb-2">Acesse canais de TV ao vivo, filmes e séries — direto na plataforma.</p>
            <p className="text-xs text-muted-foreground/70 mb-6">
              Exclusivo para assinantes do plano <span className="text-cyan-400 font-semibold">Programador (DEV)</span> — R$ 120/mês.
            </p>
            <button onClick={() => setShowVipModal(true)} className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-all text-sm">
              Assinar plano DEV
            </button>
          </div>
        </div>
        <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
      </div>
    );
  }

  const activeCat = MAIN_CATEGORIES.find(c => c.id === activeCategory);

  return (
    <div ref={containerRef} className="h-screen bg-[#141414] flex flex-col overflow-hidden">
      {/* Top Nav */}
      <header className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
        <div className="flex items-center px-6 py-3 gap-4">
          <Link to="/" className="p-1 rounded-lg hover:bg-white/10 transition-all">
            <ArrowLeft size={18} className="text-white/80" />
          </Link>
          <div className="flex items-center gap-2">
            <MonitorPlay size={20} className="text-red-500" />
            <span className="text-base font-extrabold text-white tracking-tight">SnyX TV</span>
          </div>
          <div className="flex-1" />
          {showSearch ? (
            <div className="flex items-center bg-black/70 border border-white/20 rounded-lg overflow-hidden">
              <Search size={14} className="text-white/50 ml-2.5" />
              <input
                autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar canal..." className="bg-transparent text-sm text-white placeholder:text-white/30 px-2 py-1.5 w-52 focus:outline-none"
              />
              <button onClick={() => { setShowSearch(false); setSearch(""); }} className="p-1.5 hover:bg-white/10"><X size={14} className="text-white/50" /></button>
            </div>
          ) : (
            <button onClick={() => setShowSearch(true)} className="p-2 rounded-lg hover:bg-white/10"><Search size={18} className="text-white/70" /></button>
          )}
        </div>

        {/* Category Tabs */}
        {!loading && (
          <div className="flex items-center gap-1 px-6 pb-3 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
            {MAIN_CATEGORIES.map(cat => {
              const count = categoryCounts[cat.id] || 0;
              if (count === 0) return null;
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-white text-black"
                      : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                  {cat.label}
                  <span className={`text-[10px] ${isActive ? "text-black/50" : "text-white/30"}`}>
                    {count > 999 ? `${(count / 1000).toFixed(0)}k` : count}
                  </span>
                </button>
              );
            })}
            {(categoryCounts["outros"] || 0) > 0 && (
              <button
                onClick={() => setActiveCategory("outros")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === "outros"
                    ? "bg-white text-black"
                    : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                }`}
              >
                Outros
                <span className={`text-[10px] ${activeCategory === "outros" ? "text-black/50" : "text-white/30"}`}>
                  {categoryCounts["outros"] > 999 ? `${(categoryCounts["outros"] / 1000).toFixed(0)}k` : categoryCounts["outros"]}
                </span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center w-64">
              <Loader2 size={40} className="text-red-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-white/50 mb-3">Carregando canais...</p>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all duration-500" style={{ width: `${loadingProgress}%` }} />
              </div>
              <p className="text-[10px] text-white/20 mt-2">{loadingProgress}%</p>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm flex items-center gap-2 mx-auto">
                <RefreshCw size={14} /> Tentar novamente
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="relative h-[50vh] min-h-[340px]" style={{ marginTop: loading ? 0 : undefined }}>
              {selectedChannel ? (
                <video ref={videoRef} controls autoPlay className="w-full h-full object-cover" />
              ) : (
                <div
                  className={`w-full h-full flex items-end bg-gradient-to-br ${activeCat?.color || "from-gray-800 to-gray-900"}`}
                >
                  {heroChannel?.logo && (
                    <img src={heroChannel.logo} alt="" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 object-contain opacity-15" />
                  )}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/80 via-transparent to-transparent pointer-events-none" />

              <div className="absolute bottom-8 left-10 z-10 max-w-lg">
                {selectedChannel ? (
                  <>
                    <h1 className="text-3xl font-extrabold text-white mb-2 drop-shadow-lg">{selectedChannel.name}</h1>
                    <p className="text-sm text-white/60 mb-4">Assistindo ao vivo • {selectedChannel.group}</p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setMuted(!muted)} className="p-2.5 rounded-full border border-white/30 text-white hover:bg-white/10">
                        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                      <button onClick={toggleFullscreen} className="p-2.5 rounded-full border border-white/30 text-white hover:bg-white/10">
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                      </button>
                      <button onClick={() => setSelectedChannel(null)} className="p-2.5 rounded-full border border-white/30 text-white hover:bg-white/10">
                        <X size={18} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      {activeCat && <activeCat.icon size={20} className="text-white/70" />}
                      <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">{activeCat?.label}</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-white mb-2 drop-shadow-lg">
                      {heroChannel?.name || activeCat?.label || "SnyX TV"}
                    </h1>
                    <p className="text-sm text-white/50 mb-4">
                      {categoryGroups.size} categorias disponíveis • Selecione um canal
                    </p>
                    {heroChannel && (
                      <button
                        onClick={() => setSelectedChannel(heroChannel)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-bold rounded-md hover:bg-white/90 transition-all text-sm"
                      >
                        <Play size={18} fill="black" /> Assistir
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Category Rows */}
            <div className="relative z-10 -mt-6 pb-10">
              {search && categoryGroups.size === 0 && (
                <p className="text-center text-white/30 text-sm py-10">Nenhum canal encontrado para "{search}"</p>
              )}
              {categoryGroups.size === 0 && !search && (
                <p className="text-center text-white/30 text-sm py-10">Nenhum canal nesta categoria</p>
              )}
              {Array.from(categoryGroups.entries())
                .sort((a, b) => b[1].length - a[1].length)
                .map(([group, items]) => (
                  <CategoryRow
                    key={group}
                    title={group}
                    channels={items}
                    selectedChannel={selectedChannel}
                    onSelect={setSelectedChannel}
                  />
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
