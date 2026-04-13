import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Download, ArrowLeft, Loader2, Lock, Package, Zap } from "lucide-react";
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

  const isVipOrDev = profile?.is_vip || profile?.is_dev;

  useEffect(() => {
    if (!user || !isVipOrDev) {
      setLoading(false);
      return;
    }
    fetchLatestRelease();
  }, [user, isVipOrDev]);

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
        .download(release.file_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SnyX-v${release.version}.exe`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/6 blur-[120px] animate-glow-pulse" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-primary/4 blur-[100px] animate-glow-pulse" style={{ animationDelay: '3s' }} />
      </div>

      {/* Header */}
      <header className="border-b border-border/30 bg-background sticky top-0 z-10">
        <div className="h-12 flex items-center px-3 sm:px-4 gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-bold">Downloads</h1>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-lg mx-auto p-4 sm:p-6 mt-6 sm:mt-10 md:mt-16">
        {!isVipOrDev ? (
          /* Locked state for free users */
          <div className="text-center space-y-4 animate-fade-in-up">
            <div className="w-20 h-20 rounded-2xl bg-muted/20 border border-border/30 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-lg font-bold">Acesso Restrito</h2>
            <p className="text-sm text-muted-foreground">
              O download do aplicativo é exclusivo para usuários <span className="text-primary font-semibold">VIP</span> e <span className="text-blue-400 font-semibold">DEV</span>.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Ative uma chave VIP ou DEV para ter acesso ao app.
            </p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !release ? (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-muted/20 border border-border/30 flex items-center justify-center mx-auto">
              <Package className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-lg font-bold">Nenhuma versão disponível</h2>
            <p className="text-sm text-muted-foreground">O app ainda não foi publicado. Volte mais tarde!</p>
          </div>
        ) : (
          /* Download card */
          <div className="rounded-2xl border border-border/20 bg-card/60 overflow-hidden glass-elevated animate-fade-in-up">
            <div className="p-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center mx-auto border border-primary/15 shadow-lg shadow-primary/10 relative">
                <Zap className="w-8 h-8 text-primary" />
                <div className="absolute -inset-2 rounded-2xl bg-primary/10 blur-xl -z-10 animate-breathe" />
              </div>

              <div>
                <h2 className="text-xl font-bold">SnyX App</h2>
                <p className="text-sm text-muted-foreground mt-1">Windows Desktop</p>
              </div>

              <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                <span className="px-2 py-1 rounded-md bg-primary/10 text-primary font-semibold">v{release.version}</span>
                {release.file_size && (
                  <span>{formatSize(release.file_size)}</span>
                )}
                <span>{new Date(release.created_at).toLocaleDateString("pt-BR")}</span>
              </div>

              {release.changelog && (
                <div className="text-left rounded-lg bg-muted/20 p-3 border border-border/20">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1">Changelog</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{release.changelog}</p>
                </div>
              )}

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
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
