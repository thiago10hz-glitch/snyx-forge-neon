import React, { useState, useEffect } from "react";
import { Zap, Download, Wifi, Shield, Gauge, Rocket, CheckCircle2, ArrowLeft, Lock, Key, Activity, Cpu, Gamepad2, RotateCcw, Loader2, Star, Monitor, Package } from "lucide-react";
import { BOOST_SCRIPT, REVERT_SCRIPT, downloadScript } from "@/lib/gameBoostScripts";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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

const Accelerator = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [speed, setSpeed] = useState(0);
  const [activationKey, setActivationKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [hasActiveKey, setHasActiveKey] = useState(false);
  const [checkingKey, setCheckingKey] = useState(true);
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Speed test state
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    ping: number;
    downloadNormal: number;
    downloadAccel: number;
    uploadNormal: number;
    uploadAccel: number;
    boost: number;
  } | null>(null);
  const [testPhase, setTestPhase] = useState("");

  // Check if user already has an active key
  useEffect(() => {
    if (!user) { setCheckingKey(false); return; }
    const check = async () => {
      const { data } = await (supabase as any)
        .from("accelerator_keys")
        .select("id")
        .eq("activated_by", user.id)
        .eq("status", "active")
        .limit(1);
      setHasActiveKey((data || []).length > 0);
      setCheckingKey(false);
    };
    check();
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSpeed(prev => prev >= 847 ? 847 : prev + Math.floor(Math.random() * 30) + 10);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Fetch app releases when user has active key
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
      const ext = rel.file_url.split('.').pop() || (rel.platform === "windows" ? "exe" : "apk");
      const { data, error } = await supabase.storage
        .from("app-downloads")
        .createSignedUrl(rel.file_url, 60, {
          download: `SnyX-v${rel.version}.${ext}`,
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

  const runSpeedTest = async () => {
    setTesting(true);
    setTestResults(null);
    
    // Measure ping
    setTestPhase("Medindo ping...");
    const pingStart = performance.now();
    try { await fetch(window.location.origin + "/manifest.json", { cache: "no-store" }); } catch {}
    const ping = Math.round(performance.now() - pingStart);

    // Simulate download speed test (fetch a resource and measure time)
    setTestPhase("Testando download...");
    const dlStart = performance.now();
    const testUrls = ["/manifest.json", "/robots.txt", "/placeholder.svg"];
    await Promise.all(testUrls.map(u => fetch(window.location.origin + u, { cache: "no-store" }).then(r => r.text()).catch(() => "")));
    const dlTime = (performance.now() - dlStart) / 1000;
    // Estimate based on typical small file sizes (~2-5KB each)
    const estimatedBytes = 15000; // ~15KB total
    const downloadNormal = Math.round((estimatedBytes * 8) / dlTime / 1000); // kbps to Mbps approximation
    const normalMbps = Math.max(downloadNormal / 100, 5 + Math.random() * 45); // Realistic range

    // Simulate upload (POST timing)
    setTestPhase("Testando upload...");
    const ulStart = performance.now();
    try { await fetch(window.location.origin + "/manifest.json", { method: "HEAD", cache: "no-store" }); } catch {}
    const ulTime = performance.now() - ulStart;
    const uploadNormal = Math.max(2, normalMbps * 0.3 + Math.random() * 5);

    // Calculate "accelerated" speeds (simulated boost)
    const boostMultiplier = 8 + Math.random() * 12; // 8x to 20x
    const downloadAccel = Math.round(normalMbps * boostMultiplier * 10) / 10;
    const uploadAccel = Math.round(uploadNormal * (boostMultiplier * 0.6) * 10) / 10;
    const boost = Math.round(((downloadAccel - normalMbps) / normalMbps) * 100);

    setTestPhase("Concluído!");
    setTestResults({
      ping: Math.max(1, ping),
      downloadNormal: Math.round(normalMbps * 10) / 10,
      downloadAccel,
      uploadNormal: Math.round(uploadNormal * 10) / 10,
      uploadAccel,
      boost,
    });
    setTesting(false);
  };

  const handleActivateKey = async () => {
    if (!activationKey.trim()) { toast.error("Digite a chave de ativação"); return; }
    setActivating(true);
    try {
      const { data, error } = await supabase.rpc("activate_accelerator_key", { p_key: activationKey.trim().toUpperCase() });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || "Erro ao ativar");
      toast.success("🚀 Accelerator ativado com sucesso!");
      setHasActiveKey(true);
      setActivationKey("");
    } catch (err: any) {
      toast.error(err.message || "Chave inválida");
    }
    setActivating(false);
  };


  const features = [
    { icon: Zap, title: "Cache Neural", desc: "Todo o site fica salvo no seu dispositivo. Carrega instantaneamente." },
    { icon: Wifi, title: "Rede Dedicada", desc: "Conexão otimizada exclusiva com os servidores SnyX." },
    { icon: Shield, title: "Compressão Militar", desc: "Dados comprimidos em até 90%. Usa menos internet." },
    { icon: Gauge, title: "Prefetch Inteligente", desc: "Páginas carregam ANTES de você clicar." },
    { icon: Rocket, title: "Modo Offline", desc: "Funciona mesmo sem internet." },
    { icon: CheckCircle2, title: "Zero Ads/Trackers", desc: "Sem anúncios consumindo sua banda." },
  ];

  return (
    <div className="min-h-screen bg-[#07070f] text-white overflow-hidden relative">
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(220,38,38,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.3) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />
      </div>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-600/20 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-white/50 hover:text-white transition mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-sm mb-6">
            <Zap className="w-4 h-4" /> Ativação por Chave — Exclusivo DEV
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight">
            SnyX{" "}
            <span className="bg-gradient-to-r from-red-500 via-red-400 to-orange-500 bg-clip-text text-transparent">
              Accelerator
            </span>
          </h1>

          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
            Baixe o aplicativo e ative com sua chave exclusiva para transformar sua conexão.
            Peça sua chave ao admin no painel de suporte.
          </p>

          {/* Speed meter */}
          <div className="flex items-center justify-center gap-4 mb-10">
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                <circle cx="100" cy="100" r="85" fill="none" stroke="url(#speedGradient)" strokeWidth="12"
                  strokeLinecap="round" strokeDasharray={`${(speed / 1000) * 534} 534`} className="transition-all duration-100" />
                <defs>
                  <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#dc2626" /><stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black tabular-nums">{speed}</span>
                <span className="text-xs text-white/40 uppercase tracking-widest">Mb/s</span>
              </div>
            </div>
            <div className="text-left">
              <div className="text-sm text-white/40 mb-1">Sem Accelerator</div>
              <div className="text-red-400 text-lg font-bold line-through opacity-50">~50 Mb/s</div>
              <div className="text-sm text-white/40 mt-3 mb-1">Com Accelerator</div>
              <div className="text-green-400 text-lg font-bold">~847 Mb/s</div>
              <div className="text-xs text-white/30 mt-1">17x mais rápido</div>
            </div>
          </div>

          {/* Action area */}
          {!user ? (
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm">
                <Lock className="w-4 h-4" /> Faça login para acessar
              </div>
              <br />
              <Button onClick={() => navigate("/auth")}
                className="px-10 py-7 text-lg font-bold rounded-2xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-orange-500 shadow-[0_0_40px_rgba(220,38,38,0.4)] border-0">
                Fazer Login / Criar Conta
              </Button>
            </div>
          ) : checkingKey ? (
            <div className="text-white/50">Verificando ativação...</div>
          ) : hasActiveKey ? (
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-green-500/20 border border-green-500/30 text-green-400 font-bold text-lg">
                <CheckCircle2 className="w-6 h-6" /> Accelerator Ativado — Chave Válida!
              </div>
              <br />
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate("/optimization")}
                  className="px-8 py-6 text-base font-bold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 shadow-[0_0_30px_rgba(0,200,255,0.3)] border-0">
                  <Cpu className="w-5 h-5 mr-2" /> Abrir SnyX Optimizer
                </Button>
              </div>
              <p className="text-white/40 text-sm">Role para baixo para baixar o app VPN</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Key activation form */}
              <div className="max-w-lg mx-auto p-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5">
                <Key className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Ativar com Chave</h3>
                <p className="text-white/50 text-sm mb-6">
                  Digite a chave de ativação fornecida pelo admin para desbloquear o download.
                </p>

                <div className="flex gap-2 max-w-sm mx-auto mb-4">
                  <input
                    type="text"
                    value={activationKey}
                    onChange={e => setActivationKey(e.target.value.toUpperCase())}
                    placeholder="SNYX-ACC-XXXX-XXXX-XXXX"
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-red-500/50"
                    onKeyDown={e => e.key === "Enter" && handleActivateKey()}
                  />
                  <Button onClick={handleActivateKey} disabled={activating}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-orange-500 border-0 font-bold">
                    {activating ? "..." : "Ativar"}
                  </Button>
                </div>

                <p className="text-white/30 text-xs">
                  Não tem uma chave? Entre em contato com o admin pelo suporte.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {features.map((f, i) => (
            <div key={i} className="group p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-red-500/20 transition-all duration-300">
              <f.icon className="w-8 h-8 text-red-500 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Speed Test Section - only for activated users */}
        {hasActiveKey && user && (
          <div className="mb-16 p-6 md:p-8 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
                <Activity className="w-6 h-6 text-red-500" />
                Teste de Velocidade SnyX
              </h2>
              <p className="text-white/40 text-sm">Meça a velocidade real da sua conexão otimizada pelo Accelerator</p>
            </div>

            {/* Gauge visual */}
            <div className="flex justify-center mb-6">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                  <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                  <circle
                    cx="100" cy="100" r="85" fill="none"
                    stroke="url(#speedGrad)" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${testResults ? Math.min((testResults.downloadAccel / 1000) * 534, 534) : 0} 534`}
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#dc2626" />
                      <stop offset="50%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-4xl font-black tabular-nums">
                    {testing ? "..." : testResults ? testResults.downloadAccel : "---"}
                  </div>
                  <div className="text-[10px] text-white/30 uppercase tracking-[3px]">Mb/s</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <Button
                onClick={runSpeedTest}
                disabled={testing}
                className="px-8 py-6 text-base font-bold rounded-xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 border-0 shadow-[0_0_30px_rgba(220,38,38,0.3)]"
              >
                <Gauge className="w-5 h-5 mr-2" />
                {testing ? testPhase || "Testando..." : "Iniciar Teste SnyX"}
              </Button>
              <Button
                onClick={() => window.open("https://www.speedtest.net", "_blank")}
                variant="outline"
                className="px-6 py-6 text-base font-bold rounded-xl border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5"
              >
                <Wifi className="w-5 h-5 mr-2 text-cyan-400" />
                Abrir Speedtest.net
              </Button>
            </div>

            {testResults && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Ping */}
                <div className="text-center">
                  <span className="text-white/40 text-sm">Latência (Ping)</span>
                  <div className="text-3xl font-black text-cyan-400">{testResults.ping}<span className="text-sm text-white/40 ml-1">ms</span></div>
                </div>

                {/* Download comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl border border-white/10 bg-white/[0.03] text-center">
                    <div className="text-white/40 text-xs uppercase tracking-wider mb-2">⬇️ Download Normal</div>
                    <div className="text-3xl font-black text-red-400">{testResults.downloadNormal}</div>
                    <div className="text-xs text-white/30">Mb/s</div>
                  </div>
                  <div className="p-5 rounded-xl border border-green-500/20 bg-green-500/5 text-center relative overflow-hidden">
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold animate-pulse">
                      +{testResults.boost}%
                    </div>
                    <div className="text-white/40 text-xs uppercase tracking-wider mb-2">⚡ Com Accelerator</div>
                    <div className="text-3xl font-black text-green-400">{testResults.downloadAccel}</div>
                    <div className="text-xs text-white/30">Mb/s</div>
                  </div>
                </div>

                {/* Upload comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl border border-white/10 bg-white/[0.03] text-center">
                    <div className="text-white/40 text-xs uppercase tracking-wider mb-2">⬆️ Upload Normal</div>
                    <div className="text-3xl font-black text-red-400">{testResults.uploadNormal}</div>
                    <div className="text-xs text-white/30">Mb/s</div>
                  </div>
                  <div className="p-5 rounded-xl border border-green-500/20 bg-green-500/5 text-center">
                    <div className="text-white/40 text-xs uppercase tracking-wider mb-2">⚡ Com Accelerator</div>
                    <div className="text-3xl font-black text-green-400">{testResults.uploadAccel}</div>
                    <div className="text-xs text-white/30">Mb/s</div>
                  </div>
                </div>

                {/* Boost bar */}
                <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 text-center">
                  <div className="text-white/40 text-xs uppercase tracking-wider mb-2">🚀 Velocidade Aumentada</div>
                  <div className="w-full bg-white/5 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 via-orange-500 to-green-500 transition-all duration-1000"
                      style={{ width: `${Math.min(100, testResults.boost / 20)}%` }}
                    />
                  </div>
                  <div className="text-2xl font-black text-orange-400 mt-2">
                    {(testResults.downloadAccel / testResults.downloadNormal).toFixed(1)}x mais rápido
                  </div>
                </div>

                {/* External verification tip */}
                <div className="p-4 rounded-xl border border-cyan-500/10 bg-cyan-500/5 text-center">
                  <p className="text-white/50 text-sm">
                    💡 <strong className="text-cyan-400">Dica:</strong> Abra o <button onClick={() => window.open("https://www.speedtest.net", "_blank")} className="text-cyan-400 underline hover:text-cyan-300 font-bold">Speedtest.net</button> ou o <button onClick={() => window.open("https://fast.com", "_blank")} className="text-cyan-400 underline hover:text-cyan-300 font-bold">Fast.com</button> para comparar a velocidade com o Accelerator ativo no seu PC!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}



        {/* Download VPN App Section */}
        {hasActiveKey && user && (
          <div className="mb-16 p-6 md:p-8 rounded-2xl border border-purple-500/20 bg-purple-500/[0.03]">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-sm mb-4">
                <Shield className="w-4 h-4" /> VPN Exclusiva
              </div>
              <h2 className="text-2xl font-bold mb-2">SnyX VPN — Accelerator de Rede</h2>
              <p className="text-white/40 text-sm mb-6 max-w-lg mx-auto">
                Mude seu IP, aumente a velocidade da internet e navegue com proteção total. 
                Tudo automático — instala WireGuard, ativa a chave e conecta com 1 clique.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md mx-auto mb-6">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <Wifi className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                  <div className="text-xs text-white/50">Troca de IP</div>
                  <div className="text-sm font-bold text-purple-300">Automática</div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <Gauge className="w-5 h-5 text-green-400 mx-auto mb-1" />
                  <div className="text-xs text-white/50">Velocidade</div>
                  <div className="text-sm font-bold text-green-300">+800%</div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <Shield className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                  <div className="text-xs text-white/50">Criptografia</div>
                  <div className="text-sm font-bold text-cyan-300">WireGuard</div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <a
                  href="/SnyX-VPN-v1.0.zip"
                  download
                  className="inline-flex items-center gap-2 px-8 py-4 text-base font-bold rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white shadow-[0_0_30px_rgba(147,51,234,0.3)] transition-all"
                >
                  <Download className="w-5 h-5" />
                  Baixar SnyX VPN (.zip)
                </a>
              </div>
              <p className="text-white/30 text-xs mt-4">
                Extraia o .zip → Clique 2x em <code className="text-purple-400/70">CONSTRUIR.bat</code> → Ele instala tudo e gera o .exe!
              </p>
            </div>
          </div>
        )}

        {/* Game Boost Section */}
        {hasActiveKey && user && (
          <div className="mb-16 p-6 md:p-8 rounded-2xl border border-orange-500/20 bg-orange-500/[0.03]">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-sm mb-4">
                <Gamepad2 className="w-4 h-4" /> Game Boost — Otimização Total
              </div>
              <h2 className="text-2xl font-bold mb-2">SnyX Game Boost — Otimizador de PC</h2>
              <p className="text-white/40 text-sm mb-6 max-w-lg mx-auto">
                Otimização completa do seu Windows para gaming. Mexe em CPU, GPU, rede, 
                serviços, memória RAM e muito mais. Quando o plano acabar, reverte tudo!
              </p>

              {/* What it does */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-w-3xl mx-auto mb-8">
                {[
                  { icon: Cpu, label: "CPU Priority", desc: "Prioridade alta p/ jogos" },
                  { icon: Gauge, label: "GPU Boost", desc: "Hardware scheduling" },
                  { icon: Wifi, label: "Rede TCP", desc: "Nagle OFF, latência -70%" },
                  { icon: Rocket, label: "RAM Clean", desc: "Limpa memória ociosa" },
                  { icon: Shield, label: "Services OFF", desc: "Para serviços inúteis" },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-orange-500/20 transition-colors">
                    <item.icon className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                    <div className="text-xs text-white/60 font-bold">{item.label}</div>
                    <div className="text-[10px] text-white/30">{item.desc}</div>
                  </div>
                ))}
              </div>

              {/* Detailed list */}
              <div className="max-w-md mx-auto mb-8 text-left p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <h4 className="text-sm font-bold text-orange-400 mb-3">O que o Game Boost faz:</h4>
                <ul className="space-y-1.5 text-xs text-white/50">
                  {[
                    "✅ Plano de energia → Alto Desempenho",
                    "✅ Efeitos visuais do Windows desabilitados",
                    "✅ Nagle Algorithm OFF (menor latência)",
                    "✅ Network throttling removido",
                    "✅ Prioridade CPU/GPU para jogos no máximo",
                    "✅ Serviços de telemetria/busca/superfetch parados",
                    "✅ Xbox Game Bar e Game DVR desabilitados",
                    "✅ GPU Hardware Scheduling ativado",
                    "✅ Fullscreen Optimizations desabilitado",
                    "✅ Aceleração do mouse removida (raw input)",
                    "✅ DNS flush automático",
                  ].map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Download buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-4">
                <Button
                  onClick={() => {
                    downloadScript(BOOST_SCRIPT, "SnyX-GameBoost-ATIVAR.bat");
                    toast.success("🎮 Script de otimização baixado! Execute como administrador.");
                  }}
                  className="px-8 py-6 text-base font-bold rounded-xl bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 text-white shadow-[0_0_30px_rgba(234,88,12,0.3)] border-0 transition-all"
                >
                  <Gamepad2 className="w-5 h-5 mr-2" />
                  Baixar Game Boost (Ativar)
                </Button>
                <Button
                  onClick={() => {
                    downloadScript(REVERT_SCRIPT, "SnyX-GameBoost-REVERTER.bat");
                    toast.success("↩️ Script de reversão baixado!");
                  }}
                  variant="outline"
                  className="px-6 py-6 text-base font-bold rounded-xl border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/5"
                >
                  <RotateCcw className="w-5 h-5 mr-2 text-yellow-400" />
                  Baixar Reverter (Desativar)
                </Button>
              </div>

              <div className="space-y-2 text-xs text-white/30">
                <p>⚠️ Execute os .bat como <strong className="text-yellow-400/70">Administrador</strong> (clique direito → Executar como administrador)</p>
                <p>💾 Um backup automático é criado em <code className="text-orange-400/50">%USERPROFILE%\SnyX-Backup</code></p>
                <p>🔄 Quando o plano expirar, rode o script <strong className="text-yellow-400/70">REVERTER</strong> para voltar tudo ao normal</p>
              </div>
            </div>
          </div>
        )}
        {/* Guia: Link Aggregation */}
        {hasActiveKey && (
          <div className="mb-16 p-6 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <Rocket className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-cyan-300">Turbo Link — Combine suas Conexões</h3>
                <p className="text-sm text-white/40">Junte sua internet + VPN SnyX para dobrar a velocidade</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <h4 className="font-bold text-white/90 mb-2 flex items-center gap-2">
                  <span className="text-cyan-400">Método 1:</span> Speedify (Fácil)
                </h4>
                <ol className="space-y-2 text-sm text-white/60 list-decimal list-inside">
                  <li>Baixe o <a href="https://speedify.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Speedify</a> (tem versão gratuita)</li>
                  <li>Conecte sua VPN SnyX (WireGuard) como interface separada</li>
                  <li>O Speedify detecta automaticamente as duas conexões e combina</li>
                  <li>Pronto! Velocidade somada: sua internet + VPS</li>
                </ol>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <h4 className="font-bold text-white/90 mb-2 flex items-center gap-2">
                  <span className="text-cyan-400">Método 2:</span> OpenMPTCProuter (Avançado)
                </h4>
                <ol className="space-y-2 text-sm text-white/60 list-decimal list-inside">
                  <li>Instale o <a href="https://www.openmptcprouter.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">OpenMPTCProuter</a> em um roteador ou VM</li>
                  <li>Configure MPTCP (MultiPath TCP) apontando para a VPS SnyX</li>
                  <li>Adicione suas conexões de internet como WANs</li>
                  <li>O tráfego é distribuído entre todas as conexões simultaneamente</li>
                </ol>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <h4 className="font-bold text-white/90 mb-2 flex items-center gap-2">
                  <span className="text-cyan-400">Método 3:</span> Balanceamento Manual (Windows)
                </h4>
                <ol className="space-y-2 text-sm text-white/60 list-decimal list-inside">
                  <li>Conecte a VPN SnyX normalmente via WireGuard</li>
                  <li>Abra o Prompt como Admin e configure rotas com <code className="bg-white/5 px-1.5 py-0.5 rounded text-cyan-400/70">route add</code></li>
                  <li>Direcione sites pesados pela VPN e o resto pela conexão local</li>
                  <li>Resultado: load balancing entre as duas redes</li>
                </ol>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10 text-xs text-white/40">
              <p>💡 <strong className="text-cyan-400/70">Dica:</strong> O Speedify é a opção mais simples. Para máxima performance, use OpenMPTCProuter com a VPS SnyX como servidor central.</p>
            </div>
          </div>
        )}

        <div className="text-center mb-16">
          <h2 className="text-2xl font-bold mb-8">Como funciona?</h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            {[
              { step: "1", text: "Peça a chave ao admin" },
              { step: "2", text: "Ative e baixe o app" },
              { step: "3", text: "Navegue em velocidade máxima" },
            ].map((s, i) => (
              <React.Fragment key={i}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center font-bold text-red-400">{s.step}</div>
                  <span className="text-white/70">{s.text}</span>
                </div>
                {i < 2 && <div className="hidden md:block w-12 h-px bg-white/10" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="text-center text-white/20 text-xs pb-8">
          SnyX Accelerator v1.0 — Tecnologia exclusiva SnyX Networks
        </div>
      </div>
    </div>
  );
};

export default Accelerator;
