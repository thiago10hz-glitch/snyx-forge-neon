import { useEffect, useState } from "react";
import { X, Crown, Code2, Package, Loader2, Check, Calendar, MessageCircle, Shield, Sparkles } from "lucide-react";
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
}

interface UserTagModalProps {
  open: boolean;
  user: UserMini | null;
  onClose: () => void;
  onUpdated: (patch: Partial<UserMini>) => void;
}

type TagKey = "vip" | "dev" | "pack_steam";

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
  hasMonths: boolean;
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
    hasMonths: true,
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
    hasMonths: true,
    expiresField: "dev_expires_at",
    flagField: "is_dev",
  },
  {
    key: "pack_steam",
    label: "Pack Steam",
    icon: Package,
    color: "text-emerald-300",
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/30",
    ring: "ring-emerald-500/30",
    grantAction: "grant_pack_steam",
    revokeAction: "revoke_pack_steam",
    hasMonths: true,
    expiresField: "pack_steam_expires_at",
    flagField: "is_pack_steam",
  },
];

const MONTH_OPTIONS = [1, 2, 3, 6, 12];

export function UserTagModal({ open, user, onClose, onUpdated }: UserTagModalProps) {
  const [selectedTag, setSelectedTag] = useState<TagKey>("vip");
  const [months, setMonths] = useState(1);
  const [loading, setLoading] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setSelectedTag("vip");
    setMonths(1);
    // Fetch nicer profile bits
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
        [currentTag.expiresField]: data?.[currentTag.expiresField] || data?.vip_expires_at || data?.dev_expires_at || data?.pack_steam_expires_at || null,
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
      const patch: Partial<UserMini> = {
        [currentTag.flagField]: false,
        [currentTag.expiresField]: null,
      } as Partial<UserMini>;
      onUpdated(patch);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Erro ao revogar ${currentTag.label}`);
    }
    setLoading(null);
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
        className="w-full max-w-lg bg-card border border-border/30 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
      >
        {/* Header / Profile */}
        <div className="relative p-6 pb-5 bg-gradient-to-br from-primary/10 via-card to-card border-b border-border/15">
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
              {(user.is_vip || user.is_dev || user.is_pack_steam) && (
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
              </div>
              {bio && <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1">{bio}</p>}

              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/60">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {memberSince}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> {user.free_messages_used} msgs
                </span>
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
            {!user.is_vip && !user.is_dev && !user.is_pack_steam && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-muted/20 text-muted-foreground/60 border border-border/15">
                Free
              </span>
            )}
          </div>
        </div>

        {/* Tag selector */}
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> Selecione a tag
            </p>
            <div className="grid grid-cols-3 gap-2">
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
          {currentTag.hasMonths && (
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
          )}

          {/* Status hint */}
          {isActive && expiresAt && (
            <div className="text-[11px] text-muted-foreground/70 px-3 py-2 rounded-xl bg-muted/15 border border-border/15">
              Expira em <span className="font-bold text-foreground">{new Date(expiresAt).toLocaleDateString("pt-BR")}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
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
        </div>
      </div>
    </div>
  );
}
