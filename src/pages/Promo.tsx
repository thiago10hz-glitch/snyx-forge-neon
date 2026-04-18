import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Volume2, VolumeX, RotateCcw } from "lucide-react";

interface Scene {
  id: number;
  duration: number; // ms
  narration: string;
  title: string;
  subtitle?: string;
  accent?: string;
}

const SCENES: Scene[] = [
  {
    id: 0,
    duration: 4000,
    narration: "SnyX. Inteligência sem limites.",
    title: "SnyX",
    subtitle: "Inteligência sem limites",
  },
  {
    id: 1,
    duration: 4500,
    narration: "Programador IA com nove modelos trabalhando para você.",
    title: "Programador IA",
    subtitle: "9 modelos. 1 plataforma.",
    accent: "DEV",
  },
  {
    id: 2,
    duration: 4000,
    narration: "Chat ilimitado. Conversas que nunca param.",
    title: "Chat Ilimitado",
    subtitle: "Sem cotas. Sem espera.",
    accent: "∞",
  },
  {
    id: 3,
    duration: 4000,
    narration: "RPG imersivo com personagens vivos.",
    title: "RPG Imersivo",
    subtitle: "Mundos próprios. Histórias suas.",
    accent: "RPG",
  },
  {
    id: 4,
    duration: 4000,
    narration: "Música, IPTV e muito mais. Tudo nosso.",
    title: "Música • IPTV",
    subtitle: "Infraestrutura própria",
    accent: "★",
  },
  {
    id: 5,
    duration: 4500,
    narration: "SnyX. Bem-vindo ao futuro.",
    title: "Bem-vindo ao futuro",
    subtitle: "snyx.ai",
  },
];

const TOTAL_DURATION = SCENES.reduce((acc, s) => acc + s.duration, 0);

