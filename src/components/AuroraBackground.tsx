import { useEffect, useRef } from "react";

/**
 * Fundo bonito da tela inicial:
 * - Gradiente radial vermelho profundo no topo, descendo pra preto suave
 * - Vinhetas (glows) animadas nas laterais
 * - Part\u00edculas brilhantes com halo (glow real) animadas
 * Usa o token --primary do tema, n\u00e3o cor fixa.
 */
export function AuroraBackground({ intensity = "full" }: { intensity?: "full" | "subtle" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isSubtle = intensity === "subtle";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type P = { x: number; y: number; r: number; a: number; vx: number; vy: number; phase: number; speed: number };
    let particles: P[] = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(60, Math.floor((w * h) / 32000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        a: Math.random() * 0.35 + 0.12,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.0,
      }));
    };

    const root = getComputedStyle(document.documentElement);
    const primary = root.getPropertyValue("--primary").trim() || "0 100% 50%";

    let t = 0;
    const draw = () => {
      t += 0.01;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        const flicker = (Math.sin(t * p.speed + p.phase) + 1) / 2; // 0..1
        const alpha = p.a * (0.3 + flicker * 0.7);
        // halo
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        grad.addColorStop(0, `hsla(${primary} / ${alpha.toFixed(3)})`);
        grad.addColorStop(1, `hsla(${primary} / 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
        ctx.fill();
        // n\u00facleo
        ctx.fillStyle = `hsla(${primary} / ${Math.min(1, alpha * 1.6).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Base preto */}
      <div className="absolute inset-0 bg-background" />

      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: isSubtle ? 0.35 : 1 }}
      >
        {/* Vermelho forte cobrindo toda a lateral esquerda */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, hsl(var(--primary) / 0.55) 0%, hsl(var(--primary) / 0.28) 25%, hsl(var(--primary) / 0.08) 50%, transparent 70%)",
          }}
        />
        {/* Brilho concentrado no topo esquerdo */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 70% at 0% 20%, hsl(var(--primary) / 0.65), transparent 60%)",
          }}
        />
        {/* Glow grande pulsante no lado esquerdo */}
        <div
          className="absolute -left-[10%] top-[15%] w-[55vw] h-[70vh] rounded-full blur-[160px] opacity-70 animate-[pulse_12s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.45), transparent 70%)" }}
        />
        <div
          className="absolute -left-[15%] bottom-[5%] w-[45vw] h-[50vh] rounded-full blur-[160px] opacity-50 animate-[pulse_14s_ease-in-out_infinite_3s]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.3), transparent 70%)" }}
        />

        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse at center, black 25%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 25%, transparent 75%)",
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 50%, hsl(var(--background) / 0.5) 100%)",
          }}
        />

        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        <div
          className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>
    </div>
  );
}
