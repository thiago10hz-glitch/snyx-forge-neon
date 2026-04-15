import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { X, Camera, Loader2, Save, User, Crown, Code, Sparkles, KeyRound, Heart } from "lucide-react";
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
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setAvatarUrl(profile.avatar_url || "");
      setRelationshipStatus(profile.relationship_status || "");
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl || null,
        relationship_status: relationshipStatus || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={onClose}>
      <div
        className="glass-elevated rounded-2xl max-w-md w-full overflow-hidden animate-enter border border-border/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-5 pb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 transition-all"
          >
            <X size={18} />
          </button>
          <div className="relative">
            <h2 className="text-base font-bold text-foreground">Minha Conta</h2>
            <p className="text-xs text-muted-foreground/50 mt-0.5">Edite seu perfil e preferências</p>
          </div>
        </div>

        <div className="p-5 pt-2 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted/10 border border-border/20 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-muted-foreground/20" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              >
                {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{profile?.display_name || user.email}</p>
              <p className="text-xs text-muted-foreground/50 truncate">{user.email}</p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {profile?.is_dev ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-bold border border-cyan-500/20">
                    <Code size={8} /> DEV
                  </span>
                ) : profile?.is_rpg_premium ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-bold border border-purple-500/20">
                    ⚔️ RPG
                  </span>
                ) : profile?.is_vip ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-bold border border-yellow-500/20">
                    <Crown size={8} /> VIP
                  </span>
                ) : (
                  <span className="badge-free !text-[9px] !px-1.5 !py-0.5">Free</span>
                )}
                {profile?.team_badge && (profile.team_badge === "Dono" || profile.team_badge === "Dona") ? (
                  <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 text-amber-300 font-black border border-amber-400/30 shadow-lg shadow-amber-500/15 animate-pulse" style={{ animationDuration: '3s' }}>
                    <span className="text-[10px]">👑</span> {profile.team_badge}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="ml-0.5">
                      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="rgba(251,191,36,0.15)"/>
                    </svg>
                  </span>
                ) : profile?.team_badge ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold border border-primary/20">
                    🛡️ {profile.team_badge}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground/60 mb-1.5 block">Nome de exibição</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Como quer ser chamado?"
              maxLength={50}
              className="w-full glass-input border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/20 focus:shadow-lg focus:shadow-primary/5 transition-all duration-300"
            />
          </div>

          {/* Relationship Status */}
          <div>
            <label className="text-xs font-medium text-muted-foreground/60 mb-1.5 block flex items-center gap-1">
              <Heart size={10} className="text-pink-400/50" />
              Status de relacionamento
            </label>
            <div className="grid grid-cols-3 gap-1.5">
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
                  className={`text-[11px] px-2 py-2 rounded-xl border transition-all duration-200 ${
                    relationshipStatus === opt.value
                      ? "border-pink-500/40 bg-pink-500/10 text-pink-400 font-medium"
                      : "border-border/15 text-muted-foreground/50 hover:border-border/30 hover:text-foreground"
                  }`}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-medium text-muted-foreground/60 mb-1.5 block">
              <Sparkles size={10} className="inline mr-1 text-primary/50" />
              Sobre você & interesses
            </label>
            <p className="text-[10px] text-muted-foreground/30 mb-1.5">
              A IA vai usar isso pra te conhecer melhor e personalizar as respostas
            </p>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Ex: Gosto de programação, games, música eletrônica. Tenho 20 anos, sou de SP..."
              maxLength={500}
              rows={4}
              className="w-full glass-input border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/20 focus:shadow-lg focus:shadow-primary/5 transition-all duration-300 resize-none"
            />
            <p className="text-[10px] text-muted-foreground/20 text-right mt-0.5 tabular-nums">{bio.length}/500</p>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl py-3 transition-all duration-300 text-sm disabled:opacity-50 shadow-lg shadow-primary/15 hover:shadow-primary/25"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>

          {/* Reset Password */}
          <button
            type="button"
            onClick={async () => {
              if (!user?.email) return;
              try {
                const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) throw error;
                toast.success("E-mail de redefinição enviado! Verifique sua caixa de entrada.");
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Erro ao enviar e-mail.");
              }
            }}
            className="w-full flex items-center justify-center gap-2 bg-muted/10 hover:bg-muted/20 text-muted-foreground/70 hover:text-foreground font-medium rounded-xl py-3 transition-all duration-300 text-sm border border-border/15"
          >
            <KeyRound className="w-4 h-4" />
            Redefinir senha
          </button>
        </div>
      </div>
    </div>
  );
}
