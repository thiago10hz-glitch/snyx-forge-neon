import { useState, useRef, useEffect } from "react";
import { Music, Play, Pause, Download, Loader2, Sparkles, Disc3, ChevronRight, ChevronLeft, RefreshCw, Mic, MicOff, Type, Wand2, ListMusic, Clock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { VipModal } from "./VipModal";

import vibeHighway from "@/assets/vibes/highway.jpg";
import vibeLove from "@/assets/vibes/love.jpg";
import vibeGym from "@/assets/vibes/gym.jpg";
import vibeMidnight from "@/assets/vibes/midnight.jpg";
import vibeDance from "@/assets/vibes/dance.jpg";
import vibeLofi from "@/assets/vibes/lofi.jpg";
import vibeFunk from "@/assets/vibes/funk.jpg";
import vibeEdm from "@/assets/vibes/edm.jpg";
import vibeBossanova from "@/assets/vibes/bossanova.jpg";

interface GeneratedTrack {
  id: string;
  title: string;
  prompt: string;
  audioUrl: string;
  duration: number;
  createdAt: Date;
  type: "music" | "vocal";
}

type CreationMode = "easy" | "custom";


const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "Feminina", style: "Pop / Suave" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", gender: "Feminina", style: "R&B / Soul" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "Feminina", style: "Pop / Energética" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "Feminina", style: "Indie / Delicada" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", gender: "Masculina", style: "Rock / Grave" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", gender: "Masculina", style: "Pop / Versátil" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "Masculina", style: "Narração / Grave" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "Masculina", style: "Rap / Hip-Hop" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "Masculina", style: "Pop / Suave" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", gender: "Masculina", style: "MPB / Clássico" },
];

interface MusicPanelProps {
  onBack?: () => void;
}

const STYLE_SUGGESTIONS = [
  "Pop", "Funk BR", "Trap", "Lo-fi", "R&B", "Rock", "EDM",
  "K-Pop", "Sertanejo", "Jazz", "Bossa Nova", "Cyberpunk",
  "Vaporwave", "Blues", "Hip Hop", "Reggaeton", "Pagode",
  "MPB", "Indie", "Classical",
];

const MOOD_TAGS = [
  "Animado", "Melancólico", "Romântico", "Motivacional",
  "Relaxante", "Energético", "Nostálgico", "Sombrio",
];

const INSTRUMENT_TAGS = [
  "Piano", "Guitarra", "Violão", "808 Bass", "Synth",
  "Bateria", "Violino", "Flauta", "Saxofone",
];

const SAMPLE_TRACKS = [
  { title: "Noite Estrelada", plays: "2.1K", author: "SnyX AI", image: vibeMidnight },
  { title: "Batida Tropical", plays: "1.8K", author: "SnyX AI", image: vibeFunk },
  { title: "Melodia do Pôr do Sol", plays: "1.5K", author: "SnyX AI", image: vibeHighway },
  { title: "Sonho Eletrônico", plays: "1.3K", author: "SnyX AI", image: vibeEdm },
  { title: "Café & Violão", plays: "980", author: "SnyX AI", image: vibeBossanova },
  { title: "Força Interior", plays: "850", author: "SnyX AI", image: vibeGym },
  { title: "Amor Infinito", plays: "720", author: "SnyX AI", image: vibeLove },
  { title: "Neon Dreams", plays: "650", author: "SnyX AI", image: vibeEdm },
  { title: "Ritmo da Madrugada", plays: "590", author: "SnyX AI", image: vibeDance },
  { title: "Chuva de Estrelas", plays: "480", author: "SnyX AI", image: vibeLofi },
];

const PLACEHOLDER_PROMPTS = [
  "Descreva a música que você quer criar...",
  "Ex: Uma música animada de funk para festa",
  "Ex: Trap melancólico com piano suave",
  "Ex: Rock com guitarra distorcida e vocal marcante",
  "Ex: Jazz suave para uma noite chuvosa",
];

