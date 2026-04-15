import { useState } from "react";
import { createPortal } from "react-dom";
import { Palette, Lock, Check, Pipette, X } from "lucide-react";
import { themes, useTheme, ThemeId } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

interface ThemeSelectorProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
  hideButton?: boolean;
}

export function ThemeSelector({ externalOpen, onExternalClose, hideButton }: ThemeSelectorProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const { currentTheme, setTheme, customColors, setCustomColors } = useTheme();
  const { profile } = useAuth();

  const isVipOrDev = profile?.is_vip || profile?.is_dev;
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;

  const setOpen = (val: boolean) => {
    if (externalOpen !== undefined) {
      if (!val && onExternalClose) onExternalClose();
    } else {
      setInternalOpen(val);
    }
  };

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

  const handleClose = () => {
    setOpen(false);
    setShowCustom(false);
  };

  return (
    <>
      {!hideButton && (
        <button
          onClick={() => setOpen(true)}
          className="nav-link group"
          title="Temas"
        >
          <Palette className="w-4 h-4 group-hover:text-primary transition-colors duration-300" />
          <span className="hidden md:inline">Tema</span>
        </button>
      )}

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

          {/* Panel */}
          <div className="relative w-full sm:max-w-md max-h-[85dvh] sm:max-h-[80vh] bg-background border border-border/15 rounded-t-3xl sm:rounded-2xl overflow-hidden animate-reveal flex flex-col shadow-2xl">
            {/* Handle bar (mobile) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 sm:py-4 border-b border-border/10">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {showCustom ? "Tema Personalizado" : "Escolher Tema"}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/15 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {!showCustom ? (
                <>
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
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-200
                          ${active ? "bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5" : "hover:bg-muted/20 border border-transparent"}
                          ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"}
                        `}
                      >
                        <div className="flex gap-1 shrink-0">
                          {theme.preview.map((color, i) => (
                            <div
                              key={i}
                              className="w-5 h-5 sm:w-4 sm:h-4 rounded-full border border-white/10"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm sm:text-xs font-semibold text-foreground">{theme.emoji} {theme.name}</span>
                            {theme.vipOnly && (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                VIP
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] sm:text-[10px] text-muted-foreground/50 truncate">{theme.description}</p>
                        </div>
                        {active && <Check className="w-5 h-5 sm:w-4 sm:h-4 text-primary shrink-0" />}
                        {locked && <Lock className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-muted-foreground/30 shrink-0" />}
                      </button>
                    );
                  })}

                  {/* Custom theme option */}
                  <button
                    onClick={() => { if (isVipOrDev) handleOpenCustom(); }}
                    disabled={!isVipOrDev}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-200
                      ${currentTheme === "custom" ? "bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5" : "hover:bg-muted/20 border border-transparent"}
                      ${!isVipOrDev ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"}
                    `}
                  >
                    <div className="flex gap-1 shrink-0">
                      <div className="w-5 h-5 sm:w-4 sm:h-4 rounded-full border border-white/10" style={{ backgroundColor: customColors.background }} />
                      <div className="w-5 h-5 sm:w-4 sm:h-4 rounded-full border border-white/10" style={{ backgroundColor: customColors.background }} />
                      <div className="w-5 h-5 sm:w-4 sm:h-4 rounded-full border border-white/10" style={{ backgroundColor: customColors.primary }} />
                      <div className="w-5 h-5 sm:w-4 sm:h-4 rounded-full border border-white/10" style={{ backgroundColor: customColors.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm sm:text-xs font-semibold text-foreground">🎨 Personalizado</span>
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          VIP
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-[10px] text-muted-foreground/50 truncate">Crie sua própria paleta de cores</p>
                    </div>
                    {currentTheme === "custom" && <Check className="w-5 h-5 sm:w-4 sm:h-4 text-primary shrink-0" />}
                    {!isVipOrDev && <Lock className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-muted-foreground/30 shrink-0" />}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground/60 text-center">Monte sua paleta personalizada</p>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground/50 mb-1.5 block">Cor Principal</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={tempPrimary} onChange={(e) => setTempPrimary(e.target.value)} className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl border border-border/20 cursor-pointer bg-transparent" />
                        <input type="text" value={tempPrimary} onChange={(e) => setTempPrimary(e.target.value)} className="flex-1 glass-input border rounded-xl px-3 py-2.5 text-sm sm:text-xs text-foreground font-mono" maxLength={7} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground/50 mb-1.5 block">Fundo</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={tempBg} onChange={(e) => setTempBg(e.target.value)} className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl border border-border/20 cursor-pointer bg-transparent" />
                        <input type="text" value={tempBg} onChange={(e) => setTempBg(e.target.value)} className="flex-1 glass-input border rounded-xl px-3 py-2.5 text-sm sm:text-xs text-foreground font-mono" maxLength={7} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground/50 mb-1.5 block">Cor de Destaque</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={tempAccent} onChange={(e) => setTempAccent(e.target.value)} className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl border border-border/20 cursor-pointer bg-transparent" />
                        <input type="text" value={tempAccent} onChange={(e) => setTempAccent(e.target.value)} className="flex-1 glass-input border rounded-xl px-3 py-2.5 text-sm sm:text-xs text-foreground font-mono" maxLength={7} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl p-4 border border-border/20" style={{ backgroundColor: tempBg }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tempPrimary }} />
                      <span className="text-sm sm:text-xs font-bold" style={{ color: tempPrimary }}>Preview do Tema</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 flex-1 rounded-xl" style={{ backgroundColor: tempPrimary, opacity: 0.2 }} />
                      <div className="h-8 w-16 rounded-xl flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: tempPrimary }}>Botão</div>
                      <div className="h-8 w-10 rounded-xl" style={{ backgroundColor: tempAccent, opacity: 0.3 }} />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowCustom(false)} className="flex-1 py-3 rounded-2xl text-sm sm:text-xs font-medium text-muted-foreground/60 bg-muted/20 hover:bg-muted/30 transition-all active:scale-[0.98]">
                      Voltar
                    </button>
                    <button onClick={handleApplyCustom} className="flex-1 py-3 rounded-2xl text-sm sm:text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]">
                      <Pipette size={14} />
                      Aplicar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="safe-bottom" />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
