import { useEffect, useRef } from "react";

/**
 * Fundo global vermelho com partículas brilhantes.
 * - Gradiente radial preto -> vermelho profundo (cor primary do tema)
 * - Pontinhos animados em canvas (leve, ~60 partículas)
 * Inspiração: Skynet vibe, mas usando o token --primary (não clone).
 */
export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type P = { x: number; y: number; r: number; a: number; vx: number; vy: number; phase: number };
    let particles: P[] = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(70, Math.floor((w * h) / 28000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.6 + 0.4,
        a: Math.random() * 0.5 + 0.2,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    // Read --primary from theme to keep it on-brand
    const root = getComputedStyle(document.documentElement);
    const primary = root.getPropertyValue("--primary").trim() || "0 100% 50%";

    let t = 0;
    const draw = () => {
      t += 0.01;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        const flicker = (Math.sin(t * 2 + p.phase) + 1) / 2; // 0..1
        const alpha = (p.a * (0.4 + flicker * 0.6)).toFixed(3);
        ctx.fillStyle = `hsla(${primary} / ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
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
      {/* Base: preto puro embaixo, vermelho do tema em cima */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at top, hsl(var(--primary) / 0.55) 0%, hsl(var(--primary) / 0.22) 25%, hsl(var(--background)) 70%, hsl(var(--background)) 100%)",
        }}
      />
      {/* Vinhetas vermelhas suaves */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[80vw] h-[60vh] rounded-full blur-[140px] opacity-50"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.5), transparent 70%)" }}
      />
      {/* Grid sutil */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      {/* Partículas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
