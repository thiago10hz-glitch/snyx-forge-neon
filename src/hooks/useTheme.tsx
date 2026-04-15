import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ThemeId = "neon-red" | "cyberpunk" | "aurora" | "minimal" | "ocean" | "sunset" | "custom";

export interface ThemePreset {
  id: ThemeId;
  name: string;
  emoji: string;
  description: string;
  preview: string[]; // 4 hex colors for preview swatch
  vipOnly?: boolean;
  vars: Record<string, string>;
}

function hexToHsl(hex: string): string {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function generateCustomThemeVars(primary: string, bg: string, accent: string): Record<string, string> {
  const primaryHsl = hexToHsl(primary);
  const bgHsl = hexToHsl(bg);
  const accentHsl = hexToHsl(accent);
  
  // Parse bg lightness to determine card/muted variations
  const bgParts = bgHsl.split(" ");
  const bgH = bgParts[0];
  const bgS = parseInt(bgParts[1]);
  const bgL = parseInt(bgParts[2]);
  
  return {
    "--background": bgHsl,
    "--foreground": `${bgH} ${Math.min(bgS, 10)}% 95%`,
    "--card": `${bgH} ${Math.max(bgS - 3, 0)}% ${Math.min(bgL + 3, 15)}%`,
    "--card-foreground": `${bgH} ${Math.min(bgS, 10)}% 95%`,
    "--popover": `${bgH} ${Math.max(bgS - 3, 0)}% ${Math.min(bgL + 4, 16)}%`,
    "--popover-foreground": `${bgH} ${Math.min(bgS, 10)}% 95%`,
    "--primary": primaryHsl,
    "--primary-foreground": "0 0% 100%",
    "--secondary": `${bgH} ${Math.max(bgS - 5, 0)}% ${Math.min(bgL + 5, 18)}%`,
    "--secondary-foreground": `${bgH} ${Math.min(bgS, 10)}% 80%`,
    "--muted": `${bgH} ${Math.max(bgS - 5, 0)}% ${Math.min(bgL + 7, 20)}%`,
    "--muted-foreground": `${bgH} ${Math.min(bgS, 8)}% 48%`,
    "--accent": accentHsl,
    "--accent-foreground": "0 0% 100%",
    "--border": `${bgH} ${Math.max(bgS - 5, 0)}% ${Math.min(bgL + 10, 22)}%`,
    "--input": `${bgH} ${Math.max(bgS - 5, 0)}% ${Math.min(bgL + 10, 22)}%`,
    "--ring": primaryHsl,
    "--sidebar-background": `${bgH} ${bgS}% ${Math.max(bgL - 1, 3)}%`,
    "--sidebar-primary": primaryHsl,
    "--neon-glow": `0 0 10px hsl(${primaryHsl} / 0.3), 0 0 30px hsl(${primaryHsl} / 0.1)`,
    "--neon-glow-strong": `0 0 10px hsl(${primaryHsl} / 0.5), 0 0 40px hsl(${accentHsl} / 0.2), 0 0 80px hsl(${primaryHsl} / 0.08)`,
  };
}

export const themes: ThemePreset[] = [
  {
    id: "neon-red",
    name: "Neon Red",
    emoji: "🔴",
    description: "Padrão — vermelho neon agressivo",
    preview: ["#0a0a12", "#1a1a2a", "#ff0000", "#ff3333"],
    vars: {
      "--background": "240 15% 3%",
      "--foreground": "0 0% 95%",
      "--card": "240 12% 6%",
      "--card-foreground": "0 0% 95%",
      "--popover": "240 12% 7%",
      "--popover-foreground": "0 0% 95%",
      "--primary": "0 100% 55%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "240 10% 9%",
      "--secondary-foreground": "0 0% 82%",
      "--muted": "240 10% 11%",
      "--muted-foreground": "240 5% 50%",
      "--accent": "0 100% 55%",
      "--accent-foreground": "0 0% 100%",
      "--border": "240 10% 14%",
      "--input": "240 10% 14%",
      "--ring": "0 100% 55%",
      "--sidebar-background": "240 15% 4%",
      "--sidebar-primary": "0 100% 55%",
      "--neon-glow": "0 0 10px hsl(0 100% 55% / 0.3), 0 0 30px hsl(0 100% 55% / 0.1)",
      "--neon-glow-strong": "0 0 10px hsl(0 100% 55% / 0.5), 0 0 40px hsl(0 100% 55% / 0.2), 0 0 80px hsl(0 100% 55% / 0.08)",
    },
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    emoji: "💜",
    description: "Roxo e ciano futurista",
    preview: ["#0d0d1a", "#1a0a2e", "#a855f7", "#06b6d4"],
    vars: {
      "--background": "260 30% 4%",
      "--foreground": "270 10% 95%",
      "--card": "260 25% 7%",
      "--card-foreground": "270 10% 95%",
      "--popover": "260 25% 8%",
      "--popover-foreground": "270 10% 95%",
      "--primary": "270 90% 65%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "260 20% 10%",
      "--secondary-foreground": "270 10% 80%",
      "--muted": "260 20% 12%",
      "--muted-foreground": "260 10% 50%",
      "--accent": "185 85% 45%",
      "--accent-foreground": "0 0% 100%",
      "--border": "260 20% 15%",
      "--input": "260 20% 15%",
      "--ring": "270 90% 65%",
      "--sidebar-background": "260 30% 5%",
      "--sidebar-primary": "270 90% 65%",
      "--neon-glow": "0 0 10px hsl(270 90% 65% / 0.3), 0 0 30px hsl(185 85% 45% / 0.15)",
      "--neon-glow-strong": "0 0 10px hsl(270 90% 65% / 0.5), 0 0 40px hsl(185 85% 45% / 0.2), 0 0 80px hsl(270 90% 65% / 0.08)",
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    emoji: "🟢",
    description: "Verde boreal relaxante",
    preview: ["#0a1a12", "#0d2818", "#10b981", "#34d399"],
    vars: {
      "--background": "150 30% 4%",
      "--foreground": "150 10% 95%",
      "--card": "150 25% 6%",
      "--card-foreground": "150 10% 95%",
      "--popover": "150 25% 7%",
      "--popover-foreground": "150 10% 95%",
      "--primary": "160 85% 40%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "150 20% 9%",
      "--secondary-foreground": "150 10% 80%",
      "--muted": "150 18% 11%",
      "--muted-foreground": "150 8% 48%",
      "--accent": "160 85% 40%",
      "--accent-foreground": "0 0% 100%",
      "--border": "150 18% 14%",
      "--input": "150 18% 14%",
      "--ring": "160 85% 40%",
      "--sidebar-background": "150 30% 5%",
      "--sidebar-primary": "160 85% 40%",
      "--neon-glow": "0 0 10px hsl(160 85% 40% / 0.3), 0 0 30px hsl(160 85% 40% / 0.1)",
      "--neon-glow-strong": "0 0 10px hsl(160 85% 40% / 0.5), 0 0 40px hsl(160 85% 40% / 0.2), 0 0 80px hsl(160 85% 40% / 0.08)",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    emoji: "🔵",
    description: "Azul profundo elegante",
    preview: ["#0a0f1a", "#0c1a2e", "#3b82f6", "#60a5fa"],
    vipOnly: true,
    vars: {
      "--background": "220 35% 5%",
      "--foreground": "210 10% 95%",
      "--card": "220 30% 7%",
      "--card-foreground": "210 10% 95%",
      "--popover": "220 30% 8%",
      "--popover-foreground": "210 10% 95%",
      "--primary": "217 90% 60%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "220 25% 10%",
      "--secondary-foreground": "210 10% 80%",
      "--muted": "220 22% 12%",
      "--muted-foreground": "220 10% 48%",
      "--accent": "217 90% 60%",
      "--accent-foreground": "0 0% 100%",
      "--border": "220 22% 15%",
      "--input": "220 22% 15%",
      "--ring": "217 90% 60%",
      "--sidebar-background": "220 35% 5%",
      "--sidebar-primary": "217 90% 60%",
      "--neon-glow": "0 0 10px hsl(217 90% 60% / 0.3), 0 0 30px hsl(217 90% 60% / 0.1)",
      "--neon-glow-strong": "0 0 10px hsl(217 90% 60% / 0.5), 0 0 40px hsl(217 90% 60% / 0.2), 0 0 80px hsl(217 90% 60% / 0.08)",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    emoji: "🟠",
    description: "Laranja e magenta quente",
    preview: ["#1a0d0a", "#2e1a0c", "#f97316", "#ec4899"],
    vipOnly: true,
    vars: {
      "--background": "20 35% 4%",
      "--foreground": "30 10% 95%",
      "--card": "20 30% 6%",
      "--card-foreground": "30 10% 95%",
      "--popover": "20 30% 7%",
      "--popover-foreground": "30 10% 95%",
      "--primary": "25 95% 53%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "20 25% 9%",
      "--secondary-foreground": "30 10% 80%",
      "--muted": "20 22% 11%",
      "--muted-foreground": "20 10% 48%",
      "--accent": "330 80% 55%",
      "--accent-foreground": "0 0% 100%",
      "--border": "20 22% 14%",
      "--input": "20 22% 14%",
      "--ring": "25 95% 53%",
      "--sidebar-background": "20 35% 5%",
      "--sidebar-primary": "25 95% 53%",
      "--neon-glow": "0 0 10px hsl(25 95% 53% / 0.3), 0 0 30px hsl(330 80% 55% / 0.15)",
      "--neon-glow-strong": "0 0 10px hsl(25 95% 53% / 0.5), 0 0 40px hsl(330 80% 55% / 0.2), 0 0 80px hsl(25 95% 53% / 0.08)",
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    emoji: "⚪",
    description: "Escuro minimalista clean",
    preview: ["#111111", "#1a1a1a", "#888888", "#ffffff"],
    vars: {
      "--background": "0 0% 5%",
      "--foreground": "0 0% 92%",
      "--card": "0 0% 7%",
      "--card-foreground": "0 0% 92%",
      "--popover": "0 0% 8%",
      "--popover-foreground": "0 0% 92%",
      "--primary": "0 0% 85%",
      "--primary-foreground": "0 0% 5%",
      "--secondary": "0 0% 10%",
      "--secondary-foreground": "0 0% 75%",
      "--muted": "0 0% 12%",
      "--muted-foreground": "0 0% 45%",
      "--accent": "0 0% 85%",
      "--accent-foreground": "0 0% 5%",
      "--border": "0 0% 15%",
      "--input": "0 0% 15%",
      "--ring": "0 0% 85%",
      "--sidebar-background": "0 0% 6%",
      "--sidebar-primary": "0 0% 85%",
      "--neon-glow": "0 0 10px rgba(255,255,255,0.05), 0 0 30px rgba(255,255,255,0.02)",
      "--neon-glow-strong": "0 0 10px rgba(255,255,255,0.08), 0 0 40px rgba(255,255,255,0.03)",
    },
  },
];

export interface CustomThemeColors {
  primary: string;
  background: string;
  accent: string;
}

interface ThemeContextType {
  currentTheme: ThemeId;
  setTheme: (id: ThemeId) => void;
  getTheme: () => ThemePreset;
  customColors: CustomThemeColors;
  setCustomColors: (colors: CustomThemeColors) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function applyTheme(theme: ThemePreset) {
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

const DEFAULT_CUSTOM: CustomThemeColors = { primary: "#ff0000", background: "#0a0a12", accent: "#ff3333" };

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    return (localStorage.getItem("snyx-theme") as ThemeId) || "neon-red";
  });

  const [customColors, setCustomColorsState] = useState<CustomThemeColors>(() => {
    try {
      const saved = localStorage.getItem("snyx-custom-theme");
      return saved ? JSON.parse(saved) : DEFAULT_CUSTOM;
    } catch { return DEFAULT_CUSTOM; }
  });

  const getTheme = () => {
    if (currentTheme === "custom") {
      return {
        id: "custom" as ThemeId,
        name: "Personalizado",
        emoji: "🎨",
        description: "Sua paleta personalizada",
        preview: [customColors.background, customColors.background, customColors.primary, customColors.accent],
        vipOnly: true,
        vars: generateCustomThemeVars(customColors.primary, customColors.background, customColors.accent),
      };
    }
    return themes.find((t) => t.id === currentTheme) || themes[0];
  };

  useEffect(() => {
    const theme = getTheme();
    applyTheme(theme);
  }, [currentTheme, customColors]);

  const setTheme = (id: ThemeId) => {
    setCurrentTheme(id);
    localStorage.setItem("snyx-theme", id);
  };

  const setCustomColors = (colors: CustomThemeColors) => {
    setCustomColorsState(colors);
    localStorage.setItem("snyx-custom-theme", JSON.stringify(colors));
    if (currentTheme === "custom") {
      const vars = generateCustomThemeVars(colors.primary, colors.background, colors.accent);
      const root = document.documentElement;
      Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, getTheme, customColors, setCustomColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
