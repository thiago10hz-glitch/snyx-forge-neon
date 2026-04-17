import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  X, Camera, Loader2, Save, User, Crown, Code, Sparkles, KeyRound, Heart, ImagePlus,
  MessageSquare, MessagesSquare, Calendar, Palette, Flame, Shield,
} from "lucide-react";
import { toast } from "sonner";

interface UserProfileProps {
  open: boolean;
  onClose: () => void;
}

type TabKey = "perfil" | "vip" | "config";

export function UserProfile({ open, onClose }: UserProfileProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<TabKey>("perfil");
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
  const [stats, setStats] = useState({ messages: 0, conversations: 0, daysActive: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && profile) {
      setTab("perfil");
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setAvatarUrl(profile.avatar_url || "");
      setBackgroundUrl(profile.background_url || "");
      setRelationshipStatus(profile.relationship_status || "");
      setGender(profile.gender || "");

      // Parceiro
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

      // Stats
      if (user) {
        Promise.all([
          supabase.from("chat_conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("chat_conversations").select("id").eq("user_id", user.id).then(async (res) => {
            const ids = (res.data || []).map((c: any) => c.id);
            if (!ids.length) return { count: 0 };
            const { count } = await supabase
              .from("chat_messages")
              .select("id", { count: "exact", head: true })
              .in("conversation_id", ids)
              .eq("role", "user");
            return { count: count || 0 };
          }),
        ]).then(([convRes, msgRes]: any) => {
          const createdAt = (profile as any)?.created_at ? new Date((profile as any).created_at) : new Date();
          const days = Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / 86400000));
          setStats({
            conversations: convRes.count || 0,
            messages: msgRes.count || 0,
            daysActive: days,
          });
        }).catch(() => {});
      }
    }
  }, [open, profile, user]);

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
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const tierLabel = profile?.is_dev ? "DEV" : profile?.is_vip ? "VIP" : "Free";
  const tierIcon = profile?.is_dev ? Code : profile?.is_vip ? Crown : Sparkles;
  const tierExpires = profile?.is_dev ? profile?.dev_expires_at : profile?.is_vip ? profile?.vip_expires_at : null;
  const tierDaysLeft = tierExpires
    ? Math.max(0, Math.ceil((new Date(tierExpires).getTime() - Date.now()) / 86400000))
    : null;
  const tierProgress = tierDaysLeft != null ? Math.min(100, (tierDaysLeft / 30) * 100) : 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[94vh] sm:max-h-[90vh] overflow-y-auto scrollbar-hide bg-card/90 backdrop-blur-xl sm:rounded-3xl rounded-t-3xl border border-primary/20 shadow-[0_0_60px_-15px_hsl(var(--primary)/0.5)] animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* === BANNER === */}
        <div className="relative">
          <div className="h-36 sm:h-44 relative overflow-hidden">
            {backgroundUrl ? (
              <img src={backgroundUrl} alt="Fundo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/50 via-primary/20 to-background relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,hsl(var(--primary)/0.5),transparent_55%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,hsl(var(--primary)/0.4),transparent_55%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,hsl(var(--primary)/0.15)_50%,transparent_100%)] animate-pulse" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/80 to-transparent" />

            <button
              onClick={(e) => { e.stopPropagation(); bgInputRef.current?.click(); }}
              disabled={uploadingBg}
              className="absolute bottom-2 right-2 z-20 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-background/70 backdrop-blur text-foreground/80 text-[10px] font-medium hover:bg-background/90 transition-all border border-primary/30 shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)]"
            >
              {uploadingBg ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
              {backgroundUrl ? "Trocar fundo" : "Adicionar fundo"}
            </button>
            <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-background/70 backdrop-blur text-muted-foreground hover:text-primary hover:bg-background/90 transition-all border border-primary/20 hover:border-primary/50 hover:shadow-[0_0_14px_-2px_hsl(var(--primary)/0.5)]"
          >
            <X size={16} />
          </button>

          {/* Avatar */}
          <div className="flex flex-col items-center -mt-16 relative z-10 pb-4 px-5">
            <div className="relative group">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-primary via-primary/50 to-primary/30 blur-md opacity-70 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-28 h-28 rounded-3xl overflow-hidden bg-card border-[3px] border-card shadow-[0_18px_50px_-10px_hsl(var(--primary)/0.6)] flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-muted/40 flex items-center justify-center">
                    <User className="w-12 h-12 text-primary/50" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>

            <h3 className="text-xl font-bold text-foreground mt-3 tracking-tight bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              {profile?.display_name || "Usuário"}
            </h3>
            <p className="text-[11px] text-muted-foreground/60 truncate max-w-[260px]">{user.email}</p>

            {/* Badges */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap justify-center">
              {profile?.is_dev ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-400/40 shadow-[0_0_14px_-2px_rgba(34,211,238,0.5)]">
                  <Code size={10} /> DEV
                </span>
              ) : profile?.is_vip ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-400/40 shadow-[0_0_14px_-2px_rgba(245,158,11,0.5)]">
                  <Crown size={10} /> VIP
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] px-2.5 py-1 rounded-full bg-muted/30 text-muted-foreground/70 font-semibold border border-border/30">
                  Free
                </span>
              )}
              {profile?.team_badge && (profile.team_badge === "Dono" || profile.team_badge === "Dona") ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/30 via-yellow-400/30 to-amber-500/30 text-amber-200 font-black border border-amber-400/50 shadow-[0_0_18px_rgba(251,191,36,0.5)]">
                  👑 {profile.team_badge}
                </span>
              ) : profile?.team_badge ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-primary/15 text-primary font-bold border border-primary/30">
                  🛡️ {profile.team_badge}
                </span>
              ) : null}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 w-full mt-5">
              <StatCard icon={MessageSquare} value={stats.messages} label="Mensagens" />
              <StatCard icon={MessagesSquare} value={stats.conversations} label="Conversas" />
              <StatCard icon={Calendar} value={stats.daysActive} label="Dias ativo" />
            </div>
          </div>
        </div>

        {/* === TABS === */}
        <div className="px-5 pt-1">
          <div className="flex gap-1 p-1 rounded-2xl bg-background/40 border border-border/30 backdrop-blur-sm">
            {([
              { key: "perfil", label: "Perfil", icon: User },
              { key: "vip", label: "Status", icon: Crown },
              { key: "config", label: "Config", icon: Shield },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  tab === key
                    ? "bg-primary/15 text-primary shadow-[0_0_14px_-3px_hsl(var(--primary)/0.7)] border border-primary/30"
                    : "text-muted-foreground/60 hover:text-foreground/80 border border-transparent"
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* === TAB CONTENT === */}
        <div className="px-5 pb-6 pt-4 space-y-4">
          {tab === "perfil" && (
            <>
              {partnerName && profile?.relationship_status && profile.relationship_status.toLowerCase().includes("namorando") && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 shadow-[0_0_18px_-6px_rgba(244,114,182,0.5)]">
                  <div className="flex items-center -space-x-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-pink-500/40 bg-card z-10">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Eu" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted/15 flex items-center justify-center">
                          <User className="w-4 h-4 text-muted-foreground/25" />
                        </div>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-pink-500/40 bg-card">
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
                    <p className="text-[12px] font-bold text-pink-400 flex items-center gap-1">
                      💕 Namorando
                    </p>
                    <p className="text-[11px] text-pink-400/70 truncate">
                      com <span className="font-semibold text-pink-400/90">{partnerName}</span>
                    </p>
                  </div>
                  <Heart className="w-4 h-4 text-pink-400/50 animate-pulse shrink-0" />
                </div>
              )}

              <FieldGroup label="Nome">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Como quer ser chamado?"
                  maxLength={50}
                  className="w-full bg-background/50 border border-border/20 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 focus:bg-background/70 focus:shadow-[0_0_14px_-3px_hsl(var(--primary)/0.5)] transition-all duration-200"
                />
              </FieldGroup>

              <FieldGroup label="Gênero">
                <ChipRow
                  options={[
                    { label: "Masculino", value: "masculino", emoji: "👨" },
                    { label: "Feminino", value: "feminino", emoji: "👩" },
                    { label: "Outro", value: "outro", emoji: "🌈" },
                    { label: "Prefiro não dizer", value: "", emoji: "🤐" },
                  ]}
                  value={gender}
                  onChange={setGender}
                  accent="primary"
                />
              </FieldGroup>

              <FieldGroup label="Relacionamento" icon={<Heart size={9} className="text-pink-400/60" />}>
                <ChipRow
                  options={[
                    { label: "Solteiro(a)", value: "solteiro", emoji: "💔" },
                    { label: "Namorando", value: "namorando", emoji: "💕" },
                    { label: "Casado(a)", value: "casado", emoji: "💍" },
                    { label: "Complicado", value: "complicado", emoji: "🤷" },
                    { label: "Ficando", value: "ficando", emoji: "😏" },
                    { label: "Prefiro não dizer", value: "", emoji: "🤐" },
                  ]}
                  value={relationshipStatus}
                  onChange={setRelationshipStatus}
                  accent="pink"
                />
              </FieldGroup>

              <FieldGroup
                label="Sobre você"
                icon={<Sparkles size={9} className="text-primary/60" />}
                hint="A IA usa isso pra te conhecer melhor"
              >
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Ex: Gosto de games, música, tenho 20 anos..."
                  maxLength={500}
                  rows={3}
                  className="w-full bg-background/50 border border-border/20 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 focus:bg-background/70 focus:shadow-[0_0_14px_-3px_hsl(var(--primary)/0.5)] transition-all duration-200 resize-none"
                />
                <p className="text-[9px] text-muted-foreground/40 text-right mt-0.5 tabular-nums">{bio.length}/500</p>
              </FieldGroup>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl py-3 transition-all duration-200 text-sm disabled:opacity-50 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.7)] hover:shadow-[0_0_32px_-2px_hsl(var(--primary)/0.9)] active:scale-[0.98]"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar alterações
              </button>
            </>
          )}

          {tab === "vip" && (
            <div className="space-y-4">
              {/* Tier card */}
              <div className={`relative overflow-hidden rounded-2xl p-5 border ${
                profile?.is_dev
                  ? "bg-gradient-to-br from-cyan-500/15 to-cyan-500/5 border-cyan-400/30 shadow-[0_0_30px_-10px_rgba(34,211,238,0.5)]"
                  : profile?.is_vip
                    ? "bg-gradient-to-br from-amber-500/15 to-amber-500/5 border-amber-400/30 shadow-[0_0_30px_-10px_rgba(245,158,11,0.5)]"
                    : "bg-gradient-to-br from-primary/15 to-primary/5 border-primary/30 shadow-[0_0_30px_-10px_hsl(var(--primary)/0.5)]"
              }`}>
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-current opacity-10 blur-2xl" />
                <div className="relative flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Plano atual</p>
                    <h4 className="text-2xl font-black mt-1 flex items-center gap-2">
                      {(() => { const I = tierIcon; return <I className="w-6 h-6" />; })()} {tierLabel}
                    </h4>
                  </div>
                  {tierDaysLeft != null && (
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Restam</p>
                      <p className="text-2xl font-black tabular-nums">{tierDaysLeft}<span className="text-xs font-normal text-muted-foreground/60 ml-1">dias</span></p>
                    </div>
                  )}
                </div>
                {tierDaysLeft != null && (
                  <div className="h-1.5 rounded-full bg-background/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-current transition-all duration-500"
                      style={{ width: `${tierProgress}%` }}
                    />
                  </div>
                )}
                {tierLabel === "Free" && (
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    Faça upgrade pra desbloquear conversas ilimitadas, conteúdo +18 e mais.
                  </p>
                )}
              </div>

              {/* Active perks */}
              <div className="grid grid-cols-2 gap-2">
                <PerkCard active={!!profile?.is_vip || !!profile?.is_dev} icon={Flame} label="Sem limite" />
                <PerkCard active={!!profile?.is_vip || !!profile?.is_dev} icon={Heart} label="Conteúdo +18" />
                <PerkCard active={!!profile?.is_pack_steam} icon={Sparkles} label="Pack Steam" />
                <PerkCard active={!!profile?.is_rpg_premium} icon={Crown} label="RPG Premium" />
              </div>
            </div>
          )}

          {tab === "config" && (
            <div className="space-y-2">
              <ConfigButton
                icon={Palette}
                label="Trocar tema"
                hint="Cores, fonte e estilo do app"
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent("snyx:open-theme"));
                }}
              />

              <ConfigButton
                icon={KeyRound}
                label="Redefinir senha"
                hint="Receba um e-mail pra criar uma nova"
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
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* === Subcomponents === */

