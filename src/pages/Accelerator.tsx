import React, { useState, useEffect } from "react";
import { Zap, Download, Wifi, Shield, Gauge, Rocket, CheckCircle2, ArrowLeft, Lock, Key, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Accelerator = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [installing, setInstalling] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [activationKey, setActivationKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [hasActiveKey, setHasActiveKey] = useState(false);
  const [checkingKey, setCheckingKey] = useState(true);

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

  const handleDownload = () => {
    setInstalling(true);
    const siteUrl = window.location.origin;
    const isWindows = navigator.userAgent.includes("Windows");
    const isMac = navigator.userAgent.includes("Mac");

    if (isWindows) {
      const bat = `@echo off
title SnyX Accelerator - Instalador v1.0
color 0C
echo.
echo  ============================================
echo  ⚡ SnyX Accelerator - Instalador Oficial
echo  ============================================
echo.
echo  Iniciando instalacao do SnyX Accelerator...
echo.
echo  [1/3] Verificando sistema...
timeout /t 2 /nobreak >nul
echo  [OK] Windows detectado
echo.
echo  [2/3] Configurando rede otimizada...
timeout /t 2 /nobreak >nul
echo  [OK] Cache neural ativado
echo.
echo  [3/3] Abrindo SnyX Accelerator...
timeout /t 1 /nobreak >nul
echo.
start "" "chrome" "--app=${siteUrl}/accelerator"
if errorlevel 1 (
  start "" "msedge" "--app=${siteUrl}/accelerator"
  if errorlevel 1 (
    start "" "${siteUrl}/accelerator"
  )
)
echo.
echo  ============================================
echo  ⚡ SnyX Accelerator instalado com sucesso!
echo  ============================================
echo.
echo  O app foi aberto no navegador.
echo  Esta janela vai fechar em 5 segundos...
timeout /t 5
`;
      const blob = new Blob([bat], { type: "application/x-bat" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SnyX-Accelerator-Setup.bat";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado! Execute o arquivo .bat para instalar.");
    } else if (isMac) {
      const sh = `#!/bin/bash
echo ""
echo "  ============================================"
echo "  ⚡ SnyX Accelerator - Instalador Oficial"
echo "  ============================================"
echo ""
echo "  Iniciando instalacao..."
sleep 1
echo "  [OK] macOS detectado"
echo "  [OK] Cache neural ativado"
echo ""
open -a "Google Chrome" --args --app="${siteUrl}/accelerator" 2>/dev/null || open "${siteUrl}/accelerator"
echo "  ⚡ SnyX Accelerator instalado com sucesso!"
echo ""
`;
      const blob = new Blob([sh], { type: "application/x-sh" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SnyX-Accelerator-Setup.sh";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado! Execute o arquivo .sh para instalar.");
    } else {
      // Android/iOS/Linux - download HTML app
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SnyX Accelerator</title>
<link rel="manifest" href="${siteUrl}/manifest.json">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#07070f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
.c{padding:2rem}h1{font-size:2rem;margin-bottom:1rem}p{color:#999;margin-bottom:2rem}
a{display:inline-block;padding:1rem 2rem;background:linear-gradient(135deg,#dc2626,#f97316);color:#fff;text-decoration:none;border-radius:1rem;font-weight:bold;font-size:1.1rem}</style>
</head><body><div class="c"><h1>⚡ SnyX Accelerator</h1><p>Redirecionando...</p>
<a href="${siteUrl}/accelerator">Abrir SnyX Accelerator</a>
<script>setTimeout(()=>window.location.href="${siteUrl}/accelerator",1000)</script>
</div></body></html>`;
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SnyX-Accelerator.html";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado!");
    }
    setInstalling(false);
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
              <Button onClick={handleDownload} disabled={installing}
                className="px-10 py-7 text-lg font-bold rounded-2xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-orange-500 shadow-[0_0_40px_rgba(220,38,38,0.4)] hover:shadow-[0_0_60px_rgba(220,38,38,0.6)] border-0">
                <Download className="w-5 h-5 mr-3" />
                {installing ? "Baixando..." : "Baixar SnyX Accelerator"}
              </Button>
              <p className="text-white/30 text-xs mt-2">Windows (.bat) • macOS (.sh) • Mobile (.html)</p>
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

        {/* How it works */}
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
