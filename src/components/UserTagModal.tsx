import { useEffect, useState } from "react";
import {
  X, Crown, Code2, Loader2, Check, Calendar, MessageCircle, Shield, Sparkles,
  ShieldCheck, Ban, ShieldOff, Trash2, KeyRound, Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserMini {
  user_id: string;
  display_name: string | null;
  is_vip: boolean;
  is_dev: boolean;
  is_pack_steam: boolean;
  vip_expires_at: string | null;
  dev_expires_at: string | null;
  pack_steam_expires_at: string | null;
  team_badge: string | null;
  free_messages_used: number;
  created_at: string;
  banned_until?: string | null;
}

interface UserTagModalProps {
  open: boolean;
  user: UserMini | null;
  onClose: () => void;
  onUpdated: (patch: Partial<UserMini>) => void;
  onDeleted?: (userId: string) => void;
}

type TagKey = "vip" | "dev";

const TAGS: {
  key: TagKey;
  label: string;
  icon: typeof Crown;
  color: string;
  bg: string;
  border: string;
  ring: string;
  grantAction: string;
  revokeAction: string;
  expiresField: keyof UserMini;
  flagField: keyof UserMini;
}[] = [
  {
    key: "vip",
    label: "VIP",
    icon: Crown,
    color: "text-yellow-300",
    bg: "bg-yellow-500/12",
    border: "border-yellow-500/30",
    ring: "ring-yellow-500/30",
    grantAction: "grant_vip",
    revokeAction: "revoke_vip",
    expiresField: "vip_expires_at",
    flagField: "is_vip",
  },
  {
    key: "dev",
    label: "DEV",
    icon: Code2,
    color: "text-cyan-300",
    bg: "bg-cyan-500/12",
    border: "border-cyan-500/30",
    ring: "ring-cyan-500/30",
    grantAction: "grant_dev",
    revokeAction: "revoke_dev",
    expiresField: "dev_expires_at",
    flagField: "is_dev",
  },
];

const MONTH_OPTIONS = [1, 2, 3, 6, 12];

export function UserTagModal({ open, user, onClose, onUpdated, onDeleted }: UserTagModalProps) {
  const [selectedTag, setSelectedTag] = useState<TagKey>("vip");
  const [months, setMonths] = useState(1);
  const [loading, setLoading] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [banHours, setBanHours] = useState(24);
  const [badgeInput, setBadgeInput] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    setSelectedTag("vip");
    setMonths(1);
    setBanHours(24);
    setBadgeInput(user.team_badge || "");
    supabase
      .from("profiles")
      .select("avatar_url, bio")
      .eq("user_id", user.user_id)
      .maybeSingle()
      .then(({ data }) => {
        setAvatarUrl(data?.avatar_url ?? null);
        setBio(data?.bio ?? null);
      });
  }, [open, user]);

  if (!open || !user) return null;

  const currentTag = TAGS.find((t) => t.key === selectedTag)!;
  const isActive = !!user[currentTag.flagField];
  const expiresAt = user[currentTag.expiresField] as string | null;
  const isBanned = user.banned_until && new Date(user.banned_until) > new Date();

  const handleGrant = async () => {
    setLoading("grant");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: currentTag.grantAction, target_user_id: user.user_id, vip_months: months },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${currentTag.label} ativado por ${months} mês(es)`);
      const patch: Partial<UserMini> = {
        [currentTag.flagField]: true,
        [currentTag.expiresField]: data?.[currentTag.expiresField] || data?.vip_expires_at || data?.dev_expires_at || null,
      } as Partial<UserMini>;
      onUpdated(patch);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Erro ao conceder ${currentTag.label}`);
    }
    setLoading(null);
  };

  const handleRevoke = async () => {
    setLoading("revoke");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: currentTag.revokeAction, target_user_id: user.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${currentTag.label} removido`);
      onUpdated({ [currentTag.flagField]: false, [currentTag.expiresField]: null } as Partial<UserMini>);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Erro ao revogar ${currentTag.label}`);
    }
    setLoading(null);
  };

  const handleSetBadge = async () => {
    setLoading("badge");
    try {
      const badge = badgeInput.trim() || null;
      const { data, error } = await supabase.rpc("admin_set_team_badge", {
        p_user_id: user.user_id,
        p_badge: badge,
      });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in data) throw new Error((data as { error: string }).error);
      toast.success(badge ? `Badge "${badge}" definido` : "Badge removido");
      onUpdated({ team_badge: badge });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar badge");
    }
    setLoading(null);
  };

  const handleBan = async () => {
    setLoading("ban");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "ban", target_user_id: user.user_id, ban_hours: banHours },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Usuário banido por ${banHours}h`);
      onUpdated({ banned_until: data.banned_until });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao banir");
    }
    setLoading(null);
  };

  const handleUnban = async () => {
    setLoading("unban");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "unban", target_user_id: user.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Ban removido");
      onUpdated({ banned_until: null });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao desbanir");
    }
    setLoading(null);
  };

  const handleResetPassword = async () => {
    setLoading("reset");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "reset_password", target_user_id: user.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Email enviado para ${data.email}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao resetar senha");
    }
    setLoading(null);
  };

  const handleDelete = async () => {
    if (!confirm("Excluir este usuário? Isso é irreversível!")) return;
    setLoading("delete");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "delete", target_user_id: user.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário excluído");
      onDeleted?.(user.user_id);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    }
    setLoading(null);
  };

  const copyId = () => {
    navigator.clipboard.writeText(user.user_id);
    toast.success("ID copiado");
  };

  const initials = (user.display_name || "?").trim().slice(0, 2).toUpperCase();
  const memberSince = new Date(user.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-card border border-border/30 rounded-3xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
      >
        {/* Header / Profile */}
        <div className="relative p-6 pb-5 bg-gradient-to-br from-primary/10 via-card to-card border-b border-border/15 sticky top-0 z-10">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-border/30" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/30 flex items-center justify-center text-lg font-black text-primary">
                  {initials}
                </div>
              )}
              {(user.is_vip || user.is_dev) && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border-2 border-primary/40 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-primary" strokeWidth={2.5} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-foreground truncate">
                  {user.display_name || "Sem nome"}
                </h2>
                {user.team_badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25">
                    🛡️ {user.team_badge}
                  </span>
                )}
                {isBanned && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-destructive/15 text-destructive border border-destructive/25">
                    Banido
                  </span>
                )}
              </div>
              {bio && <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1">{bio}</p>}

              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/60">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {memberSince}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> {user.free_messages_used} msgs
                </span>
                <button
                  onClick={copyId}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  title="Copiar ID"
                >
                  <Copy className="w-3 h-3" /> ID
                </button>
              </div>
            </div>
          </div>

          {/* Active tags row */}
          <div className="flex flex-wrap gap-1.5 mt-4">
            {TAGS.map((t) => {
              const active = !!user[t.flagField];
              const Icon = t.icon;
              return (
                <span
                  key={t.key}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 border transition-all ${
                    active
                      ? `${t.bg} ${t.color} ${t.border}`
                      : "bg-muted/15 text-muted-foreground/40 border-border/15"
                  }`}
                >
                  <Icon className="w-2.5 h-2.5" />
                  {t.label}
                  {active && <Check className="w-2.5 h-2.5" />}
                </span>
              );
            })}
            {!user.is_vip && !user.is_dev && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-muted/20 text-muted-foreground/60 border border-border/15">
                Free
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Tag selector */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> Conceder plano
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TAGS.map((t) => {
                const Icon = t.icon;
                const selected = selectedTag === t.key;
                const active = !!user[t.flagField];
                return (
                  <button
                    key={t.key}
                    onClick={() => setSelectedTag(t.key)}
                    className={`relative p-3 rounded-2xl border transition-all ${
                      selected
                        ? `${t.bg} ${t.border} ring-2 ${t.ring}`
                        : "bg-muted/10 border-border/15 hover:bg-muted/20 hover:border-border/30"
                    }`}
                  >
                    {active && (
                      <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500/80 border border-emerald-300 flex items-center justify-center">
                        <Check className="w-2 h-2 text-white" strokeWidth={3} />
                      </div>
                    )}
                    <Icon className={`w-4 h-4 mx-auto mb-1.5 ${selected ? t.color : "text-muted-foreground/50"}`} strokeWidth={2.2} />
                    <p className={`text-[11px] font-bold ${selected ? "text-foreground" : "text-muted-foreground/70"}`}>
                      {t.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Months picker */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
              Duração
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {MONTH_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    months === m
                      ? `${currentTag.bg} ${currentTag.color} border ${currentTag.border}`
                      : "bg-muted/15 text-muted-foreground/70 border border-border/15 hover:border-border/40"
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {/* Status hint */}
          {isActive && expiresAt && (
            <div className="text-[11px] text-muted-foreground/70 px-3 py-2 rounded-xl bg-muted/15 border border-border/15">
              {currentTag.label} expira em <span className="font-bold text-foreground">{new Date(expiresAt).toLocaleDateString("pt-BR")}</span>
            </div>
          )}

          {/* Grant / Revoke actions */}
          <div className="flex gap-2">
            <button
              onClick={handleGrant}
              disabled={loading !== null}
              className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${currentTag.bg} ${currentTag.color} border ${currentTag.border} hover:brightness-110 disabled:opacity-50`}
            >
              {loading === "grant" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <currentTag.icon className="w-4 h-4" />
                  {isActive ? "Renovar" : "Conceder"} {currentTag.label}
                </>
              )}
            </button>
            {isActive && (
              <button
                onClick={handleRevoke}
                disabled={loading !== null}
                className="px-4 py-3 rounded-2xl text-sm font-bold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition-all disabled:opacity-50"
              >
                {loading === "revoke" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Revogar"}
              </button>
            )}
          </div>

          {/* Badge da equipe */}
          <div className="pt-3 border-t border-border/15">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" /> Badge da equipe
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={badgeInput}
                onChange={(e) => setBadgeInput(e.target.value)}
                placeholder="Ex: SnyX, Primeira-Dama (vazio = remover)"
                className="flex-1 bg-muted/20 border border-border/20 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40"
              />
              <button
                onClick={handleSetBadge}
                disabled={loading !== null}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary/12 text-primary border border-primary/25 hover:bg-primary/20 transition-all disabled:opacity-50"
              >
                {loading === "badge" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Aplicar"}
              </button>
            </div>
          </div>

          {/* Moderação */}
          <div className="pt-3 border-t border-border/15">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5">
              <Ban className="w-3 h-3" /> Moderação
            </p>

            {isBanned ? (
              <button
                onClick={handleUnban}
                disabled={loading !== null}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === "unban" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><ShieldOff className="w-3.5 h-3.5" /> Desbanir</>}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={banHours}
                  onChange={(e) => setBanHours(parseInt(e.target.value) || 24)}
                  className="w-20 bg-muted/20 border border-border/20 rounded-xl px-3 py-2 text-xs text-center text-foreground focus:outline-none focus:border-orange-500/40"
                />
                <span className="text-[11px] text-muted-foreground/70">horas</span>
                <button
                  onClick={handleBan}
                  disabled={loading !== null}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading === "ban" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Ban className="w-3.5 h-3.5" /> Banir</>}
                </button>
              </div>
            )}
          </div>

          {/* Conta */}
          <div className="pt-3 border-t border-border/15 grid grid-cols-2 gap-2">
            <button
              onClick={handleResetPassword}
              disabled={loading !== null}
              className="py-2.5 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === "reset" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><KeyRound className="w-3.5 h-3.5" /> Resetar senha</>}
            </button>
            <button
              onClick={handleDelete}
              disabled={loading !== null}
              className="py-2.5 rounded-xl text-xs font-bold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === "delete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" /> Excluir</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
