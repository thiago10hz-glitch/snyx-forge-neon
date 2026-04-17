import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Crown, MessageCircle, TrendingUp,
  ShieldCheck, Activity, BarChart3, ArrowUpRight,
  Swords, Flame, Trash2, DollarSign, Trophy, ShieldAlert,
  AlertTriangle, Sparkles, Zap, Code2,
} from "lucide-react";
import { toast } from "sonner";

// ====================== TYPES ======================
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
  totalCharacters: number;
  avgMessagesPerUser: number;
  estimatedMRR: number;
}

interface DailyPoint { date: string; signups: number; messages: number }
interface TopUser { display_name: string | null; user_id: string; messages: number; is_vip: boolean; is_dev: boolean; team_badge: string | null }
interface SecurityEvent { id: string; event_type: string; severity: string; created_at: string; user_id: string; resource: string | null }
interface FraudEvent { id: string; attempt_type: string; details: string | null; created_at: string; user_id: string }
interface RecentUser { display_name: string | null; created_at: string; is_vip: boolean; is_dev: boolean; team_badge: string | null }

// ====================== HELPERS ======================
const PRICE = { vip: 19.9, dev: 49.9, pack_steam: 29.9, rpg_premium: 14.9 };

function AnimatedCounter({ value, duration = 1000, prefix = "", decimals = 0 }: { value: number; duration?: number; prefix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, duration]);
  return <>{prefix}{decimals > 0 ? display.toFixed(decimals).replace(".", ",") : Math.round(display).toLocaleString("pt-BR")}</>;
}