export default function Promo() {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentScene, setCurrentScene] = useState(-1);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number>();
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ptVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Pick best PT-BR voice
  useEffect(() => {
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const pt =
        voices.find((v) => v.lang === "pt-BR" && /female|google|luciana|maria/i.test(v.name)) ||
        voices.find((v) => v.lang === "pt-BR") ||
        voices.find((v) => v.lang.startsWith("pt"));
      if (pt) ptVoiceRef.current = pt;
    };
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = (text: string) => {
    if (muted) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = 0.95;
    u.pitch = 1.05;
    u.volume = 1;
    if (ptVoiceRef.current) u.voice = ptVoiceRef.current;
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
  };

  const tick = () => {
    const elapsed = performance.now() - startTimeRef.current;
    const pct = Math.min(elapsed / TOTAL_DURATION, 1);
    setProgress(pct);

    let acc = 0;
    let sceneIdx = 0;
    for (let i = 0; i < SCENES.length; i++) {
      if (elapsed >= acc && elapsed < acc + SCENES[i].duration) {
        sceneIdx = i;
        break;
      }
      acc += SCENES[i].duration;
      sceneIdx = i;
    }

    setCurrentScene((prev) => {
      if (prev !== sceneIdx) {
        speak(SCENES[sceneIdx].narration);
        return sceneIdx;
      }
      return prev;
    });

    if (elapsed < TOTAL_DURATION) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setPlaying(false);
    }
  };

  const start = () => {
    window.speechSynthesis.cancel();
    setPlaying(true);
    setCurrentScene(-1);
    setProgress(0);
    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    window.speechSynthesis.cancel();
    setPlaying(false);
    setCurrentScene(-1);
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.speechSynthesis.cancel();
    };
  }, []);

  const scene = currentScene >= 0 ? SCENES[currentScene] : null;
  const sceneElapsed = (() => {
    if (currentScene < 0) return 0;
    const elapsed = performance.now() - startTimeRef.current;
    let acc = 0;
    for (let i = 0; i < currentScene; i++) acc += SCENES[i].duration;
    return Math.max(0, elapsed - acc);
  })();
  const sceneProgress = scene ? Math.min(sceneElapsed / scene.duration, 1) : 0;

  return (
    <div className="min-h-screen bg-black text-foreground overflow-hidden relative">
      {/* Cinematic black bars */}
      {playing && (
        <>
          <div className="fixed top-0 left-0 right-0 h-[8vh] bg-black z-50 pointer-events-none" />
          <div className="fixed bottom-0 left-0 right-0 h-[8vh] bg-black z-50 pointer-events-none" />
        </>
      )}

      {/* Aurora background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute w-[140vw] h-[140vw] -top-[20vw] -left-[20vw] rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
            transform: `translate(${Math.sin(progress * Math.PI * 2) * 40}px, ${Math.cos(progress * Math.PI * 2) * 40}px)`,
            transition: "transform 1s ease-out",
          }}
        />
        <div
          className="absolute w-[100vw] h-[100vw] -bottom-[30vw] -right-[20vw] rounded-full opacity-15 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(0 100% 50%) 0%, transparent 70%)",
            transform: `translate(${Math.cos(progress * Math.PI * 3) * 60}px, ${Math.sin(progress * Math.PI * 3) * 60}px)`,
            transition: "transform 1s ease-out",
          }}
        />
      </div>

      {/* Grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Main stage */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {!playing && currentScene === -1 && (
          <div className="text-center space-y-8 animate-fade-in">
            <div className="space-y-3">
              <p className="text-xs tracking-[0.4em] text-muted-foreground uppercase">
                SnyX presents
              </p>
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter">
                A nova era da IA
              </h1>
              <p className="text-lg text-muted-foreground max-w-md mx-auto">
                Um filme curto sobre o que construímos para você.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={start}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-14 text-base font-semibold gap-2"
              >
                <Play className="w-5 h-5 fill-current" />
                Reproduzir filme (30s)
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setMuted((m) => !m)}
                className="h-14 gap-2"
              >
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                {muted ? "Som desligado" : "Som ligado"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground/60">
              Use fones para a melhor experiência cinemática
            </p>
          </div>
        )}

        {scene && (
          <div key={scene.id} className="text-center max-w-5xl px-4">
            {scene.accent && (
              <div
                className="text-[20vw] md:text-[14vw] font-black leading-none text-primary/10 absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                style={{
                  transform: `scale(${1 + sceneProgress * 0.15}) translateY(${(1 - sceneProgress) * 30}px)`,
                  opacity: 0.08 + sceneProgress * 0.04,
                }}
              >
                {scene.accent}
              </div>
            )}

            <div className="relative">
              <p
                className="text-xs md:text-sm tracking-[0.5em] uppercase text-primary mb-6"
                style={{
                  opacity: Math.min(sceneProgress * 4, 1),
                  transform: `translateY(${(1 - Math.min(sceneProgress * 4, 1)) * 20}px)`,
                }}
              >
                {String(scene.id + 1).padStart(2, "0")} / {String(SCENES.length).padStart(2, "0")}
              </p>

              <h2
                className="text-5xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.9]"
                style={{
                  opacity: Math.min(sceneProgress * 3, 1),
                  transform: `translateY(${(1 - Math.min(sceneProgress * 3, 1)) * 60}px) scale(${0.95 + Math.min(sceneProgress * 3, 1) * 0.05})`,
                  filter: `blur(${(1 - Math.min(sceneProgress * 3, 1)) * 12}px)`,
                  background:
                    "linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(var(--primary)) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {scene.title}
              </h2>

              {scene.subtitle && (
                <p
                  className="text-lg md:text-2xl text-muted-foreground mt-6 font-light tracking-wide"
                  style={{
                    opacity: Math.min(Math.max(sceneProgress - 0.2, 0) * 3, 1),
                    transform: `translateY(${(1 - Math.min(Math.max(sceneProgress - 0.2, 0) * 3, 1)) * 30}px)`,
                  }}
                >
                  {scene.subtitle}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls + progress */}
      {playing && (
        <div className="fixed bottom-[10vh] left-0 right-0 z-50 px-6 pointer-events-none">
          <div className="max-w-4xl mx-auto space-y-3 pointer-events-auto">
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMuted((m) => !m)}
                className="text-foreground/70 hover:text-foreground"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={stop}
                className="text-foreground/70 hover:text-foreground"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
            <div className="h-[2px] bg-foreground/10 overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${progress * 100}%`, transition: "width 0.1s linear" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Replay after end */}
      {!playing && currentScene >= 0 && (
        <div className="fixed bottom-10 left-0 right-0 z-50 flex justify-center">
          <Button onClick={start} size="lg" className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Assistir novamente
          </Button>
        </div>
      )}
    </div>
  );
}
