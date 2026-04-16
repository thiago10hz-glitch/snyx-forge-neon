import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { VipModal } from "@/components/VipModal";
import {
  ArrowLeft, Code2, Search, RefreshCw, Play, Tv, X, ChevronDown, Loader2, Radio, List
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface Channel {
  n: string;
  u: string;
  l: string;
  g: string;
}

async function getInvokeErrorMessage(error: unknown) {
  const maybeResponse = (error as { context?: Response } | null)?.context;

  if (maybeResponse instanceof Response) {
    try {
      const payload = await maybeResponse.clone().json() as { error?: string; message?: string };
      return payload.error || payload.message || `Erro ${maybeResponse.status} ao sincronizar`;
    } catch {
      try {
        const text = await maybeResponse.clone().text();
        return text || `Erro ${maybeResponse.status} ao sincronizar`;
      } catch {
        return `Erro ${maybeResponse.status} ao sincronizar`;
      }
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Erro ao sincronizar";
}

export default function IPTV() {
  const { profile, session } = useAuth();
  const [showVipModal, setShowVipModal] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("Todos");
  const [playingChannel, setPlayingChannel] = useState<Channel | null>(null);
  const [showGroups, setShowGroups] = useState(false);
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
      toast.error("Faça login para sincronizar os canais.");
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

  useEffect(() => {
    if (hasAccess) loadChannels();
  }, [hasAccess, loadChannels]);

  // Extract unique groups
  const groups = useMemo(() => {
    const set = new Set(channels.map(c => c.g));
    return ["Todos", ...Array.from(set).sort()];
  }, [channels]);

  // Filter channels
  const filtered = useMemo(() => {
    let list = channels;
    if (selectedGroup !== "Todos") list = list.filter(c => c.g === selectedGroup);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.n.toLowerCase().includes(q) || c.g.toLowerCase().includes(q));
    }
    return list;
  }, [channels, selectedGroup, search]);

  // Play channel with HLS
  const playChannel = useCallback(async (ch: Channel) => {
    setPlayingChannel(ch);
    // Wait for video element to mount
    setTimeout(async () => {
      const video = videoRef.current;
      if (!video) return;
      // Try native HLS first (Safari)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = ch.u;
        video.play().catch(() => {});
      } else {
        // Load HLS.js dynamically
        try {
          const { default: Hls } = await import("hls.js");
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
            hls.loadSource(ch.u);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
          } else {
            // Fallback: try direct
            video.src = ch.u;
            video.play().catch(() => {});
          }
        } catch {
          video.src = ch.u;
          video.play().catch(() => {});
        }
      }
    }, 100);
  }, []);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30 flex items-center justify-center mx-auto">
            <Tv size={28} className="text-purple-400" />
          </div>
          <h1 className="text-lg font-bold text-foreground">SnyX TV</h1>
          <p className="text-muted-foreground/50 text-xs">
            Acesso exclusivo para membros DEV. Assista TV ao vivo com milhares de canais.
          </p>
          <div className="flex gap-2 justify-center">
            <Link to="/" className="px-3 py-1.5 rounded-lg bg-muted/10 border border-border/10 text-muted-foreground hover:bg-muted/20 transition-all text-xs flex items-center gap-1.5">
              <ArrowLeft size={12} /> Voltar
            </Link>
            <button onClick={() => setShowVipModal(true)} className="px-5 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium hover:opacity-90 transition-all text-xs">
              Obter Acesso
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
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 h-11 glass border-b border-border/10">
        <div className="flex items-center gap-2.5">
          <Link to="/" className="p-1.5 rounded-md bg-muted/10 hover:bg-muted/20 transition-all text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30 flex items-center justify-center">
              <Tv size={13} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-foreground">SnyX TV</h1>
              <p className="text-[8px] text-muted-foreground/40 hidden sm:block">{channels.length} canais disponíveis</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncChannels}
            disabled={syncing}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/10 border border-border/10 text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 transition-all text-[10px] disabled:opacity-50"
          >
            <RefreshCw size={10} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
          <Link
            to="/"
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/10 border border-border/10 text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 transition-all text-[10px]"
          >
            <Code2 size={10} /> SnyX
          </Link>
        </div>
      </div>

      {/* Player */}
      {playingChannel && (
        <div className="relative bg-black w-full" style={{ maxHeight: "50vh" }}>
          <video
            ref={videoRef}
            controls
            autoPlay
            className="w-full max-h-[50vh] bg-black"
          />
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm">
              <Radio size={10} className="text-red-500 animate-pulse" />
              <span className="text-white text-[10px] font-medium truncate max-w-[200px]">{playingChannel.n}</span>
            </div>
            <button
              onClick={() => {
                setPlayingChannel(null);
                if (videoRef.current) videoRef.current.src = "";
              }}
              className="p-1.5 rounded-md bg-black/70 backdrop-blur-sm text-white/70 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="sticky top-11 z-10 px-4 py-2 glass border-b border-border/10 flex gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar canal..."
            className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-muted/10 border border-border/10 text-foreground text-xs placeholder:text-muted-foreground/30 focus:outline-none focus:border-purple-500/30"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowGroups(!showGroups)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/10 border border-border/10 text-muted-foreground text-xs hover:bg-muted/20 transition-all whitespace-nowrap"
          >
            <List size={11} />
            <span className="hidden sm:inline max-w-[100px] truncate">{selectedGroup}</span>
            <ChevronDown size={10} />
          </button>
          {showGroups && (
            <div className="absolute right-0 top-full mt-1 w-56 max-h-60 overflow-y-auto rounded-lg bg-card border border-border/20 shadow-xl z-50">
              {groups.map(g => (
                <button
                  key={g}
                  onClick={() => { setSelectedGroup(g); setShowGroups(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/20 transition-colors ${g === selectedGroup ? "text-purple-400 bg-purple-500/10" : "text-foreground/70"}`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={24} className="text-purple-400 animate-spin" />
            <p className="text-muted-foreground/40 text-xs">Carregando canais...</p>
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Tv size={32} className="text-muted-foreground/20" />
            <p className="text-muted-foreground/40 text-xs">Nenhum canal encontrado</p>
            <button
              onClick={syncChannels}
              disabled={syncing}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs font-medium hover:opacity-90 transition-all disabled:opacity-50"
            >
              {syncing ? "Sincronizando..." : "Sincronizar Canais"}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Search size={24} className="text-muted-foreground/20" />
            <p className="text-muted-foreground/40 text-xs">Nenhum canal encontrado para "{search}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {filtered.slice(0, 200).map((ch, i) => (
              <button
                key={`${ch.n}-${i}`}
                onClick={() => playChannel(ch)}
                className={`group flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 text-left hover:scale-[1.01] ${
                  playingChannel?.u === ch.u
                    ? "bg-purple-500/10 border-purple-500/30 shadow-lg shadow-purple-500/5"
                    : "bg-card/30 border-border/10 hover:bg-card/50 hover:border-border/20"
                }`}
              >
                {ch.l ? (
                  <img
                    src={ch.l}
                    alt=""
                    className="w-8 h-8 rounded-lg object-contain bg-black/20 shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shrink-0">
                    <Tv size={14} className="text-purple-400/60" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-[12px] font-medium truncate">{ch.n}</p>
                  <p className="text-muted-foreground/30 text-[9px] truncate">{ch.g}</p>
                </div>
                <div className={`p-1 rounded-md transition-all ${
                  playingChannel?.u === ch.u
                    ? "bg-purple-500/20 text-purple-400"
                    : "bg-muted/10 text-muted-foreground/30 opacity-0 group-hover:opacity-100"
                }`}>
                  <Play size={10} fill={playingChannel?.u === ch.u ? "currentColor" : "none"} />
                </div>
              </button>
            ))}
          </div>
        )}

        {filtered.length > 200 && (
          <p className="text-center text-muted-foreground/20 text-[10px] mt-4">
            Mostrando 200 de {filtered.length} canais. Use a busca para filtrar.
          </p>
        )}
      </div>

      <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
    </div>
  );
}
