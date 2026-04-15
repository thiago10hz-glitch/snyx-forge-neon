import React, { useState, useEffect } from "react";
import { Zap, Download, Wifi, Shield, Gauge, Rocket, CheckCircle2, ArrowLeft, Lock, MessageSquare, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios" | "desktop-chromium" | "desktop-other";

const detectPlatform = (): Platform => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Chrome|Chromium|Edg|Brave|OPR/.test(ua)) return "desktop-chromium";
  return "desktop-other";
};

const Accelerator = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const platform = detectPlatform();

  const isDev = profile?.is_dev === true;
  const isVip = profile?.is_vip === true;
  const hasAccess = isDev || isVip;

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSpeed(prev => {
        if (prev >= 847) return 847;
        return prev + Math.floor(Math.random() * 30) + 10;
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleInstall = async () => {
    setInstalling(true);

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        setInstalling(false);
        return;
      }
      setDeferredPrompt(null);
    }

    // Fallback: download a launcher file
    const siteUrl = window.location.origin;
    const isWindows = navigator.userAgent.includes("Windows");
    const isMac = navigator.userAgent.includes("Mac");

    if (isWindows) {
      const bat = `@echo off
title SnyX Accelerator - Instalador
echo ============================================
echo    SnyX Accelerator - Instalando...
echo ============================================
echo.
echo Abrindo SnyX Accelerator no navegador...
echo Quando abrir, clique em "Instalar" na barra do navegador.
echo.
start "" "chrome" "--app=${siteUrl}/accelerator"
if errorlevel 1 (
  start "" "msedge" "--app=${siteUrl}/accelerator"
  if errorlevel 1 (
    start "" "${siteUrl}/accelerator"
  )
)
echo.
echo Instalacao iniciada! Pode fechar esta janela.
timeout /t 5
`;
      const blob = new Blob([bat], { type: "application/bat" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SnyX-Accelerator-Setup.bat";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado! Execute o arquivo para instalar.");
    } else if (isMac) {
      const sh = `#!/bin/bash
echo "============================================"
echo "   SnyX Accelerator - Instalando..."
echo "============================================"
echo ""
open -a "Google Chrome" --args --app="${siteUrl}/accelerator" 2>/dev/null || open "${siteUrl}/accelerator"
echo "Instalacao iniciada!"
`;
      const blob = new Blob([sh], { type: "application/x-sh" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SnyX-Accelerator-Setup.sh";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado! Execute o arquivo para instalar.");
    } else {
      // Mobile or other - show instructions
      setShowInstructions(true);
    }

    setInstalling(false);
  };

  const handleRequestActivation = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setSendingRequest(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        subject: "🚀 Solicitar Ativação — SnyX Accelerator (Plano DEV)",
        status: "open",
      });
      if (error) throw error;

      await supabase.from("support_messages").insert({
        ticket_id: (await supabase.from("support_tickets").select("id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single()).data?.id || "",
        sender_id: user.id,
        content: `Olá! Gostaria de ativar o SnyX Accelerator. Meu plano atual: ${isDev ? "DEV" : isVip ? "VIP" : "Free"}. Por favor, ativar o acesso ao Accelerator.`,
        sender_role: "user",
      });

      setRequestSent(true);
      toast.success("Solicitação enviada! O admin vai analisar e ativar seu acesso.");
    } catch (err) {
      toast.error("Erro ao enviar solicitação. Tente novamente.");
    } finally {
      setSendingRequest(false);
    }
  };

  const features = [
    { icon: Zap, title: "Cache Neural", desc: "Todo o site fica salvo no seu dispositivo. Carrega instantaneamente, sem esperar download." },
    { icon: Wifi, title: "Rede Dedicada", desc: "Conexão otimizada exclusiva com os servidores SnyX. Menos latência, mais velocidade." },
    { icon: Shield, title: "Compressão Militar", desc: "Dados comprimidos em até 90%. Usa menos internet e carrega mais rápido." },
    { icon: Gauge, title: "Prefetch Inteligente", desc: "Páginas carregam ANTES de você clicar. A IA prevê o que você vai acessar." },
    { icon: Rocket, title: "Modo Offline", desc: "Funciona mesmo sem internet. Acesse chats, código e configurações offline." },
    { icon: CheckCircle2, title: "Zero Ads/Trackers", desc: "Sem anúncios ou rastreadores de terceiros consumindo sua banda." },
  ];

  return (
    <div className="min-h-screen bg-[#07070f] text-white overflow-hidden relative">
      {/* Animated background grid */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(220,38,38,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.3) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          animation: "pulse 4s ease-in-out infinite"
        }} />
      </div>

      {/* Glow effects */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-600/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[300px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Back button */}
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-white/50 hover:text-white transition mb-8">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-sm mb-6">
            <Zap className="w-4 h-4" />
            Exclusivo — Plano DEV / VIP
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight">
            SnyX{" "}
            <span className="bg-gradient-to-r from-red-500 via-red-400 to-orange-500 bg-clip-text text-transparent">
              Accelerator
            </span>
          </h1>

          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
            Instale o acelerador de rede exclusivo e transforme sua conexão com o SnyX.
            Disponível para assinantes <strong className="text-red-400">DEV</strong> e <strong className="text-yellow-400">VIP</strong>.
          </p>

          {/* Speed meter */}
          <div className="flex items-center justify-center gap-4 mb-10">
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                <circle
                  cx="100" cy="100" r="85"
                  fill="none"
                  stroke="url(#speedGradient)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(speed / 1000) * 534} 534`}
                  className="transition-all duration-100"
                />
                <defs>
                  <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#dc2626" />
                    <stop offset="100%" stopColor="#f97316" />
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

          {/* Action area - based on access */}
          {!user ? (
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm mb-4">
                <Lock className="w-4 h-4" />
                Faça login para acessar o Accelerator
              </div>
              <br />
              <Button
                onClick={() => navigate("/auth")}
                className="px-10 py-7 text-lg font-bold rounded-2xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-orange-500 shadow-[0_0_40px_rgba(220,38,38,0.4)] transition-all duration-300 border-0"
              >
                Fazer Login / Criar Conta
              </Button>
            </div>
          ) : !hasAccess ? (
            <div className="space-y-6">
              {/* Locked state - no DEV/VIP */}
              <div className="max-w-lg mx-auto p-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5">
                <Lock className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Acesso Exclusivo</h3>
                <p className="text-white/50 text-sm mb-6">
                  O SnyX Accelerator faz parte do <strong className="text-red-400">Plano DEV</strong>. 
                  Solicite ativação ao admin ou adquira o plano para desbloquear.
                </p>

                {requestSent ? (
                  <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 font-semibold">
                    <CheckCircle2 className="w-5 h-5" />
                    Solicitação enviada! Aguarde aprovação do admin.
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      onClick={handleRequestActivation}
                      disabled={sendingRequest}
                      className="px-6 py-6 text-base font-bold rounded-xl bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-orange-500 border-0"
                    >
                      <MessageSquare className="w-5 h-5 mr-2" />
                      {sendingRequest ? "Enviando..." : "Solicitar Ativação ao Admin"}
                    </Button>
                    <Button
                      onClick={() => navigate("/")}
                      variant="outline"
                      className="px-6 py-6 text-base rounded-xl border-white/10 text-white/60 hover:text-white hover:bg-white/5"
                    >
                      <Crown className="w-5 h-5 mr-2" />
                      Ver Plano DEV
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : isInstalled ? (
            <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-green-500/20 border border-green-500/30 text-green-400 font-bold text-lg">
              <CheckCircle2 className="w-6 h-6" />
              Accelerator Ativo — Velocidade Máxima!
            </div>
          ) : (
            <>
              {/* Has access - show download */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm mb-6">
                <CheckCircle2 className="w-4 h-4" />
                Plano {isDev ? "DEV" : "VIP"} ativo — Acesso liberado!
              </div>
              <br />
              <Button
                onClick={handleInstall}
                disabled={installing}
                className="px-10 py-7 text-lg font-bold rounded-2xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-orange-500 shadow-[0_0_40px_rgba(220,38,38,0.4)] hover:shadow-[0_0_60px_rgba(220,38,38,0.6)] transition-all duration-300 border-0"
              >
                <Download className="w-5 h-5 mr-3" />
                {installing ? "Instalando..." : "Baixar e Instalar SnyX Accelerator"}
              </Button>

              {showInstructions && !deferredPrompt && (
                <div className="mt-6 max-w-lg mx-auto p-6 rounded-2xl border border-white/10 bg-white/[0.03] text-left">
                  <h3 className="font-bold text-lg mb-4 text-center">📲 Como instalar</h3>

                  {platform === "ios" ? (
                    <div className="space-y-3 text-white/70 text-sm">
                      <p className="font-semibold text-white">iPhone / iPad (Safari):</p>
                      <p>1. Toque no botão <strong className="text-white">Compartilhar</strong> (ícone ↑ na barra inferior)</p>
                      <p>2. Role para baixo e toque em <strong className="text-white">"Adicionar à Tela de Início"</strong></p>
                      <p>3. Toque em <strong className="text-white">"Adicionar"</strong></p>
                      <p className="text-xs text-white/40 mt-2">⚠️ Deve ser no Safari. Chrome/Firefox no iOS não suportam instalação.</p>
                    </div>
                  ) : platform === "android" ? (
                    <div className="space-y-3 text-white/70 text-sm">
                      <p className="font-semibold text-white">Android (Chrome):</p>
                      <p>1. Toque no menu <strong className="text-white">⋮</strong> (3 pontinhos no canto superior)</p>
                      <p>2. Toque em <strong className="text-white">"Adicionar à tela inicial"</strong></p>
                      <p>3. Confirme tocando em <strong className="text-white">"Adicionar"</strong></p>
                    </div>
                  ) : (
                    <div className="space-y-3 text-white/70 text-sm">
                      <p className="font-semibold text-white">PC / Notebook:</p>
                      <p>1. No <strong className="text-white">Chrome/Edge/Brave</strong>: clique no ícone de instalação <strong className="text-white">⊕</strong> na barra de endereço</p>
                      <p>2. Ou vá no menu <strong className="text-white">⋮ → "Instalar SnyX Accelerator"</strong></p>
                      <p className="text-xs text-white/40 mt-2">⚠️ Firefox/Safari no PC não suportam instalação. Use Chrome, Edge ou Brave.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {features.map((f, i) => (
            <div
              key={i}
              className="group p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-red-500/20 transition-all duration-300"
            >
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
              { step: "1", text: "Adquira o Plano DEV" },
              { step: "2", text: "Baixe e instale o Accelerator" },
              { step: "3", text: "Navegue em velocidade máxima" },
            ].map((s, i) => (
              <React.Fragment key={i}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center font-bold text-red-400">
                    {s.step}
                  </div>
                  <span className="text-white/70">{s.text}</span>
                </div>
                {i < 2 && <div className="hidden md:block w-12 h-px bg-white/10" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-white/20 text-xs pb-8">
          SnyX Accelerator v1.0 — Tecnologia exclusiva SnyX Networks
        </div>
      </div>
    </div>
  );
};

export default Accelerator;
