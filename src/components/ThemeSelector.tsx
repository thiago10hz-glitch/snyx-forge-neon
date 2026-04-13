import { useState } from "react";
import { Palette, Lock, Check } from "lucide-react";
import { themes, useTheme, ThemeId } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

export function ThemeSelector() {
  const [open, setOpen] = useState(false);
  const { currentTheme, setTheme } = useTheme();
  const { profile } = useAuth();

  const isVipOrDev = profile?.is_vip || profile?.is_dev;

  const canUse = (themeId: ThemeId) => {
    const t = themes.find((x) => x.id === themeId);
    if (!t?.vipOnly) return true;
    return isVipOrDev;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="nav-link group"
        title="Temas"
      >
        <Palette className="w-4 h-4 group-hover:text-primary transition-colors duration-300" />
        <span className="hidden md:inline">Tema</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-2 z-50 glass-elevated rounded-2xl border border-border/10 p-3 min-w-[260px] animate-reveal">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-3 px-1">
              Escolher Tema
            </p>
            <div className="space-y-1.5">
              {themes.map((theme) => {
                const locked = !canUse(theme.id);
                const active = currentTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      if (!locked) {
                        setTheme(theme.id);
                        setOpen(false);
                      }
                    }}
                    disabled={locked}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200
                      ${active ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/20 border border-transparent"}
                      ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                    `}
                  >
                    {/* Color swatch */}
                    <div className="flex gap-0.5 shrink-0">
                      {theme.preview.map((color, i) => (
                        <div
                          key={i}
                          className="w-4 h-4 rounded-full border border-white/10"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">{theme.emoji} {theme.name}</span>
                        {theme.vipOnly && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            VIP
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/50 truncate">{theme.description}</p>
                    </div>

                    {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                    {locked && <Lock className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
