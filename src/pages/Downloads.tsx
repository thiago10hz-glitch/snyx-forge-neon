import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Download, ArrowLeft, Loader2, Lock, Package, Zap, Shield, Sparkles, Star, Monitor, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { generateIntegrityToken } from "@/lib/snyxSecurity";

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
  const { user, profile, session, loading: authLoading } = useAuth();
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showChangelogId, setShowChangelogId] = useState<string | null>(null);
  const [securityStatus, setSecurityStatus] = useState<"checking" | "verified" | "failed">("checking");

  const hasAccess = !!profile?.is_pack_steam;

  // Initialize security guards
  useEffect(() => {
    initSecurityGuards();
  }, []);

  // Verify integrity on mount
  useEffect(() => {
    if (!user || !session) return;
    verifyIntegrity();
  }, [user, session]);

  const verifyIntegrity = useCallback(async () => {
    try {
      const timestamp = Date.now().toString();
      const sig = snyxHMAC(`${user!.id}:${timestamp}:verify`, SNYX_INTEGRITY_SECRET);
      
      const { data, error } = await supabase.functions.invoke("secure-download", {
        body: { action: "verify_integrity" },
        headers: {
          "x-snyx-integrity": sig,
          "x-snyx-timestamp": timestamp,
          "x-snyx-fingerprint": getDeviceFingerprint(),
        },
      });

      if (error) {
        setSecurityStatus("failed");
      } else {
        setSecurityStatus("verified");
      }
    } catch {
      setSecurityStatus("failed");
    }
  }, [user]);

  useEffect(() => {
    if (!user || !hasAccess) {
      setLoading(false);
      return;
    }
    fetchReleases();
  }, [user, hasAccess]);

  const fetchReleases = async () => {
    const { data, error } = await supabase
      .from("app_releases")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2);

    if (!error && data) setReleases(data as AppRelease[]);
    setLoading(false);
  };

  const handleSecureDownload = async (rel: AppRelease) => {
    if (!user || !session) return;
    
    setDownloadingId(rel.id);
    try {
      const timestamp = Date.now().toString();
      const fingerprint = getDeviceFingerprint();
      
      // Generate integrity signature
      const integritySignature = snyxHMAC(
        `${user.id}:${timestamp}:${rel.file_url}`,
        SNYX_INTEGRITY_SECRET
      );

      toast.info("🔐 Verificando integridade...", { duration: 2000 });

      const { data, error } = await supabase.functions.invoke("secure-download", {
        body: {
          action: "get_secure_url",
          release_id: rel.id,
          file_path: rel.file_url,
        },
        headers: {
          "x-snyx-integrity": integritySignature,
          "x-snyx-timestamp": timestamp,
          "x-snyx-fingerprint": fingerprint,
        },
      });

      if (error) {
        throw new Error(error.message || "Erro de segurança");
      }

      if (data?.error) {
        if (data.error.includes("Violação") || data.error.includes("bloqueada")) {
          toast.error("🚫 " + data.error, { duration: 10000 });
          // Force logout on violation
          setTimeout(() => supabase.auth.signOut(), 3000);
          return;
        }
        throw new Error(data.error);
      }

      // Verify response checksum
      const expectedChecksum = snyxHMAC(data.url, SNYX_INTEGRITY_SECRET);
      if (data.checksum !== expectedChecksum) {
        toast.error("🚫 SnyX-SEC: Resposta corrompida. Download cancelado.");
        return;
      }

      // Start download
      const a = document.createElement("a");
      a.href = data.url;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast.success("✅ Download seguro iniciado!", { 
        description: `URL expira em ${data.expires_in}s`,
        duration: 4000 
      });
    } catch (err: any) {
      const msg = err.message || "Erro desconhecido";
      if (msg.includes("SnyX-SEC")) {
        toast.error("🔒 " + msg, { duration: 6000 });
      } else {
        toast.error("Erro no download: " + msg);
      }
    }
    setDownloadingId(null);
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getPlatformIcon = (platform: string) => {
    return platform === "windows" ? Monitor : Package;
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const renderAppCard = (rel: AppRelease, index: number) => {
    const isDownloading = downloadingId === rel.id;
    const isChangelogOpen = showChangelogId === rel.id;
    const PlatIcon = getPlatformIcon(rel.platform);

    return (
      <div key={rel.id} className="animate-fade-in-up space-y-4" style={{ animationDelay: `${index * 100}ms` }}>
        <div className="rounded-2xl border border-border/10 overflow-hidden glass-elevated">
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="relative shrink-0">
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/15 shadow-xl shadow-primary/10">
                  <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                </div>
                <div className="absolute -inset-2 rounded-2xl bg-primary/8 blur-xl -z-10 animate-breathe" />
              </div>

              <div className="flex-1 min-w-0 space-y-2.5">
                <div>
                  <h2 className="text-lg sm:text-xl font-black leading-tight">SnyX App</h2>
                  <p className="text-xs text-muted-foreground/40 mt-0.5">
                    Thiago Dev • {rel.platform === "windows" ? "Windows" : rel.platform.charAt(0).toUpperCase() + rel.platform.slice(1)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className="w-3.5 h-3.5 text-primary fill-primary" />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground/40 font-medium">5.0</span>
                </div>

                <button
                  onClick={() => handleSecureDownload(rel)}
                  disabled={isDownloading}
                  data-snyx-protected="true"
                  className="mt-1 px-5 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold rounded-full transition-all text-xs shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.97] flex items-center gap-1.5 w-fit"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Shield className="w-4 h-4" />
                  )}
                  {isDownloading ? "Verificando..." : "Download Seguro"}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-border/8 px-4 sm:px-5 py-2.5 flex items-center gap-3 sm:gap-5 overflow-x-auto">
            <div className="flex flex-col items-center min-w-fit">
              <span className="text-xs font-bold text-foreground/80">v{rel.version}</span>
              <span className="text-[10px] text-muted-foreground/40">Versão</span>
            </div>
            <div className="w-px h-8 bg-border/10" />
            {rel.file_size && (
              <>
                <div className="flex flex-col items-center min-w-fit">
                  <span className="text-xs font-bold text-foreground/80">{formatSize(rel.file_size)}</span>
                  <span className="text-[10px] text-muted-foreground/40">Tamanho</span>
                </div>
                <div className="w-px h-8 bg-border/10" />
              </>
            )}
            <div className="flex flex-col items-center min-w-fit">
              <span className="text-xs font-bold text-foreground/80">{new Date(rel.created_at).toLocaleDateString("pt-BR")}</span>
              <span className="text-[10px] text-muted-foreground/40">Atualizado</span>
            </div>
            <div className="w-px h-8 bg-border/10" />
            <div className="flex flex-col items-center min-w-fit">
              <div className="flex items-center gap-1">
                <PlatIcon className="w-3 h-3 text-foreground/80" />
                <span className="text-xs font-bold text-foreground/80 capitalize">{rel.platform}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/40">Plataforma</span>
            </div>
          </div>
        </div>

        {rel.changelog && (
          <div className="rounded-2xl border border-border/10 glass-elevated p-4 sm:p-5 space-y-2.5">
            <button
              onClick={() => setShowChangelogId(isChangelogOpen ? null : rel.id)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="text-sm font-bold text-foreground/70">Novidades</h3>
              <span className="text-xs text-primary font-medium">
                {isChangelogOpen ? "Ocultar" : "Ver mais"}
              </span>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${isChangelogOpen ? "max-h-96" : "max-h-16"}`}>
              <p className="text-xs text-muted-foreground/60 whitespace-pre-wrap leading-relaxed">{rel.changelog}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

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
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/15">
              <Download className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold">Downloads</h1>
              <p className="text-[9px] text-muted-foreground/40 hidden sm:block">SnyX Desktop & Apps</p>
            </div>
          </div>

          {/* Security badge */}
          {hasAccess && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
              securityStatus === "verified" 
                ? "bg-green-500/10 text-green-400 border-green-500/20" 
                : securityStatus === "checking"
                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              {securityStatus === "verified" ? (
                <><Shield className="w-3 h-3" /> Criptografado</>
              ) : securityStatus === "checking" ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Verificando...</>
              ) : (
                <><ShieldAlert className="w-3 h-3" /> Erro</>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto p-4 sm:p-6 mt-6 sm:mt-10">
        {!hasAccess ? (
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
                O download do app é exclusivo para usuários <span className="text-primary font-semibold">Pack Steam</span>.
              </p>
            </div>
            <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground/30">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Criptografia ativa
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Anti-tamper
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : releases.length === 0 ? (
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
          <div className="space-y-8">
            {/* Security notice */}
            <div className="rounded-2xl border border-green-500/10 bg-green-500/5 p-4 sm:p-5 flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-green-400">Proteção SnyX-SEC Ativa</h3>
                <p className="text-[11px] text-green-400/60 mt-1 leading-relaxed">
                  Downloads protegidos com criptografia, verificação de integridade e anti-tamper. 
                  Tentativas de manipulação resultam em bloqueio permanente.
                </p>
              </div>
            </div>

            {/* Features section */}
            <div className="rounded-2xl border border-border/10 glass-elevated p-4 sm:p-5 space-y-2.5">
              <h3 className="text-xs font-bold text-foreground/70">Recursos</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { icon: Shield, label: "Criptografia E2E" },
                  { icon: Sparkles, label: "Auto atualização" },
                  { icon: Zap, label: "Desempenho máximo" },
                  { icon: CheckCircle2, label: "Anti-tamper ativo" },
                ].map((feat) => (
                  <div key={feat.label} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/8 border border-border/8">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <feat.icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-[11px] font-medium text-foreground/70">{feat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {releases.map((rel, i) => renderAppCard(rel, i))}
            </div>

            <div className="flex items-center justify-center gap-2 py-2">
              <Package className="w-3.5 h-3.5 text-primary/50" />
              <span className="text-[11px] text-muted-foreground/30 font-medium">Exclusivo Pack Steam • Protegido por SnyX-SEC</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
