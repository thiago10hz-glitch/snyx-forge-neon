import { useState, useRef, useEffect } from "react";
import { Music, Play, Pause, Download, Loader2, Sparkles, Disc3, Mic, ListMusic, ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { VipModal } from "./VipModal";

interface GeneratedTrack {
  id: string;
  title: string;
  prompt: string;
  audioUrl: string;
  createdAt: Date;
  type: "music" | "vocal";
}

const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "Feminina", color: "#a78bfa" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", gender: "Feminina", color: "#f472b6" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "Feminina", color: "#34d399" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "Feminina", color: "#fbbf24" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", gender: "Masculina", color: "#60a5fa" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", gender: "Masculina", color: "#4ade80" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "Masculina", color: "#fb923c" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "Masculina", color: "#38bdf8" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", gender: "Masculina", color: "#c084fc" },
];

type Phase = "menu" | "create-music" | "create-vocal" | "generating" | "playing" | "library";

interface MusicPanelProps {
  onBack?: () => void;
}

/* ─── Orb Component (same style as VoiceCall) ─── */
function MusicOrb({ accent, label, levels, active, icon }: {
  accent: string; label: string; levels: number[]; active: boolean; icon?: React.ReactNode;
}) {
  return (
    <div className="relative h-[200px] w-[200px] sm:h-[240px] sm:w-[240px]">
      <div
        className="absolute inset-0 rounded-full blur-3xl transition-all duration-500"
        style={{
          background: `radial-gradient(circle, ${accent}55 0%, ${accent}15 50%, transparent 75%)`,
          opacity: active ? 1 : 0.6,
          transform: active ? "scale(1.1)" : "scale(0.95)",
        }}
      />
      {levels.map((level, index) => {
        const alpha = Math.max(0.12, 0.5 - index * 0.09);
        return (
          <div key={index} className="absolute inset-0 flex items-center justify-center">
            <div
              className="rounded-full transition-all duration-200 ease-out"
              style={{
                width: `${38 + index * 16 + level * 22}%`,
                height: `${38 + index * 16 + level * 22}%`,
                border: `1.5px solid ${accent}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`,
                boxShadow: active ? `0 0 ${8 + level * 14}px ${accent}44` : "none",
              }}
            />
          </div>
        );
      })}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex items-center justify-center rounded-full font-bold text-white shadow-2xl h-24 w-24 sm:h-28 sm:w-28 text-3xl sm:text-4xl"
          style={{
            background: `linear-gradient(145deg, ${accent}, ${accent}bb)`,
            boxShadow: `0 8px 32px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.15)`,
          }}
        >
          {icon || label[0]}
        </div>
      </div>
    </div>
  );
}

