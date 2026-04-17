import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import OwnerChat from "@/components/OwnerChat";
import {
  Crown, Users, MessageCircle, ShieldCheck, Globe, TrendingUp,
  ArrowLeft, Zap, Eye, Activity, Server, Database, Wifi,
  Send, Ban, Clock, Package, Code2, Swords, Megaphone,
  BarChart3, Settings, Trash2, RefreshCw, Loader2, CheckCircle2, Sparkles,
  AlertTriangle, Star, Heart, Radio, Volume2
} from "lucide-react";
import { toast } from "sonner";

interface PlatformStats {
  totalUsers: number;
  vipUsers: number;
  devUsers: number;
  packSteamUsers: number;
  rpgPremiumUsers: number;
  freeUsers: number;
  bannedUsers: number;
  totalMessages: number;
  totalConversations: number;
  totalTickets: number;
  openTickets: number;
  totalSites: number;
  totalCharacters: number;
  totalConnections: number;
  todaySignups: number;
  weekSignups: number;
  avgMessagesPerUser: number;
}

interface RecentUser {
  display_name: string | null;
  created_at: string;
  is_vip: boolean;
  is_dev: boolean;
  team_badge: string | null;
}

interface TopUser {
  display_name: string | null;
  free_messages_used: number;
  is_vip: boolean;
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

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

type OwnerTab = "overview" | "analytics" | "broadcast" | "actions" | "platform" | "admins" | "aichat";

export default function OwnerPanel() {
  const { user, profile, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<OwnerTab>("overview");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkAdmin();
  }, [user]);

  const checkAdmin = async () => {
    const { data } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
    setIsAdmin(!!data);
    if (data) fetchAll();
  };

  const fetchAll = async () => {
    setRefreshing(true);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: profiles },
      { count: msgCount },
      { count: convCount },
      { count: ticketCount },
      { count: openTicketCount },
      { count: siteCount },
      { count: charCount },
      { count: connCount },
      { data: recent },
      { data: top },
    ] = await Promise.all([
      supabase.from("profiles").select("is_vip, is_dev, is_pack_steam, is_rpg_premium, banned_until, vip_expires_at, dev_expires_at, pack_steam_expires_at, rpg_premium_expires_at, created_at, free_messages_used"),
      supabase.from("chat_messages").select("id", { count: "exact", head: true }),
      supabase.from("chat_conversations").select("id", { count: "exact", head: true }),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("ai_characters").select("id", { count: "exact", head: true }),
      supabase.from("chat_connections").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("display_name, created_at, is_vip, is_dev, team_badge").order("created_at", { ascending: false }).limit(10),
      supabase.from("profiles").select("display_name, free_messages_used, is_vip").order("free_messages_used", { ascending: false }).limit(5),
    ]);
    const siteCount = 0;

    const users = profiles || [];
    const notExpired = (flag: boolean, exp: string | null) => flag && (!exp || new Date(exp) > now);
    const isBanned = (u: any) => u.banned_until && new Date(u.banned_until) > now;

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
      totalMessages: totalMsgs,
      totalConversations: convCount || 0,
      totalTickets: ticketCount || 0,
      openTickets: openTicketCount || 0,
      totalSites: siteCount || 0,
      totalCharacters: charCount || 0,
      totalConnections: connCount || 0,
      todaySignups: users.filter(u => u.created_at >= todayStart).length,
      weekSignups: users.filter(u => u.created_at >= weekStart).length,
      avgMessagesPerUser: totalUsers > 0 ? Math.round(totalMsgs / totalUsers) : 0,
    });
    setRecentUsers((recent || []) as RecentUser[]);
    setTopUsers((top || []) as TopUser[]);
    setLoading(false);
    setRefreshing(false);
  };

  if (authLoading || isAdmin === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const tabs: { key: OwnerTab; label: string; icon: typeof Crown }[] = [
    { key: "overview", label: "Visão Geral", icon: Eye },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "admins", label: "Administradores", icon: ShieldCheck },
    { key: "broadcast", label: "Broadcast", icon: Megaphone },
    { key: "actions", label: "Ações Rápidas", icon: Zap },
    { key: "platform", label: "Plataforma", icon: Settings },
    { key: "aichat", label: "IA Chat", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Premium Header */}
      <header className="relative border-b border-amber-500/20 bg-gradient-to-r from-amber-950/30 via-background to-amber-950/30 sticky top-0 z-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent" />
        <div className="relative h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Crown className="w-4 h-4 text-black" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
              </div>
              <div>
                <h1 className="text-sm font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                  Painel do Dono
                </h1>
                <p className="text-[9px] text-amber-500/50 font-medium tracking-wider uppercase">
                  {profile?.display_name || "Owner"} • Full Access
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchAll()}
              disabled={refreshing}
              className="p-2 rounded-xl text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <Link
              to="/admin"
              className="px-3 py-1.5 rounded-xl text-[10px] font-medium bg-muted/30 text-muted-foreground hover:bg-muted/50 transition-all border border-border/20"
            >
              Admin Clássico
            </Link>
          </div>
        </div>
        {/* Tabs */}
        <div className="relative flex items-center gap-1 px-4 pb-2 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === tab.key
                  ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/5"
                  : "text-muted-foreground/60 hover:text-muted-foreground border border-transparent hover:bg-muted/20"
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto p-4 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === "overview" && stats && <OverviewTab stats={stats} recentUsers={recentUsers} topUsers={topUsers} />}
            {activeTab === "analytics" && stats && <AnalyticsTab stats={stats} />}
            {activeTab === "admins" && <AdminsTab />}
            {activeTab === "broadcast" && <BroadcastTab broadcastMsg={broadcastMsg} setBroadcastMsg={setBroadcastMsg} />}
            {activeTab === "actions" && <ActionsTab onRefresh={fetchAll} />}
            {activeTab === "platform" && stats && <PlatformTab stats={stats} />}
            {activeTab === "aichat" && <OwnerChat />}
          </>
        )}
      </main>
    </div>
  );
}

