import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BOOST_SCRIPT, REVERT_SCRIPT, downloadScript } from "@/lib/gameBoostScripts";
import {
  ArrowLeft, Lock, Cpu, Zap, Monitor, MemoryStick, Settings, CheckCircle2,
  XCircle, Power, Loader2, RefreshCw, Download, RotateCcw, Gamepad2,
  Eye, MousePointer, Network, Shield, Key, HardDrive, Wifi, Gauge, Flame,
  ChevronRight, Check, Info
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// ============= ELECTRON DESKTOP TYPES =============
declare global {
  interface Window {
    snyxAPI?: {
      isDesktop: boolean;
      activateKey: (key: string) => Promise<any>;
      checkLicense: () => Promise<any>;
      runOptimization: (id: string) => Promise<any>;
      runAllOptimizations: () => Promise<any>;
      revertAll: () => Promise<any>;
      getSystemInfo: () => Promise<any>;
      setupVPN: (config: any) => Promise<any>;
      removeVPN: () => Promise<any>;
      cleanupNetwork: () => Promise<any>;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      selfDestruct: () => Promise<any>;
      onLicenseRevoked: (cb: (reason: string) => void) => void;
    };
  }
}

const isDesktop = typeof window !== "undefined" && !!window.snyxAPI?.isDesktop;

// ============= ELECTRON KEY-ONLY FLOW =============
const desktopModules = [
  { id: "power", name: "Power Plan", desc: "Plano de energia máximo desempenho", icon: Power, color: "text-yellow-400" },
  { id: "network", name: "Network Boost", desc: "Otimização TCP/IP e DNS", icon: Wifi, color: "text-blue-400" },
  { id: "cpu", name: "CPU Priority", desc: "Prioridade de processos para jogos", icon: Cpu, color: "text-red-400" },
  { id: "gpu", name: "GPU Tweaks", desc: "Configurações de GPU otimizadas", icon: Monitor, color: "text-green-400" },
  { id: "ram", name: "RAM Cleaner", desc: "Limpeza e otimização de memória", icon: MemoryStick, color: "text-purple-400" },
  { id: "disk", name: "Disk Boost", desc: "Otimização de disco e I/O", icon: HardDrive, color: "text-orange-400" },
  { id: "gaming", name: "Game Mode", desc: "Modo jogo do Windows otimizado", icon: Flame, color: "text-red-500" },
  { id: "latency", name: "Low Latency", desc: "Redução de latência de rede", icon: Gauge, color: "text-cyan-400" },
  { id: "services", name: "Service Cleanup", desc: "Desativa serviços desnecessários", icon: RefreshCw, color: "text-pink-400" },
  { id: "dns", name: "DNS Optimizer", desc: "DNS mais rápido configurado", icon: Network, color: "text-emerald-400" },
];

function DesktopKeyActivation({ onActivated }: { onActivated: () => void }) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    window.snyxAPI!.checkLicense().then((res: any) => {
      if (res?.valid) onActivated();
      setChecking(false);
    }).catch(() => setChecking(false));
  }, [onActivated]);

  const activate = async () => {
    if (!key.trim()) return;
    setLoading(true);
    try {
      const res = await window.snyxAPI!.activateKey(key.trim());
      if (res?.success) {
        toast.success(res.message || "Chave ativada!");
        onActivated();
      } else {
        toast.error(res?.error || "Chave inválida");
      }
    } catch {
      toast.error("Falha ao ativar chave");
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07070f]">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#07070f]">
      {/* Titlebar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5 select-none" style={{ WebkitAppRegion: "drag" } as any}>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold text-gray-300">SnyX Optimizer</span>
        </div>
        <div className="flex gap-1" style={{ WebkitAppRegion: "no-drag" } as any}>
          <button onClick={() => window.snyxAPI!.minimize()} className="w-8 h-6 flex items-center justify-center hover:bg-white/10 rounded text-gray-400 text-xs">─</button>
          <button onClick={() => window.snyxAPI!.maximize()} className="w-8 h-6 flex items-center justify-center hover:bg-white/10 rounded text-gray-400 text-xs">□</button>
          <button onClick={() => window.snyxAPI!.close()} className="w-8 h-6 flex items-center justify-center hover:bg-red-600/80 rounded text-gray-400 hover:text-white text-xs">✕</button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-3">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-lg shadow-red-600/30">
              <Zap className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">SnyX Optimizer</h1>
            <p className="text-sm text-gray-400">Insira sua chave de ativação para continuar</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="SNYX-ACC-XXXX-XXXX-XXXX"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && activate()}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 font-mono text-sm tracking-wider"
                disabled={loading}
              />
            </div>
            <Button
              onClick={activate}
              disabled={loading || !key.trim()}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-semibold rounded-xl transition-all"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              {loading ? "Verificando..." : "Ativar Chave"}
            </Button>
          </div>
          <p className="text-xs text-gray-600">v2.0 • Sistema protegido por chave de ativação</p>
        </div>
      </div>
    </div>
  );
}

function DesktopOptimizer() {
  const [running, setRunning] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    window.snyxAPI!.getSystemInfo().then(setSysInfo).catch(() => {});
    window.snyxAPI!.onLicenseRevoked((reason: string) => {
      toast.error("Licença revogada: " + reason);
    });
  }, []);

  const runModule = async (id: string) => {
    setRunning(id);
    setProgress(0);
    const interval = setInterval(() => setProgress(p => Math.min(p + 15, 90)), 200);
    try {
      await window.snyxAPI!.runOptimization(id);
      setProgress(100);
      setCompleted(prev => new Set(prev).add(id));
      toast.success(`${desktopModules.find(m => m.id === id)?.name} aplicado!`);
    } catch {
      toast.error("Falha na otimização");
    }
    clearInterval(interval);
    setTimeout(() => { setRunning(null); setProgress(0); }, 500);
  };

  const runAll = async () => {
    setRunning("all");
    setProgress(0);
    try {
      await window.snyxAPI!.runAllOptimizations();
      setProgress(100);
      setCompleted(new Set(desktopModules.map(m => m.id)));
      toast.success("Todas otimizações aplicadas!");
    } catch {
      toast.error("Erro ao aplicar otimizações");
    }
    setTimeout(() => { setRunning(null); setProgress(0); }, 500);
  };

  const revertAll = async () => {
    try {
      await window.snyxAPI!.revertAll();
      setCompleted(new Set());
      toast.success("Todas otimizações revertidas");
    } catch {
      toast.error("Erro ao reverter");
    }
  };

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      {/* Titlebar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5 select-none" style={{ WebkitAppRegion: "drag" } as any}>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold text-gray-300">SnyX Optimizer</span>
        </div>
        <div className="flex gap-1" style={{ WebkitAppRegion: "no-drag" } as any}>
          <button onClick={() => window.snyxAPI!.minimize()} className="w-8 h-6 flex items-center justify-center hover:bg-white/10 rounded text-gray-400 text-xs">─</button>
          <button onClick={() => window.snyxAPI!.maximize()} className="w-8 h-6 flex items-center justify-center hover:bg-white/10 rounded text-gray-400 text-xs">□</button>
          <button onClick={() => window.snyxAPI!.close()} className="w-8 h-6 flex items-center justify-center hover:bg-red-600/80 rounded text-gray-400 hover:text-white text-xs">✕</button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-red-500" /> SnyX Optimizer
            </h1>
            <p className="text-sm text-gray-500 mt-1">{completed.size}/{desktopModules.length} otimizações ativas</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={runAll} disabled={!!running} size="sm" className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500">
              <Zap className="h-3.5 w-3.5 mr-1" /> Otimizar Tudo
            </Button>
            <Button onClick={revertAll} disabled={!!running} size="sm" variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reverter
            </Button>
          </div>
        </div>

        {running && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{running === "all" ? "Aplicando todas..." : `Aplicando ${desktopModules.find(m => m.id === running)?.name}...`}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {sysInfo && (
          <Card className="p-4 bg-white/[0.03] border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-300">Sistema</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-400">
              <div><span className="text-gray-600">OS:</span> {sysInfo.os}</div>
              <div><span className="text-gray-600">CPU:</span> {sysInfo.cpu}</div>
              <div><span className="text-gray-600">RAM:</span> {sysInfo.ram}</div>
              <div><span className="text-gray-600">GPU:</span> {sysInfo.gpu}</div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {desktopModules.map((mod) => {
            const Icon = mod.icon;
            const isDone = completed.has(mod.id);
            const isRunning = running === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => !running && runModule(mod.id)}
                disabled={!!running}
                className={`group relative p-4 rounded-xl border text-left transition-all ${
                  isDone ? "bg-green-500/5 border-green-500/20" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                } disabled:opacity-50`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDone ? "bg-green-500/10" : "bg-white/5"}`}>
                      <Icon className={`h-4 w-4 ${isDone ? "text-green-400" : mod.color}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">{mod.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{mod.desc}</p>
                    </div>
                  </div>
                  {isDone ? <Check className="h-4 w-4 text-green-400" /> : isRunning ? <Loader2 className="h-4 w-4 animate-spin text-red-400" /> : <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-gray-400" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============= WEB VERSION (original) =============
interface KeyInfo {
  activation_key: string;
  activated_at: string | null;
  expires_at: string | null;
  status: string;
}

const modules = [
  { id: "cpu", name: "CPU Optimizer", desc: "Otimiza prioridade de processos e threads para jogos", icon: Cpu, color: "from-red-500/20 to-red-600/20 border-red-500/30 text-red-400" },
  { id: "gpu", name: "GPU Tweaks", desc: "Configurações avançadas de GPU para máximo FPS", icon: Monitor, color: "from-green-500/20 to-green-600/20 border-green-500/30 text-green-400" },
  { id: "ram", name: "RAM Cleaner", desc: "Libera memória RAM e otimiza uso", icon: MemoryStick, color: "from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400" },
  { id: "network", name: "Network Boost", desc: "Otimiza TCP/IP e reduz latência de rede", icon: Network, color: "from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400" },
  { id: "power", name: "Power Plan", desc: "Ativa plano de energia de máximo desempenho", icon: Power, color: "from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-400" },
  { id: "gaming", name: "Game Mode Pro", desc: "Desativa serviços desnecessários durante jogos", icon: Gamepad2, color: "from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400" },
  { id: "visual", name: "Visual Tweaks", desc: "Desativa efeitos visuais que consomem performance", icon: Eye, color: "from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-400" },
  { id: "input", name: "Input Lag Fix", desc: "Reduz input lag de mouse e teclado", icon: MousePointer, color: "from-cyan-500/20 to-cyan-600/20 border-cyan-500/30 text-cyan-400" },
];

function WebOptimization() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyInput, setKeyInput] = useState("");
  const [activating, setActivating] = useState(false);
  const [optimizedModules, setOptimizedModules] = useState<Set<string>>(new Set());
  const [runningModule, setRunningModule] = useState<string | null>(null);

  const hasAccess = !!(profile?.is_vip || profile?.is_dev);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadKey();
  }, [user]);

  const loadKey = async () => {
    const { data } = await supabase
      .from("accelerator_keys")
      .select("activation_key, activated_at, expires_at, status")
      .eq("activated_by", user!.id)
      .eq("status", "active")
      .maybeSingle();
    setKeyInfo(data);
    setLoading(false);
  };

  const activateKey = async () => {
    if (!keyInput.trim()) return;
    setActivating(true);
    const { data, error } = await supabase.rpc("activate_accelerator_key", { p_key: keyInput.trim() });
    if (error) { toast.error("Erro ao ativar chave"); setActivating(false); return; }
    const result = data as any;
    if (result.success) { toast.success(result.message); loadKey(); }
    else toast.error(result.error);
    setActivating(false);
  };

  const handleOptimize = async (moduleId: string) => {
    setRunningModule(moduleId);
    await new Promise(r => setTimeout(r, 1500));
    setOptimizedModules(prev => new Set(prev).add(moduleId));
    setRunningModule(null);
    toast.success(`${modules.find(m => m.id === moduleId)?.name} otimizado!`);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" /> SnyX Accelerator
            </h1>
            <p className="text-muted-foreground text-sm">Otimização avançada para PC</p>
          </div>
        </div>

        {!hasAccess && !keyInfo ? (
          <div className="max-w-md mx-auto space-y-6 py-12">
            <div className="text-center space-y-2">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-bold text-foreground">Acesso Restrito</h2>
              <p className="text-sm text-muted-foreground">Insira sua chave de ativação ou adquira acesso VIP</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="SNYX-ACC-XXXX-XXXX-XXXX"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && activateKey()}
                className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button onClick={activateKey} disabled={activating || !keyInput.trim()}>
                {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {keyInfo && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-foreground">Chave ativa: <code className="font-mono text-primary">{keyInfo.activation_key}</code></span>
                {keyInfo.expires_at && <span className="text-muted-foreground ml-auto">Expira: {new Date(keyInfo.expires_at).toLocaleDateString("pt-BR")}</span>}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => downloadScript(BOOST_SCRIPT, "SnyX-Optimizer.bat")} className="bg-primary hover:bg-primary/90">
                <Download className="h-4 w-4 mr-2" /> Baixar Otimizador
              </Button>
              <Button onClick={() => downloadScript(REVERT_SCRIPT, "SnyX-Reverter.bat")} variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" /> Baixar Reversor
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {modules.map((mod) => {
                const Icon = mod.icon;
                const isDone = optimizedModules.has(mod.id);
                const isRunning = runningModule === mod.id;
                return (
                  <button
                    key={mod.id}
                    onClick={() => handleOptimize(mod.id)}
                    disabled={!!runningModule || isDone}
                    className={`p-4 rounded-xl border bg-gradient-to-br ${mod.color} text-left transition-all hover:scale-[1.02] disabled:opacity-60`}
                  >
                    <Icon className="h-6 w-6 mb-2" />
                    <h3 className="font-semibold text-sm text-foreground">{mod.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{mod.desc}</p>
                    <div className="mt-3 text-xs font-medium">
                      {isRunning ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Otimizando...</span> :
                       isDone ? <span className="flex items-center gap-1 text-green-400"><CheckCircle2 className="h-3 w-3" /> Aplicado</span> :
                       "Clique para otimizar"}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============= MAIN EXPORT =============
export default function Optimization() {
  const [desktopActivated, setDesktopActivated] = useState(false);
  const handleActivated = useCallback(() => setDesktopActivated(true), []);

  // Electron desktop: key-only flow, no auth needed
  if (isDesktop) {
    if (!desktopActivated) return <DesktopKeyActivation onActivated={handleActivated} />;
    return <DesktopOptimizer />;
  }

  // Web: normal flow with auth
  return <WebOptimization />;
}