function StatCard({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-background/40 border border-border/20 hover:border-primary/30 hover:bg-background/60 transition-all">
      <Icon className="w-3.5 h-3.5 text-primary/70" />
      <span className="text-base font-bold text-foreground tabular-nums leading-none">{value}</span>
      <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function FieldGroup({ label, icon, hint, children }: { label: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5 flex items-center gap-1">
        {icon} {label}
      </label>
      {hint && <p className="text-[10px] text-muted-foreground/40 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function ChipRow({
  options, value, onChange, accent,
}: {
  options: { label: string; value: string; emoji: string }[];
  value: string;
  onChange: (v: string) => void;
  accent: "primary" | "pink";
}) {
  const activeCls = accent === "pink"
    ? "border-pink-500/40 bg-pink-500/15 text-pink-300 font-medium shadow-[0_0_12px_-3px_rgba(244,114,182,0.5)]"
    : "border-primary/40 bg-primary/15 text-primary font-medium shadow-[0_0_12px_-3px_hsl(var(--primary)/0.5)]";
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt.value || "none"}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-[11px] px-3 py-1.5 rounded-full border transition-all duration-200 ${
            value === opt.value
              ? activeCls
              : "border-border/20 bg-muted/10 text-muted-foreground/60 hover:border-border/40 hover:text-foreground/80"
          }`}
        >
          {opt.emoji} {opt.label}
        </button>
      ))}
    </div>
  );
}

function PerkCard({ active, icon: Icon, label }: { active: boolean; icon: any; label: string }) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
      active
        ? "bg-primary/10 border-primary/30 text-foreground shadow-[0_0_14px_-4px_hsl(var(--primary)/0.5)]"
        : "bg-muted/5 border-border/15 text-muted-foreground/40"
    }`}>
      <Icon className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground/40"}`} />
      <span className="text-xs font-semibold">{label}</span>
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />}
    </div>
  );
}

function ConfigButton({ icon: Icon, label, hint, onClick }: { icon: any; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-background/40 hover:bg-background/70 border border-border/20 hover:border-primary/40 transition-all group hover:shadow-[0_0_18px_-6px_hsl(var(--primary)/0.5)]"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground/60">{hint}</p>
      </div>
    </button>
  );
}
