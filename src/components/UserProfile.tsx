import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { X, Camera, Loader2, Save, User, Crown, Code, Sparkles, KeyRound, Heart, ImagePlus } from "lucide-react";
import { toast } from "sonner";

interface UserProfileProps {
  open: boolean;
  onClose: () => void;
}

export function UserProfile({ open, onClose }: UserProfileProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [gender, setGender] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setAvatarUrl(profile.avatar_url || "");
      setBackgroundUrl(profile.background_url || "");
      setRelationshipStatus(profile.relationship_status || "");
      setGender(profile.gender || "");
      
      // Fetch partner info
      if (profile.partner_user_id) {
        supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("user_id", profile.partner_user_id)
          .single()
          .then(({ data }) => {
            if (data) {
              setPartnerName((data as any).display_name || "Parceiro(a)");
              setPartnerAvatar((data as any).avatar_url || null);
            }
          });
      } else {
        setPartnerName(null);
        setPartnerAvatar(null);
      }
    }
  }, [open, profile]);

  if (!open || !user) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 5MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Envie apenas imagens"); return; }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(newUrl);
      await supabase.from("profiles").update({ avatar_url: newUrl }).eq("user_id", user.id);
      toast.success("Foto atualizada!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 5MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Envie apenas imagens"); return; }

    setUploadingBg(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/background.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setBackgroundUrl(newUrl);
      await (supabase as any).from("profiles").update({ background_url: newUrl }).eq("user_id", user.id);
      toast.success("Fundo atualizado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar imagem de fundo");
    } finally {
      setUploadingBg(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("profiles").update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl || null,
        background_url: backgroundUrl || null,
        relationship_status: relationshipStatus || null,
        gender: gender || null,
      }).eq("user_id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Perfil salvo!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 " onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[92vh] sm:max-h-[90vh] overflow-y-auto bg-card/95  sm:rounded-3xl rounded-t-3xl border border-border/10 shadow-2xl animate-enter"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with avatar hero */}
        <div className="relative">
          {/* Gradient banner / custom background */}
          <div className="h-32 sm:h-36 relative overflow-hidden">
            {backgroundUrl ? (
              <img src={backgroundUrl} alt="Fundo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/40 via-primary/15 to-background relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.35),transparent_55%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_80%,hsl(var(--primary)/0.25),transparent_50%)]" />
              </div>
            )}
            {/* Bottom gradient fade for legibility */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card via-card/60 to-transparent" />

            <button
              onClick={(e) => { e.stopPropagation(); bgInputRef.current?.click(); }}
              disabled={uploadingBg}
              className="absolute bottom-2 right-2 z-20 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-background/70 backdrop-blur text-foreground/80 text-[10px] font-medium hover:bg-background/90 transition-all border border-border/30"
            >
              {uploadingBg ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
              {backgroundUrl ? "Trocar fundo" : "Adicionar fundo"}
            </button>
            <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
          </div>

          {/* Close button */}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 backdrop-blur text-muted-foreground hover:text-foreground hover:bg-background/90 transition-all border border-border/30"
          >
            <X size={16} />
          </button>

          {/* Avatar - overlapping banner */}
          <div className="flex flex-col items-center -mt-14 relative z-10 pb-4 px-5">
            <div className="relative group">
              <div className="w-24 h-24 rounded-3xl overflow-hidden bg-card border-[3px] border-card shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6),0_0_0_1px_hsl(var(--primary)/0.2)] flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/15 to-muted/40 flex items-center justify-center">
                    <User className="w-10 h-10 text-primary/40" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>

            <h3 className="text-lg font-bold text-foreground mt-3 tracking-tight">{profile?.display_name || "Usuário"}</h3>
            <p className="text-[11px] text-muted-foreground/55 truncate max-w-[240px]">{user.email}</p>

            {/* Badges */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap justify-center">
              {profile?.is_dev ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-400/35 shadow-[0_0_14px_-2px_rgba(34,211,238,0.4)]">
                  <Code size={10} /> DEV
                </span>
              ) : profile?.is_vip ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-400/35 shadow-[0_0_14px_-2px_rgba(245,158,11,0.4)]">
                  <Crown size={10} /> VIP
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] px-2.5 py-1 rounded-full bg-muted/30 text-muted-foreground/70 font-semibold border border-border/30">
                  Free
                </span>
              )}
              {profile?.team_badge && (profile.team_badge === "Dono" || profile.team_badge === "Dona") ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/25 via-yellow-400/25 to-amber-500/25 text-amber-200 font-black border border-amber-400/50 shadow-[0_0_16px_rgba(251,191,36,0.5)]">
                  👑 {profile.team_badge}
                </span>
              ) : profile?.team_badge ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-primary/12 text-primary font-bold border border-primary/25">
                  🛡️ {profile.team_badge}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Form content */}
        <div className="px-5 pb-6 space-y-4">
          {/* Partner / Relationship display */}
          {partnerName && profile?.relationship_status && profile.relationship_status.toLowerCase().includes("namorando") && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-pink-500/8 border border-pink-500/15">
              <div className="flex items-center -space-x-3">
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-pink-500/30 bg-card z-10">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Eu" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted/15 flex items-center justify-center">
                      <User className="w-4 h-4 text-muted-foreground/25" />
                    </div>
                  )}
                </div>
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-pink-500/30 bg-card">
                  {partnerAvatar ? (
                    <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-pink-500/10 flex items-center justify-center">
                      <Heart className="w-4 h-4 text-pink-400/50" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-pink-400 flex items-center gap-1">
                  💕 Namorando
                </p>
                <p className="text-[10px] text-pink-400/60 truncate">
                  com <span className="font-semibold text-pink-400/80">{partnerName}</span>
                </p>
              </div>
              <Heart className="w-4 h-4 text-pink-400/40 animate-pulse shrink-0" />
            </div>
          )}

          {/* Display Name */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-1.5 block">Nome</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Como quer ser chamado?"
              maxLength={50}
              className="w-full bg-background/40 border border-border/8 rounded-xl px-3.5 py-2.5 text-sm text-foreground/80 placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/20 focus:bg-background/60 transition-all duration-200"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-1.5 block">Gênero</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Masculino", value: "masculino", emoji: "👨" },
                { label: "Feminino", value: "feminino", emoji: "👩" },
                { label: "Outro", value: "outro", emoji: "🌈" },
                { label: "Prefiro não dizer", value: "", emoji: "🤐" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(opt.value)}
                  className={`text-[11px] px-3 py-1.5 rounded-full border transition-all duration-200 ${
                    gender === opt.value
                      ? "border-primary/30 bg-primary/10 text-primary font-medium shadow-sm shadow-primary/5"
                      : "border-border/10 bg-muted/5 text-muted-foreground/45 hover:border-border/25 hover:text-foreground/70"
                  }`}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Relationship Status */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
              <Heart size={9} className="text-pink-400/40" /> Relacionamento
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Solteiro(a)", value: "solteiro", emoji: "💔" },
                { label: "Namorando", value: "namorando", emoji: "💕" },
                { label: "Casado(a)", value: "casado", emoji: "💍" },
                { label: "Complicado", value: "complicado", emoji: "🤷" },
                { label: "Ficando", value: "ficando", emoji: "😏" },
                { label: "Prefiro não dizer", value: "", emoji: "🤐" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRelationshipStatus(opt.value)}
                  className={`text-[11px] px-3 py-1.5 rounded-full border transition-all duration-200 ${
                    relationshipStatus === opt.value
                      ? "border-pink-500/30 bg-pink-500/10 text-pink-400 font-medium shadow-sm shadow-pink-500/5"
                      : "border-border/10 bg-muted/5 text-muted-foreground/45 hover:border-border/25 hover:text-foreground/70"
                  }`}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-1 block flex items-center gap-1">
              <Sparkles size={9} className="text-primary/40" /> Sobre você
            </label>
            <p className="text-[10px] text-muted-foreground/25 mb-1.5">
              A IA usa isso pra te conhecer melhor
            </p>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Ex: Gosto de games, música, tenho 20 anos..."
              maxLength={500}
              rows={3}
              className="w-full bg-background/40 border border-border/8 rounded-xl px-3.5 py-2.5 text-sm text-foreground/80 placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary/20 focus:bg-background/60 transition-all duration-200 resize-none"
            />
            <p className="text-[9px] text-muted-foreground/20 text-right mt-0.5 tabular-nums">{bio.length}/500</p>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl py-3 transition-all duration-200 text-sm disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!user?.email) return;
                try {
                  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) throw error;
                  toast.success("E-mail de redefinição enviado!");
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : "Erro ao enviar e-mail.");
                }
              }}
              className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-muted/10 text-muted-foreground/50 hover:text-foreground/70 font-medium rounded-xl py-2.5 transition-all duration-200 text-xs"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Redefinir senha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
