import React, { useState, useEffect } from "react";
import { Zap, Download, Wifi, Shield, Gauge, Rocket, CheckCircle2, ArrowLeft, Smartphone, Monitor, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  const platform = detectPlatform();

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
    if (deferredPrompt) {
      setInstalling(true);
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      setInstalling(false);
    } else {
      setShowInstructions(true);
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
            Tecnologia Exclusiva SnyX
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight">
            SnyX{" "}
            <span className="bg-gradient-to-r from-red-500 via-red-400 to-orange-500 bg-clip-text text-transparent">
              Accelerator
            </span>
          </h1>

          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
            Instale o acelerador de rede exclusivo e transforme sua conexão com o SnyX.
            Velocidade que nenhum outro site oferece.
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

          {/* Install button */}
          {isInstalled ? (
            <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-green-500/20 border border-green-500/30 text-green-400 font-bold text-lg">
              <CheckCircle2 className="w-6 h-6" />
              Accelerator Ativo — Velocidade Máxima!
            </div>
          ) : (
            <Button
              onClick={handleInstall}
              disabled={!deferredPrompt || installing}
              className="px-10 py-7 text-lg font-bold rounded-2xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-orange-500 shadow-[0_0_40px_rgba(220,38,38,0.4)] hover:shadow-[0_0_60px_rgba(220,38,38,0.6)] transition-all duration-300 border-0"
            >
              <Download className="w-5 h-5 mr-3" />
              {installing ? "Instalando..." : deferredPrompt ? "Instalar SnyX Accelerator" : "Instalar via Navegador"}
            </Button>
          )}

          {!deferredPrompt && !isInstalled && (
            <p className="text-white/30 text-sm mt-4 max-w-md mx-auto">
              No celular: toque em <strong>Compartilhar → Adicionar à Tela Inicial</strong>.
              No PC: clique no ícone de instalação na barra de endereço do navegador.
            </p>
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
              { step: "1", text: "Clique em Instalar" },
              { step: "2", text: "O app salva tudo localmente" },
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
