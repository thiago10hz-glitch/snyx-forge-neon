import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BOOST_SCRIPT, REVERT_SCRIPT, downloadScript } from "@/lib/gameBoostScripts";
import {
  ArrowLeft, Lock, Cpu, Zap,
  Monitor, MemoryStick, Settings, CheckCircle2,
  XCircle, Power, Loader2, RefreshCw, Download,
  RotateCcw, Gamepad2, Eye, MousePointer, Network,
  Shield
} from "lucide-react";

interface KeyInfo {
  activation_key: string;
  activated_at: string | null;
  expires_at: string | null;
  status: string;
  days_remaining: number | null;
}

const Optimization = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasActiveKey, setHasActiveKey] = useState(false);
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  

  // Optimization states
  const [optimizations, setOptimizations] = useState({
    power: false,
    visual: false,
    network: false,
    cpu: false,
    services: false,
    ram: false,
    gamebar: false,
    gpu: false,
    fullscreen: false,
    mouse: false,
  });

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    checkKeyStatus();
  }, [user]);

  // Fetch releases when key is active
  useEffect(() => {
    if (!user || !hasActiveKey) return;
    setLoadingReleases(true);
    supabase
      .from("app_releases")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data) setReleases(data as AppRelease[]);
        setLoadingReleases(false);
      });
  }, [user, hasActiveKey]);

  const handleDownloadApp = async (rel: AppRelease) => {
    setDownloadingId(rel.id);
    try {
      const ext = rel.file_url.split('.').pop() || "exe";
      const { data, error } = await supabase.storage
        .from("app-downloads")
        .createSignedUrl(rel.file_url, 60, {
          download: `SnyX-Optimizer-v${rel.version}.${ext}`,
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
    setDownloadingId(null);
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const checkKeyStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("vpn-manage", {
        body: { action: "status" },
      });
      if (!error && data?.active) {
        setHasActiveKey(true);
        setKeyInfo(data.key_info);
      } else {
        // Fallback: check directly
        const { data: keyData } = await (supabase as any)
          .from("accelerator_keys")
          .select("*")
          .eq("activated_by", user!.id)
          .eq("status", "active")
          .limit(1);
        if (keyData && keyData.length > 0) {
          setHasActiveKey(true);
          setKeyInfo({
            activation_key: keyData[0].activation_key,
            activated_at: keyData[0].activated_at,
            expires_at: keyData[0].expires_at,
            status: keyData[0].status,
            days_remaining: keyData[0].expires_at
              ? Math.max(0, Math.ceil((new Date(keyData[0].expires_at).getTime() - Date.now()) / 86400000))
              : null,
          });
        }
      }
    } catch {
      // Silent fail
    }
    setLoading(false);
  };

  const optimizationModules = [
    {
      id: "power",
      icon: Power,
      title: "Plano de Energia",
      desc: "SnyX Ultimate Gaming — CPU 100%, sem sleep, core parking OFF",
      color: "from-red-600 to-orange-500",
      border: "border-red-500/20",
      bg: "bg-red-500/5",
    },
    {
      id: "visual",
      icon: Eye,
      title: "Efeitos Visuais",
      desc: "Desabilita animações, transparências e efeitos que consomem GPU",
      color: "from-purple-600 to-pink-500",
      border: "border-purple-500/20",
      bg: "bg-purple-500/5",
    },
    {
      id: "network",
      icon: Network,
      title: "Rede TCP/Nagle",
      desc: "Nagle OFF, throttling removido, latência -70%",
      color: "from-cyan-600 to-blue-500",
      border: "border-cyan-500/20",
      bg: "bg-cyan-500/5",
    },
    {
      id: "cpu",
      icon: Cpu,
      title: "Prioridade CPU/GPU",
      desc: "Prioridade alta para jogos, scheduling otimizado",
      color: "from-green-600 to-emerald-500",
      border: "border-green-500/20",
      bg: "bg-green-500/5",
    },
    {
      id: "services",
      icon: Settings,
      title: "Serviços Windows",
      desc: "Para telemetria, busca, superfetch e serviços inúteis",
      color: "from-yellow-600 to-amber-500",
      border: "border-yellow-500/20",
      bg: "bg-yellow-500/5",
    },
    {
      id: "ram",
      icon: MemoryStick,
      title: "Limpeza de RAM",
      desc: "Limpa memória ociosa e flush DNS automático",
      color: "from-teal-600 to-cyan-500",
      border: "border-teal-500/20",
      bg: "bg-teal-500/5",
    },
    {
      id: "gamebar",
      icon: Gamepad2,
      title: "Game Bar / DVR",
      desc: "Desabilita Xbox Game Bar e Game DVR — menos overhead",
      color: "from-rose-600 to-red-500",
      border: "border-rose-500/20",
      bg: "bg-rose-500/5",
    },
    {
      id: "gpu",
      icon: Monitor,
      title: "GPU Scheduling",
      desc: "Hardware accelerated GPU scheduling ativado",
      color: "from-indigo-600 to-violet-500",
      border: "border-indigo-500/20",
      bg: "bg-indigo-500/5",
    },
    {
      id: "fullscreen",
      icon: Monitor,
      title: "Fullscreen Optimizations",
      desc: "Desabilita otimizações de tela cheia do Windows",
      color: "from-orange-600 to-yellow-500",
      border: "border-orange-500/20",
      bg: "bg-orange-500/5",
    },
    {
      id: "mouse",
      icon: MousePointer,
      title: "Mouse Raw Input",
      desc: "Remove aceleração do mouse — precisão total para FPS",
      color: "from-lime-600 to-green-500",
      border: "border-lime-500/20",
      bg: "bg-lime-500/5",
    },
  ];

  const handleDownloadAll = () => {
    downloadScript(BOOST_SCRIPT, "SnyX-Otimizacao-ATIVAR.bat");
    toast.success("🚀 Script de otimização completa baixado!");
    setOptimizations(prev => {
      const all: any = {};
      Object.keys(prev).forEach(k => all[k] = true);
      return all;
    });
  };

  const handleRevertAll = () => {
    downloadScript(REVERT_SCRIPT, "SnyX-Otimizacao-REVERTER.bat");
    toast.success("↩️ Script de reversão baixado!");
    setOptimizations(prev => {
      const all: any = {};
      Object.keys(prev).forEach(k => all[k] = false);
      return all;
    });
  };

  const activeCount = Object.values(optimizations).filter(Boolean).length;
  const totalCount = Object.keys(optimizations).length;

  return (
    <div className="min-h-screen bg-[#07070f] text-white overflow-hidden relative">
      {/* Background effects */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(0,200,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,255,0.2) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />
      </div>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-cyan-600/15 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[300px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-white/50 hover:text-white transition mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-sm mb-6">
            <Cpu className="w-4 h-4" /> Otimização Total — Vinculada à Chave
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight">
            SnyX{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
              Optimizer
            </span>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            Otimize seu PC para máxima performance. Tudo conectado à sua chave — 
            desativou a chave, desativou a otimização.
          </p>
        </div>

        {/* Auth / Key check */}
        {!user ? (
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm">
              <Lock className="w-4 h-4" /> Faça login para acessar
            </div>
            <br />
            <Button onClick={() => navigate("/auth")}
              className="px-10 py-7 text-lg font-bold rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 shadow-[0_0_40px_rgba(0,200,255,0.3)] border-0">
              Fazer Login / Criar Conta
            </Button>
          </div>
        ) : loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-4" />
            <p className="text-white/40">Verificando chave de ativação...</p>
          </div>
        ) : !hasActiveKey ? (
          <div className="text-center space-y-6 mb-16">
            <div className="max-w-md mx-auto p-8 rounded-2xl border border-red-500/20 bg-red-500/5">
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2 text-red-400">Chave Não Encontrada</h3>
              <p className="text-white/50 text-sm mb-6">
                Você precisa de uma chave ativa do SnyX Accelerator para usar a otimização.
                A otimização está vinculada à sua chave — sem chave, sem otimização.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate("/accelerator")}
                  className="px-6 py-5 font-bold rounded-xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 border-0">
                  <Zap className="w-4 h-4 mr-2" /> Ativar Chave
                </Button>
                <Button onClick={() => navigate("/")} variant="outline"
                  className="px-6 py-5 font-bold rounded-xl border-white/10 hover:border-white/20">
                  Voltar ao Início
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Key status card */}
            <div className="max-w-2xl mx-auto mb-10 p-5 rounded-2xl border border-green-500/20 bg-green-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-green-500/20">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <div className="font-bold text-green-400">Chave Ativa — Otimização Liberada</div>
                  <div className="text-xs text-white/40 font-mono">
                    {keyInfo?.activation_key || "Chave válida"}
                    {keyInfo?.days_remaining !== null && keyInfo?.days_remaining !== undefined && (
                      <span className="ml-2 text-yellow-400">• {keyInfo.days_remaining} dias restantes</span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={checkKeyStatus} className="text-white/30 hover:text-white transition p-2">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Stats bar */}
            <div className="max-w-2xl mx-auto mb-10 grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] text-center">
                <div className="text-2xl font-black text-cyan-400">{activeCount}</div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider">Ativas</div>
              </div>
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] text-center">
                <div className="text-2xl font-black text-white/60">{totalCount - activeCount}</div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider">Inativas</div>
              </div>
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] text-center">
                <div className="text-2xl font-black text-green-400">{Math.round((activeCount / totalCount) * 100)}%</div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider">Otimizado</div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="max-w-2xl mx-auto mb-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleDownloadAll}
                className="px-8 py-6 text-base font-bold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 border-0 shadow-[0_0_30px_rgba(0,200,255,0.3)]">
                <Download className="w-5 h-5 mr-2" />
                Baixar Otimização Completa
              </Button>
              <Button onClick={handleRevertAll} variant="outline"
                className="px-6 py-6 text-base font-bold rounded-xl border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/5">
                <RotateCcw className="w-5 h-5 mr-2 text-yellow-400" />
                Reverter Tudo
              </Button>
            </div>

            {/* Optimization modules grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
              {optimizationModules.map((mod) => (
                <div key={mod.id}
                  className={`group p-5 rounded-2xl border transition-all duration-300 ${
                    optimizations[mod.id as keyof typeof optimizations]
                      ? `${mod.border} ${mod.bg}`
                      : "border-white/5 bg-white/[0.02] hover:border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${
                        optimizations[mod.id as keyof typeof optimizations]
                          ? `bg-gradient-to-br ${mod.color}`
                          : "bg-white/5"
                      }`}>
                        <mod.icon className={`w-5 h-5 ${
                          optimizations[mod.id as keyof typeof optimizations] ? "text-white" : "text-white/40"
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{mod.title}</h3>
                        <p className="text-xs text-white/40 mt-0.5">{mod.desc}</p>
                      </div>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      optimizations[mod.id as keyof typeof optimizations]
                        ? "bg-green-500/20 text-green-400"
                        : "bg-white/5 text-white/30"
                    }`}>
                      {optimizations[mod.id as keyof typeof optimizations] ? "Ativo" : "OFF"}
                    </div>
                  </div>
                </div>
              ))}
            </div>



            {/* Link to Accelerator */}
            <div className="text-center mb-10">
              <Button onClick={() => navigate("/accelerator")} variant="outline"
                className="px-6 py-5 rounded-xl border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5">
                <Zap className="w-4 h-4 mr-2 text-red-400" />
                Ir para o SnyX Accelerator
              </Button>
            </div>
          </>
        )}

        <div className="text-center text-white/20 text-xs pb-8">
          SnyX Optimizer v1.0 — Vinculado à chave Accelerator
        </div>
      </div>
    </div>
  );
};

export default Optimization;
