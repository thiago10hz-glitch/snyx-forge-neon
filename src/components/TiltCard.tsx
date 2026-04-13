import { useRef, useState, ReactNode, useCallback } from "react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  glareColor?: string;
  maxTilt?: number;
}

export function TiltCard({ children, className = "", glareColor = "rgba(255,255,255,0.12)", maxTilt = 12 }: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({ opacity: 0 });

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tiltX = (0.5 - y) * maxTilt;
    const tiltY = (x - 0.5) * maxTilt;

    setStyle({
      transform: `perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.02,1.02,1.02)`,
      transition: "transform 0.1s ease-out",
    });

    setGlareStyle({
      opacity: 0.7,
      background: `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${glareColor} 0%, transparent 60%)`,
      transition: "opacity 0.1s ease-out",
    });
  }, [glareColor, maxTilt]);

  const handleLeave = useCallback(() => {
    setStyle({
      transform: "perspective(600px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)",
      transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    });
    setGlareStyle({ opacity: 0, transition: "opacity 0.4s ease-out" });
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`relative overflow-hidden ${className}`}
      style={{ ...style, transformStyle: "preserve-3d" }}
    >
      {children}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] z-10"
        style={glareStyle}
      />
    </div>
  );
}
