import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Video, Sparkles, Loader2, Download,
  X, Film, Crown, Play, RefreshCw, CheckCircle, AlertCircle,
  User as UserIcon, Mic,
} from "lucide-react";
import { toast } from "sonner";

interface Generation {
  id: string;
  prompt: string;
  mode: string;
  status: string;
  result_url: string | null;
  created_at: string;
}

interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  preview_image_url?: string;
}

interface HeyGenVoice {
  voice_id: string;
  display_name?: string;
  language?: string;
  name?: string;
}

export default function Videos() {
  const { profile } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingVideoId, setProcessingVideoId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<Generation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Avatar & Voice selection
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [voices, setVoices] = useState<HeyGenVoice[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [loadingAssets, setLoadingAssets] = useState(true);

  const isPrivileged = profile?.is_vip || profile?.is_dev;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load avatars, voices, and history on mount
  useEffect(() => {
    fetchHistory();
    fetchAssets();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const fetchAssets = async () => {
    setLoadingAssets(true);
    try {
      const [avatarRes, voiceRes] = await Promise.all([
        supabase.functions.invoke("generate-video", { body: { action: "list_avatars" } }),
        supabase.functions.invoke("generate-video", { body: { action: "list_voices" } }),
      ]);

      if (avatarRes.data?.avatars) {
        setAvatars(avatarRes.data.avatars.slice(0, 30));
        if (avatarRes.data.avatars.length > 0) {
          setSelectedAvatar(avatarRes.data.avatars[0].avatar_id);
        }
      }
      if (voiceRes.data?.voices) {
        // Filter Portuguese voices first, then show others
        const ptVoices = voiceRes.data.voices.filter((v: HeyGenVoice) =>
          v.language?.toLowerCase().includes("portug") || v.language?.toLowerCase().includes("pt")
        );
        const otherVoices = voiceRes.data.voices.filter((v: HeyGenVoice) =>
          !v.language?.toLowerCase().includes("portug") && !v.language?.toLowerCase().includes("pt")
        );
        const sorted = [...ptVoices, ...otherVoices].slice(0, 50);
        setVoices(sorted);
        if (ptVoices.length > 0) setSelectedVoice(ptVoices[0].voice_id);
        else if (sorted.length > 0) setSelectedVoice(sorted[0].voice_id);
      }
    } catch {
      console.error("Failed to load HeyGen assets");
    }
    setLoadingAssets(false);
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from("video_generations" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as any[]) || []);
    setLoadingHistory(false);
  };

  const pollStatus = useCallback((videoId: string) => {
    setProcessingVideoId(videoId);
    setProcessingStatus("Processando vídeo...");

    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const { data } = await supabase.functions.invoke("generate-video", {
          body: { action: "check_status", video_id: videoId },
        });

        if (data?.status === "completed" && data?.video_url) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setResultUrl(data.video_url);
          setProcessingVideoId(null);
          setLoading(false);
          toast.success("Vídeo gerado com sucesso! 🎬");
          fetchHistory();
        } else if (data?.status === "failed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setProcessingVideoId(null);
          setLoading(false);
          toast.error("Falha na geração do vídeo");
          fetchHistory();
        } else {
          const statusMap: Record<string, string> = {
            pending: "Na fila...",
            waiting: "Aguardando...",
            processing: `Renderizando vídeo... (${attempts * 10}s)`,
          };
          setProcessingStatus(statusMap[data?.status] || `Processando... (${attempts * 10}s)`);
        }

        // Timeout after 10 minutes
        if (attempts > 60) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setProcessingVideoId(null);
          setLoading(false);
          toast.error("Tempo esgotado. Verifique o histórico mais tarde.");
        }
      } catch {
        // Keep polling on network errors
      }
    }, 10000);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Descreva o que o avatar deve falar");
      return;
    }

    setLoading(true);
    setResultUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          prompt: prompt.trim(),
          avatar_id: selectedAvatar || undefined,
          voice_id: selectedVoice || undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        if (data.limit_reached) {
          toast.error(data.error, { duration: 5000 });
        } else {
          toast.error(data.error);
        }
        setLoading(false);
        return;
      }

      if (data?.video_id) {
        toast.success("Vídeo enviado para geração!");
        pollStatus(data.video_id);
      } else {
        setLoading(false);
        toast.error("Erro inesperado");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao gerar vídeo");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-muted/30 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold">SnyX Vídeos AI</h1>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">HeyGen</span>
          </div>
          {!isPrivileged && (
            <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
              <Crown className="w-3 h-3 text-yellow-500" />
              Free: 2/dia
            </span>
          )}
          {isPrivileged && (
            <span className="ml-auto text-xs text-primary flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Ilimitado
            </span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Input area */}
        <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4">
          {/* Avatar selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5" /> Avatar
            </label>
            {loadingAssets ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Carregando avatares...
              </div>
            ) : avatars.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {avatars.map((a) => (
                  <button
                    key={a.avatar_id}
                    onClick={() => setSelectedAvatar(a.avatar_id)}
                    className={`shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all ${
                      selectedAvatar === a.avatar_id
                        ? "ring-2 ring-primary bg-primary/10"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    {a.preview_image_url ? (
                      <img src={a.preview_image_url} alt={a.avatar_name} className="w-14 h-14 rounded-lg object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted/30 flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                      {a.avatar_name}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum avatar disponível</p>
            )}
          </div>

          {/* Voice selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5" /> Voz
            </label>
            {loadingAssets ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Carregando vozes...
              </div>
            ) : (
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full bg-background/50 border border-border/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.display_name || v.name || v.voice_id} {v.language ? `(${v.language})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Prompt */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="O que o avatar deve falar? Ex: Olá! Bem-vindo ao SnyX, a melhor plataforma de IA do Brasil..."
            rows={3}
            maxLength={5000}
            className="w-full bg-background/50 border border-border/20 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{prompt.length}/5000</span>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim() || loadingAssets}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {processingVideoId ? processingStatus : "Enviando..."}
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Gerar Vídeo com Avatar
              </>
            )}
          </button>
        </div>

        {/* Processing indicator */}
        {processingVideoId && (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-medium">{processingStatus}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                ID: {processingVideoId.substring(0, 12)}... — Não feche esta página
              </p>
            </div>
          </div>
        )}

        {/* Result */}
        {resultUrl && (
          <div className="rounded-2xl border border-primary/20 bg-card/50 p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Vídeo Pronto!
            </h3>
            <video
              src={resultUrl}
              controls
              className="w-full rounded-xl max-h-[500px]"
              autoPlay
            />
            <a
              href={resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
            >
              <Download className="w-3 h-3" />
              Download MP4
            </a>
          </div>
        )}

        {/* History */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Histórico recente</h3>
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum vídeo gerado ainda. Escolha um avatar e escreva o texto! 🎬
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((gen) => (
                <div
                  key={gen.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-border/10"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Video className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{gen.prompt}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(gen.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {gen.status === "completed" && gen.result_url && !gen.result_url.startsWith("generated") && gen.result_url.length > 40 ? (
                      <a href={gen.result_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Download className="w-3 h-3" /> Baixar
                      </a>
                    ) : null}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      gen.status === "completed" ? "bg-green-500/10 text-green-400" :
                      gen.status === "failed" ? "bg-red-500/10 text-red-400" :
                      "bg-yellow-500/10 text-yellow-400"
                    }`}>
                      {gen.status === "completed" ? <CheckCircle className="w-3 h-3 inline" /> :
                       gen.status === "failed" ? <AlertCircle className="w-3 h-3 inline" /> :
                       <Loader2 className="w-3 h-3 inline animate-spin" />}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
