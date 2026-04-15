import { useState } from "react";
import { Palette, Lock, Check, Pipette } from "lucide-react";
import { themes, useTheme, ThemeId } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

export function ThemeSelector() {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const { currentTheme, setTheme, customColors, setCustomColors } = useTheme();
  const { profile } = useAuth();

  const isVipOrDev = profile?.is_vip || profile?.is_dev;

  const canUse = (themeId: ThemeId) => {
    const t = themes.find((x) => x.id === themeId);
    if (themeId === "custom") return isVipOrDev;
    if (!t?.vipOnly) return true;
    return isVipOrDev;
  };

  const [tempPrimary, setTempPrimary] = useState(customColors.primary);
  const [tempBg, setTempBg] = useState(customColors.background);
  const [tempAccent, setTempAccent] = useState(customColors.accent);

  const handleOpenCustom = () => {
    setTempPrimary(customColors.primary);
    setTempBg(customColors.background);
    setTempAccent(customColors.accent);
    setShowCustom(true);
  };

  const handleApplyCustom = () => {
    setCustomColors({ primary: tempPrimary, background: tempBg, accent: tempAccent });
    setTheme("custom");
    setShowCustom(false);
    setOpen(false);
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
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setShowCustom(false); }} />
          <div className="absolute top-full right-0 mt-2 z-50 glass-elevated rounded-2xl border border-border/10 p-3 min-w-[280px] animate-reveal max-h-[420px] overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-3 px-1">
              Escolher Tema
            </p>

            {!showCustom ? (
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

                {/* Custom theme option */}
                <button
                  onClick={() => {
                    if (isVipOrDev) handleOpenCustom();
                  }}
                  disabled={!isVipOrDev}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200
                    ${currentTheme === "custom" ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/20 border border-transparent"}
                    ${!isVipOrDev ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  <div className="flex gap-0.5 shrink-0">
                    <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: customColors.background }} />
                    <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: customColors.background }} />
                    <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: customColors.primary }} />
                    <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: customColors.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">🎨 Personalizado</span>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                        VIP
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 truncate">Crie sua própria paleta de cores</p>
                  </div>
                  {currentTheme === "custom" && <Check className="w-4 h-4 text-primary shrink-0" />}
                  {!isVipOrDev && <Lock className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground/60 text-center">Monte sua paleta personalizada</p>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground/50 mb-1 block">Cor Principal</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={tempPrimary}
                        onChange={(e) => setTempPrimary(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border/20 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={tempPrimary}
                        onChange={(e) => setTempPrimary(e.target.value)}
                        className="flex-1 glass-input border rounded-lg px-3 py-2 text-xs text-foreground font-mono"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground/50 mb-1 block">Fundo</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={tempBg}
                        onChange={(e) => setTempBg(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border/20 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={tempBg}
                        onChange={(e) => setTempBg(e.target.value)}
                        className="flex-1 glass-input border rounded-lg px-3 py-2 text-xs text-foreground font-mono"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground/50 mb-1 block">Cor de Destaque</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={tempAccent}
                        onChange={(e) => setTempAccent(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border/20 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={tempAccent}
                        onChange={(e) => setTempAccent(e.target.value)}
                        className="flex-1 glass-input border rounded-lg px-3 py-2 text-xs text-foreground font-mono"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-xl p-3 border border-border/20" style={{ backgroundColor: tempBg }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tempPrimary }} />
                    <span className="text-xs font-bold" style={{ color: tempPrimary }}>Preview do Tema</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-6 flex-1 rounded-lg" style={{ backgroundColor: tempPrimary, opacity: 0.2 }} />
                    <div className="h-6 w-12 rounded-lg flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: tempPrimary }}>
                      Botão
                    </div>
                    <div className="h-6 w-8 rounded-lg" style={{ backgroundColor: tempAccent, opacity: 0.3 }} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCustom(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-medium text-muted-foreground/60 bg-muted/20 hover:bg-muted/30 transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleApplyCustom}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Pipette size={12} />
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
