import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { VipModal } from "@/components/VipModal";
import {
  ArrowLeft, MonitorPlay, Maximize2, Minimize2, RefreshCw, Code2,
  Search, Loader2, Radio, X, Volume2, VolumeX,
  Film, Tv, Clapperboard, Sparkles, Baby, Heart, Skull, Swords, Popcorn,
  List, Star
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const IPTV_PLAYLIST_URL = "http://dns.acesse.digital/get.php?username=59176152&password=77525563&type=m3u_plus&output=mpegts";
const CACHE_KEY = "snyx_iptv_channels";
const CACHE_TTL = 1000 * 60 * 60;

interface Channel {
  name: string;
  url: string;
  logo: string;
  group: string;
}

// IndexedDB cache
async function getCachedChannels(): Promise<Channel[] | null> {
  try {
    const raw = localStorage.getItem(CACHE_KEY + "_meta");
    if (!raw) return null;
    const meta = JSON.parse(raw);
    if (Date.now() - meta.timestamp > CACHE_TTL) return null;
    return new Promise((resolve) => {
      const req = indexedDB.open("snyx_iptv", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("channels");
      req.onsuccess = () => {
        const tx = req.result.transaction("channels", "readonly");
        const get = tx.objectStore("channels").get("data");
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function setCachedChannels(channels: Channel[]): Promise<void> {
  try {
    localStorage.setItem(CACHE_KEY + "_meta", JSON.stringify({ timestamp: Date.now(), count: channels.length }));
    return new Promise((resolve) => {
      const req = indexedDB.open("snyx_iptv", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("channels");
      req.onsuccess = () => {
        const tx = req.result.transaction("channels", "readwrite");
        tx.objectStore("channels").put(channels, "data");
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

const CATEGORIES = [
  { id: "all", label: "Todos", icon: List },
  { id: "tv", label: "TV ao Vivo", icon: Tv, keywords: ["canais", "tv", "aberto", "esporte", "sport", "futebol", "ppv", "combate", "premiere", "sbt", "globo", "record", "band", "rede", "canal", "hbo", "telecine", "fox", "espn", "directv", "usa", "programas"] },
  { id: "filmes", label: "Filmes", icon: Film, keywords: ["filmes", "filme", "cinema", "legendado", "legendadas", "movie"] },
  { id: "series", label: "Séries", icon: Clapperboard, keywords: ["séries", "serie", "temporada", "season"] },
  { id: "novelas", label: "Novelas", icon: Heart, keywords: ["novelas", "novela", "turcas", "turca", "doramas", "dorama", "drama"] },
  { id: "anime", label: "Anime", icon: Sparkles, keywords: ["anime", "animes", "animação", "desenho"] },
  { id: "kids", label: "Kids", icon: Baby, keywords: ["kids", "crianças", "infantil", "cartoon", "nick", "disney"] },
  { id: "streaming", label: "Streaming", icon: Popcorn, keywords: ["netflix", "amazon", "prime", "globoplay", "max", "disney plus", "paramount", "apple tv", "star plus", "discovery", "hulu"] },
  { id: "terror", label: "Terror", icon: Skull, keywords: ["terror", "horror", "suspense"] },
  { id: "acao", label: "Ação", icon: Swords, keywords: ["acao", "ação", "aventura", "guerra"] },
  { id: "favoritos", label: "Favoritos", icon: Star },
];

function categorizeGroup(group: string): string {
  const g = group.toLowerCase();
  if (g.includes("xxx") || g.includes("adulto")) return "__hidden__";
  for (const cat of CATEGORIES) {
    if (cat.keywords && cat.keywords.some((kw: string) => g.includes(kw))) return cat.id;
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

function ChannelListItem({ channel, isPlaying, isFav, onClick, onToggleFav }: {
  channel: Channel; isPlaying: boolean; isFav: boolean; onClick: () => void; onToggleFav: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-all border-b border-white/5 group ${
        isPlaying
          ? "bg-blue-600/20 border-l-2 border-l-blue-500"
          : "hover:bg-white/5 border-l-2 border-l-transparent"
      }`}
    >
      <div className="w-10 h-10 rounded bg-white/5 flex-shrink-0 flex items-center justify-center overflow-hidden">
        {channel.logo && !imgError ? (
          <img src={channel.logo} alt="" className="w-full h-full object-contain" onError={() => setImgError(true)} loading="lazy" />
        ) : (
          <Radio size={16} className="text-white/20" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${isPlaying ? "text-blue-400" : "text-white/90"}`}>
          {channel.name}
        </p>
        <p className="text-[10px] text-white/30 truncate">{channel.group}</p>
      </div>
      {isPlaying && (
        <div className="flex gap-0.5">
          <div className="w-0.5 h-3 bg-blue-500 rounded-full animate-pulse" />
          <div className="w-0.5 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
          <div className="w-0.5 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
        className={`p-1 rounded transition-all ${isFav ? "text-yellow-400" : "text-white/10 opacity-0 group-hover:opacity-100 hover:text-yellow-400"}`}
      >
        <Star size={12} fill={isFav ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export default function IPTV() {
  const { profile } = useAuth();
  const [showVipModal, setShowVipModal] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("Verificando cache...");
  const [error, setError] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [search, setSearch] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [playerError, setPlayerError] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("snyx_iptv_favs");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  const channelListRef = useRef<HTMLDivElement>(null);

  const hasAccess = profile?.is_dev;

  const toggleFav = useCallback((url: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      localStorage.setItem("snyx_iptv_favs", JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Load channels
  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      setLoadingProgress(5);
      setLoadingStatus("Verificando cache...");

      try {
        const cached = await getCachedChannels();
        if (cached && cached.length > 0 && !cancelled) {
          setLoadingProgress(100);
          setChannels(cached);
          setLoading(false);
          refreshFromNetwork(false);
          return;
        }
      } catch { /* ignore */ }

      if (cancelled) return;
      await refreshFromNetwork(true);
    };

    const refreshFromNetwork = async (showLoading: boolean) => {
      try {
        if (showLoading) { setLoadingProgress(10); setLoadingStatus("Conectando ao servidor..."); }
        const { data, error: fnError } = await supabase.functions.invoke("proxy-m3u", { body: { url: IPTV_PLAYLIST_URL } });
        if (cancelled) return;
        if (fnError) throw new Error(fnError.message);
        if (showLoading) { setLoadingProgress(50); setLoadingStatus("Processando playlist..."); }
        const text = typeof data === "string" ? data : await new Response(data).text();
        if (cancelled) return;
        try {
          const j = JSON.parse(text);
          if (j?.error) throw new Error(j.error);
        } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
        if (showLoading) { setLoadingProgress(70); setLoadingStatus("Organizando canais..."); }
        await new Promise(r => setTimeout(r, 0));
        const parsed = parseM3U(text);
        if (cancelled) return;
        if (parsed.length === 0) { if (showLoading) throw new Error("Nenhum canal encontrado"); return; }
        setCachedChannels(parsed);
        if (showLoading) setLoadingProgress(100);
        setChannels(parsed);
      } catch (e: any) {
        if (!cancelled && showLoading) setError(e.message || "Erro ao carregar");
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [hasAccess]);

  // Filtered channels and groups
  const { filteredChannels, groups, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = { all: 0, favoritos: 0 };
    const q = search.toLowerCase();

    for (const ch of channels) {
      const catId = categorizeGroup(ch.group);
      if (catId === "__hidden__") continue;
      counts["all"] = (counts["all"] || 0) + 1;
      counts[catId] = (counts[catId] || 0) + 1;
      if (favorites.has(ch.url)) counts["favoritos"] = (counts["favoritos"] || 0) + 1;
    }

    const filtered = channels.filter(ch => {
      const catId = categorizeGroup(ch.group);
      if (catId === "__hidden__") return false;
      if (activeCategory === "favoritos") {
        if (!favorites.has(ch.url)) return false;
      } else if (activeCategory !== "all") {
        if (catId !== activeCategory) return false;
      }
      if (q && !ch.name.toLowerCase().includes(q) && !ch.group.toLowerCase().includes(q)) return false;
      return true;
    });

    const groupMap = new Map<string, number>();
    for (const ch of filtered) {
      groupMap.set(ch.group, (groupMap.get(ch.group) || 0) + 1);
    }

    return {
      filteredChannels: selectedGroup ? filtered.filter(ch => ch.group === selectedGroup) : filtered,
      groups: [...groupMap.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      categoryCounts: counts,
    };
  }, [channels, activeCategory, search, favorites, selectedGroup]);

  // HLS playback with error recovery
  useEffect(() => {
    if (!selectedChannel || !videoRef.current) return;
    const video = videoRef.current;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    setPlayerStatus("loading");
    setPlayerError("");

    // Try HTTPS first, then HTTP
    const urls: string[] = [];
    const originalUrl = selectedChannel.url;
    if (originalUrl.startsWith("http://")) {
      urls.push(originalUrl.replace("http://", "https://"));
      urls.push(originalUrl);
    } else {
      urls.push(originalUrl);
    }

    let attemptIndex = 0;
    let destroyed = false;

    const tryPlay = async (url: string) => {
      if (destroyed) return;

      // Native HLS support (Safari/iOS)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        try {
          await video.play();
          setPlayerStatus("playing");
        } catch {
          // Try next URL
          attemptIndex++;
          if (attemptIndex < urls.length) {
            tryPlay(urls[attemptIndex]);
          } else {
            setPlayerStatus("error");
            setPlayerError("Não foi possível reproduzir este canal");
          }
        }
        return;
      }

      const { default: Hls } = await import("hls.js");
      if (!Hls.isSupported()) {
        video.src = url;
        video.play().catch(() => {
          setPlayerStatus("error");
          setPlayerError("Navegador não suporta este formato");
        });
        return;
      }

      if (destroyed) return;

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        fragLoadingMaxRetry: 3,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        fragLoadingRetryDelay: 1000,
        manifestLoadingTimeOut: 15000,
        fragLoadingTimeOut: 20000,
        xhrSetup: (xhr: XMLHttpRequest, xhrUrl: string) => {
          // Some servers need specific headers
          xhr.withCredentials = false;
        },
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!destroyed) {
          video.play().then(() => setPlayerStatus("playing")).catch(() => {
            // Autoplay might be blocked, still show video
            setPlayerStatus("playing");
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (destroyed) return;
        if (data.fatal) {
          hls.destroy();
          hlsRef.current = null;
          // Try next URL
          attemptIndex++;
          if (attemptIndex < urls.length) {
            tryPlay(urls[attemptIndex]);
          } else {
            setPlayerStatus("error");
            setPlayerError("Canal indisponível ou offline");
          }
        }
      });
    };

    tryPlay(urls[0]);

    // Handle video events
    const onPlaying = () => setPlayerStatus("playing");
    const onWaiting = () => setPlayerStatus("loading");
    const onError = () => {
      if (!destroyed && playerStatus !== "playing") {
        attemptIndex++;
        if (attemptIndex < urls.length) {
          tryPlay(urls[attemptIndex]);
        } else {
          setPlayerStatus("error");
          setPlayerError("Erro ao carregar stream");
        }
      }
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onError);

    return () => {
      destroyed = true;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onError);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
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
            <p className="text-sm text-muted-foreground mb-2">Acesse canais de TV ao vivo, filmes e séries.</p>
            <p className="text-xs text-muted-foreground/70 mb-6">
              Exclusivo para <span className="text-cyan-400 font-semibold">DEV</span> — R$ 120/mês.
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

  return (
    <div ref={containerRef} className="h-screen bg-[#0a0e17] flex flex-col overflow-hidden">
      {/* Loading */}
      {loading ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center w-72">
            <Loader2 size={40} className="text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-white/60 mb-1">{loadingStatus}</p>
            <p className="text-[10px] text-white/30 mb-3">Primeira vez demora mais</p>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${loadingProgress}%` }} />
            </div>
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
        <div className="flex h-full">
          {/* Sidebar - Categories */}
          <div className="w-16 bg-[#0d1220] flex flex-col items-center py-2 gap-1 border-r border-white/5 overflow-y-auto shrink-0" style={{ scrollbarWidth: "none" }}>
            <Link to="/" className="p-2 rounded-lg hover:bg-white/10 transition-all mb-2">
              <ArrowLeft size={16} className="text-white/50" />
            </Link>
            {CATEGORIES.map(cat => {
              const count = categoryCounts[cat.id] || 0;
              if (cat.id !== "all" && cat.id !== "favoritos" && count === 0) return null;
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setSelectedGroup(null); }}
                  title={`${cat.label} (${count})`}
                  className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                      : "text-white/40 hover:bg-white/10 hover:text-white/70"
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-[7px] font-medium leading-none">{cat.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>

          {/* Groups panel */}
          <div className="w-48 bg-[#0f1524] flex flex-col border-r border-white/5 shrink-0">
            <div className="p-3 border-b border-white/5">
              <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                {CATEGORIES.find(c => c.id === activeCategory)?.label || "Canais"}
              </h3>
              <p className="text-[9px] text-white/20 mt-0.5">{groups.length} grupos</p>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#ffffff15 transparent" }}>
              <button
                onClick={() => setSelectedGroup(null)}
                className={`w-full text-left px-3 py-2 text-xs transition-all border-b border-white/5 flex items-center justify-between ${
                  !selectedGroup ? "bg-blue-600/15 text-blue-400" : "text-white/60 hover:bg-white/5"
                }`}
              >
                <span className="truncate">Todos</span>
                <span className="text-[9px] text-white/20">{filteredChannels.length}</span>
              </button>
              {groups.map(([group, count]) => (
                <button
                  key={group}
                  onClick={() => setSelectedGroup(group)}
                  className={`w-full text-left px-3 py-2 text-xs transition-all border-b border-white/5 flex items-center justify-between gap-1 ${
                    selectedGroup === group ? "bg-blue-600/15 text-blue-400" : "text-white/60 hover:bg-white/5"
                  }`}
                >
                  <span className="truncate">{group}</span>
                  <span className="text-[9px] text-white/20 shrink-0">{count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Channel list */}
          <div className="w-72 bg-[#111827] flex flex-col border-r border-white/5 shrink-0">
            {/* Search */}
            <div className="p-2 border-b border-white/5">
              <div className="flex items-center bg-white/5 rounded-lg px-2.5 py-1.5 gap-2">
                <Search size={13} className="text-white/30 shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar canal..."
                  className="bg-transparent text-xs text-white placeholder:text-white/20 w-full focus:outline-none"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-white/30 hover:text-white/60">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Channel count */}
            <div className="px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-white/30">
                {filteredChannels.length} canais
              </span>
              {selectedGroup && (
                <button onClick={() => setSelectedGroup(null)} className="text-[10px] text-blue-400 hover:text-blue-300">
                  Limpar filtro
                </button>
              )}
            </div>

            {/* List */}
            <div ref={channelListRef} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#ffffff15 transparent" }}>
              {filteredChannels.length === 0 ? (
                <p className="text-center text-white/20 text-xs py-8">Nenhum canal encontrado</p>
              ) : (
                filteredChannels.slice(0, 500).map((ch, i) => (
                  <ChannelListItem
                    key={`${ch.url}-${i}`}
                    channel={ch}
                    isPlaying={selectedChannel?.url === ch.url}
                    isFav={favorites.has(ch.url)}
                    onClick={() => setSelectedChannel(ch)}
                    onToggleFav={() => toggleFav(ch.url)}
                  />
                ))
              )}
              {filteredChannels.length > 500 && (
                <p className="text-center text-white/20 text-[10px] py-3">
                  Mostrando 500 de {filteredChannels.length} — use a busca
                </p>
              )}
            </div>
          </div>

          {/* Player area */}
          <div className="flex-1 flex flex-col bg-[#0a0e17]">
            {selectedChannel ? (
              <>
                {/* Video */}
                <div className="flex-1 relative bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Now playing bar */}
                <div className="h-14 bg-[#111827] border-t border-white/5 flex items-center px-4 gap-3 shrink-0">
                  <div className="flex gap-0.5 mr-1">
                    <div className="w-0.5 h-3 bg-blue-500 rounded-full animate-pulse" />
                    <div className="w-0.5 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                    <div className="w-0.5 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{selectedChannel.name}</p>
                    <p className="text-[10px] text-white/40">{selectedChannel.group}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setMuted(!muted)} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all">
                      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all">
                      {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    <button onClick={() => setSelectedChannel(null)} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-2xl bg-blue-600/10 flex items-center justify-center mx-auto mb-4">
                    <MonitorPlay size={48} className="text-blue-500/50" />
                  </div>
                  <h2 className="text-lg font-bold text-white/80 mb-1">SnyX TV</h2>
                  <p className="text-sm text-white/30 mb-1">Selecione um canal para assistir</p>
                  <p className="text-xs text-white/15">{channels.length} canais disponíveis</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