// SVG line chart for 14-day trend
function TrendChart({ data, color = "hsl(var(--primary))", label }: { data: number[]; color?: string; label: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100, h = 30;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  const total = data.reduce((a, b) => a + b, 0);
  const last = data[data.length - 1] || 0;
  const prev = data[data.length - 2] || 0;
  const delta = prev > 0 ? ((last - prev) / prev) * 100 : 0;

  return (
    <div className="relative">
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold">{label}</p>
          <p className="text-2xl font-black tracking-tight">{total.toLocaleString("pt-BR")}</p>
        </div>
        <div className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${
          delta >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
        }`}>
          {delta >= 0 ? "↗" : "↘"} {Math.abs(delta).toFixed(0)}%
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#grad-${label})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
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

// ====================== COMPONENT ======================
export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0, vipUsers: 0, devUsers: 0, packSteamUsers: 0, rpgPremiumUsers: 0,
    freeUsers: 0, bannedUsers: 0, expiredUsers: 0, totalMessages: 0,
    todaySignups: 0, weekSignups: 0, totalTickets: 0, openTickets: 0,
    totalCharacters: 0, avgMessagesPerUser: 0, estimatedMRR: 0,
  });
  const [dailyPoints, setDailyPoints] = useState<DailyPoint[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [fraudEvents, setFraudEvents] = useState<FraudEvent[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
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
    const fourteenDaysStart = new Date(now.getTime() - 14 * 86400000).toISOString();

    const [
      { data: profiles },
      { count: msgCount },
      { count: ticketCount },
      { count: openTicketCount },
      { count: charCount },
      { data: recent },
      { data: signups14 },
      { data: messages14 },
      { data: topProfiles },
      { data: secLogs },
      { data: fraud },
    ] = await Promise.all([
      supabase.from("profiles").select("is_vip, is_dev, is_pack_steam, is_rpg_premium, banned_until, vip_expires_at, dev_expires_at, pack_steam_expires_at, rpg_premium_expires_at, created_at, free_messages_used"),
      supabase.from("chat_messages").select("id", { count: "exact", head: true }),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("ai_characters").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("display_name, created_at, is_vip, is_dev, team_badge").order("created_at", { ascending: false }).limit(8),
      supabase.from("profiles").select("created_at").gte("created_at", fourteenDaysStart),
      supabase.from("chat_messages").select("created_at").gte("created_at", fourteenDaysStart),
      supabase.from("profiles").select("user_id, display_name, free_messages_used, is_vip, is_dev, team_badge").order("free_messages_used", { ascending: false }).limit(6),
      supabase.from("security_audit_log").select("id, event_type, severity, created_at, user_id, resource").order("created_at", { ascending: false }).limit(6),
      supabase.from("fraud_attempts").select("id, attempt_type, details, created_at, user_id").order("created_at", { ascending: false }).limit(6),
    ]);

    const users = profiles || [];
    const isBanned = (u: any) => u.banned_until && new Date(u.banned_until) > now;
    const notExpired = (flag: boolean, exp: string | null) => flag && (!exp || new Date(exp) > now);
    const isExpired = (u: any) =>
      (u.is_vip && u.vip_expires_at && new Date(u.vip_expires_at) < now) ||
      (u.is_dev && u.dev_expires_at && new Date(u.dev_expires_at) < now) ||
      (u.is_pack_steam && u.pack_steam_expires_at && new Date(u.pack_steam_expires_at) < now);

    const totalMsgs = msgCount || 0;
    const totalUsers = users.length;
    const vipActive = users.filter(u => notExpired(u.is_vip, u.vip_expires_at)).length;
    const devActive = users.filter(u => notExpired(u.is_dev, u.dev_expires_at)).length;
    const packActive = users.filter(u => notExpired(u.is_pack_steam, u.pack_steam_expires_at)).length;
    const rpgActive = users.filter(u => notExpired(u.is_rpg_premium, u.rpg_premium_expires_at)).length;
    const mrr = vipActive * PRICE.vip + devActive * PRICE.dev + packActive * PRICE.pack_steam + rpgActive * PRICE.rpg_premium;

    // Build 14-day buckets
    const buckets: DailyPoint[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      buckets.push({ date: key, signups: 0, messages: 0 });
    }
    const bucketMap = Object.fromEntries(buckets.map(b => [b.date, b]));
    (signups14 || []).forEach((r: any) => {
      const k = r.created_at.slice(0, 10);
      if (bucketMap[k]) bucketMap[k].signups++;
    });
    (messages14 || []).forEach((r: any) => {
      const k = r.created_at.slice(0, 10);
      if (bucketMap[k]) bucketMap[k].messages++;
    });

    setStats({
      totalUsers,
      vipUsers: vipActive,
      devUsers: devActive,
      packSteamUsers: packActive,
      rpgPremiumUsers: rpgActive,
      freeUsers: users.filter(u => !u.is_vip && !u.is_dev && !u.is_pack_steam && !u.is_rpg_premium).length,
      bannedUsers: users.filter(u => isBanned(u)).length,
      expiredUsers: users.filter(u => isExpired(u)).length,
      totalMessages: totalMsgs,
      todaySignups: users.filter(u => u.created_at >= todayStart).length,
      weekSignups: users.filter(u => u.created_at >= weekStart).length,
      totalTickets: ticketCount || 0,
      openTickets: openTicketCount || 0,
      totalCharacters: charCount || 0,
      avgMessagesPerUser: totalUsers > 0 ? Math.round(totalMsgs / totalUsers) : 0,
      estimatedMRR: mrr,
    });
    setDailyPoints(buckets);
    setTopUsers((topProfiles || []).filter((u: any) => u.free_messages_used > 0).map((u: any) => ({
      display_name: u.display_name, user_id: u.user_id, messages: u.free_messages_used,
      is_vip: u.is_vip, is_dev: u.is_dev, team_badge: u.team_badge,
    })));
    setSecurityEvents((secLogs || []) as any);
    setFraudEvents((fraud || []) as any);
    setRecentUsers((recent || []) as any);
    setLoading(false);
  };

  const paidUsers = stats.vipUsers + stats.devUsers + stats.packSteamUsers + stats.rpgPremiumUsers;
  const conversionRate = stats.totalUsers > 0 ? ((paidUsers / stats.totalUsers) * 100).toFixed(1) : "0";

  const userBreakdown = useMemo(() => [
    { label: "VIP", value: stats.vipUsers, color: "bg-yellow-500" },
    { label: "DEV", value: stats.devUsers, color: "bg-cyan-500" },
    { label: "Pack Steam", value: stats.packSteamUsers, color: "bg-green-500" },
    { label: "RPG Premium", value: stats.rpgPremiumUsers, color: "bg-orange-500" },
    { label: "Free", value: stats.freeUsers, color: "bg-muted-foreground/30" },
  ], [stats]);

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

  const heroCards = [
    { label: "Receita estimada (MRR)", value: stats.estimatedMRR, icon: DollarSign, gradient: "from-emerald-500 via-green-500 to-teal-500", glow: "emerald", prefix: "R$ ", decimals: 2, sub: `${paidUsers} pagantes ativos` },
    { label: "Total de usuários", value: stats.totalUsers, icon: Users, gradient: "from-blue-600 via-indigo-500 to-cyan-500", glow: "blue", sub: `+${stats.todaySignups} hoje · +${stats.weekSignups} semana` },
    { label: "Mensagens enviadas", value: stats.totalMessages, icon: MessageCircle, gradient: "from-purple-500 via-fuchsia-500 to-pink-500", glow: "purple", sub: `${stats.avgMessagesPerUser} msg/usuário` },
    { label: "Conversão", value: parseFloat(conversionRate), icon: Sparkles, gradient: "from-amber-500 via-orange-500 to-red-500", glow: "amber", decimals: 1, sub: `${paidUsers}/${stats.totalUsers} usuários` },
  ];

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <p className="text-[11px] text-muted-foreground font-medium">Tempo real · atualiza a cada 30s</p>
        </div>
        <button
          onClick={handleCleanup}
          disabled={cleaning}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition disabled:opacity-50"
        >
          <Trash2 className="w-3 h-3" />
          {cleaning ? "Limpando..." : "Limpar storage"}
        </button>
      </div>

      {/* === HERO STATS === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {heroCards.map((s, i) => (
          <div key={s.label}
            className="group relative rounded-2xl border border-border/15 bg-gradient-to-br from-card/80 to-card/30 backdrop-blur-xl p-4 overflow-hidden transition-all duration-500 hover:border-border/40 hover:-translate-y-0.5 hover:shadow-2xl animate-fade-in"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}>
            <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${s.gradient} opacity-15 group-hover:opacity-30 blur-3xl transition-all duration-700`} />
            <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-${s.glow}-500/40 to-transparent`} />
            <div className="relative">
              <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-3 shadow-lg shadow-black/30 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                <s.icon className="w-5 h-5 text-white drop-shadow" />
              </div>
              <p className="text-2xl font-black tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                <AnimatedCounter value={s.value} prefix={s.prefix} decimals={s.decimals} />
                {s.label === "Conversão" && <span className="text-base text-muted-foreground/50 ml-0.5">%</span>}
              </p>
              <p className="text-[11px] text-muted-foreground/70 font-medium mt-0.5">{s.label}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-emerald-400/70" /> {s.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* === GROWTH CHARTS === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/15 bg-card/50 backdrop-blur-xl p-5 animate-fade-in" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-xs font-bold">Cadastros · 14 dias</span>
          </div>
          <TrendChart data={dailyPoints.map(d => d.signups)} color="hsl(217 91% 60%)" label="signups" />
        </div>
        <div className="rounded-2xl border border-border/15 bg-card/50 backdrop-blur-xl p-5 animate-fade-in" style={{ animationDelay: "260ms", animationFillMode: "both" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <MessageCircle className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <span className="text-xs font-bold">Mensagens · 14 dias</span>
          </div>
          <TrendChart data={dailyPoints.map(d => d.messages)} color="hsl(280 91% 65%)" label="messages" />
        </div>
      </div>

      {/* === USER BREAKDOWN + REVENUE === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/15 bg-card/50 backdrop-blur-xl p-5 animate-fade-in" style={{ animationDelay: "320ms", animationFillMode: "both" }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold">Distribuição de usuários</span>
          </div>
          <div className="flex rounded-xl overflow-hidden h-7 mb-4 shadow-inner">
            {userBreakdown.filter(u => u.value > 0).map(u => {
              const pct = stats.totalUsers > 0 ? (u.value / stats.totalUsers) * 100 : 0;
              return (
                <div key={u.label} className={`${u.color} flex items-center justify-center transition-all duration-1000`}
                  style={{ width: `${Math.max(pct, 3)}%` }} title={`${u.label}: ${u.value}`}>
                  {pct > 8 && <span className="text-[9px] font-bold text-white/95">{pct.toFixed(0)}%</span>}
                </div>
              );
            })}
          </div>
          <MiniBar data={userBreakdown} maxValue={Math.max(...userBreakdown.map(u => u.value), 1)} />
        </div>

        {/* Revenue breakdown */}
        <div className="rounded-2xl border border-border/15 bg-gradient-to-br from-emerald-950/20 via-card/50 to-card/30 backdrop-blur-xl p-5 animate-fade-in" style={{ animationDelay: "380ms", animationFillMode: "both" }}>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold">Receita por plano (MRR estimado)</span>
          </div>
          <div className="space-y-2.5">
            {[
              { label: "VIP", count: stats.vipUsers, price: PRICE.vip, color: "bg-yellow-500", icon: Crown },
              { label: "DEV", count: stats.devUsers, price: PRICE.dev, color: "bg-cyan-500", icon: Code2 },
              { label: "Pack Steam", count: stats.packSteamUsers, price: PRICE.pack_steam, color: "bg-green-500", icon: Zap },
              { label: "RPG Premium", count: stats.rpgPremiumUsers, price: PRICE.rpg_premium, color: "bg-orange-500", icon: Swords },
            ].map((p) => {
              const total = p.count * p.price;
              const pct = stats.estimatedMRR > 0 ? (total / stats.estimatedMRR) * 100 : 0;
              return (
                <div key={p.label} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <p.icon className="w-3 h-3 text-muted-foreground/70" />
                      <span className="text-[11px] font-semibold">{p.label}</span>
                      <span className="text-[10px] text-muted-foreground/50">{p.count} × R$ {p.price.toFixed(2).replace(".", ",")}</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400">R$ {total.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
                    <div className={`h-full rounded-full ${p.color} transition-all duration-700`} style={{ width: `${Math.max(pct, 1)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-border/10 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-bold">Total mensal</span>
            <span className="text-xl font-black text-emerald-400">R$ <AnimatedCounter value={stats.estimatedMRR} decimals={2} /></span>
          </div>
        </div>
      </div>

      {/* === TOP USERS + SECURITY === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top users by activity */}
        <div className="rounded-2xl border border-border/15 bg-card/50 backdrop-blur-xl p-5 animate-fade-in" style={{ animationDelay: "440ms", animationFillMode: "both" }}>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold">Top usuários · mais mensagens</span>
          </div>
          <div className="space-y-1.5">
            {topUsers.length === 0 && (
              <p className="text-[11px] text-muted-foreground/50 text-center py-6">Sem dados ainda</p>
            )}
            {topUsers.map((u, i) => {
              const max = topUsers[0]?.messages || 1;
              const pct = (u.messages / max) * 100;
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
              return (
                <div key={u.user_id} className="flex items-center gap-3 py-2 px-2.5 rounded-xl hover:bg-muted/15 transition-colors group">
                  <span className={`text-xs font-black w-6 text-center shrink-0 ${i < 3 ? "" : "text-muted-foreground/40"}`}>{medal}</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    u.team_badge ? "bg-gradient-to-br from-amber-400/20 to-yellow-500/20 text-amber-400" :
                    u.is_dev ? "bg-cyan-500/15 text-cyan-400" :
                    u.is_vip ? "bg-yellow-500/15 text-yellow-400" :
                    "bg-muted/30 text-muted-foreground/60"
                  }`}>
                    {(u.display_name || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{u.display_name || "Anônimo"}</p>
                    <div className="h-1 rounded-full bg-muted/15 overflow-hidden mt-0.5">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-[11px] font-bold tabular-nums shrink-0">{u.messages}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Security & fraud feed */}
        <div className="rounded-2xl border border-border/15 bg-gradient-to-br from-red-950/15 via-card/50 to-card/30 backdrop-blur-xl p-5 animate-fade-in" style={{ animationDelay: "500ms", animationFillMode: "both" }}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold">Segurança & fraude</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold">{securityEvents.length + fraudEvents.length}</span>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {[...fraudEvents.map(f => ({
              kind: "fraud" as const, id: f.id, type: f.attempt_type, detail: f.details, date: f.created_at, severity: "warning",
            })), ...securityEvents.map(s => ({
              kind: "audit" as const, id: s.id, type: s.event_type, detail: s.resource, date: s.created_at, severity: s.severity,
            }))]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 10)
              .map((e) => {
                const isFraud = e.kind === "fraud";
                const sevColor = isFraud || e.severity === "critical" ? "text-red-400 bg-red-500/15 border-red-500/20"
                  : e.severity === "warning" ? "text-amber-400 bg-amber-500/15 border-amber-500/20"
                  : "text-muted-foreground bg-muted/20 border-border/15";
                return (
                  <div key={e.kind + e.id} className="flex items-start gap-2.5 py-2 px-2.5 rounded-xl hover:bg-muted/15 transition-colors">
                    <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${sevColor}`}>
                      {isFraud ? <AlertTriangle className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold truncate">{e.type}</p>
                      {e.detail && <p className="text-[10px] text-muted-foreground/50 truncate">{e.detail}</p>}
                    </div>
                    <span className="text-[9px] text-muted-foreground/40 shrink-0 mt-1">{formatRelativeTime(e.date)}</span>
                  </div>
                );
              })}
            {securityEvents.length === 0 && fraudEvents.length === 0 && (
              <p className="text-[11px] text-muted-foreground/50 text-center py-6">✅ Tudo limpo · sem eventos recentes</p>
            )}
          </div>
        </div>
      </div>

      {/* === RECENT ACTIVITY === */}
      <div className="rounded-2xl border border-border/15 bg-card/50 backdrop-blur-xl p-5 animate-fade-in" style={{ animationDelay: "560ms", animationFillMode: "both" }}>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold">Cadastros recentes</span>
          <span className="ml-auto text-[10px] text-muted-foreground/40">{recentUsers.length} novos</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {recentUsers.map((u, i) => (
            <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-muted/15 transition-colors">
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
                  {u.display_name || "Novo usuário"}
                  {u.team_badge && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{u.team_badge}</span>}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground/40 shrink-0">{formatRelativeTime(u.created_at)}</span>
            </div>
          ))}
          {recentUsers.length === 0 && (
            <p className="text-xs text-muted-foreground/40 text-center py-4 col-span-2">Nenhuma atividade recente</p>
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