function HorizontalScroll({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };
  return (
    <div className={`relative group ${className}`}>
      <button onClick={() => scroll("left")} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur border border-border/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity -translate-x-3">
        <ChevronLeft size={16} />
      </button>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
        {children}
      </div>
      <button onClick={() => scroll("right")} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur border border-border/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-3">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export function MusicPanel({ onBack }: MusicPanelProps) {
  // Creation state
  const [mode, setMode] = useState<CreationMode>("easy");
  const [easyPrompt, setEasyPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [style, setStyle] = useState("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [vocalGender, setVocalGender] = useState<"female" | "male">("female");
  const [songTitle, setSongTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  // Tracks state
  const [tracks, setTracks] = useState<GeneratedTrack[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  // Vocals state
  const [vocalText, setVocalText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [isGeneratingVocal, setIsGeneratingVocal] = useState(false);

  // UI state
  const [showVipModal, setShowVipModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "vocals" | "library">("create");

  const { profile } = useAuth();
  const canUse = profile?.is_vip || profile?.is_dev;

  useEffect(() => {
    const interval = setInterval(() => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_PROMPTS.length), 4000);
    return () => clearInterval(interval);
  }, []);

  const toggleStyle = (s: string) => {
    setSelectedStyles((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : prev.length < 5 ? [...prev, s] : prev
    );
  };

  const shuffleStyles = () => {
    const shuffled = [...STYLE_SUGGESTIONS].sort(() => Math.random() - 0.5);
    setSelectedStyles(shuffled.slice(0, 3));
  };

  const buildPrompt = () => {
    if (mode === "easy") return easyPrompt.trim();

    const parts: string[] = [];
    if (selectedStyles.length > 0) parts.push(selectedStyles.join(", "));
    if (style.trim()) parts.push(style.trim());
    if (vocalGender === "male") parts.push("male vocals");
    else parts.push("female vocals");
    if (instrumental) parts.push("instrumental, no vocals");
    if (lyrics.trim()) parts.push(`Lyrics: ${lyrics.trim().slice(0, 200)}`);
    if (songTitle.trim()) parts.push(`Title: "${songTitle.trim()}"`);
    return parts.join(". ") || "";
  };

  const handleGenerate = async () => {
    const finalPrompt = buildPrompt();
    if (!finalPrompt) {
      toast.error("Descreva a música que deseja criar!");
      return;
    }
    if (!canUse) {
      setShowVipModal(true);
      return;
    }

    setIsGenerating(true);
    setGeneratingPhase("Preparando...");
    const phases = ["Compondo melodia...", "Criando harmonia...", "Mixando instrumentos...", "Masterizando áudio...", "Finalizando..."];
    let phaseIdx = 0;
    const interval = setInterval(() => {
      phaseIdx = (phaseIdx + 1) % phases.length;
      setGeneratingPhase(phases[phaseIdx]);
    }, 4000);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-music`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ prompt: finalPrompt, duration: 30 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Erro ao gerar música");

      const newTrack: GeneratedTrack = {
        id: crypto.randomUUID(),
        title: data.title || songTitle || finalPrompt.slice(0, 40),
        prompt: finalPrompt,
        audioUrl: data.audioUrl || (data.audioBase64 ? `data:audio/mpeg;base64,${data.audioBase64}` : ""),
        duration: 30,
        createdAt: new Date(),
        type: "music",
      };
      setTracks((prev) => [newTrack, ...prev]);
      toast.success("Música criada com sucesso! 🎵");
      setActiveTab("library");
    } catch (err: any) {
      console.error("Music generation error:", err);
      toast.error(err.message || "Erro ao gerar música");
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
      setGeneratingPhase("");
    }
  };

  const handleGenerateVocal = async () => {
    if (!vocalText.trim()) {
      toast.error("Escreva a letra para gerar o vocal!");
      return;
    }
    if (!canUse) {
      setShowVipModal(true);
      return;
    }

    setIsGeneratingVocal(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-vocals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ text: vocalText.trim(), style: VOICES.find(v => v.id === selectedVoice)?.style || "Pop vocal" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Erro ao gerar vocal");

      const voiceName = VOICES.find(v => v.id === selectedVoice)?.name || "Vocal";
      const newTrack: GeneratedTrack = {
        id: crypto.randomUUID(),
        title: `Vocal - ${voiceName}`,
        prompt: vocalText.trim().slice(0, 60),
        audioUrl: data.audioUrl || (data.audioBase64 ? `data:audio/mpeg;base64,${data.audioBase64}` : ""),
        duration: 0,
        createdAt: new Date(),
        type: "vocal",
      };
      setTracks((prev) => [newTrack, ...prev]);
      toast.success("Vocal gerado com sucesso! 🎤");
      setActiveTab("library");
    } catch (err: any) {
      console.error("Vocal generation error:", err);
      toast.error(err.message || "Erro ao gerar vocal");
    } finally {
      setIsGeneratingVocal(false);
    }
  };

  const togglePlay = (trackId: string) => {
    const audio = audioRefs.current[trackId];
    if (!audio) return;
    if (playingTrackId === trackId) {
      audio.pause();
      setPlayingTrackId(null);
    } else {
      if (playingTrackId && audioRefs.current[playingTrackId]) audioRefs.current[playingTrackId]?.pause();
      audio.play();
      setPlayingTrackId(trackId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden w-full">
      {/* Top Navigation */}
      <div className="shrink-0 border-b border-border/10 bg-background/95 backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex items-center justify-between h-12">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/20 transition-all"
                title="Voltar ao chat"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <Disc3 size={20} className="text-purple-400" />
            <span className="text-sm font-bold text-foreground">SnyX Música</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 ml-1">AI</span>
          </div>
          <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("create")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "create" ? "bg-purple-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Sparkles size={12} className="inline mr-1" />
              Criar
            </button>
            <button
              onClick={() => setActiveTab("vocals")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "vocals" ? "bg-purple-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Mic size={12} className="inline mr-1" />
              Vozes
            </button>
            <button
              onClick={() => setActiveTab("library")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === "library" ? "bg-purple-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ListMusic size={12} className="inline mr-1" />
              Biblioteca
              {tracks.length > 0 && (
                <span className="ml-1 text-[9px] bg-purple-500/30 px-1 rounded-full">{tracks.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === "create" ? (
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
            <div className="flex flex-col lg:flex-row gap-6">

              {/* Left Column — Creation Panel */}
              <div className="flex-1 min-w-0 space-y-5">

                {/* Mode Tabs: Easy / Custom */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-muted/20 rounded-xl p-1 border border-border/10">
                    <button
                      onClick={() => setMode("easy")}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${mode === "easy" ? "bg-purple-600 text-white shadow-md shadow-purple-500/20" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Fácil
                    </button>
                    <button
                      onClick={() => setMode("custom")}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${mode === "custom" ? "bg-purple-600 text-white shadow-md shadow-purple-500/20" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Personalizado
                    </button>
                  </div>
                </div>

                {mode === "easy" ? (
                  /* Easy Mode */
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border/15 bg-muted/5 p-5 space-y-4">
                      <p className="text-sm text-muted-foreground/70">Descreva em uma linha a música que você quer criar</p>
                      <textarea
                        value={easyPrompt}
                        onChange={(e) => setEasyPrompt(e.target.value)}
                        placeholder={PLACEHOLDER_PROMPTS[placeholderIdx]}
                        className="w-full h-24 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 outline-none resize-none"
                        disabled={isGenerating}
                      />
                    </div>

                    {/* Quick Style Tags */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground/60">Estilos rápidos</span>
                        <button onClick={shuffleStyles} className="text-muted-foreground/40 hover:text-purple-400 transition-colors">
                          <RefreshCw size={13} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {STYLE_SUGGESTIONS.slice(0, 12).map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setEasyPrompt((prev) => (prev ? `${prev}, ${s}` : s));
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg border border-border/15 text-muted-foreground/70 hover:border-purple-500/30 hover:text-purple-400 hover:bg-purple-500/5 transition-all"
                          >
                            + {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Custom Mode */
                  <div className="space-y-4">

                    {/* Lyrics Section */}
                    <div className="rounded-2xl border border-border/15 bg-muted/5 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border/10">
                        <span className="text-sm font-semibold text-foreground">Letra</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setInstrumental(!instrumental)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${instrumental ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "text-muted-foreground/50 border border-border/10 hover:border-purple-500/20"}`}
                          >
                            {instrumental ? <MicOff size={12} /> : <Mic size={12} />}
                            Instrumental
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={lyrics}
                        onChange={(e) => setLyrics(e.target.value)}
                        placeholder={instrumental ? "Sem letra — modo instrumental ativado" : "Escreva a letra da música aqui ou deixe em branco para instrumental..."}
                        className="w-full h-36 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 outline-none resize-none px-4 py-3"
                        disabled={isGenerating || instrumental}
                      />
                      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border/10">
                        <button className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-purple-400 transition-colors">
                          <Wand2 size={12} />
                          Otimizar
                        </button>
                        <button className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-purple-400 transition-colors">
                          <Type size={12} />
                          Gerar Letra
                        </button>
                      </div>
                    </div>

                    {/* Style Section */}
                    <div className="rounded-2xl border border-border/15 bg-muted/5 p-4 space-y-3">
                      <span className="text-sm font-semibold text-foreground">Estilo</span>
                      <textarea
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                        placeholder="Ex: Trap melancólico com 808 pesado, piano suave..."
                        className="w-full h-16 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 outline-none resize-none"
                        disabled={isGenerating}
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={shuffleStyles} className="w-7 h-7 rounded-lg border border-border/15 flex items-center justify-center text-muted-foreground/40 hover:text-purple-400 hover:border-purple-500/30 transition-all">
                          <RefreshCw size={13} />
                        </button>
                        {STYLE_SUGGESTIONS.slice(0, 8).map((s) => {
                          const active = selectedStyles.includes(s);
                          return (
                            <button
                              key={s}
                              onClick={() => toggleStyle(s)}
                              className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${active ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "border-border/15 text-muted-foreground/60 hover:border-purple-500/20 hover:text-purple-400"}`}
                            >
                              + {s}
                            </button>
                          );
                        })}
                      </div>

                      {/* Mood Tags */}
                      <div className="pt-1">
                        <span className="text-xs text-muted-foreground/50 mb-1.5 block">Humor</span>
                        <div className="flex flex-wrap gap-1.5">
                          {MOOD_TAGS.map((m) => {
                            const active = selectedStyles.includes(m);
                            return (
                              <button
                                key={m}
                                onClick={() => toggleStyle(m)}
                                className={`px-2.5 py-1 text-[11px] rounded-md border transition-all ${active ? "bg-purple-500/15 text-purple-400 border-purple-500/25" : "border-border/10 text-muted-foreground/50 hover:border-purple-500/15 hover:text-purple-400"}`}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Instrument Tags */}
                      <div className="pt-1">
                        <span className="text-xs text-muted-foreground/50 mb-1.5 block">Instrumentos</span>
                        <div className="flex flex-wrap gap-1.5">
                          {INSTRUMENT_TAGS.map((inst) => {
                            const active = selectedStyles.includes(inst);
                            return (
                              <button
                                key={inst}
                                onClick={() => toggleStyle(inst)}
                                className={`px-2.5 py-1 text-[11px] rounded-md border transition-all ${active ? "bg-purple-500/15 text-purple-400 border-purple-500/25" : "border-border/10 text-muted-foreground/50 hover:border-purple-500/15 hover:text-purple-400"}`}
                              >
                                {inst}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Vocal Gender */}
                    <div className="rounded-2xl border border-border/15 bg-muted/5 p-4 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">Voz</span>
                      <div className="flex items-center bg-muted/20 rounded-lg p-0.5 border border-border/10">
                        <button
                          onClick={() => setVocalGender("female")}
                          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${vocalGender === "female" ? "bg-purple-600 text-white" : "text-muted-foreground/60 hover:text-foreground"}`}
                        >
                          Feminina
                        </button>
                        <button
                          onClick={() => setVocalGender("male")}
                          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${vocalGender === "male" ? "bg-purple-600 text-white" : "text-muted-foreground/60 hover:text-foreground"}`}
                        >
                          Masculina
                        </button>
                      </div>
                    </div>

                    {/* Song Title */}
                    <div className="rounded-2xl border border-border/15 bg-muted/5 p-4 space-y-2">
                      <span className="text-sm font-semibold text-foreground">Título da Música</span>
                      <input
                        value={songTitle}
                        onChange={(e) => setSongTitle(e.target.value.slice(0, 50))}
                        placeholder="Nome da sua música"
                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 outline-none"
                        disabled={isGenerating}
                      />
                      <span className="text-[10px] text-muted-foreground/30 text-right block">{songTitle.length}/50</span>
                    </div>
                  </div>
                )}

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || (mode === "easy" ? !easyPrompt.trim() : !style.trim() && selectedStyles.length === 0 && !lyrics.trim())}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {generatingPhase}
                    </>
                  ) : (
                    <>
                      <Music size={16} />
                      Criar Música
                    </>
                  )}
                </button>

                {/* Generating Animation */}
                {isGenerating && (
                  <div className="flex flex-col items-center gap-3 py-6 animate-fade-in">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 animate-spin opacity-20" style={{ animationDuration: "3s" }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Disc3 size={28} className="text-purple-400 animate-spin" style={{ animationDuration: "2s" }} />
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-purple-500/40 rounded-full animate-pulse"
                          style={{ height: `${8 + Math.random() * 20}px`, animationDelay: `${i * 0.1}s`, animationDuration: "0.6s" }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column — Preview / Trending */}
              <div className="w-full lg:w-[380px] shrink-0 space-y-5">

                {/* Recently Generated Quick View */}
                {tracks.length > 0 && (
                  <div className="rounded-2xl border border-border/15 bg-muted/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">Última criação</span>
                      <button onClick={() => setActiveTab("library")} className="text-[11px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-0.5">
                        Ver todas <ChevronRight size={12} />
                      </button>
                    </div>
                    {(() => {
                      const latest = tracks[0];
                      const isPlaying = playingTrackId === latest.id;
                      return (
                        <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isPlaying ? "bg-purple-500/10 border border-purple-500/20" : "bg-muted/10 border border-transparent"}`}>
                          <button
                            onClick={() => togglePlay(latest.id)}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${isPlaying ? "bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-purple-500/20" : "bg-purple-500/15 hover:bg-purple-500/25"}`}
                          >
                            {isPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-purple-400 ml-0.5" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{latest.title}</p>
                            <p className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                              <Clock size={10} />
                              {latest.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <audio
                            ref={(el) => { audioRefs.current[latest.id] = el; }}
                            src={latest.audioUrl}
                            onEnded={() => { if (playingTrackId === latest.id) setPlayingTrackId(null); }}
                            preload="auto"
                          />
                          <a
                            href={latest.audioUrl}
                            download={`snyx-${latest.id.slice(0, 8)}.mp3`}
                            className="p-2 rounded-lg text-muted-foreground/40 hover:text-purple-400 hover:bg-purple-500/10 transition-all"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Trending / Sample Tracks */}
                <div className="rounded-2xl border border-border/15 bg-muted/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">🔥 Trending</span>
                    <span className="text-[10px] text-muted-foreground/40">By SnyX AI</span>
                  </div>
                  <div className="space-y-0.5">
                    {SAMPLE_TRACKS.slice(0, 6).map((track, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          if (!canUse) { setShowVipModal(true); return; }
                          setEasyPrompt(track.title);
                          setMode("easy");
                          toast.info(`Prompt preenchido: "${track.title}" — clique em Criar Música!`);
                        }}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/10 transition-all cursor-pointer group"
                      >
                        <span className="text-[10px] text-muted-foreground/30 w-4 text-right shrink-0">{i + 1}</span>
                        <img src={track.image} alt={track.title} loading="lazy" width={40} height={40} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{track.title}</p>
                          <p className="text-[10px] text-muted-foreground/40">▶ {track.plays}</p>
                        </div>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-purple-500/10">
                          <Play size={12} className="text-purple-400 ml-0.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* VIP Banner */}
                {!canUse && (
                  <div className="rounded-2xl bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-500/20 p-5 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto">
                      <Sparkles size={20} className="text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Desbloqueie a criação</h3>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">Acesso ilimitado à geração de músicas com IA</p>
                    </div>
                    <button
                      onClick={() => setShowVipModal(true)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-bold hover:shadow-lg hover:shadow-purple-500/20 transition-all"
                    >
                      Upgrade VIP / DEV
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === "vocals" ? (
          /* Vocals Tab */
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left — Voice Selection */}
              <div className="flex-1 min-w-0 space-y-5">
                <h2 className="text-lg font-bold text-foreground">Gerar Vocal com IA</h2>
                <p className="text-sm text-muted-foreground/60">Escolha uma voz e escreva a letra para gerar um vocal realista</p>

                {/* Voice Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {VOICES.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`rounded-2xl border p-4 text-left transition-all ${selectedVoice === voice.id ? "bg-purple-500/15 border-purple-500/30 shadow-md shadow-purple-500/10" : "bg-muted/5 border-border/15 hover:border-purple-500/20"}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center mb-2">
                        <Mic size={16} className="text-purple-400" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{voice.name}</p>
                      <p className="text-[10px] text-muted-foreground/50">{voice.gender}</p>
                      <p className="text-[10px] text-purple-400/60 mt-0.5">{voice.style}</p>
                    </button>
                  ))}
                </div>

                {/* Lyrics Input */}
                <div className="rounded-2xl border border-border/15 bg-muted/5 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/10">
                    <span className="text-sm font-semibold text-foreground">Letra / Texto para cantar</span>
                  </div>
                  <textarea
                    value={vocalText}
                    onChange={(e) => setVocalText(e.target.value)}
                    placeholder="Escreva a letra que a voz vai cantar ou falar..."
                    className="w-full h-40 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 outline-none resize-none px-4 py-3"
                    disabled={isGeneratingVocal}
                  />
                </div>

                {/* Generate Vocal Button */}
                <button
                  onClick={handleGenerateVocal}
                  disabled={isGeneratingVocal || !vocalText.trim()}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                >
                  {isGeneratingVocal ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Gerando vocal...
                    </>
                  ) : (
                    <>
                      <Mic size={16} />
                      Gerar Vocal
                    </>
                  )}
                </button>
              </div>

              {/* Right — Info */}
              <div className="w-full lg:w-[380px] shrink-0 space-y-5">
                <div className="rounded-2xl border border-border/15 bg-muted/5 p-5 space-y-3">
                  <h3 className="text-sm font-bold text-foreground">💡 Dicas</h3>
                  <ul className="space-y-2 text-xs text-muted-foreground/60">
                    <li>• Escreva letras claras e com pontuação para melhor resultado</li>
                    <li>• Cada voz tem um estilo diferente — experimente!</li>
                    <li>• Vozes suportam português e inglês</li>
                    <li>• Combine a música gerada na aba Criar com o vocal gerado aqui</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Library Tab */
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">

            {/* User's Generated Tracks */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Suas Músicas</h2>
                <span className="text-xs text-muted-foreground/40">{tracks.length} música{tracks.length !== 1 ? "s" : ""}</span>
              </div>

              {tracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                    <Music size={32} className="text-purple-400/50" />
                  </div>
                  <p className="text-sm text-muted-foreground/60">Nenhuma música criada ainda</p>
                  <p className="text-xs text-muted-foreground/40 mt-1">Crie sua primeira música agora!</p>
                  <button
                    onClick={() => setActiveTab("create")}
                    className="mt-4 px-5 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors"
                  >
                    Criar Música
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tracks.map((track) => {
                    const isPlaying = playingTrackId === track.id;
                    return (
                      <div
                        key={track.id}
                        className={`rounded-2xl border p-4 transition-all group ${isPlaying ? "bg-purple-500/10 border-purple-500/20" : "bg-muted/5 border-border/15 hover:border-purple-500/15"}`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => togglePlay(track.id)}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${isPlaying ? "bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-purple-500/20" : "bg-purple-500/10 group-hover:bg-purple-500/20"}`}
                          >
                            {isPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-purple-400 ml-0.5" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{track.title}</p>
                            <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">{track.prompt.slice(0, 60)}</p>
                            <p className="text-[10px] text-muted-foreground/30 mt-1 flex items-center gap-1">
                              <Clock size={9} />
                              {track.createdAt.toLocaleDateString("pt-BR")} · {track.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-3">
                          <a
                            href={track.audioUrl}
                            download={`snyx-${track.id.slice(0, 8)}.mp3`}
                            className="p-2 rounded-lg text-muted-foreground/30 hover:text-purple-400 hover:bg-purple-500/10 transition-all"
                            title="Baixar"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                        <audio
                          ref={(el) => { audioRefs.current[track.id] = el; }}
                          src={track.audioUrl}
                          onEnded={() => { if (playingTrackId === track.id) setPlayingTrackId(null); }}
                          preload="auto"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Explore Section */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">Explorar</h2>
              <HorizontalScroll>
                {SAMPLE_TRACKS.map((track, i) => (
                  <div key={i} className="shrink-0 w-[150px] sm:w-[170px] group cursor-pointer">
                    <div className="rounded-xl overflow-hidden aspect-square mb-2 border border-border/10 group-hover:border-purple-500/30 transition-all relative">
                      <img src={track.image} alt={track.title} loading="lazy" width={512} height={512} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5">
                        <p className="text-[11px] font-semibold text-white">{track.title}</p>
                        <p className="text-[9px] text-white/50">▶ {track.plays}</p>
                      </div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play size={16} className="text-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </HorizontalScroll>
            </div>

            <div className="h-4" />
          </div>
        )}
      </div>

      <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} highlightPlan="vip" />
    </div>
  );
}