export function MusicPanel({ onBack }: MusicPanelProps) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [prompt, setPrompt] = useState("");
  const [vocalText, setVocalText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0]);
  const [_isGenerating, setIsGenerating] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState("");
  const [generatingType, setGeneratingType] = useState<"music" | "vocal">("music");
  const [tracks, setTracks] = useState<GeneratedTrack[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<GeneratedTrack | null>(null);
  const [orbLevels, setOrbLevels] = useState<number[]>([0.2, 0.28, 0.24, 0.3, 0.22]);
  const [showVipModal, setShowVipModal] = useState(false);

  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const orbIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { profile } = useAuth();
  const canUse = profile?.is_vip || profile?.is_dev;

  // Orb animation
  useEffect(() => {
    if (orbIntervalRef.current) clearInterval(orbIntervalRef.current);

    if (phase === "generating") {
      orbIntervalRef.current = setInterval(() => {
        const wave = 0.3 + (Math.sin(Date.now() / 300) + 1) * 0.2;
        setOrbLevels([wave, wave + 0.08, wave + 0.04, wave + 0.1, wave + 0.06]);
      }, 100);
    } else if (phase === "playing" && playingTrackId) {
      orbIntervalRef.current = setInterval(() => {
        setOrbLevels(Array.from({ length: 5 }, () => 0.3 + Math.random() * 0.5));
      }, 120);
    } else {
      setOrbLevels([0.2, 0.28, 0.24, 0.3, 0.22]);
    }

    return () => { if (orbIntervalRef.current) clearInterval(orbIntervalRef.current); };
  }, [phase, playingTrackId]);

  const handleGenerateMusic = async () => {
    if (!prompt.trim()) { toast.error("Descreva a música!"); return; }
    if (!canUse) { setShowVipModal(true); return; }

    setGeneratingType("music");
    setPhase("generating");
    setIsGenerating(true);
    setGeneratingPhase("Compondo melodia...");

    const phases = ["Criando harmonia...", "Mixando instrumentos...", "Masterizando...", "Finalizando..."];
    let idx = 0;
    const interval = setInterval(() => { idx = (idx + 1) % phases.length; setGeneratingPhase(phases[idx]); }, 4000);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-music`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Erro ao gerar música");

      const audioUrl = data.audioUrl || (data.audioBase64 ? `data:audio/mpeg;base64,${data.audioBase64}` : "");
      if (!audioUrl) throw new Error("Nenhum áudio retornado");

      const newTrack: GeneratedTrack = {
        id: crypto.randomUUID(),
        title: data.title || prompt.slice(0, 40),
        prompt: prompt.trim(),
        audioUrl,
        createdAt: new Date(),
        type: "music",
      };
      setTracks(prev => [newTrack, ...prev]);
      setCurrentTrack(newTrack);
      setPhase("playing");
      toast.success("🎵 Música criada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar música");
      setPhase("create-music");
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
      setGeneratingPhase("");
    }
  };

  const handleGenerateVocal = async () => {
    if (!vocalText.trim()) { toast.error("Escreva a letra!"); return; }
    if (!canUse) { setShowVipModal(true); return; }

    setGeneratingType("vocal");
    setPhase("generating");
    setIsGenerating(true);
    setGeneratingPhase("Preparando voz...");

    const phases = ["Processando vocal...", "Aplicando estilo...", "Finalizando..."];
    let idx = 0;
    const interval = setInterval(() => { idx = (idx + 1) % phases.length; setGeneratingPhase(phases[idx]); }, 3000);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-vocals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ text: vocalText.trim(), voiceId: selectedVoice.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Erro ao gerar vocal");

      const audioUrl = data.audioUrl || (data.audioBase64 ? `data:audio/mpeg;base64,${data.audioBase64}` : "");
      if (!audioUrl) throw new Error("Nenhum áudio retornado");

      const newTrack: GeneratedTrack = {
        id: crypto.randomUUID(),
        title: `Vocal - ${selectedVoice.name}`,
        prompt: vocalText.trim().slice(0, 60),
        audioUrl,
        createdAt: new Date(),
        type: "vocal",
      };
      setTracks(prev => [newTrack, ...prev]);
      setCurrentTrack(newTrack);
      setPhase("playing");
      toast.success("🎤 Vocal gerado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar vocal");
      setPhase("create-vocal");
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
      setGeneratingPhase("");
    }
  };

  const togglePlay = (track: GeneratedTrack) => {
    const audio = audioRefs.current[track.id];
    if (!audio) return;
    if (playingTrackId === track.id) {
      audio.pause();
      setPlayingTrackId(null);
    } else {
      if (playingTrackId && audioRefs.current[playingTrackId]) audioRefs.current[playingTrackId]?.pause();
      audio.play();
      setPlayingTrackId(track.id);
      setCurrentTrack(track);
    }
  };

  const accent = generatingType === "vocal" ? selectedVoice.color : "#a855f7";

  return (
    <div className="fixed inset-0 z-[999] flex flex-col" style={{
      background: `radial-gradient(ellipse at 50% 30%, ${accent}12 0%, transparent 60%), linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.97) 100%)`,
    }}>
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full blur-[120px] opacity-30" style={{ background: accent }} />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Back button (always visible) */}
      <button
        onClick={() => {
          if (phase === "menu" || phase === "library") { onBack?.(); }
          else if (phase === "generating") { /* can't go back while generating */ }
          else if (phase === "playing") { setPhase("menu"); }
          else { setPhase("menu"); }
        }}
        className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-muted/15 text-muted-foreground/70  transition-all hover:bg-muted/30 hover:text-foreground"
      >
        <ArrowLeft size={18} />
      </button>

      {/* Library button */}
      {phase !== "library" && phase !== "generating" && tracks.length > 0 && (
        <button
          onClick={() => setPhase("library")}
          className="absolute right-4 top-4 z-20 flex h-10 items-center gap-1.5 px-3 rounded-full bg-muted/15 text-muted-foreground/70  transition-all hover:bg-muted/30 hover:text-foreground text-xs font-medium"
        >
          <ListMusic size={14} />
          {tracks.length}
        </button>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">

        {/* ═══ MENU PHASE ═══ */}
        {phase === "menu" && (
          <div className="flex w-full max-w-sm flex-col items-center gap-8">
            <div className="space-y-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40 font-medium">SnyX Music</p>
              <h2 className="text-xl font-semibold text-foreground">O que você quer criar?</h2>
            </div>

            <div className="flex w-full gap-4">
              {/* Music card */}
              <button
                onClick={() => { if (!canUse) { setShowVipModal(true); return; } setPhase("create-music"); }}
                className="flex flex-1 flex-col items-center gap-3 rounded-3xl border p-6 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                style={{ borderColor: "#a855f766", background: "linear-gradient(180deg, #a855f718 0%, #a855f708 100%)", boxShadow: "0 8px 32px #a855f720" }}
              >
                <div className="h-16 w-16 rounded-full shadow-lg flex items-center justify-center" style={{ background: "linear-gradient(145deg, #a855f7, #a855f7aa)", boxShadow: "0 4px 20px #a855f744" }}>
                  <Music size={28} className="text-white" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-foreground">Música</span>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">Gerar faixa completa</p>
                </div>
              </button>

              {/* Vocal card */}
              <button
                onClick={() => { if (!canUse) { setShowVipModal(true); return; } setPhase("create-vocal"); }}
                className="flex flex-1 flex-col items-center gap-3 rounded-3xl border p-6 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                style={{ borderColor: "#f472b666", background: "linear-gradient(180deg, #f472b618 0%, #f472b608 100%)", boxShadow: "0 8px 32px #f472b620" }}
              >
                <div className="h-16 w-16 rounded-full shadow-lg flex items-center justify-center" style={{ background: "linear-gradient(145deg, #f472b6, #f472b6aa)", boxShadow: "0 4px 20px #f472b644" }}>
                  <Mic size={28} className="text-white" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-foreground">Vocal</span>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">Voz com ElevenLabs</p>
                </div>
              </button>
            </div>

            {!canUse && (
              <button
                onClick={() => setShowVipModal(true)}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-bold hover:shadow-lg hover:shadow-purple-500/20 transition-all"
              >
                ⭐ Upgrade VIP / DEV
              </button>
            )}
          </div>
        )}

        {/* ═══ CREATE MUSIC PHASE ═══ */}
        {phase === "create-music" && (
          <div className="flex w-full max-w-md flex-col items-center gap-6">
            <div className="space-y-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40 font-medium">Criar Música</p>
              <h2 className="text-xl font-semibold text-foreground">Descreva sua música</h2>
            </div>

            <MusicOrb accent="#a855f7" label="♫" levels={orbLevels} active={false} icon={<Music size={36} className="text-white" />} />

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Ex: Funk animado pra festa com batida pesada..."
              className="w-full h-28 bg-muted/10 border border-border/15 rounded-2xl p-4 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none resize-none focus:border-purple-500/30 transition-colors "
            />

            {/* Quick tags */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {["Pop", "Funk BR", "Trap", "Lo-fi", "R&B", "Rock", "EDM", "Sertanejo", "Jazz", "Hip Hop"].map(s => (
                <button
                  key={s}
                  onClick={() => setPrompt(prev => prev ? `${prev}, ${s}` : s)}
                  className="px-3 py-1.5 text-[11px] rounded-full border border-border/15 text-muted-foreground/60 hover:border-purple-500/30 hover:text-purple-400 hover:bg-purple-500/5 transition-all"
                >
                  + {s}
                </button>
              ))}
            </div>

            <button
              onClick={handleGenerateMusic}
              disabled={!prompt.trim()}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-white shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-40"
              style={{ background: "linear-gradient(145deg, #a855f7, #a855f7cc)", boxShadow: "0 8px 40px #a855f755, 0 0 0 4px #a855f715" }}
            >
              <Sparkles size={28} />
            </button>
          </div>
        )}

        {/* ═══ CREATE VOCAL PHASE ═══ */}
        {phase === "create-vocal" && (
          <div className="flex w-full max-w-md flex-col items-center gap-6">
            <div className="space-y-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40 font-medium">Criar Vocal</p>
              <h2 className="text-xl font-semibold text-foreground">Escolha a voz</h2>
            </div>

            {/* Voice grid */}
            <div className="flex gap-3 overflow-x-auto pb-2 max-w-full scrollbar-none">
              {VOICES.map(v => {
                const sel = selectedVoice.id === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVoice(v)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all duration-300 shrink-0 ${sel ? "scale-[1.05] -translate-y-1" : "hover:scale-[1.02]"}`}
                    style={sel ? { borderColor: `${v.color}66`, background: `linear-gradient(180deg, ${v.color}18 0%, ${v.color}08 100%)`, boxShadow: `0 4px 16px ${v.color}20` } : { borderColor: "hsl(var(--border) / 0.12)", background: "hsl(var(--card) / 0.3)" }}
                  >
                    <div className="h-10 w-10 rounded-full" style={{ background: `linear-gradient(145deg, ${v.color}, ${v.color}aa)` }} />
                    <span className="text-[11px] font-medium text-foreground">{v.name}</span>
                    <span className="text-[9px] text-muted-foreground/40">{v.gender}</span>
                  </button>
                );
              })}
            </div>

            <textarea
              value={vocalText}
              onChange={e => setVocalText(e.target.value)}
              placeholder="Escreva a letra ou texto que a voz vai cantar/falar..."
              className="w-full h-28 bg-muted/10 border border-border/15 rounded-2xl p-4 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none resize-none focus:border-pink-500/30 transition-colors "
            />

            <button
              onClick={handleGenerateVocal}
              disabled={!vocalText.trim()}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-white shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-40"
              style={{ background: `linear-gradient(145deg, ${selectedVoice.color}, ${selectedVoice.color}cc)`, boxShadow: `0 8px 40px ${selectedVoice.color}55, 0 0 0 4px ${selectedVoice.color}15` }}
            >
              <Mic size={28} />
            </button>
          </div>
        )}

        {/* ═══ GENERATING PHASE ═══ */}
        {phase === "generating" && (
          <div className="flex flex-col items-center gap-6">
            <div className="space-y-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40 font-medium">
                {generatingType === "music" ? "Gerando Música" : "Gerando Vocal"}
              </p>
              <h2 className="text-2xl font-semibold text-foreground">
                {generatingType === "vocal" ? selectedVoice.name : "SnyX AI"}
              </h2>
            </div>

            <MusicOrb
              accent={accent}
              label={generatingType === "music" ? "♫" : selectedVoice.name}
              levels={orbLevels}
              active
              icon={generatingType === "music" ? <Disc3 size={36} className="text-white animate-spin" style={{ animationDuration: "3s" }} /> : undefined}
            />

            <p className="animate-pulse text-xs text-muted-foreground/60 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {generatingPhase}
            </p>

            {/* Waveform bars */}
            <div className="flex gap-0.5">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full animate-pulse"
                  style={{
                    height: `${8 + Math.random() * 24}px`,
                    background: accent,
                    opacity: 0.4,
                    animationDelay: `${i * 0.08}s`,
                    animationDuration: "0.5s",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ═══ PLAYING PHASE ═══ */}
        {phase === "playing" && currentTrack && (
          <div className="flex flex-col items-center gap-5">
            <div className="space-y-1 text-center">
              <h2 className="text-2xl font-semibold text-foreground">{currentTrack.title}</h2>
              <p className="text-xs font-medium" style={{ color: `${accent}cc` }}>
                {playingTrackId === currentTrack.id ? "♫ Tocando..." : "Pronto para tocar"}
              </p>
            </div>

            <MusicOrb
              accent={accent}
              label={currentTrack.type === "vocal" ? selectedVoice.name : "♫"}
              levels={orbLevels}
              active={playingTrackId === currentTrack.id}
              icon={currentTrack.type === "music" ? <Disc3 size={36} className={`text-white ${playingTrackId === currentTrack.id ? "animate-spin" : ""}`} style={{ animationDuration: "3s" }} /> : undefined}
            />

            <audio
              ref={el => { audioRefs.current[currentTrack.id] = el; }}
              src={currentTrack.audioUrl}
              onEnded={() => setPlayingTrackId(null)}
              preload="auto"
            />

            <div className="flex items-center gap-6 pt-2">
              {/* Play/Pause */}
              <button
                onClick={() => togglePlay(currentTrack)}
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-white shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
                style={{ background: `linear-gradient(145deg, ${accent}, ${accent}cc)`, boxShadow: `0 8px 40px ${accent}55, 0 0 0 4px ${accent}15` }}
              >
                {playingTrackId === currentTrack.id ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              {/* Download */}
              <a
                href={currentTrack.audioUrl}
                download={`snyx-${currentTrack.type}-${currentTrack.id.slice(0, 8)}.mp3`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-border/15 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted/15 transition-all"
              >
                <Download size={14} /> Baixar
              </a>

              {/* Create another */}
              <button
                onClick={() => setPhase("menu")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-border/15 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted/15 transition-all"
              >
                <RefreshCw size={14} /> Criar outra
              </button>
            </div>
          </div>
        )}

        {/* ═══ LIBRARY PHASE ═══ */}
        {phase === "library" && (
          <div className="w-full max-w-lg">
            <div className="space-y-1 text-center mb-6">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40 font-medium">Biblioteca</p>
              <h2 className="text-xl font-semibold text-foreground">Suas Criações</h2>
            </div>

            {tracks.length === 0 ? (
              <div className="text-center py-12">
                <Disc3 size={40} className="text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground/40">Nenhuma criação ainda</p>
                <button onClick={() => setPhase("menu")} className="mt-4 px-4 py-2 rounded-full text-xs font-medium text-purple-400 border border-purple-500/20 hover:bg-purple-500/10 transition-all">
                  Criar agora
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {tracks.map(track => {
                  const isPlaying = playingTrackId === track.id;
                  const tAccent = track.type === "vocal" ? "#f472b6" : "#a855f7";
                  return (
                    <div
                      key={track.id}
                      className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${isPlaying ? "bg-purple-500/10 border border-purple-500/20" : "bg-muted/5 border border-border/10 hover:bg-muted/10"}`}
                    >
                      <button
                        onClick={() => {
                          setCurrentTrack(track);
                          togglePlay(track);
                        }}
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all"
                        style={{ background: isPlaying ? `linear-gradient(135deg, ${tAccent}, ${tAccent}aa)` : `${tAccent}20` }}
                      >
                        {isPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} style={{ color: tAccent }} className="ml-0.5" />}
                      </button>
                      <audio
                        ref={el => { audioRefs.current[track.id] = el; }}
                        src={track.audioUrl}
                        onEnded={() => { if (playingTrackId === track.id) setPlayingTrackId(null); }}
                        preload="none"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{track.title}</p>
                        <p className="text-[10px] text-muted-foreground/40">
                          {track.type === "music" ? "🎵 Música" : "🎤 Vocal"} • {track.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <a
                        href={track.audioUrl}
                        download={`snyx-${track.id.slice(0, 8)}.mp3`}
                        className="p-2 rounded-lg text-muted-foreground/30 hover:text-foreground hover:bg-muted/15 transition-all"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
    </div>
  );
}
