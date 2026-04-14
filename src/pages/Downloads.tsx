import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Download, ArrowLeft, Loader2, Lock, Package, Zap, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface AppRelease {
  id: string;
  version: string;
  platform: string;
  file_url: string;
  file_size: number | null;
  changelog: string | null;
  created_at: string;
}

export default function Downloads() {
  const { user, profile, loading: authLoading } = useAuth();
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const hasAccess = !!profile?.is_pack_steam;

  useEffect(() => {
    if (!user || !hasAccess) {
      setLoading(false);
      return;
    }
    fetchLatestRelease();
  }, [user, hasAccess]);

  const fetchLatestRelease = async () => {
    const { data, error } = await supabase
      .from("app_releases")
      .select("*")
      .eq("platform", "windows")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!error && data) setRelease(data as AppRelease);
    setLoading(false);
  };

  const handleDownload = async () => {
    if (!release) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from("app-downloads")
        .createSignedUrl(release.file_url, 60, {
          download: `SnyX-v${release.version}.exe`,
        });

      if (error) throw error;

      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Download iniciado!");
    } catch (err: any) {
      toast.error("Erro no download: " + (err.message || "tente novamente"));
    }
    setDownloading(false);
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-72 w-72 rounded-full bg-primary/5 blur-[100px] animate-glow-pulse" />
        <div className="absolute bottom-20 left-1/4 h-56 w-56 rounded-full bg-primary/3 blur-[80px] animate-glow-pulse" style={{ animationDelay: '3s' }} />
      </div>

      {/* Header */}
      <header className="border-b border-border/8 glass sticky top-0 z-10">
        <div className="h-14 flex items-center px-4 sm:px-6 gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-xl text-muted-foreground/50 hover:text-foreground hover:bg-muted/15 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/15">
              <Download className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold">Downloads</h1>
              <p className="text-[9px] text-muted-foreground/40 hidden sm:block">SnyX Desktop App</p>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-lg mx-auto p-5 sm:p-8 mt-8 sm:mt-16 md:mt-20">
        {!isVipOrDev ? (
          /* Locked state */
          <div className="text-center space-y-5 animate-fade-in-up">
            <div className="relative mx-auto w-fit">
              <div className="w-24 h-24 rounded-3xl bg-muted/10 border border-border/15 flex items-center justify-center">
                <Lock className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <div className="absolute -inset-4 rounded-3xl bg-muted/5 blur-2xl -z-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black">Acesso Restrito</h2>
              <p className="text-sm text-muted-foreground/50 leading-relaxed max-w-xs mx-auto">
                O download do app é exclusivo para usuários <span className="text-primary font-semibold">VIP</span>, <span className="text-cyan-400 font-semibold">DEV</span> e <span className="text-green-400 font-semibold">Pack Steam</span>.
              </p>
            </div>
            <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground/30">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Acesso seguro
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Atualizações automáticas
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !release ? (
          <div className="text-center space-y-5 animate-fade-in-up">
            <div className="w-24 h-24 rounded-3xl bg-muted/10 border border-border/15 flex items-center justify-center mx-auto">
              <Package className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black">Nenhuma versão disponível</h2>
              <p className="text-sm text-muted-foreground/50">O app ainda não foi publicado. Volte mais tarde!</p>
            </div>
          </div>
        ) : (
          /* Download card */
          <div className="rounded-3xl border border-border/10 overflow-hidden glass-elevated animate-fade-in-up">
            <div className="p-6 sm:p-8 text-center space-y-5">
              {/* App icon */}
              <div className="relative mx-auto w-fit">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/15 shadow-2xl shadow-primary/10">
                  <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </div>
                <div className="absolute -inset-3 rounded-2xl bg-primary/8 blur-xl -z-10 animate-breathe" />
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-black">SnyX App</h2>
                <p className="text-sm text-muted-foreground/40">Windows Desktop</p>
              </div>

              {/* Version info */}
              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/15">
                  v{release.version}
                </span>
                {release.file_size && (
                  <span className="px-3 py-1.5 rounded-full bg-muted/10 text-muted-foreground/60 text-xs border border-border/10">
                    {formatSize(release.file_size)}
                  </span>
                )}
                <span className="px-3 py-1.5 rounded-full bg-muted/10 text-muted-foreground/60 text-xs border border-border/10">
                  {new Date(release.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>

              {/* Changelog */}
              {release.changelog && (
                <div className="text-left rounded-2xl bg-muted/8 p-4 border border-border/8">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground/40 mb-2 tracking-wider">Changelog</p>
                  <p className="text-xs text-muted-foreground/60 whitespace-pre-wrap leading-relaxed">{release.changelog}</p>
                </div>
              )}

              {/* Download button */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full px-6 py-4 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold rounded-2xl transition-all flex items-center justify-center gap-2.5 text-sm shadow-xl shadow-primary/20 hover:shadow-primary/30 btn-glow active:scale-[0.98]"
              >
                {downloading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                {downloading ? "Baixando..." : "Baixar para Windows"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