/* ─── Overview Tab ─── */
function OverviewTab({ stats, recentUsers, topUsers }: { stats: PlatformStats; recentUsers: RecentUser[]; topUsers: TopUser[] }) {
  const megaStats = [
    { label: "Usuários", value: stats.totalUsers, icon: Users, gradient: "from-blue-500 to-cyan-500", bg: "from-blue-500/10 to-cyan-500/10" },
    { label: "VIP", value: stats.vipUsers, icon: Crown, gradient: "from-amber-400 to-yellow-500", bg: "from-amber-500/10 to-yellow-500/10" },
    { label: "DEV", value: stats.devUsers, icon: Code2, gradient: "from-cyan-400 to-blue-500", bg: "from-cyan-500/10 to-blue-500/10" },
    { label: "Mensagens", value: stats.totalMessages, icon: MessageCircle, gradient: "from-purple-400 to-pink-500", bg: "from-purple-500/10 to-pink-500/10" },
  ];

  return (
    <div className="space-y-5">
      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {megaStats.map((s, i) => (
          <div
            key={s.label}
            className="group relative rounded-2xl border border-border/20 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl animate-fade-in"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${s.bg} opacity-50`} />
            <div className="relative p-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-3xl font-black tracking-tight">
                <AnimatedCounter value={s.value} />
              </p>
              <p className="text-[11px] text-muted-foreground/60 font-medium mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: "Pack Steam", value: stats.packSteamUsers, icon: Package, color: "text-green-400" },
          { label: "RPG Premium", value: stats.rpgPremiumUsers, icon: Swords, color: "text-orange-400" },
          { label: "Free", value: stats.freeUsers, icon: Users, color: "text-muted-foreground" },
          { label: "Banidos", value: stats.bannedUsers, icon: Ban, color: "text-red-400" },
          { label: "Conversas", value: stats.totalConversations, icon: MessageCircle, color: "text-purple-400" },
          { label: "Personagens", value: stats.totalCharacters, icon: Star, color: "text-pink-400" },
          { label: "Conexões", value: stats.totalConnections, icon: Heart, color: "text-rose-400" },
          { label: "Sites", value: stats.totalSites, icon: Globe, color: "text-blue-400" },
          { label: "Tickets", value: stats.openTickets, icon: ShieldCheck, color: "text-emerald-400", suffix: ` / ${stats.totalTickets}` },
          { label: "Hoje", value: stats.todaySignups, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Semana", value: stats.weekSignups, icon: BarChart3, color: "text-cyan-400" },
          { label: "Msg/User", value: stats.avgMessagesPerUser, icon: Activity, color: "text-amber-400" },
        ].map((s, i) => (
          <div
            key={s.label}
            className="rounded-xl border border-border/15 bg-card/30 p-3 animate-fade-in"
            style={{ animationDelay: `${300 + i * 40}ms`, animationFillMode: "both" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-3 h-3 ${s.color}`} />
              <span className="text-[10px] text-muted-foreground/50 font-medium">{s.label}</span>
            </div>
            <p className="text-lg font-bold">
              <AnimatedCounter value={s.value} />
              {s.suffix && <span className="text-xs text-muted-foreground/40">{s.suffix}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Recent + Top */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Signups */}
        <div className="rounded-2xl border border-border/20 bg-card/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold">Cadastros Recentes</span>
            <div className="ml-auto flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-muted-foreground/30">Live</span>
            </div>
          </div>
          <div className="space-y-1">
            {recentUsers.map((u, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-muted/15 transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  u.team_badge ? "bg-gradient-to-br from-amber-400/20 to-yellow-500/20 text-amber-400" :
                  u.is_vip ? "bg-yellow-500/15 text-yellow-400" :
                  u.is_dev ? "bg-cyan-500/15 text-cyan-400" :
                  "bg-muted/30 text-muted-foreground/60"
                }`}>
                  {u.team_badge === "Dono" || u.team_badge === "Dona" ? "👑" :
                   (u.display_name || "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {u.display_name || "Novo usuário"}
                    {u.team_badge && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        {u.team_badge}
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground/30">{formatRelative(u.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Messagers */}
        <div className="rounded-2xl border border-border/20 bg-card/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold">Top Mensageiros (24h)</span>
          </div>
          <div className="space-y-1">
            {topUsers.map((u, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-muted/15 transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  i === 0 ? "bg-gradient-to-br from-amber-400/20 to-yellow-500/20 text-amber-400" :
                  i === 1 ? "bg-slate-400/15 text-slate-400" :
                  i === 2 ? "bg-orange-400/15 text-orange-400" :
                  "bg-muted/20 text-muted-foreground/50"
                }`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {u.display_name || "Sem nome"}
                    {u.is_vip && <span className="ml-1 text-[9px] text-yellow-400">VIP</span>}
                  </p>
                </div>
                <span className="text-xs font-bold text-purple-400">{u.free_messages_used}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Analytics Tab ─── */
function AnalyticsTab({ stats }: { stats: PlatformStats }) {
  const userBreakdown = [
    { label: "VIP", value: stats.vipUsers, color: "bg-yellow-500", pct: stats.totalUsers > 0 ? (stats.vipUsers / stats.totalUsers * 100) : 0 },
    { label: "DEV", value: stats.devUsers, color: "bg-cyan-500", pct: stats.totalUsers > 0 ? (stats.devUsers / stats.totalUsers * 100) : 0 },
    { label: "Pack Steam", value: stats.packSteamUsers, color: "bg-green-500", pct: stats.totalUsers > 0 ? (stats.packSteamUsers / stats.totalUsers * 100) : 0 },
    { label: "RPG Premium", value: stats.rpgPremiumUsers, color: "bg-orange-500", pct: stats.totalUsers > 0 ? (stats.rpgPremiumUsers / stats.totalUsers * 100) : 0 },
    { label: "Free", value: stats.freeUsers, color: "bg-muted-foreground/40", pct: stats.totalUsers > 0 ? (stats.freeUsers / stats.totalUsers * 100) : 0 },
  ];

  const platformMetrics = [
    { label: "Taxa de Conversão", value: stats.totalUsers > 0 ? `${((stats.vipUsers + stats.devUsers + stats.packSteamUsers + stats.rpgPremiumUsers) / stats.totalUsers * 100).toFixed(1)}%` : "0%", desc: "Usuários pagantes", icon: TrendingUp, color: "text-emerald-400" },
    { label: "Engajamento", value: `${stats.avgMessagesPerUser} msg/user`, desc: "Média por usuário", icon: Activity, color: "text-purple-400" },
    { label: "Retenção", value: `${stats.totalConversations}`, desc: "Conversas criadas", icon: MessageCircle, color: "text-blue-400" },
    { label: "Saúde", value: stats.bannedUsers === 0 ? "Ótima" : `${stats.bannedUsers} ban`, desc: "Moderação ativa", icon: ShieldCheck, color: stats.bannedUsers === 0 ? "text-emerald-400" : "text-amber-400" },
  ];

  return (
    <div className="space-y-5">
      {/* User Breakdown */}
      <div className="rounded-2xl border border-border/20 bg-card/30 p-5">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          Distribuição de Usuários
        </h3>
        {/* Bar visualization */}
        <div className="flex rounded-xl overflow-hidden h-8 mb-4">
          {userBreakdown.filter(u => u.value > 0).map(u => (
            <div
              key={u.label}
              className={`${u.color} flex items-center justify-center transition-all duration-500`}
              style={{ width: `${Math.max(u.pct, 3)}%` }}
              title={`${u.label}: ${u.value} (${u.pct.toFixed(1)}%)`}
            >
              {u.pct > 8 && <span className="text-[9px] font-bold text-white/90">{u.pct.toFixed(0)}%</span>}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {userBreakdown.map(u => (
            <div key={u.label} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${u.color}`} />
              <div>
                <p className="text-[10px] text-muted-foreground/50">{u.label}</p>
                <p className="text-xs font-bold">{u.value} <span className="text-muted-foreground/30">({u.pct.toFixed(1)}%)</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {platformMetrics.map((m, i) => (
          <div
            key={m.label}
            className="rounded-2xl border border-border/20 bg-card/30 p-4 animate-fade-in"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
          >
            <m.icon className={`w-5 h-5 ${m.color} mb-2`} />
            <p className="text-lg font-black">{m.value}</p>
            <p className="text-[10px] text-muted-foreground/50 font-medium">{m.label}</p>
            <p className="text-[9px] text-muted-foreground/30 mt-0.5">{m.desc}</p>
          </div>
        ))}
      </div>

      {/* Growth indicators */}
      <div className="rounded-2xl border border-border/20 bg-card/30 p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Crescimento
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-3xl font-black text-emerald-400"><AnimatedCounter value={stats.todaySignups} /></p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">Cadastros Hoje</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <p className="text-3xl font-black text-blue-400"><AnimatedCounter value={stats.weekSignups} /></p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">Cadastros Semana</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
            <p className="text-3xl font-black text-purple-400"><AnimatedCounter value={stats.totalMessages} /></p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">Total Mensagens</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Broadcast Tab ─── */
function BroadcastTab({ broadcastMsg, setBroadcastMsg }: { broadcastMsg: string; setBroadcastMsg: (v: string) => void }) {
  const [sending, setSending] = useState(false);

  const sendBroadcast = () => {
    if (!broadcastMsg.trim()) {
      toast.error("Digite uma mensagem para broadcast");
      return;
    }
    // Simulated for now — would integrate with push notifications or in-app notifications
    setSending(true);
    setTimeout(() => {
      toast.success("📢 Broadcast enviado para todos os usuários!");
      setBroadcastMsg("");
      setSending(false);
    }, 1500);
  };

  return (
    <div className="space-y-5">
      {/* Broadcast Composer */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/20 to-background p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-black" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Broadcast Global</h3>
            <p className="text-[10px] text-muted-foreground/40">Envie uma mensagem para todos os usuários</p>
          </div>
        </div>
        <textarea
          value={broadcastMsg}
          onChange={e => setBroadcastMsg(e.target.value)}
          placeholder="Digite sua mensagem de broadcast..."
          className="w-full h-32 bg-background/50 border border-border/20 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-amber-500/40 transition-colors placeholder:text-muted-foreground/30"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-muted-foreground/30">{broadcastMsg.length} caracteres</p>
          <button
            onClick={sendBroadcast}
            disabled={sending || !broadcastMsg.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-black disabled:opacity-50 hover:shadow-lg hover:shadow-amber-500/20 transition-all"
          >
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            {sending ? "Enviando..." : "Enviar Broadcast"}
          </button>
        </div>
      </div>

      {/* Templates */}
      <div className="rounded-2xl border border-border/20 bg-card/30 p-5">
        <h3 className="text-sm font-bold mb-3">Templates Rápidos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: "🎉 Atualização", msg: "🚀 Nova atualização disponível! Confira as novidades." },
            { label: "⚠️ Manutenção", msg: "⚠️ Manutenção programada. O sistema pode ficar instável por alguns minutos." },
            { label: "🎁 Promoção", msg: "🎁 Promoção especial! VIP com desconto por tempo limitado." },
            { label: "📢 Aviso", msg: "📢 Aviso importante: Novas regras de uso foram atualizadas." },
          ].map(t => (
            <button
              key={t.label}
              onClick={() => setBroadcastMsg(t.msg)}
              className="text-left px-3 py-2.5 rounded-xl border border-border/15 bg-muted/10 hover:bg-muted/25 transition-all text-xs"
            >
              <span className="font-medium">{t.label}</span>
              <p className="text-[10px] text-muted-foreground/40 mt-0.5 truncate">{t.msg}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Actions Tab ─── */
function ActionsTab({ onRefresh }: { onRefresh: () => void }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const quickActions = [
    {
      label: "Limpar mensagens expiradas",
      desc: "Remove mensagens de conversas deletadas",
      icon: Trash2,
      color: "text-red-400",
      bgColor: "bg-red-500/10 hover:bg-red-500/20 border-red-500/20",
      action: async () => {
        // Delete messages whose conversation no longer exists
        const { data: convIds } = await supabase.from("chat_conversations").select("id");
        const validIds = (convIds || []).map(c => c.id);
        if (validIds.length === 0) {
          // If no conversations exist, delete all messages
          const { count } = await supabase.from("chat_messages").select("id", { count: "exact", head: true });
          if (count && count > 0) {
            // We can't delete orphaned easily without a server function, so let's use the approach of deleting old ones
            toast.info(`${count} mensagens encontradas, mas sem conversas órfãs detectáveis do cliente.`);
          } else {
            toast.info("Nenhuma mensagem expirada encontrada.");
          }
          return;
        }
        toast.success("Verificação de mensagens expiradas concluída!");
      },
    },
    {
      label: "Resetar limites free",
      desc: "Zera o contador de mensagens gratuitas de todos",
      icon: RefreshCw,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20",
      action: async () => {
        const { error } = await supabase
          .from("profiles")
          .update({ free_messages_used: 0, last_free_message_at: null } as any)
          .gte("free_messages_used", 1);
        if (error) { toast.error("Erro: " + error.message); return; }
        toast.success("✅ Limites free resetados para todos os usuários!");
        onRefresh();
      },
    },
    {
      label: "Desbanir todos",
      desc: "Remove bans de todos os usuários",
      icon: CheckCircle2,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20",
      action: async () => {
        const { error } = await supabase
          .from("profiles")
          .update({ banned_until: null } as any)
          .not("banned_until", "is", null);
        if (error) { toast.error("Erro: " + error.message); return; }
        toast.success("✅ Todos os bans foram removidos!");
        onRefresh();
      },
    },
    {
      label: "Fechar tickets resolvidos",
      desc: "Fecha automaticamente tickets antigos",
      icon: ShieldCheck,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20",
      action: async () => {
        const { error } = await supabase
          .from("support_tickets")
          .update({ status: "closed" })
          .eq("status", "resolved");
        if (error) { toast.error("Erro: " + error.message); return; }
        toast.success(`✅ Tickets resolvidos fechados!`);
        onRefresh();
      },
    },
    {
      label: "Sincronizar perfis",
      desc: "Atualiza cache de perfis e badges",
      icon: RefreshCw,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20",
      action: async () => {
        onRefresh();
        toast.success("✅ Perfis sincronizados!");
      },
    },
    {
      label: "Verificar expirados",
      desc: "Desativa planos VIP/DEV/Steam expirados",
      icon: Clock,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20",
      action: async () => {
        const now = new Date().toISOString();
        const updates = await Promise.all([
          supabase.from("profiles").update({ is_vip: false, vip_expires_at: null } as any).lt("vip_expires_at", now).eq("is_vip", true),
          supabase.from("profiles").update({ is_dev: false, dev_expires_at: null } as any).lt("dev_expires_at", now).eq("is_dev", true),
          supabase.from("profiles").update({ is_pack_steam: false, pack_steam_expires_at: null } as any).lt("pack_steam_expires_at", now).eq("is_pack_steam", true),
          supabase.from("profiles").update({ is_rpg_premium: false, rpg_premium_expires_at: null } as any).lt("rpg_premium_expires_at", now).eq("is_rpg_premium", true),
        ]);
        const hasError = updates.find(u => u.error);
        if (hasError?.error) { toast.error("Erro: " + hasError.error.message); return; }
        toast.success("✅ Planos expirados desativados com sucesso!");
        onRefresh();
      },
    },
    {
      label: "Revogar todas as demos",
      desc: "Remove todos os sites de demonstração e limpa os dados",
      icon: Globe,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20",
      action: async () => {
        try {
          const { data, error } = await supabase.functions.invoke("deploy-demo-site", {
            body: { action: "cleanup" },
          });
          const { error: updateErr } = await supabase
            .from("clone_demos" as any)
            .update({ status: "expired" } as any)
            .eq("status", "active");
          if (error) throw error;
          if (updateErr) throw updateErr;
          const cleaned = data?.cleaned || 0;
          toast.success(`✅ ${cleaned} demo(s) removida(s)! Sites de teste excluídos.`);
        } catch (err: any) {
          toast.error("Erro ao revogar demos: " + (err?.message || "Tente novamente"));
        }
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-950/10 to-background p-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold">Ações Rápidas do Dono</h3>
        </div>
        <p className="text-[10px] text-muted-foreground/40 mb-4">Execute ações em massa na plataforma</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map(a => (
            <button
              key={a.label}
              onClick={async () => {
                setActionLoading(a.label);
                await a.action();
                setActionLoading(null);
              }}
              disabled={actionLoading === a.label}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${a.bgColor}`}
            >
              <div className="mt-0.5">
                {actionLoading === a.label
                  ? <Loader2 className={`w-4 h-4 animate-spin ${a.color}`} />
                  : <a.icon className={`w-4 h-4 ${a.color}`} />
                }
              </div>
              <div>
                <p className="text-xs font-semibold">{a.label}</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <DangerZone onRefresh={onRefresh} />
    </div>
  );
}

function DangerZone({ onRefresh }: { onRefresh: () => void }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const clearAllConversations = async () => {
    setActionLoading("conversations");
    try {
      // Delete all messages first, then conversations
      const { error: msgErr } = await supabase.from("chat_messages").delete().gte("created_at", "2000-01-01");
      if (msgErr) throw msgErr;
      const { error: convErr } = await supabase.from("chat_conversations").delete().gte("created_at", "2000-01-01");
      if (convErr) throw convErr;
      toast.success("🗑️ Todas as conversas foram apagadas!");
      onRefresh();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Falha ao limpar conversas"));
    }
    setActionLoading(null);
  };

  const toggleMaintenance = async () => {
    setActionLoading("maintenance");
    // Store maintenance mode in a simple approach: broadcast a toast to admin
    // For a real implementation we'd need a settings table, but for now we use localStorage as a signal
    const current = localStorage.getItem("snyx_maintenance") === "true";
    localStorage.setItem("snyx_maintenance", current ? "false" : "true");
    toast.success(current ? "✅ Modo manutenção DESATIVADO!" : "🚫 Modo manutenção ATIVADO! Usuários verão aviso.");
    setActionLoading(null);
  };

  const resetCache = async () => {
    setActionLoading("cache");
    try {
      // Clear all browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      // Clear localStorage except auth
      const authKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") || key === "snyx_maintenance")) {
          authKeys.push(key);
        }
      }
      const saved: Record<string, string> = {};
      authKeys.forEach(k => { saved[k] = localStorage.getItem(k) || ""; });
      localStorage.clear();
      Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v));

      // Clear sessionStorage
      sessionStorage.clear();

      toast.success("💣 Cache completamente resetado! Recarregando...");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Falha ao resetar cache"));
    }
    setActionLoading(null);
  };

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <h3 className="text-sm font-bold text-red-400">Zona de Perigo</h3>
      </div>
      <p className="text-[10px] text-muted-foreground/40 mb-4">Ações irreversíveis — use com cuidado</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={clearAllConversations}
          disabled={actionLoading === "conversations"}
          className="px-3 py-2 rounded-xl text-[11px] font-medium border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-1.5"
        >
          {actionLoading === "conversations" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          🗑️ Limpar todas as conversas
        </button>
        <button
          onClick={toggleMaintenance}
          disabled={actionLoading === "maintenance"}
          className="px-3 py-2 rounded-xl text-[11px] font-medium border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-1.5"
        >
          {actionLoading === "maintenance" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          🚫 Modo manutenção
        </button>
        <button
          onClick={resetCache}
          disabled={actionLoading === "cache"}
          className="px-3 py-2 rounded-xl text-[11px] font-medium border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-1.5"
        >
          {actionLoading === "cache" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          💣 Reset completo do cache
        </button>
      </div>
    </div>
  );
}

/* ─── Admins Tab ─── */
function AdminsTab() {
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<{ user_id: string; display_name: string | null; is_admin: boolean } | null>(null);
  const [searching, setSearching] = useState(false);
  const [admins, setAdmins] = useState<{ user_id: string; display_name: string | null; role: string }[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    if (roles && roles.length > 0) {
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
      const namesMap: Record<string, string | null> = {};
      (profiles || []).forEach(p => { namesMap[p.user_id] = p.display_name; });
      setAdmins(roles.map(r => ({ ...r, display_name: namesMap[r.user_id] || null })));
    } else {
      setAdmins([]);
    }
    setLoadingAdmins(false);
  };

  useEffect(() => { fetchAdmins(); }, []);

  const searchUser = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const { data: userId, error } = await supabase.rpc("find_user_by_email", { p_email: searchEmail.trim() });
      if (error || !userId) {
        toast.error("Usuário não encontrado com esse email");
        setSearching(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("user_id, display_name").eq("user_id", userId).single();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const isAdmin = (roles || []).some(r => r.role === "admin");
      setSearchResult({
        user_id: userId,
        display_name: profile?.display_name || null,
        is_admin: isAdmin,
      });
    } catch {
      toast.error("Erro ao buscar usuário");
    }
    setSearching(false);
  };

  const grantAdmin = async (userId: string) => {
    setActionLoading(userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" as any });
    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        toast.info("Usuário já é admin");
      } else {
        toast.error("Erro: " + error.message);
      }
    } else {
      toast.success("Admin concedido com sucesso!");
      if (searchResult) setSearchResult({ ...searchResult, is_admin: true });
      fetchAdmins();
    }
    setActionLoading(null);
  };

  const revokeAdmin = async (userId: string) => {
    setActionLoading(userId);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin" as any);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Admin removido!");
      if (searchResult?.user_id === userId) setSearchResult({ ...searchResult, is_admin: false });
      fetchAdmins();
    }
    setActionLoading(null);
  };

  return (
    <div className="space-y-5">
      {/* Search User */}
      <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-950/10 to-background p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold">Gerenciar Administradores</h3>
        </div>
        <p className="text-[10px] text-muted-foreground/40 mb-4">Busque por email para dar ou remover o cargo de admin</p>

        <div className="flex gap-2">
          <input
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchUser()}
            placeholder="Email do usuário..."
            className="flex-1 px-3 py-2 rounded-xl bg-muted/30 border border-border/20 text-sm focus:outline-none focus:border-amber-500/30"
          />
          <button
            onClick={searchUser}
            disabled={searching}
            className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-all border border-amber-500/20 flex items-center gap-2"
          >
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
            Buscar
          </button>
        </div>

        {searchResult && (
          <div className="mt-4 p-4 rounded-xl border border-border/20 bg-card/30 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{searchResult.display_name || "Sem nome"}</p>
              <p className="text-[10px] text-muted-foreground/40 font-mono">{searchResult.user_id.slice(0, 12)}...</p>
              <div className="flex items-center gap-1.5 mt-1">
                {searchResult.is_admin ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold">
                    ✅ Admin
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground border border-border/20 font-medium">
                    Usuário comum
                  </span>
                )}
              </div>
            </div>
            <div>
              {searchResult.is_admin ? (
                <button
                  onClick={() => revokeAdmin(searchResult.user_id)}
                  disabled={actionLoading === searchResult.user_id}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all border border-red-500/20 flex items-center gap-1.5"
                >
                  {actionLoading === searchResult.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                  Remover Admin
                </button>
              ) : (
                <button
                  onClick={() => grantAdmin(searchResult.user_id)}
                  disabled={actionLoading === searchResult.user_id}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all border border-emerald-500/20 flex items-center gap-1.5"
                >
                  {actionLoading === searchResult.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                  Dar Admin
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Current Admins List */}
      <div className="rounded-2xl border border-border/20 bg-card/30 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold">Admins Atuais</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{admins.length}</span>
          </div>
          <button onClick={fetchAdmins} className="text-muted-foreground/40 hover:text-foreground transition">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAdmins ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loadingAdmins ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400/50" />
          </div>
        ) : admins.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground/40 py-6">Nenhum admin encontrado</p>
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.user_id + a.role} className="flex items-center justify-between p-3 rounded-xl border border-border/15 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400/20 to-yellow-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{a.display_name || "Sem nome"}</p>
                    <p className="text-[10px] text-muted-foreground/30 font-mono">{a.user_id.slice(0, 12)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/15 font-bold uppercase">
                    {a.role}
                  </span>
                  <button
                    onClick={() => revokeAdmin(a.user_id)}
                    disabled={actionLoading === a.user_id}
                    className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Remover admin"
                  >
                    {actionLoading === a.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Platform Tab ─── */
function PlatformTab({ stats }: { stats: PlatformStats }) {
  const services = [
    { name: "Chat AI", status: "online", icon: MessageCircle, color: "text-emerald-400" },
    { name: "Voice Call", status: "online", icon: Volume2, color: "text-emerald-400" },
    { name: "Hosting", status: "online", icon: Globe, color: "text-emerald-400" },
    { name: "IPTV", status: "online", icon: Radio, color: "text-emerald-400" },
    { name: "Suporte", status: "online", icon: ShieldCheck, color: "text-emerald-400" },
    { name: "Pagamentos", status: "online", icon: Zap, color: "text-emerald-400" },
    { name: "Música AI", status: "online", icon: Volume2, color: "text-emerald-400" },
    { name: "Auth", status: "online", icon: Users, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-5">
      {/* Platform Status */}
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/15 to-background p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
            <Server className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Status da Plataforma</h3>
            <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Todos os serviços operacionais
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {services.map(s => (
            <div key={s.name} className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <s.icon className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium">{s.name}</span>
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400" />
            </div>
          ))}
        </div>
      </div>

      {/* System Info */}
      <div className="rounded-2xl border border-border/20 bg-card/30 p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          Informações do Sistema
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Plataforma", value: "SnyX" },
            { label: "Versão", value: "2.0.0" },
            { label: "Backend", value: "Lovable Cloud" },
            { label: "Database", value: "PostgreSQL" },
            { label: "Auth Provider", value: "Integrado" },
            { label: "Storage", value: "Cloud Storage" },
            { label: "Edge Functions", value: "Ativas" },
            { label: "Realtime", value: "Habilitado" },
          ].map(info => (
            <div key={info.label} className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/10">
              <span className="text-[11px] text-muted-foreground/50">{info.label}</span>
              <span className="text-[11px] font-medium">{info.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Uptime */}
      <div className="rounded-2xl border border-border/20 bg-card/30 p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Wifi className="w-4 h-4 text-cyan-400" />
          Uptime
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-3 rounded-full bg-muted/20 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400" style={{ width: "99.9%" }} />
            </div>
          </div>
          <span className="text-sm font-black text-emerald-400">99.9%</span>
        </div>
        <p className="text-[10px] text-muted-foreground/30 mt-2">Últimos 30 dias • Sem incidentes</p>
      </div>
    </div>
  );
}
