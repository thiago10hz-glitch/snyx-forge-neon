import { useState, useEffect, useRef } from "react";
import { X, Palette, Bot, Save, Loader2, Camera, Sparkles, Type, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ChatSettingsProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface ChatCustomization {
  theme_color: string;
  bg_color: string;
  ai_name: string;
  ai_avatar_url: string | null;
  ai_personality: string | null;
  system_prompt: string | null;
  bubble_style: string;
}

const THEME_COLORS = [
  "#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#f97316", "#a855f7", "#14b8a6",
];

const BG_COLORS = [
  "#0a0a0a", "#0f172a", "#1a1a2e", "#0d1117", "#1e1b2e",
  "#0a192f", "#16213e", "#1a0a2e", "#0d0d0d", "#111827",
];

const PERSONALITIES = [
  { label: "Padrão", value: "", emoji: "🤖" },
  { label: "Carinhosa", value: "Seja extremamente carinhosa, amorosa e atenciosa. Use emojis de coração e demonstre afeto.", emoji: "💕" },
  { label: "Engraçada", value: "Seja muito engraçada e bem-humorada. Faça piadas, use memes e trocadilhos.", emoji: "😂" },
  { label: "Séria", value: "Seja profissional, direta e séria. Vá direto ao ponto sem firulas.", emoji: "🧐" },
  { label: "Motivadora", value: "Seja extremamente motivadora e inspiradora. Encoraje e eleve o ânimo sempre.", emoji: "🔥" },
  { label: "Sarcástica", value: "Seja sarcástica e irônica de forma leve e divertida.", emoji: "😏" },
];

const BUBBLE_STYLES = [
  { label: "Padrão", value: "default", emoji: "💬", desc: "Arredondado clássico", vip: false },
  { label: "Quadrado", value: "sharp", emoji: "🟦", desc: "Cantos retos e limpos", vip: false },
  { label: "Bolha", value: "bubble", emoji: "🫧", desc: "Super arredondado", vip: false },
  { label: "Neon", value: "neon", emoji: "✨", desc: "Brilho neon nas bordas", vip: true },
  { label: "Glass", value: "glass", emoji: "🪟", desc: "Efeito glassmorphism", vip: true },
  { label: "Retro", value: "retro", emoji: "👾", desc: "Estilo pixel/8-bit", vip: true },
  { label: "Gatinho", value: "cat", emoji: "🐱", desc: "Orelhinhas de gato", vip: true },
  { label: "Nuvem", value: "cloud", emoji: "☁️", desc: "Balão nuvenzinha", vip: true },
  { label: "Bolhas", value: "transparent", emoji: "🔮", desc: "Bolhas transparentes", vip: true },
  { label: "Estrelas", value: "stars", emoji: "⭐", desc: "Brilho de estrelas", vip: true },
  { label: "Coração", value: "heart", emoji: "💖", desc: "Balão com coração", vip: true },
];

export const getBubblePreviewClass = (style: string, themeColor?: string): string => {
  switch (style) {
    case "sharp": return "rounded-sm px-2 py-1 bg-muted/20 border border-border/20";
    case "bubble": return "rounded-3xl px-3 py-2 bg-muted/20 border border-border/15";
    case "neon": return `rounded-2xl px-2 py-1 bg-muted/10 border border-border/20 shadow-[0_0_8px_${themeColor || '#8b5cf6'}40]`;
    case "glass": return "rounded-2xl px-2 py-1 bg-white/5  border border-white/10";
    case "retro": return "rounded-none px-2 py-1 bg-muted/30 border-2 border-border/30 font-mono shadow-[3px_3px_0px_rgba(255,255,255,0.1)]";
    case "cat": return "bubble-cat rounded-2xl px-2 py-1 bg-muted/20 border border-border/15";
    case "cloud": return "bubble-cloud px-2 py-1";
    case "transparent": return "bubble-transparent rounded-2xl px-2 py-1";
    case "stars": return "bubble-stars rounded-2xl px-2 py-1 bg-muted/20 border border-border/15";
    case "heart": return "bubble-heart rounded-2xl px-2 py-1 bg-muted/20 border border-border/15";
    default: return "";
  }
};

export const getBubbleClass = (style: string, themeColor?: string): string => {
  switch (style) {
    case "sharp": return "rounded-md rounded-bl-none";
    case "bubble": return "rounded-3xl";
    case "neon": return `rounded-2xl rounded-bl-md shadow-[0_0_12px_${themeColor || '#8b5cf6'}30,0_0_4px_${themeColor || '#8b5cf6'}20] border border-[${themeColor || '#8b5cf6'}30]`;
    case "glass": return "rounded-2xl rounded-bl-md bg-white/5  border border-white/10";
    case "retro": return "rounded-none border-2 border-border/30 font-mono shadow-[4px_4px_0px_rgba(255,255,255,0.08)]";
    case "cat": return "bubble-cat rounded-2xl rounded-bl-md";
    case "cloud": return "bubble-cloud";
    case "transparent": return "bubble-transparent rounded-2xl rounded-bl-md";
    case "stars": return "bubble-stars rounded-2xl rounded-bl-md";
    case "heart": return "bubble-heart rounded-2xl rounded-bl-md";
    default: return "rounded-2xl rounded-bl-md";
  }
};

export const getUserBubbleClass = (style: string): string => {
  switch (style) {
    case "sharp": return "rounded-md rounded-br-none";
    case "bubble": return "rounded-3xl";
    case "neon": return "rounded-2xl rounded-br-md shadow-[0_0_12px_rgba(239,68,68,0.3)]";
    case "glass": return "rounded-2xl rounded-br-md bg-white/10  border border-white/15";
    case "retro": return "rounded-none border-2 border-primary/40 font-mono shadow-[4px_4px_0px_rgba(255,255,255,0.08)]";
    case "cat": return "bubble-cat-user rounded-2xl rounded-br-md";
    case "cloud": return "bubble-cloud-user";
    case "transparent": return "bubble-transparent-user rounded-2xl rounded-br-md";
    case "stars": return "bubble-stars-user rounded-2xl rounded-br-md";
    case "heart": return "bubble-heart-user rounded-2xl rounded-br-md";
    default: return "rounded-2xl rounded-br-md";
  }
};

export function ChatSettings({ open, onClose, onSaved }: ChatSettingsProps) {
  const { user, profile } = useAuth();
  const isVip = !!(profile?.is_vip || profile?.is_dev);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<ChatCustomization>({
    theme_color: "#8b5cf6",
    bg_color: "#0a0a0a",
    ai_name: "SnyX",
    ai_avatar_url: null,
    ai_personality: null,
    system_prompt: null,
    bubble_style: "default",
  });

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("chat_customization")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setSettings({
          theme_color: data.theme_color || "#8b5cf6",
          bg_color: data.bg_color || "#0a0a0a",
          ai_name: data.ai_name || "SnyX",
          ai_avatar_url: data.ai_avatar_url,
          ai_personality: data.ai_personality,
          system_prompt: data.system_prompt,
          bubble_style: (data as any).bubble_style || "default",
        });
      }
      setLoading(false);
    })();
  }, [open, user]);

  if (!open || !user) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Envie apenas imagens"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/ai-avatar.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setSettings(prev => ({ ...prev, ai_avatar_url: `${urlData.publicUrl}?t=${Date.now()}` }));
      toast.success("Avatar da IA atualizado!");
    } catch {
      toast.error("Erro ao enviar avatar");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("chat_customization")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("chat_customization")
          .update({ ...settings })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("chat_customization")
          .insert({ user_id: user.id, ...settings });
        if (error) throw error;
      }

      toast.success("Configurações salvas!");
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60  p-4" onClick={onClose}>
      <div
        className="glass-elevated rounded-2xl max-w-lg w-full overflow-hidden animate-enter border border-border/20 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-5 pb-3 shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-xl text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 transition-all">
            <X size={18} />
          </button>
          <div className="relative flex items-center gap-2">
            <Palette size={18} className="text-primary" />
            <h2 className="text-base font-bold text-foreground">Personalizar Chat</h2>
          </div>
          <p className="text-xs text-muted-foreground/50 mt-1 ml-7">Cores, personalidade e comportamento da IA</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 pt-2 space-y-5 scrollbar-thin">
            {/* AI Name & Avatar */}
            <div className="flex items-start gap-4">
              <div className="relative group">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-muted/10 border border-border/20 flex items-center justify-center">
                  {settings.ai_avatar_url ? (
                    <img src={settings.ai_avatar_url} alt="AI Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Bot className="w-6 h-6 text-muted-foreground/20" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {uploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground/60 mb-1.5 block">Nome da IA</label>
                <input
                  value={settings.ai_name}
                  onChange={e => setSettings(prev => ({ ...prev, ai_name: e.target.value }))}
                  placeholder="SnyX"
                  maxLength={30}
                  className="w-full glass-input border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/20 transition-all"
                />
              </div>
            </div>

            {/* Theme Color */}
            <div>
              <label className="text-xs font-medium text-muted-foreground/60 mb-2 block flex items-center gap-1.5">
                <Sparkles size={10} className="text-primary/50" /> Cor do tema
              </label>
              <div className="flex flex-wrap gap-2">
                {THEME_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setSettings(prev => ({ ...prev, theme_color: c }))}
                    className={`w-8 h-8 rounded-xl transition-all duration-200 border-2 ${
                      settings.theme_color === c ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* BG Color */}
            <div>
              <label className="text-xs font-medium text-muted-foreground/60 mb-2 block flex items-center gap-1.5">
                <Type size={10} className="text-primary/50" /> Cor de fundo
              </label>
              <div className="flex flex-wrap gap-2">
                {BG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setSettings(prev => ({ ...prev, bg_color: c }))}
                    className={`w-8 h-8 rounded-xl transition-all duration-200 border-2 ${
                      settings.bg_color === c ? "border-white scale-110 shadow-lg" : "border-border/30 hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Personality */}
            <div>
              <label className="text-xs font-medium text-muted-foreground/60 mb-2 block">Personalidade da IA</label>
              <div className="grid grid-cols-3 gap-2">
                {PERSONALITIES.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setSettings(prev => ({ ...prev, ai_personality: p.value || null }))}
                    className={`text-xs px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                      (settings.ai_personality || "") === p.value
                        ? "border-primary/40 bg-primary/10 text-primary font-medium"
                        : "border-border/15 text-muted-foreground/60 hover:border-border/30 hover:text-foreground"
                    }`}
                  >
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bubble Style */}
            <div>
              <label className="text-xs font-medium text-muted-foreground/60 mb-2 block flex items-center gap-1.5">
                <MessageSquare size={10} className="text-primary/50" /> Estilo do balão de fala
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {BUBBLE_STYLES.map(b => {
                  const locked = b.vip && !isVip;
                  return (
                    <button
                      key={b.value}
                      onClick={() => {
                        if (locked) { toast.error("Estilo exclusivo para VIP/DEV!"); return; }
                        setSettings(prev => ({ ...prev, bubble_style: b.value }));
                      }}
                      className={`text-xs px-3 py-2.5 rounded-xl border transition-all duration-200 text-left relative ${
                        locked
                          ? "border-border/10 text-muted-foreground/30 opacity-60 cursor-not-allowed"
                          : settings.bubble_style === b.value
                            ? "border-primary/40 bg-primary/10 text-primary font-medium"
                            : "border-border/15 text-muted-foreground/60 hover:border-border/30 hover:text-foreground"
                      }`}
                    >
                      <span className="text-sm">{b.emoji}</span>
                      <span className="ml-1">{b.label}</span>
                      {locked && <span className="ml-1 text-[9px]">🔒</span>}
                      <p className="text-[9px] text-muted-foreground/40 mt-0.5">{locked ? "VIP" : b.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>


            {/* Preview */}
            <div className="rounded-xl p-3 border border-border/15" style={{ backgroundColor: settings.bg_color }}>
              <p className="text-[10px] text-muted-foreground/40 mb-2">Preview</p>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${settings.theme_color}20` }}>
                  {settings.ai_avatar_url ? (
                    <img src={settings.ai_avatar_url} className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    <Bot size={12} style={{ color: settings.theme_color }} />
                  )}
                </div>
                <div className={`flex-1 ${getBubblePreviewClass(settings.bubble_style, settings.theme_color)}`}>
                  <p className="text-[10px] font-medium mb-0.5" style={{ color: settings.theme_color }}>{settings.ai_name}</p>
                  <p className="text-xs text-foreground/70">Olá! Como posso te ajudar hoje? 😊</p>
                </div>
              </div>
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl py-3 transition-all text-sm disabled:opacity-50 shadow-lg shadow-primary/15"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
