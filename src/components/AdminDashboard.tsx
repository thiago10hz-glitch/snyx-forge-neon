import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Crown, Code2, MessageCircle, TrendingUp, Ban, Clock, Package,
  ShieldCheck, Globe, Activity, Zap
} from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  vipUsers: number;
  devUsers: number;
  packSteamUsers: number;
  freeUsers: number;
  bannedUsers: number;
  expiredUsers: number;
  totalMessages: number;
  todaySignups: number;
  totalTickets: number;
  openTickets: number;
  totalSites: number;
}

function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, duration]);
  return <>{display.toLocaleString("pt-BR")}</>;
}

function StatCard({ label, value, icon: Icon, color, glowColor, delay }: {
  label: string; value: number; icon: typeof Users; color: string; glowColor: string; delay: number;
}) {
  return (
    <div
      className="group relative rounded-2xl border border-border/20 bg-card/50 backdrop-blur-sm p-4 overflow-hidden transition-all duration-300 hover:border-border/40 hover:scale-[1.02] hover:shadow-lg animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {/* Glow effect */}
      <div
        className="absolute -top-12 -right-12 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
        style={{ background: glowColor }}
      />
      
      <div className="relative flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${color} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight">
            <AnimatedCounter value={value} />
          </p>
          <p className="text-[11px] text-muted-foreground/60 font-medium">{label}</p>
        </div>
      </div>

      {/* Bottom bar indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)` }}
      />
    </div>
  );
}

function ActivityItem({ label, time, icon: Icon, color }: {
  label: string; time: string; icon: typeof Users; color: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/20 transition-colors">
      <div className={`p-1.5 rounded-lg ${color}`}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground/80 truncate">{label}</p>
      </div>
      <span className="text-[10px] text-muted-foreground/40 shrink-0">{time}</span>
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0, vipUsers: 0, devUsers: 0, packSteamUsers: 0,
    freeUsers: 0, bannedUsers: 0, expiredUsers: 0, totalMessages: 0,
    todaySignups: 0, totalTickets: 0, openTickets: 0, totalSites: 0,
  });
  const [recentUsers, setRecentUsers] = useState<{ display_name: string | null; created_at: string; is_vip: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
    // Auto-refresh every 30s
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [
      { data: profiles },
      { count: msgCount },
      { count: ticketCount },
      { count: openTicketCount },
      { count: siteCount },
      { data: recent },
    ] = await Promise.all([
      supabase.from("profiles").select("is_vip, is_dev, is_pack_steam, banned_until, vip_expires_at, dev_expires_at, pack_steam_expires_at, created_at"),
      supabase.from("chat_messages").select("id", { count: "exact", head: true }),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("hosted_sites").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("profiles").select("display_name, created_at, is_vip").order("created_at", { ascending: false }).limit(5),
    ]);

    const users = profiles || [];
    const isBanned = (u: any) => u.banned_until && new Date(u.banned_until) > now;
    const isExpired = (u: any) =>
      (u.is_vip && u.vip_expires_at && new Date(u.vip_expires_at) < now) ||
      (u.is_dev && u.dev_expires_at && new Date(u.dev_expires_at) < now) ||
      (u.is_pack_steam && u.pack_steam_expires_at && new Date(u.pack_steam_expires_at) < now);

    setStats({
      totalUsers: users.length,
      vipUsers: users.filter(u => u.is_vip && !(u.vip_expires_at && new Date(u.vip_expires_at) < now)).length,
      devUsers: users.filter(u => u.is_dev && !(u.dev_expires_at && new Date(u.dev_expires_at) < now)).length,
      packSteamUsers: users.filter(u => u.is_pack_steam && !(u.pack_steam_expires_at && new Date(u.pack_steam_expires_at) < now)).length,
      freeUsers: users.filter(u => !u.is_vip && !u.is_dev && !u.is_pack_steam).length,
      bannedUsers: users.filter(u => isBanned(u)).length,
      expiredUsers: users.filter(u => isExpired(u)).length,
      totalMessages: msgCount || 0,
      todaySignups: users.filter(u => u.created_at >= todayStart).length,
      totalTickets: ticketCount || 0,
      openTickets: openTicketCount || 0,
      totalSites: siteCount || 0,
    });
    setRecentUsers(recent || []);
    setLoading(false);
  };

  if (loading) return null;

  const statCards = [
    { label: "Total Usuários", value: stats.totalUsers, icon: Users, color: "bg-primary/15 text-primary", glowColor: "hsl(var(--primary) / 0.3)" },
    { label: "VIP Ativos", value: stats.vipUsers, icon: Crown, color: "bg-yellow-500/15 text-yellow-400", glowColor: "rgba(234,179,8,0.3)" },
    { label: "DEV Ativos", value: stats.devUsers, icon: Code2, color: "bg-cyan-500/15 text-cyan-400", glowColor: "rgba(34,211,238,0.3)" },
    { label: "Pack Steam", value: stats.packSteamUsers, icon: Package, color: "bg-green-500/15 text-green-400", glowColor: "rgba(34,197,94,0.3)" },
    { label: "Free", value: stats.freeUsers, icon: Users, color: "bg-muted/40 text-muted-foreground", glowColor: "rgba(150,150,150,0.2)" },
    { label: "Banidos", value: stats.bannedUsers, icon: Ban, color: "bg-destructive/15 text-destructive", glowColor: "hsl(var(--destructive) / 0.3)" },
    { label: "Msgs Total", value: stats.totalMessages, icon: MessageCircle, color: "bg-purple-500/15 text-purple-400", glowColor: "rgba(168,85,247,0.3)" },
    { label: "Hoje", value: stats.todaySignups, icon: TrendingUp, color: "bg-emerald-500/15 text-emerald-400", glowColor: "rgba(52,211,153,0.3)" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 60} />
        ))}
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/20 bg-card/50 backdrop-blur-sm p-4 animate-fade-in" style={{ animationDelay: "500ms", animationFillMode: "both" }}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold">Suporte</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold"><AnimatedCounter value={stats.openTickets} /></span>
            <span className="text-[11px] text-muted-foreground/60">abertos de {stats.totalTickets}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border/20 bg-card/50 backdrop-blur-sm p-4 animate-fade-in" style={{ animationDelay: "560ms", animationFillMode: "both" }}>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold">Sites Hospedados</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold"><AnimatedCounter value={stats.totalSites} /></span>
            <span className="text-[11px] text-muted-foreground/60">ativos</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border/20 bg-card/50 backdrop-blur-sm p-4 animate-fade-in" style={{ animationDelay: "620ms", animationFillMode: "both" }}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold">Expirados</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold"><AnimatedCounter value={stats.expiredUsers} /></span>
            <span className="text-[11px] text-muted-foreground/60">precisam renovar</span>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl border border-border/20 bg-card/50 backdrop-blur-sm p-4 animate-fade-in" style={{ animationDelay: "700ms", animationFillMode: "both" }}>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">Atividade Recente</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-muted-foreground/40">Atualiza a cada 30s</span>
          </div>
        </div>
        <div className="space-y-0.5">
          {recentUsers.map((u, i) => (
            <ActivityItem
              key={i}
              label={`${u.display_name || "Novo usuário"} se cadastrou`}
              time={formatRelativeTime(u.created_at)}
              icon={u.is_vip ? Crown : Users}
              color={u.is_vip ? "bg-yellow-500/15 text-yellow-400" : "bg-muted/40 text-muted-foreground"}
            />
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
