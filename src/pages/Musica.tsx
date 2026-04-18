import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Music, Loader2, Download, Trash2, ArrowLeft, Sparkles, Crown } from "lucide-react";
import { AuroraBackground } from "@/components/AuroraBackground";

type Track = {
  id: string;
  prompt: string;
  duration_seconds: number;
  audio_url: string;
  created_at: string;
};

const SUGGESTIONS = [
  "trilha épica de batalha medieval com tambores",
  "lo-fi chill pra estudar, piano suave",
  "música eletrônica synthwave anos 80",
  "rock pesado com guitarra distorcida",
  "ambiente cyberpunk noturno chuvoso",
  "jazz suave de bar nos anos 50",
  "8-bit retrô estilo videogame",
  "orquestra cinemática emocionante",
];

export default function Musica() {
  const { profile, isAdmin } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(15);
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const isVip = profile?.is_vip || profile?.is_dev || isAdmin;

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("generated_music")
      .select("id, prompt, duration_seconds, audio_url, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setTracks(data);
    setLoadingHistory(false);
  };

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error("Descreve a música que tu quer 🎵");
      return;
    }
    if (!isVip) {
      toast.error("Recurso exclusivo VIP/DEV");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-music", {
        body: { prompt, duration },
      });
      if (error) {
        const detailedMessage = typeof error.context === "string"
          ? error.context
          : error.message;
        throw new Error(detailedMessage || "Erro ao gerar");
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success("Música gerada! 🎶");
      setPrompt("");
      await loadHistory();
    } catch (e: any) {
      const rawMessage = e?.message || "Erro ao gerar";
      const msg = rawMessage.includes("503")
        ? "Modelo carregando, tenta de novo em ~30s 🔄"
        : rawMessage;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
      setLoading(false);
    }
  };

  const removeTrack = async (id: string, audioUrl: string) => {
    if (!confirm("Apagar essa música?")) return;
    // Apaga do storage
    try {
      const path = audioUrl.split("/generated-music/")[1];
      if (path) await supabase.storage.from("generated-music").remove([path]);
    } catch { /* ignore */ }
    const { error } = await supabase.from("generated_music").delete().eq("id", id);
    if (error) toast.error("Erro ao apagar");
    else {
      setTracks((t) => t.filter((x) => x.id !== id));
      toast.success("Removida");
    }
  };

  const downloadTrack = async (url: string, prompt: string) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `snyx-${prompt.slice(0, 30).replace(/[^a-z0-9]/gi, "_")}.wav`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Erro ao baixar");
    }
  };

  if (!isVip) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <AuroraBackground />
        <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
          <Card className="max-w-md p-8 text-center bg-card/80 backdrop-blur border-primary/30">
            <Crown className="mx-auto mb-4 h-16 w-16 text-primary" />
            <h1 className="mb-2 text-2xl font-bold">Recurso VIP</h1>
            <p className="mb-6 text-muted-foreground">
              O gerador de música é exclusivo pra membros VIP e DEV. Faça upgrade pra criar trilhas únicas com IA.
            </p>
            <div className="flex gap-2 justify-center">
              <Button asChild>
                <Link to="/">Voltar</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground />
      <div className="relative z-10 mx-auto max-w-5xl p-4 md:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <Badge variant="outline" className="border-primary/40 text-primary">
            <Crown className="mr-1 h-3 w-3" /> VIP
          </Badge>
        </div>

        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30">
            <Music className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-2 text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
            Gerador de Música IA
          </h1>
          <p className="text-muted-foreground">
            Descreve em português o que tu quer ouvir e a IA cria pra ti 🎵
          </p>
        </div>

        {/* Form */}
        <Card className="mb-8 p-6 bg-card/80 backdrop-blur border-border/50">
          <label className="mb-2 block text-sm font-medium">O que tu quer gerar?</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: trilha épica de batalha com tambores e violinos..."
            className="mb-3 min-h-[80px] resize-none"
            maxLength={500}
            disabled={loading}
          />

          <div className="mb-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPrompt(s)}
                disabled={loading}
                className="rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Duração</span>
              <span className="font-medium">{duration}s</span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={(v) => setDuration(v[0])}
              min={5}
              max={30}
              step={1}
              disabled={loading}
            />
          </div>

          <Button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando música... (~{duration * 2}s)</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Gerar música</>
            )}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            ⏱️ Geração leva ~{Math.round(duration * 1.5)}-{duration * 3}s. Primeira execução pode demorar mais (modelo aquecendo).
          </p>
        </Card>

        {/* Histórico */}
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Music className="h-4 w-4" /> Tuas músicas ({tracks.length})
          </h2>

          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : tracks.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground bg-card/50">
              Nenhuma música gerada ainda. Cria a primeira aí em cima! 🎶
            </Card>
          ) : (
            <div className="space-y-3">
              {tracks.map((t) => (
                <Card key={t.id} className="p-4 bg-card/80 backdrop-blur border-border/50">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{t.prompt}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.duration_seconds}s · {new Date(t.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => downloadTrack(t.audio_url, t.prompt)}
                        title="Baixar"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeTrack(t.id, t.audio_url)}
                        title="Apagar"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <audio controls src={t.audio_url} className="w-full" preload="none" />
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
