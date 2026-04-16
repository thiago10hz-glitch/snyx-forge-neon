import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Video, Image, Sparkles, Loader2, Download,
  Upload, X, Film, Wand2, Crown,
} from "lucide-react";
import { toast } from "sonner";

type VideoMode = "text" | "image";

interface Generation {
  id: string;
  prompt: string;
  mode: string;
  status: string;
  result_url: string | null;
  created_at: string;
  content?: string;
}

export default function Videos() {
  const { profile } = useAuth();
  const [mode, setMode] = useState<VideoMode>("text");
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultContent, setResultContent] = useState<string | null>(null);
  const [history, setHistory] = useState<Generation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPrivileged = profile?.is_vip || profile?.is_dev;

  useEffect(() => {
    fetchHistory();
  }, []);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Descreva o vídeo que deseja gerar");
      return;
    }
    if (mode === "image" && !imageFile) {
      toast.error("Selecione uma imagem para animar");
      return;
    }

    setLoading(true);
    setResult(null);
    setResultContent(null);

    try {
      let imageUrl: string | undefined;

      if (mode === "image" && imagePreview) {
        imageUrl = imagePreview;
      }

      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          prompt: prompt.trim(),
          image_url: imageUrl,
          mode: mode === "image" ? "image_to_video" : "text_to_video",
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

      if (data?.result_url) {
        setResult(data.result_url);
      }
      if (data?.content) {
        setResultContent(data.content);
      }

      toast.success("Geração concluída! 🎬");
      fetchHistory();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao gerar vídeo");
    }
    setLoading(false);
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
          </div>
          {!isPrivileged && (
            <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
              <Crown className="w-3 h-3 text-yellow-500" />
              Free: 2 vídeos/dia
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
        {/* Mode selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode("text")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              mode === "text"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-muted/30 hover:bg-muted/50 text-muted-foreground"
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Texto → Vídeo
          </button>
          <button
            onClick={() => setMode("image")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              mode === "image"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-muted/30 hover:bg-muted/50 text-muted-foreground"
            }`}
          >
            <Image className="w-4 h-4" />
            Imagem → Vídeo
          </button>
        </div>

        {/* Input area */}
        <div className="rounded-2xl border border-border/30 bg-card/50 p-5 space-y-4">
          {/* Image upload (when in image mode) */}
          {mode === "image" && (
            <div>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-40 h-40 object-cover rounded-xl border border-border/30"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-40 h-40 rounded-xl border-2 border-dashed border-border/40 hover:border-primary/50 flex flex-col items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Carregar imagem</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Prompt */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              mode === "text"
                ? "Descreva o vídeo que deseja gerar... Ex: Um pôr do sol na praia com ondas calmas"
                : "Descreva como animar a imagem... Ex: Fazer as nuvens se moverem suavemente"
            }
            rows={3}
            className="w-full bg-background/50 border border-border/20 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
          />

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Gerar Vídeo
              </>
            )}
          </button>
        </div>

        {/* Result */}
        {(result || resultContent) && (
          <div className="rounded-2xl border border-primary/20 bg-card/50 p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              Resultado
            </h3>
            {result && result.startsWith("data:image") && (
              <div className="rounded-xl overflow-hidden">
                <img src={result} alt="Generated" className="w-full max-h-[500px] object-contain" />
              </div>
            )}
            {result && result.startsWith("data:video") && (
              <video
                src={result}
                controls
                className="w-full rounded-xl max-h-[500px]"
              />
            )}
            {resultContent && !result && (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-background/50 rounded-xl p-4">
                {resultContent}
              </div>
            )}
            {result && (
              <a
                href={result}
                download="snyx-video.mp4"
                className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
              >
                <Download className="w-3 h-3" />
                Download
              </a>
            )}
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
              Nenhum vídeo gerado ainda. Comece descrevendo o que deseja! 🎬
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((gen) => (
                <div
                  key={gen.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-border/10"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {gen.mode === "image_to_video" ? (
                      <Image className="w-4 h-4 text-primary" />
                    ) : (
                      <Wand2 className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{gen.prompt}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(gen.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    gen.status === "completed" ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"
                  }`}>
                    {gen.status === "completed" ? "✓" : "..."}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
