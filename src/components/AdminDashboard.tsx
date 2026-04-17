import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Crown, MessageCircle, TrendingUp, Ban, Clock,
  ShieldCheck, Globe, Activity, BarChart3, ArrowUpRight,
  Swords, Flame, Trash2
} from "lucide-react";
import { toast } from "sonner";

interface DashboardStats {
  totalUsers: number;
  vipUsers: number;
  devUsers: number;
  packSteamUsers: number;
  rpgPremiumUsers: number;
  freeUsers: number;
  bannedUsers: number;
  expiredUsers: number;
  totalMessages: number;
  todaySignups: number;
  weekSignups: number;
  totalTickets: number;
  openTickets: number;
  totalSites: number;
  totalCharacters: number;
  avgMessagesPerUser: number;
}

function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, duration]);
  return <>{display.toLocaleString("pt-BR")}</>;
}

function MiniBar({ data, maxValue }: { data: { label: string; value: number; color: string }[]; maxValue: number }) {
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground/50 w-20 shrink-0 truncate">{d.label}</span>
          <div className="flex-1 h-2 rounded-full bg-muted/20 overflow-hidden">
            <div className={`h-full rounded-full ${d.color} transition-all duration-700`}
              style={{ width: `${maxValue > 0 ? Math.max((d.value / maxValue) * 100, 2) : 0}%` }} />
          </div>
          <span className="text-[10px] font-bold w-8 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0, vipUsers: 0, devUsers: 0, packSteamUsers: 0, rpgPremiumUsers: 0,
    freeUsers: 0, bannedUsers: 0, expiredUsers: 0, totalMessages: 0,
    todaySignups: 0, weekSignups: 0, totalTickets: 0, openTickets: 0,
    totalSites: 0, totalCharacters: 0, avgMessagesPerUser: 0,
  });
  const [recentUsers, setRecentUsers] = useState<{ display_name: string | null; created_at: string; is_vip: boolean; is_dev: boolean; team_badge: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const handleCleanup = async () => {
    if (!confirm("Apagar TODOS os arquivos antigos do bucket app-downloads (instaladores, ZIPs)? Não pode ser desfeito.")) return;
    setCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-cleanup-storage");
      if (error) throw error;
      toast.success("Limpeza concluída!");
      console.log("cleanup result", data);
    } catch (e: any) {
      toast.error(e.message || "Falhou");
    } finally {
      setCleaning(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();

    const [
      { data: profiles },
      { count: msgCount },
      { count: ticketCount },
      { count: openTicketCount },
      { count: charCount },
      { data: recent },
    ] = await Promise.all([
      supabase.from("profiles").select("is_vip, is_dev, is_pack_steam, is_rpg_premium, banned_until, vip_expires_at, dev_expires_at, pack_steam_expires_at, rpg_premium_expires_at, created_at, free_messages_used"),
      supabase.from("chat_messages").select("id", { count: "exact", head: true }),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("ai_characters").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("display_name, created_at, is_vip, is_dev, team_badge").order("created_at", { ascending: false }).limit(8),
    ]);
    const siteCount = 0;

    const users = profiles || [];
    const isBanned = (u: any) => u.banned_until && new Date(u.banned_until) > now;
    const notExpired = (flag: boolean, exp: string | null) => flag && (!exp || new Date(exp) > now);
    const isExpired = (u: any) =>
      (u.is_vip && u.vip_expires_at && new Date(u.vip_expires_at) < now) ||
      (u.is_dev && u.dev_expires_at && new Date(u.dev_expires_at) < now) ||
      (u.is_pack_steam && u.pack_steam_expires_at && new Date(u.pack_steam_expires_at) < now);

    const totalMsgs = msgCount || 0;
    const totalUsers = users.length;

    setStats({
      totalUsers,
      vipUsers: users.filter(u => notExpired(u.is_vip, u.vip_expires_at)).length,
      devUsers: users.filter(u => notExpired(u.is_dev, u.dev_expires_at)).length,
      packSteamUsers: users.filter(u => notExpired(u.is_pack_steam, u.pack_steam_expires_at)).length,
      rpgPremiumUsers: users.filter(u => notExpired(u.is_rpg_premium, u.rpg_premium_expires_at)).length,
      freeUsers: users.filter(u => !u.is_vip && !u.is_dev && !u.is_pack_steam && !u.is_rpg_premium).length,
      bannedUsers: users.filter(u => isBanned(u)).length,
      expiredUsers: users.filter(u => isExpired(u)).length,
      totalMessages: totalMsgs,
      todaySignups: users.filter(u => u.created_at >= todayStart).length,
      weekSignups: users.filter(u => u.created_at >= weekStart).length,
      totalTickets: ticketCount || 0,
      openTickets: openTicketCount || 0,
      totalSites: siteCount || 0,
      totalCharacters: charCount || 0,
      avgMessagesPerUser: totalUsers > 0 ? Math.round(totalMsgs / totalUsers) : 0,
    });
    setRecentUsers((recent || []) as any);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Flame className="h-5 w-5 text-primary animate-pulse" />
          <span className="text-sm">Carregando dashboard...</span>
        </div>
      </div>
    );
  }

  const paidUsers = stats.vipUsers + stats.devUsers + stats.packSteamUsers + stats.rpgPremiumUsers;
  const conversionRate = stats.totalUsers > 0 ? ((paidUsers / stats.totalUsers) * 100).toFixed(1) : "0";

  const heroCards = [
    { label: "Total Usuários", value: stats.totalUsers, icon: Users, gradient: "from-blue-600 to-cyan-500", sub: `+${stats.todaySignups} hoje` },
    { label: "Receita (Pagantes)", value: paidUsers, icon: Crown, gradient: "from-amber-500 to-yellow-400", sub: `${conversionRate}% conversão` },
    { label: "Mensagens", value: stats.totalMessages, icon: MessageCircle, gradient: "from-purple-500 to-pink-500", sub: `${stats.avgMessagesPerUser} msg/user` },
    { label: "Tickets Abertos", value: stats.openTickets, icon: ShieldCheck, gradient: "from-emerald-500 to-green-400", sub: `${stats.totalTickets} total` },
  ];

  const userBreakdown = [
    { label: "VIP", value: stats.vipUsers, color: "bg-yellow-500" },
    { label: "DEV", value: stats.devUsers, color: "bg-cyan-500" },
    { label: "Pack Steam", value: stats.packSteamUsers, color: "bg-green-500" },
    { label: "RPG Premium", value: stats.rpgPremiumUsers, color: "bg-orange-500" },
    { label: "Free", value: stats.freeUsers, color: "bg-muted-foreground/30" },
  ];


  return (
    <div className="space-y-5">
      {/* Cleanup button */}
      <div className="flex justify-end">
        <button
          onClick={handleCleanup}
          disabled={cleaning}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {cleaning ? "Limpando..." : "Limpar Storage antigo"}
        </button>
      </div>
      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {heroCards.map((s, i) => (
          <div key={s.label} className="group relative rounded-2xl border border-border/20 bg-card/50  p-4 overflow-hidden transition-all duration-300 hover:border-border/40 hover:shadow-xl animate-fade-in"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}>
            <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-to-br ${s.gradient} opacity-10 group-hover:opacity-20 blur-2xl transition-opacity duration-500`} />
            <div className="relative">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-black tracking-tight"><AnimatedCounter value={s.value} /></p>
              <p className="text-[11px] text-muted-foreground/60 font-medium">{s.label}</p>
              <p className="text-[10px] text-primary/60 mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> {s.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Middle row: User breakdown + quick stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Breakdown Chart */}
        <div className="rounded-2xl border border-border/20 bg-card/50  p-5 animate-fade-in" style={{ animationDelay: "250ms", animationFillMode: "both" }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold">Distribuição de Usuários</span>
          </div>
          {/* Stacked bar */}
          <div className="flex rounded-xl overflow-hidden h-6 mb-4">
            {userBreakdown.filter(u => u.value > 0).map(u => {
              const pct = stats.totalUsers > 0 ? (u.value / stats.totalUsers) * 100 : 0;
              return (
                <div key={u.label} className={`${u.color} flex items-center justify-center transition-all duration-700`}
                  style={{ width: `${Math.max(pct, 3)}%` }} title={`${u.label}: ${u.value}`}>
                  {pct > 10 && <span className="text-[8px] font-bold text-white/90">{pct.toFixed(0)}%</span>}
                </div>
              );
            })}
          </div>
          <MiniBar data={userBreakdown} maxValue={Math.max(...userBreakdown.map(u => u.value), 1)} />
        </div>

        {/* Quick Stats Grid */}
        <div className="rounded-2xl border border-border/20 bg-card/50  p-5 animate-fade-in" style={{ animationDelay: "320ms", animationFillMode: "both" }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold">Métricas Rápidas</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Cadastros Hoje", value: stats.todaySignups, icon: ArrowUpRight, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Cadastros Semana", value: stats.weekSignups, icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Banidos", value: stats.bannedUsers, icon: Ban, color: "text-red-400", bg: "bg-red-500/10" },
              { label: "Expirados", value: stats.expiredUsers, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
              { label: "Personagens", value: stats.totalCharacters, icon: Swords, color: "text-purple-400", bg: "bg-purple-500/10" },
            ].map((m) => (
              <div key={m.label} className={`flex items-center gap-3 p-3 rounded-xl ${m.bg} border border-transparent hover:border-border/20 transition-all`}>
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <div>
                  <p className="text-lg font-bold leading-none"><AnimatedCounter value={m.value} /></p>
                  <p className="text-[9px] text-muted-foreground/50 mt-0.5">{m.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl border border-border/20 bg-card/50  p-5 animate-fade-in" style={{ animationDelay: "400ms", animationFillMode: "both" }}>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold">Atividade Recente</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-muted-foreground/40">Auto-refresh 30s</span>
          </div>
        </div>
        <div className="space-y-0.5">
          {recentUsers.map((u, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/15 transition-colors">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                u.team_badge ? "bg-gradient-to-br from-amber-400/20 to-yellow-500/20 text-amber-400" :
                u.is_dev ? "bg-cyan-500/15 text-cyan-400" :
                u.is_vip ? "bg-yellow-500/15 text-yellow-400" :
                "bg-muted/30 text-muted-foreground/60"
              }`}>
                {u.team_badge === "Dono" || u.team_badge === "Dona" ? "👑" : (u.display_name || "?")[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {u.display_name || "Novo usuário"} se cadastrou
                  {u.team_badge && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{u.team_badge}</span>}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground/40 shrink-0">{formatRelativeTime(u.created_at)}</span>
            </div>
          ))}
          {recentUsers.length === 0 && (
            <p className="text-xs text-muted-foreground/40 text-center py-4">Nenhuma atividade recente</p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
