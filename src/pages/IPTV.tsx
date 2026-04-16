import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { VipModal } from "@/components/VipModal";
import {
  ArrowLeft, Code2, Search, RefreshCw, Play, Tv, X, ChevronDown, Loader2, Radio,
  List, Zap, Signal, Film, Clapperboard, MonitorPlay
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

const CATEGORIES: { id: MainCategory; label: string; icon: typeof Tv; gradient: string; keywords: string[] }[] = [
  { id: "tv", label: "TV ao Vivo", icon: Tv, gradient: "from-blue-500 to-cyan-500", keywords: ["tv", "aberto", "ao vivo", "esporte", "sport", "news", "notícia", "canal", "hd", "fhd", "uhd", "4k", "educativo", "religioso", "infantil", "kids", "music", "adulto"] },
  { id: "filmes", label: "Filmes", icon: Film, gradient: "from-purple-500 to-pink-500", keywords: ["filme", "filmes", "movie", "movies", "film"] },
  { id: "series", label: "Séries", icon: MonitorPlay, gradient: "from-orange-500 to-red-500", keywords: ["série", "series", "serie", "novela", "anime", "animação", "animes"] },
  { id: "cinema", label: "Cinema", icon: Clapperboard, gradient: "from-emerald-500 to-teal-500", keywords: ["cinema", "premiere", "telecine", "hbo", "star", "paramount", "warner"] },
];

function classifyChannel(group: string): MainCategory[] {
  const g = group.toLowerCase();
  const matches: MainCategory[] = [];
  for (const cat of CATEGORIES) {
    if (cat.keywords.some(k => g.includes(k))) {
      matches.push(cat.id);
    }
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
  const videoRef = useRef<HTMLVideoElement>(null);

  const hasAccess = profile?.is_dev;

  const loadChannels = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = supabase.storage.from("iptv-cache").getPublicUrl("channels.json");
      const res = await fetch(data.publicUrl + "?t=" + Date.now());
      if (res.ok) {
        const json = await res.json();
        setChannels(Array.isArray(json) ? json : []);
      } else setChannels([]);
    } catch { setChannels([]); } finally { setLoading(false); }
  }, []);

  const syncChannels = useCallback(async () => {
    if (!session?.access_token) { toast.error("Faça login para sincronizar."); return; }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("iptv-sync");
      if (error) throw error;
      if (data?.success) { toast.success(`${data.channels} canais sincronizados!`); await loadChannels(); }
      else toast.error(data?.error || "Erro ao sincronizar");
    } catch (error) { toast.error(await getInvokeErrorMessage(error)); }
    finally { setSyncing(false); }
  }, [session?.access_token, loadChannels]);

  useEffect(() => { if (hasAccess) loadChannels(); }, [hasAccess, loadChannels]);

  // Channels grouped by category
  const channelsByCategory = useMemo(() => {
    const map: Record<MainCategory, Channel[]> = { home: [], tv: [], filmes: [], series: [], cinema: [] };
    channels.forEach(ch => {
      const cats = classifyChannel(ch.g);
      cats.forEach(cat => map[cat].push(ch));
    });
    return map;
  }, [channels]);

  // Category counts
  const categoryCounts = useMemo(() => ({
    tv: channelsByCategory.tv.length,
    filmes: channelsByCategory.filmes.length,
    series: channelsByCategory.series.length,
    cinema: channelsByCategory.cinema.length,
  }), [channelsByCategory]);

  // Sub-groups within active category
  const categoryChannels = useMemo(() => {
    if (activeCategory === "home") return [];
    return channelsByCategory[activeCategory];
  }, [activeCategory, channelsByCategory]);

  const subGroups = useMemo(() => {
    const set = new Set(categoryChannels.map(c => c.g));
    return ["Todos", ...Array.from(set).sort()];
  }, [categoryChannels]);

  const filtered = useMemo(() => {
    let list = categoryChannels;
    if (selectedGroup !== "Todos") list = list.filter(c => c.g === selectedGroup);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.n.toLowerCase().includes(q) || c.g.toLowerCase().includes(q));
    }
    return list;
  }, [categoryChannels, selectedGroup, search]);

  const playChannel = useCallback(async (ch: Channel) => {
    setPlayingChannel(ch);
    setTimeout(async () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = ch.u; video.play().catch(() => {});
      } else {
        try {
          const { default: Hls } = await import("hls.js");
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
            hls.loadSource(ch.u); hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
          } else { video.src = ch.u; video.play().catch(() => {}); }
        } catch { video.src = ch.u; video.play().catch(() => {}); }
      }
    }, 100);
  }, []);

  const goBack = () => {
    if (activeCategory !== "home") {
      setActiveCategory("home");
      setSelectedGroup("Todos");
      setSearch("");
    }
  };

  // Featured channels per category for home
  const homePreviews = useMemo(() => {
    return CATEGORIES.map(cat => ({
      ...cat,
      channels: channelsByCategory[cat.id].slice(0, 6),
      total: channelsByCategory[cat.id].length,
    }));
  }, [channelsByCategory]);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="relative text-center max-w-md space-y-6">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/20 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/10">
            <Tv size={36} className="text-purple-400" />
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-background animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground font-mono tracking-tight">SnyX TV</h1>
            <p className="text-muted-foreground/60 text-sm mt-2 leading-relaxed">Acesso exclusivo para membros DEV.<br />Assista TV ao vivo com milhares de canais.</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Link to="/" className="px-4 py-2.5 rounded-xl bg-muted/10 border border-border/10 text-muted-foreground hover:bg-muted/20 transition-all text-sm flex items-center gap-2"><ArrowLeft size={14} /> Voltar</Link>
            <button onClick={() => setShowVipModal(true)} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold hover:opacity-90 transition-all text-sm shadow-lg shadow-purple-500/25 hover:scale-105 active:scale-95">
              <Zap size={14} className="inline mr-1.5 -mt-0.5" />Obter Acesso
            </button>
          </div>
        </div>
        <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border/10">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            {activeCategory !== "home" ? (
              <button onClick={goBack} className="p-2 rounded-xl bg-muted/10 hover:bg-muted/20 transition-all text-muted-foreground hover:text-foreground">
                <ArrowLeft size={16} />
              </button>
            ) : (
              <Link to="/" className="p-2 rounded-xl bg-muted/10 hover:bg-muted/20 transition-all text-muted-foreground hover:text-foreground">
                <ArrowLeft size={16} />
              </Link>
            )}
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Tv size={16} className="text-white" />
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground font-mono tracking-tight">SnyX TV</h1>
                <div className="flex items-center gap-1.5">
                  <Signal size={8} className="text-green-400" />
                  <p className="text-[10px] text-muted-foreground/50">
                    {activeCategory === "home" ? `${channels.length.toLocaleString()} canais` : CATEGORIES.find(c => c.id === activeCategory)?.label}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={syncChannels} disabled={syncing} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/10 border border-border/10 text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all text-xs disabled:opacity-50 group">
              <RefreshCw size={12} className={`${syncing ? "animate-spin" : "group-hover:rotate-90"} transition-transform`} />
              <span className="hidden sm:inline">{syncing ? "Sincronizando..." : "Sincronizar"}</span>
            </button>
            <Link to="/" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/10 border border-border/10 text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all text-xs">
              <Code2 size={12} /><span className="hidden sm:inline">SnyX</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Player */}
      {playingChannel && (
        <div className="relative bg-black w-full group/player" style={{ maxHeight: "50vh" }}>
          <video ref={videoRef} controls autoPlay className="w-full max-h-[50vh] bg-black" />
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/10">
              <Radio size={10} className="text-red-500 animate-pulse" />
              <span className="text-white text-xs font-medium truncate max-w-[200px]">{playingChannel.n}</span>
              <span className="text-white/40 text-[9px]">•</span>
              <span className="text-white/40 text-[9px] truncate max-w-[100px]">{playingChannel.g}</span>
            </div>
            <button onClick={() => { setPlayingChannel(null); if (videoRef.current) videoRef.current.src = ""; }} className="p-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-red-500/30 transition-all">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* HOME VIEW */}
      {activeCategory === "home" && (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                  <Loader2 size={28} className="text-purple-400 animate-spin" />
                </div>
              </div>
              <p className="text-muted-foreground/50 text-sm">Carregando canais...</p>
            </div>
          ) : channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="w-20 h-20 rounded-2xl bg-muted/10 border border-border/10 flex items-center justify-center">
                <Tv size={36} className="text-muted-foreground/20" />
              </div>
              <div className="text-center">
                <p className="text-foreground/60 text-sm font-medium">Nenhum canal encontrado</p>
                <p className="text-muted-foreground/30 text-xs mt-1">Sincronize para carregar a lista</p>
              </div>
              <button onClick={syncChannels} disabled={syncing} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-purple-500/25">
                <RefreshCw size={14} className={`inline mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Sincronizar Canais"}
              </button>
            </div>
          ) : (
            <div className="px-4 sm:px-6 py-6 space-y-8">
              {/* Category Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const count = categoryCounts[cat.id];
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { setActiveCategory(cat.id); setSelectedGroup("Todos"); setSearch(""); }}
                      className="group relative overflow-hidden rounded-2xl border border-border/10 p-5 text-left transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] hover:shadow-xl hover:shadow-black/20 bg-card/40 hover:border-border/20"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient} opacity-[0.07] group-hover:opacity-[0.15] transition-opacity`} />
                      <div className="relative z-10">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                          <Icon size={22} className="text-white" />
                        </div>
                        <h3 className="text-foreground font-bold text-sm">{cat.label}</h3>
                        <p className="text-muted-foreground/40 text-xs mt-0.5">{count.toLocaleString()} canais</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Preview rows per category */}
              {homePreviews.filter(p => p.channels.length > 0).map(preview => {
                const Icon = preview.icon;
                return (
                  <div key={preview.id}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${preview.gradient} flex items-center justify-center`}>
                          <Icon size={14} className="text-white" />
                        </div>
                        <h2 className="text-foreground font-bold text-sm">{preview.label}</h2>
                        <span className="text-muted-foreground/30 text-[10px]">{preview.total.toLocaleString()}</span>
                      </div>
                      <button
                        onClick={() => { setActiveCategory(preview.id); setSelectedGroup("Todos"); setSearch(""); }}
                        className="text-purple-400 text-xs hover:text-purple-300 transition-colors flex items-center gap-1"
                      >
                        Ver todos <ChevronDown size={10} className="-rotate-90" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {preview.channels.map((ch, i) => (
                        <button
                          key={`${ch.n}-${i}`}
                          onClick={() => playChannel(ch)}
                          className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-card/30 border border-border/5 hover:bg-card/60 hover:border-border/20 hover:shadow-lg transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                        >
                          {ch.l ? (
                            <img src={ch.l} alt="" className="w-12 h-12 rounded-xl object-contain bg-black/30 border border-white/5" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${preview.gradient} opacity-20 flex items-center justify-center`}>
                              <Icon size={20} className="text-foreground/40" />
                            </div>
                          )}
                          <p className="text-foreground/80 text-[11px] font-medium truncate w-full text-center">{ch.n}</p>
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

      {/* CATEGORY VIEW */}
      {activeCategory !== "home" && (
        <>
          {/* Search & Filters */}
          <div className="sticky top-14 z-10 px-4 sm:px-6 py-3 backdrop-blur-xl bg-background/80 border-b border-border/10">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar canal ou categoria..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card/50 border border-border/10 text-foreground text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition-all"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-foreground transition-colors">
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="relative">
                <button onClick={() => setShowGroups(!showGroups)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/50 border border-border/10 text-muted-foreground text-sm hover:bg-card hover:border-purple-500/20 transition-all whitespace-nowrap h-full">
                  <List size={14} />
                  <span className="hidden sm:inline max-w-[120px] truncate">{selectedGroup}</span>
                  <ChevronDown size={12} className={`transition-transform ${showGroups ? "rotate-180" : ""}`} />
                </button>
                {showGroups && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowGroups(false)} />
                    <div className="absolute right-0 top-full mt-2 w-64 max-h-72 overflow-y-auto rounded-2xl bg-card border border-border/20 shadow-2xl shadow-black/40 z-50 p-1.5">
                      {subGroups.map(g => (
                        <button key={g} onClick={() => { setSelectedGroup(g); setShowGroups(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all ${g === selectedGroup ? "text-purple-400 bg-purple-500/10 font-medium" : "text-foreground/70 hover:bg-muted/20"}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            {(selectedGroup !== "Todos" || search) && (
              <div className="flex items-center gap-2 mt-2">
                {selectedGroup !== "Todos" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-medium">
                    {selectedGroup}
                    <button onClick={() => setSelectedGroup("Todos")} className="hover:text-white transition-colors"><X size={10} /></button>
                  </span>
                )}
                <span className="text-muted-foreground/30 text-[10px]">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          {/* Channel Grid */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-muted/10 flex items-center justify-center">
                  <Search size={28} className="text-muted-foreground/20" />
                </div>
                <p className="text-muted-foreground/50 text-sm">Nenhum canal encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filtered.slice(0, 200).map((ch, i) => {
                  const isPlaying = playingChannel?.u === ch.u;
                  return (
                    <button
                      key={`${ch.n}-${i}`}
                      onClick={() => playChannel(ch)}
                      className={`group flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 text-left hover:scale-[1.02] active:scale-[0.98] ${
                        isPlaying
                          ? "bg-purple-500/10 border-purple-500/30 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/20"
                          : "bg-card/40 border-border/5 hover:bg-card/70 hover:border-border/20 hover:shadow-lg hover:shadow-black/10"
                      }`}
                    >
                      {ch.l ? (
                        <img src={ch.l} alt="" className="w-10 h-10 rounded-xl object-contain bg-black/30 shrink-0 border border-white/5" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${isPlaying ? "bg-purple-500/20 border-purple-500/30" : "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-white/5"}`}>
                          <Tv size={16} className={isPlaying ? "text-purple-400" : "text-purple-400/40 group-hover:text-purple-400/60"} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-medium truncate transition-colors ${isPlaying ? "text-purple-300" : "text-foreground/90 group-hover:text-foreground"}`}>{ch.n}</p>
                        <p className="text-muted-foreground/30 text-[10px] truncate mt-0.5">{ch.g}</p>
                      </div>
                      <div className={`p-1.5 rounded-lg transition-all duration-200 ${isPlaying ? "bg-purple-500/20 text-purple-400 scale-110" : "bg-transparent text-muted-foreground/20 opacity-0 group-hover:opacity-100 group-hover:text-purple-400/60 group-hover:bg-purple-500/10"}`}>
                        {isPlaying ? <Radio size={12} className="animate-pulse" /> : <Play size={12} fill="currentColor" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {filtered.length > 200 && (
              <div className="text-center mt-6 py-3 px-4 rounded-xl bg-muted/5 border border-border/5">
                <p className="text-muted-foreground/30 text-xs">Mostrando <span className="text-foreground/50 font-medium">200</span> de <span className="text-foreground/50 font-medium">{filtered.length.toLocaleString()}</span> canais</p>
              </div>
            )}
          </div>
        </>
      )}

      <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
    </div>
  );
}
