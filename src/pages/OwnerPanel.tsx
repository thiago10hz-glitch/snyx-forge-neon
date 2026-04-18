import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import OwnerChat from "@/components/OwnerChat";
import {
  Crown, Users, MessageCircle, ShieldCheck, Globe, TrendingUp,
  ArrowLeft, Zap, Eye, Activity, Server, Database,
  Send, Ban, Clock, Package, Megaphone,
  BarChart3, Trash2, RefreshCw, Loader2, CheckCircle2, Sparkles,
  AlertTriangle, Star, Radio, Volume2, Menu, X,
  DollarSign, KeyRound, FileText, Cpu, Flame, Search,
  ArrowUpRight, Gauge, ChevronLeft, ChevronRight, LifeBuoy, Settings2,
} from "lucide-react";
import { ChatSettings } from "@/components/ChatSettings";
import ApiClientsManager from "@/components/ApiClientsManager";
import ApiLiveMonitor from "@/components/ApiLiveMonitor";
import { toast } from "sonner";

/* ════════════════════════════════════════════════════════════════
 *  PAINEL DO DONO — SnyX Command Center v3
 *  Dark neon vermelho · Bento grid · Live data
 * ════════════════════════════════════════════════════════════════ */

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
  totalCharacters: number;
  todaySignups: number;
  weekSignups: number;
  avgMessagesPerUser: number;
  apiClients: number;
  apiRequests: number;
  monthlyRevenue: number;
  pendingApplications: number;
}

interface RecentUser {
  user_id: string;
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

function AnimatedCounter({ value, duration = 1000, prefix = "", suffix = "" }: { value: number; duration?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, duration]);
  return <>{prefix}{display.toLocaleString("pt-BR")}{suffix}</>;
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

type OwnerTab =
  | "operation" | "revenue" | "system"
  | "broadcast" | "admins" | "aichat";

// Sub-abas de "operation" (Visão Geral + Tempo Real + Analytics)
type OperationView = "overview" | "live" | "analytics";
// Sub-abas de "system" (Saúde + Serviços + Ações)
type SystemView = "health" | "platform" | "actions";

export default function OwnerPanel() {
  const { user, profile, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<OwnerTab>("operation");
  const [operationView, setOperationView] = useState<OperationView>("overview");
  const [systemView, setSystemView] = useState<SystemView>("health");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [botSettingsOpen, setBotSettingsOpen] = useState(false);

  useEffect(() => { if (user) checkAdmin(); }, [user]);

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
      { count: charCount },
      { data: recent },
      { data: top },
      { count: apiClientCount },
      { data: apiClientsData },
      { count: pendingApps },
    ] = await Promise.all([
      supabase.from("profiles").select("is_vip, is_dev, is_pack_steam, is_rpg_premium, banned_until, vip_expires_at, dev_expires_at, pack_steam_expires_at, rpg_premium_expires_at, created_at, free_messages_used"),
      supabase.from("chat_messages").select("id", { count: "exact", head: true }),
      supabase.from("chat_conversations").select("id", { count: "exact", head: true }),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("ai_characters").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("user_id, display_name, created_at, is_vip, is_dev, team_badge").order("created_at", { ascending: false }).limit(10),
      supabase.from("profiles").select("display_name, free_messages_used, is_vip").order("free_messages_used", { ascending: false }).limit(5),
      supabase.from("api_clients").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("api_clients").select("daily_used, monthly_used"),
      supabase.from("api_key_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    const users = profiles || [];
    const notExpired = (flag: boolean, exp: string | null) => flag && (!exp || new Date(exp) > now);
    const isBanned = (u: any) => u.banned_until && new Date(u.banned_until) > now;

    const totalMsgs = msgCount || 0;
    const totalUsers = users.length;
    const vipCount = users.filter(u => notExpired(u.is_vip, u.vip_expires_at)).length;
    const devCount = users.filter(u => notExpired(u.is_dev, u.dev_expires_at)).length;
    const packCount = users.filter(u => notExpired(u.is_pack_steam, u.pack_steam_expires_at)).length;
    const rpgCount = users.filter(u => notExpired(u.is_rpg_premium, u.rpg_premium_expires_at)).length;

    // Estimativa simples de receita mensal (pode ser ajustada com preços reais)
    const monthlyRevenue = vipCount * 19.9 + packCount * 29.9 + rpgCount * 14.9;
    const apiRequests = (apiClientsData || []).reduce((acc: number, c: any) => acc + (c.monthly_used || 0), 0);

    setStats({
      totalUsers,
      vipUsers: vipCount,
      devUsers: devCount,
      packSteamUsers: packCount,
      rpgPremiumUsers: rpgCount,
      freeUsers: users.filter(u => !u.is_vip && !u.is_dev && !u.is_pack_steam && !u.is_rpg_premium).length,
      bannedUsers: users.filter(u => isBanned(u)).length,
      totalMessages: totalMsgs,
      totalConversations: convCount || 0,
      totalTickets: ticketCount || 0,
      openTickets: openTicketCount || 0,
      totalCharacters: charCount || 0,
      todaySignups: users.filter(u => u.created_at >= todayStart).length,
      weekSignups: users.filter(u => u.created_at >= weekStart).length,
      avgMessagesPerUser: totalUsers > 0 ? Math.round(totalMsgs / totalUsers) : 0,
      apiClients: apiClientCount || 0,
      apiRequests,
      monthlyRevenue,
      pendingApplications: pendingApps || 0,
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

  const navGroups: { label: string; tabs: { key: OwnerTab; label: string; icon: typeof Crown; badge?: number }[] }[] = [
    {
      label: "Operação",
      tabs: [
        { key: "operation", label: "Operação", icon: Eye },
      ],
    },
    {
      label: "Negócio",
      tabs: [
        { key: "revenue", label: "Receita & API", icon: DollarSign, badge: stats?.pendingApplications },
        { key: "broadcast", label: "Broadcast", icon: Megaphone },
      ],
    },
    {
      label: "Sistema",
      tabs: [
        { key: "system", label: "Sistema", icon: Server },
      ],
    },
    {
      label: "Pessoas & IA",
      tabs: [
        { key: "admins", label: "Admins", icon: ShieldCheck },
        { key: "aichat", label: "IA Chat", icon: Sparkles },
      ],
    },
  ];

  const allTabs = navGroups.flatMap(g => g.tabs);
  const currentTab = allTabs.find(t => t.key === activeTab);

  // Sub-abas das seções fundidas
  const operationViews: { key: OperationView; label: string; icon: typeof Crown }[] = [
    { key: "overview", label: "Visão Geral", icon: Eye },
    { key: "live", label: "Tempo Real", icon: Activity },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
  ];
  const systemViews: { key: SystemView; label: string; icon: typeof Crown }[] = [
    { key: "health", label: "Saúde", icon: Gauge },
    { key: "platform", label: "Serviços", icon: Server },
    { key: "actions", label: "Ações", icon: Zap },
  ];

  return (
    <div className="min-h-screen text-foreground flex relative overflow-hidden bg-[#0a0612]">
      {/* Royal aurora — violet + gold ambient backdrop (Owner) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 w-[640px] h-[640px] rounded-full bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.28),transparent_60%)] blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[720px] h-[720px] rounded-full bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.18),transparent_60%)] blur-3xl" />
        <div className="absolute bottom-[-200px] left-1/4 w-[560px] h-[560px] rounded-full bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.14),transparent_65%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,6,18,0.4)_0%,rgba(10,6,18,0.85)_100%)]" />
        <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }} />
      </div>
      {/* Ambient red glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-[100dvh] shrink-0 z-50 md:z-10
        bg-gradient-to-b from-card/90 via-background/95 to-background/95 backdrop-blur-2xl
        border-r border-primary/15 flex flex-col transition-all duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${sidebarCollapsed ? 'w-16' : 'w-[260px]'}
      `}>
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-3 border-b border-primary/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-primary-glow to-primary flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.5)]">
                <Crown className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-black bg-gradient-to-r from-primary-glow via-primary to-primary-glow bg-clip-text text-transparent tracking-tight truncate">
                  SnyX Command
                </h1>
                <p className="text-[9px] text-primary/60 font-bold tracking-[0.2em] uppercase truncate">Owner Console</p>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30">
            <X className="w-4 h-4" />
          </button>
          <button onClick={() => setSidebarCollapsed(c => !c)} className="hidden md:flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30" title={sidebarCollapsed ? "Expandir" : "Recolher"}>
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Owner pill */}
        {!sidebarCollapsed && (
          <div className="px-3 pt-3">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center text-sm font-black text-primary-glow shadow-inner">
                {(profile?.display_name || "O")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate flex items-center gap-1">
                  {profile?.display_name || "Owner"}
                  <Crown className="w-3 h-3 text-primary-glow" />
                </p>
                <p className="text-[9px] text-primary/70 truncate font-semibold">{profile?.team_badge || "Dono"} · Full Access</p>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-3 overflow-y-auto">
          {navGroups.map(group => (
            <div key={group.label} className="space-y-1">
              {!sidebarCollapsed && <p className="px-3 pt-1 pb-1 text-[9px] font-black text-primary/40 uppercase tracking-[0.2em]">{group.label}</p>}
              {group.tabs.map(tab => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setSidebarOpen(false); }}
                    title={sidebarCollapsed ? tab.label : undefined}
                    className={`w-full flex items-center gap-3 ${sidebarCollapsed ? "justify-center px-0" : "px-3"} py-2.5 rounded-xl text-sm font-medium transition-all relative group ${
                      active
                        ? "bg-gradient-to-r from-primary/25 via-primary/10 to-transparent text-primary-glow border border-primary/30 shadow-[0_0_25px_-8px_hsl(var(--primary)/0.7)]"
                        : "text-muted-foreground/70 hover:text-foreground hover:bg-card/50 border border-transparent"
                    }`}
                  >
                    {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />}
                    <tab.icon className={`w-4 h-4 shrink-0 ${active ? "drop-shadow-[0_0_4px_hsl(var(--primary))]" : ""}`} />
                    {!sidebarCollapsed && <span className="flex-1 text-left">{tab.label}</span>}
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary-glow font-black border border-primary/30 min-w-[18px] text-center ${sidebarCollapsed ? "absolute -top-0.5 -right-0.5" : ""}`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-primary/10 space-y-1 shrink-0">
          <Link to="/admin" title={sidebarCollapsed ? "Admin Console" : undefined} className={`w-full flex items-center gap-3 ${sidebarCollapsed ? "justify-center px-0" : "px-3"} py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-card/50 transition-all`}>
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />{!sidebarCollapsed && <span>Admin Console</span>}
          </Link>
          <Link to="/" title={sidebarCollapsed ? "Voltar" : undefined} className={`w-full flex items-center gap-3 ${sidebarCollapsed ? "justify-center px-0" : "px-3"} py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-card/50 transition-all`}>
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />{!sidebarCollapsed && <span>Voltar ao app</span>}
          </Link>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-2 border-b border-primary/10 bg-background/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card/50">
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              {currentTab && <currentTab.icon className="w-4 h-4 text-primary-glow drop-shadow-[0_0_4px_hsl(var(--primary))] shrink-0" />}
              <h2 className="text-sm font-bold truncate">{currentTab?.label}</h2>
            </div>
          </div>

          {/* Stats strip */}
          <div className="hidden lg:flex items-center gap-2">
            {stats && [
              { label: "Receita", value: `R$${Math.round(stats.monthlyRevenue)}`, icon: DollarSign, color: "text-emerald-400" },
              { label: "Users", value: stats.totalUsers.toLocaleString("pt-BR"), icon: Users, color: "text-cyan-400" },
              { label: "Tickets", value: stats.openTickets, icon: LifeBuoy, color: "text-amber-400" },
              { label: "API Pend.", value: stats.pendingApplications, icon: KeyRound, color: "text-primary-glow" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card/40 border border-primary/10">
                <s.icon className={`w-3 h-3 ${s.color}`} />
                <span className="text-[10px] text-muted-foreground/70 font-medium">{s.label}</span>
                <span className={`text-xs font-black ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400">OK</span>
            </div>
            <button
              onClick={() => setBotSettingsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary-glow hover:bg-primary/20 hover:border-primary/40 transition-all"
              title="Personalizar bot"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">BOT</span>
            </button>
            <button
              onClick={() => fetchAll()}
              disabled={refreshing}
              className="p-2 rounded-xl text-primary/70 hover:text-primary-glow hover:bg-primary/10 transition-all"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        <ChatSettings open={botSettingsOpen} onClose={() => setBotSettingsOpen(false)} />

        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === "operation" && stats && (
                <div className="space-y-4">
                  {/* Sub-tabs internas */}
                  <div className="flex gap-1 p-1 rounded-xl bg-card/40 border border-primary/10 w-fit">
                    {operationViews.map(v => {
                      const active = operationView === v.key;
                      return (
                        <button key={v.key} onClick={() => setOperationView(v.key)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? "bg-primary/20 text-primary-glow border border-primary/30 shadow-[0_0_12px_-4px_hsl(var(--primary))]" : "text-muted-foreground/70 hover:text-foreground"}`}>
                          <v.icon className="w-3.5 h-3.5" />
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                  {operationView === "overview" && <OverviewTab stats={stats} recentUsers={recentUsers} topUsers={topUsers} />}
                  {operationView === "live" && <LiveTab stats={stats} />}
                  {operationView === "analytics" && <AnalyticsTab stats={stats} />}
                </div>
              )}
              {activeTab === "system" && stats && (
                <div className="space-y-4">
                  <div className="flex gap-1 p-1 rounded-xl bg-card/40 border border-primary/10 w-fit">
                    {systemViews.map(v => {
                      const active = systemView === v.key;
                      return (
                        <button key={v.key} onClick={() => setSystemView(v.key)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? "bg-primary/20 text-primary-glow border border-primary/30 shadow-[0_0_12px_-4px_hsl(var(--primary))]" : "text-muted-foreground/70 hover:text-foreground"}`}>
                          <v.icon className="w-3.5 h-3.5" />
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                  {systemView === "health" && <HealthTab stats={stats} />}
                  {systemView === "platform" && <PlatformTab stats={stats} />}
                  {systemView === "actions" && <ActionsTab onRefresh={fetchAll} />}
                </div>
              )}
              {activeTab === "revenue" && stats && <RevenueTab stats={stats} />}
              {activeTab === "broadcast" && <BroadcastTab />}
              {activeTab === "admins" && <AdminsTab />}
              {activeTab === "aichat" && <OwnerChat />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 *  CARD BASE
 * ═══════════════════════════════════════════════════════════════ */
function NeonCard({ children, className = "", glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`relative rounded-2xl border border-primary/15 bg-gradient-to-br from-card/60 via-card/30 to-background/60 backdrop-blur-sm overflow-hidden ${glow ? "shadow-[0_0_30px_-12px_hsl(var(--primary)/0.4)]" : ""} ${className}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 *  OVERVIEW — Bento Grid
 * ═══════════════════════════════════════════════════════════════ */
function OverviewTab({ stats, recentUsers, topUsers }: { stats: PlatformStats; recentUsers: RecentUser[]; topUsers: TopUser[] }) {
  const conversionRate = stats.totalUsers > 0
    ? ((stats.vipUsers + stats.devUsers + stats.packSteamUsers + stats.rpgPremiumUsers) / stats.totalUsers * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Hero — Receita + Métricas chave */}
      <div className="grid grid-cols-12 gap-4">
        {/* Big revenue card */}
        <NeonCard glow className="col-span-12 lg:col-span-6 p-6 animate-fade-in">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] text-primary/60 uppercase">Receita estimada / mês</p>
              <p className="text-4xl md:text-5xl font-black mt-2 bg-gradient-to-br from-primary-glow via-primary to-primary-glow bg-clip-text text-transparent drop-shadow-[0_0_18px_hsl(var(--primary)/0.4)]">
                <AnimatedCounter value={stats.monthlyRevenue} prefix="R$ " />
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                  <ArrowUpRight className="w-3 h-3" /> {conversionRate.toFixed(1)}%
                </span>
                <span className="text-[10px] text-muted-foreground/60">conversão pagantes</span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
              <DollarSign className="w-7 h-7 text-primary-glow" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-4 border-t border-primary/10">
            {[
              { l: "VIP", v: stats.vipUsers, c: "text-yellow-400" },
              { l: "DEV", v: stats.devUsers, c: "text-cyan-400" },
              { l: "Steam", v: stats.packSteamUsers, c: "text-emerald-400" },
              { l: "RPG", v: stats.rpgPremiumUsers, c: "text-pink-400" },
            ].map(s => (
              <div key={s.l} className="text-center">
                <p className={`text-lg font-black ${s.c}`}><AnimatedCounter value={s.v} /></p>
                <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider">{s.l}</p>
              </div>
            ))}
          </div>
        </NeonCard>

        {/* 4 mini stats */}
        {[
          { label: "Usuários", value: stats.totalUsers, icon: Users, color: "from-blue-500/20 to-cyan-500/10", iconColor: "text-cyan-400", trend: stats.todaySignups },
          { label: "Mensagens", value: stats.totalMessages, icon: MessageCircle, color: "from-purple-500/20 to-pink-500/10", iconColor: "text-purple-400" },
          { label: "API Clients", value: stats.apiClients, icon: KeyRound, color: "from-primary/20 to-primary/5", iconColor: "text-primary-glow" },
          { label: "Personagens", value: stats.totalCharacters, icon: Star, color: "from-pink-500/20 to-rose-500/10", iconColor: "text-pink-400" },
        ].map((s, i) => (
          <NeonCard key={s.label} className="col-span-6 lg:col-span-3 p-4 group hover:scale-[1.02] transition-transform animate-fade-in" >
            <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-50`} />
            <div className="relative">
              <div className="flex items-start justify-between mb-3">
                <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                {s.trend !== undefined && s.trend > 0 && (
                  <span className="text-[9px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
                    <ArrowUpRight className="w-2.5 h-2.5" />+{s.trend}
                  </span>
                )}
              </div>
              <p className="text-2xl font-black tracking-tight"><AnimatedCounter value={s.value} /></p>
              <p className="text-[10px] text-muted-foreground/60 font-medium mt-0.5">{s.label}</p>
            </div>
          </NeonCard>
        ))}
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: "Free", value: stats.freeUsers, icon: Users, c: "text-muted-foreground" },
          { label: "Banidos", value: stats.bannedUsers, icon: Ban, c: "text-destructive" },
          { label: "Conversas", value: stats.totalConversations, icon: MessageCircle, c: "text-purple-400" },
          { label: "Tickets", value: stats.openTickets, icon: ShieldCheck, c: "text-emerald-400", suffix: ` / ${stats.totalTickets}` },
          { label: "Hoje", value: stats.todaySignups, icon: TrendingUp, c: "text-emerald-400" },
          { label: "Msg/User", value: stats.avgMessagesPerUser, icon: Activity, c: "text-primary-glow" },
        ].map((s, i) => (
          <div key={s.label} className="rounded-xl border border-primary/10 bg-card/30 p-3 hover:border-primary/25 transition-colors animate-fade-in" style={{ animationDelay: `${200 + i * 30}ms` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className={`w-3 h-3 ${s.c}`} />
              <span className="text-[10px] text-muted-foreground/60 font-medium">{s.label}</span>
            </div>
            <p className="text-base font-bold">
              <AnimatedCounter value={s.value} />
              {s.suffix && <span className="text-xs text-muted-foreground/40">{s.suffix}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Two columns: recent + top */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NeonCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold">Cadastros Recentes</span>
            <div className="ml-auto flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-wider">Live</span>
            </div>
          </div>
          <div className="space-y-1">
            {recentUsers.length === 0 && <p className="text-xs text-muted-foreground/40 text-center py-4">Sem cadastros recentes</p>}
            {recentUsers.map((u, i) => (
              <div key={u.user_id || i} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-primary/5 transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  u.team_badge ? "bg-gradient-to-br from-primary/30 to-primary/10 text-primary-glow" :
                  u.is_vip ? "bg-yellow-500/15 text-yellow-400" :
                  u.is_dev ? "bg-cyan-500/15 text-cyan-400" :
                  "bg-muted/30 text-muted-foreground/60"
                }`}>
                  {u.team_badge === "Dono" || u.team_badge === "Dona" ? "👑" : (u.display_name || "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {u.display_name || "Novo usuário"}
                    {u.team_badge && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary-glow border border-primary/20">{u.team_badge}</span>
                    )}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">{formatRelative(u.created_at)}</span>
              </div>
            ))}
          </div>
        </NeonCard>

        <NeonCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-primary-glow" />
            <span className="text-xs font-bold">Top Mensageiros (24h)</span>
          </div>
          <div className="space-y-1">
            {topUsers.length === 0 && <p className="text-xs text-muted-foreground/40 text-center py-4">Sem dados ainda</p>}
            {topUsers.map((u, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl hover:bg-primary/5 transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  i === 0 ? "bg-gradient-to-br from-yellow-400/20 to-amber-500/10 text-yellow-400" :
                  i === 1 ? "bg-slate-400/15 text-slate-300" :
                  i === 2 ? "bg-orange-400/15 text-orange-400" :
                  "bg-muted/20 text-muted-foreground/50"
                }`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {u.display_name || "Sem nome"}
                    {u.is_vip && <Crown className="inline w-2.5 h-2.5 ml-1 text-yellow-400" />}
                  </p>
                </div>
                <span className="text-xs font-black text-primary-glow">{u.free_messages_used}</span>
              </div>
            ))}
          </div>
        </NeonCard>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 *  LIVE — Tempo real
 * ═══════════════════════════════════════════════════════════════ */
function LiveTab({ stats }: { stats: PlatformStats }) {
  const [feed, setFeed] = useState<{ id: string; type: string; text: string; ts: number }[]>([]);

  useEffect(() => {
    const channels = [
      supabase.channel("owner-live-msgs").on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p: any) => {
        setFeed(prev => [{ id: p.new.id, type: "msg", text: `Nova mensagem (${p.new.role})`, ts: Date.now() }, ...prev].slice(0, 50));
      }).subscribe(),
      supabase.channel("owner-live-users").on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, (p: any) => {
        setFeed(prev => [{ id: p.new.id, type: "user", text: `Novo cadastro: ${p.new.display_name || "anon"}`, ts: Date.now() }, ...prev].slice(0, 50));
      }).subscribe(),
      supabase.channel("owner-live-tickets").on("postgres_changes", { event: "INSERT", schema: "public", table: "support_tickets" }, (p: any) => {
        setFeed(prev => [{ id: p.new.id, type: "ticket", text: `Novo ticket: ${p.new.subject}`, ts: Date.now() }, ...prev].slice(0, 50));
      }).subscribe(),
    ];
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, []);

  const iconFor = (t: string) => t === "msg" ? MessageCircle : t === "user" ? Users : ShieldCheck;
  const colorFor = (t: string) => t === "msg" ? "text-purple-400" : t === "user" ? "text-emerald-400" : "text-amber-400";

  return (
    <div className="space-y-5">
      {/* Live counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "Conexões", v: stats.totalUsers, i: Users, c: "text-cyan-400" },
          { l: "Conversas Ativas", v: stats.totalConversations, i: MessageCircle, c: "text-purple-400" },
          { l: "Tickets Abertos", v: stats.openTickets, i: ShieldCheck, c: "text-emerald-400" },
          { l: "API Reqs/Mês", v: stats.apiRequests, i: Cpu, c: "text-primary-glow" },
        ].map(s => (
          <NeonCard key={s.l} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <s.i className={`w-4 h-4 ${s.c}`} />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-2xl font-black"><AnimatedCounter value={s.v} /></p>
            <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">{s.l}</p>
          </NeonCard>
        ))}
      </div>

      {/* Live feed */}
      <NeonCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative">
            <Activity className="w-4 h-4 text-primary-glow" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <h3 className="text-sm font-bold">Feed ao Vivo</h3>
          <span className="ml-auto text-[10px] text-muted-foreground/50 font-mono">{feed.length} eventos</span>
        </div>
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {feed.length === 0 && (
            <div className="text-center py-12">
              <Radio className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2 animate-pulse" />
              <p className="text-xs text-muted-foreground/50">Aguardando atividade da plataforma...</p>
            </div>
          )}
          {feed.map(ev => {
            const Icon = iconFor(ev.type);
            return (
              <div key={ev.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-card/30 border border-primary/5 hover:border-primary/15 transition-colors animate-fade-in">
                <Icon className={`w-3.5 h-3.5 ${colorFor(ev.type)}`} />
                <span className="text-xs flex-1 truncate">{ev.text}</span>
                <span className="text-[9px] text-muted-foreground/40 font-mono">{formatRelative(new Date(ev.ts).toISOString())}</span>
              </div>
            );
          })}
        </div>
      </NeonCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 *  ANALYTICS
 * ═══════════════════════════════════════════════════════════════ */
function AnalyticsTab({ stats }: { stats: PlatformStats }) {
  const breakdown = [
    { label: "VIP", value: stats.vipUsers, color: "bg-yellow-500", glow: "shadow-[0_0_8px_rgb(234_179_8/0.5)]" },
    { label: "DEV", value: stats.devUsers, color: "bg-cyan-500", glow: "shadow-[0_0_8px_rgb(6_182_212/0.5)]" },
    { label: "Pack Steam", value: stats.packSteamUsers, color: "bg-emerald-500", glow: "shadow-[0_0_8px_rgb(16_185_129/0.5)]" },
    { label: "RPG", value: stats.rpgPremiumUsers, color: "bg-pink-500", glow: "shadow-[0_0_8px_rgb(236_72_153/0.5)]" },
    { label: "Free", value: stats.freeUsers, color: "bg-muted-foreground/40", glow: "" },
  ].map(b => ({ ...b, pct: stats.totalUsers > 0 ? (b.value / stats.totalUsers * 100) : 0 }));

  const metrics = [
    { label: "Conversão", value: `${stats.totalUsers > 0 ? ((stats.vipUsers + stats.devUsers + stats.packSteamUsers + stats.rpgPremiumUsers) / stats.totalUsers * 100).toFixed(1) : 0}%`, desc: "Pagantes / Total", icon: TrendingUp, c: "text-emerald-400" },
    { label: "Engajamento", value: `${stats.avgMessagesPerUser}`, desc: "msgs / usuário", icon: Activity, c: "text-purple-400" },
    { label: "Conversas", value: `${stats.totalConversations}`, desc: "Total criadas", icon: MessageCircle, c: "text-cyan-400" },
    { label: "Saúde", value: stats.bannedUsers === 0 ? "✓" : `${stats.bannedUsers}`, desc: stats.bannedUsers === 0 ? "Sem bans" : "Banidos", icon: ShieldCheck, c: stats.bannedUsers === 0 ? "text-emerald-400" : "text-destructive" },
  ];

  return (
    <div className="space-y-5">
      <NeonCard className="p-5">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary-glow" />
          Distribuição de Usuários
        </h3>
        <div className="flex rounded-xl overflow-hidden h-10 mb-4 border border-primary/10">
          {breakdown.filter(u => u.value > 0).map(u => (
            <div key={u.label} className={`${u.color} ${u.glow} flex items-center justify-center transition-all`} style={{ width: `${Math.max(u.pct, 3)}%` }} title={`${u.label}: ${u.value}`}>
              {u.pct > 8 && <span className="text-[10px] font-black text-white drop-shadow">{u.pct.toFixed(0)}%</span>}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {breakdown.map(u => (
            <div key={u.label} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${u.color}`} />
              <div>
                <p className="text-[10px] text-muted-foreground/60">{u.label}</p>
                <p className="text-xs font-bold">{u.value} <span className="text-muted-foreground/40 font-normal">({u.pct.toFixed(1)}%)</span></p>
              </div>
            </div>
          ))}
        </div>
      </NeonCard>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m, i) => (
          <NeonCard key={m.label} className="p-4 animate-fade-in" >
            <m.icon className={`w-5 h-5 ${m.c} mb-2`} />
            <p className="text-2xl font-black">{m.value}</p>
            <p className="text-[10px] text-muted-foreground/60 font-medium">{m.label}</p>
            <p className="text-[9px] text-muted-foreground/40 mt-0.5">{m.desc}</p>
          </NeonCard>
        ))}
      </div>

      <NeonCard className="p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> Crescimento
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { v: stats.todaySignups, l: "Hoje", c: "text-emerald-400", bg: "from-emerald-500/15 to-emerald-500/5" },
            { v: stats.weekSignups, l: "Semana", c: "text-cyan-400", bg: "from-cyan-500/15 to-cyan-500/5" },
            { v: stats.totalMessages, l: "Total Mensagens", c: "text-primary-glow", bg: "from-primary/15 to-primary/5" },
          ].map(s => (
            <div key={s.l} className={`text-center p-4 rounded-xl bg-gradient-to-br ${s.bg} border border-primary/10`}>
              <p className={`text-3xl font-black ${s.c}`}><AnimatedCounter value={s.v} /></p>
              <p className="text-[11px] text-muted-foreground/60 mt-1 font-medium">{s.l}</p>
            </div>
          ))}
        </div>
      </NeonCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 *  REVENUE & API
 * ═══════════════════════════════════════════════════════════════ */
function RevenueTab({ stats }: { stats: PlatformStats }) {
  const [apps, setApps] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("api_key_applications").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("api_plans").select("*").eq("is_active", true).order("price_brl"),
    ]).then(([{ data: a }, { data: p }]) => {
      setApps(a || []);
      setPlans(p || []);
      setLoadingApps(false);
    });
  }, []);

  const planRevenue = [
    { name: "VIP", users: stats.vipUsers, price: 19.9, color: "from-yellow-500/20 to-amber-500/10", iconColor: "text-yellow-400" },
    { name: "Pack Steam", users: stats.packSteamUsers, price: 29.9, color: "from-emerald-500/20 to-green-500/10", iconColor: "text-emerald-400" },
    { name: "RPG Premium", users: stats.rpgPremiumUsers, price: 14.9, color: "from-pink-500/20 to-rose-500/10", iconColor: "text-pink-400" },
    { name: "DEV", users: stats.devUsers, price: 0, color: "from-cyan-500/20 to-blue-500/10", iconColor: "text-cyan-400" },
  ];

  return (
    <div className="space-y-5">
      {/* Revenue overview */}
      <NeonCard glow className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-primary/60 uppercase">Receita Mensal Recorrente (MRR)</p>
            <p className="text-5xl font-black mt-2 bg-gradient-to-br from-primary-glow to-primary bg-clip-text text-transparent">
              <AnimatedCounter value={stats.monthlyRevenue} prefix="R$ " />
            </p>
            <p className="text-xs text-muted-foreground/60 mt-2">Anual estimado: <span className="text-primary-glow font-bold">R$ {(stats.monthlyRevenue * 12).toLocaleString("pt-BR")}</span></p>
          </div>
          <DollarSign className="w-10 h-10 text-primary-glow opacity-40" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {planRevenue.map(p => (
            <div key={p.name} className={`relative rounded-xl border border-primary/10 p-4 overflow-hidden`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${p.color} opacity-50`} />
              <div className="relative">
                <p className={`text-xs font-bold ${p.iconColor} mb-1`}>{p.name}</p>
                <p className="text-2xl font-black"><AnimatedCounter value={p.users} /></p>
                <p className="text-[10px] text-muted-foreground/60">usuários ativos</p>
                <p className="text-[10px] mt-2 font-bold text-emerald-400">R$ {(p.users * p.price).toFixed(2)}/mês</p>
              </div>
            </div>
          ))}
        </div>
      </NeonCard>

      {/* API Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <NeonCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-primary-glow" />
            <h3 className="text-xs font-bold">API Clients</h3>
          </div>
          <p className="text-3xl font-black text-primary-glow"><AnimatedCounter value={stats.apiClients} /></p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Chaves ativas</p>
        </NeonCard>
        <NeonCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold">Requests / Mês</h3>
          </div>
          <p className="text-3xl font-black text-cyan-400"><AnimatedCounter value={stats.apiRequests} /></p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Chamadas de API</p>
        </NeonCard>
        <NeonCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold">Aplicações Pendentes</h3>
          </div>
          <p className="text-3xl font-black text-amber-400"><AnimatedCounter value={stats.pendingApplications} /></p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Aguardando revisão</p>
        </NeonCard>
      </div>

      {/* Live Monitor — IPs/origens em tempo real */}
      <NeonCard className="p-5">
        <ApiLiveMonitor />
      </NeonCard>

      {/* Gerenciador de API Keys */}
      <NeonCard className="p-5">
        <ApiClientsManager />
      </NeonCard>

      {/* Plans table */}
      <NeonCard className="p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary-glow" /> Planos API
        </h3>
        <div className="space-y-2">
          {plans.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-primary/10 hover:border-primary/25 transition-colors">
              <div>
                <p className="text-sm font-bold">{p.name}</p>
                <p className="text-[10px] text-muted-foreground/60">{p.daily_request_limit}/dia · {p.monthly_request_limit}/mês · {p.rate_limit_per_minute} rpm</p>
              </div>
              <p className="text-lg font-black text-primary-glow">R$ {Number(p.price_brl).toFixed(2)}</p>
            </div>
          ))}
          {plans.length === 0 && <p className="text-xs text-muted-foreground/40 text-center py-4">Nenhum plano ativo</p>}
        </div>
      </NeonCard>

      {/* Recent applications */}
      <NeonCard className="p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" /> Aplicações Recentes
        </h3>
        {loadingApps ? <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto my-6" /> : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {apps.length === 0 && <p className="text-xs text-muted-foreground/40 text-center py-4">Nenhuma aplicação ainda</p>}
            {apps.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-primary/10 hover:bg-card/40 transition">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{a.full_name}</p>
                  <p className="text-[10px] text-muted-foreground/60 truncate">{a.company_or_project}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  a.status === "approved" ? "bg-emerald-500/15 text-emerald-400" :
                  a.status === "rejected" ? "bg-destructive/15 text-destructive" :
                  "bg-amber-500/15 text-amber-400"
                }`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </NeonCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 *  HEALTH — Saúde do sistema
 * ═══════════════════════════════════════════════════════════════ */
function HealthTab({ stats }: { stats: PlatformStats }) {
  const [providerKeys, setProviderKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);

  useEffect(() => {
    supabase.from("ai_provider_keys").select("provider, label, status, daily_used, daily_limit, total_used").then(({ data }) => {
      setProviderKeys(data || []);
      setLoadingKeys(false);
    });
  }, []);

  const healthScore = useMemo(() => {
    let score = 100;
    if (stats.bannedUsers > 0) score -= Math.min(stats.bannedUsers * 2, 20);
    if (stats.openTickets > 5) score -= 10;
    const errorKeys = providerKeys.filter(k => k.status === "error" || k.status === "exhausted").length;
    score -= errorKeys * 15;
    return Math.max(0, score);
  }, [stats, providerKeys]);

  const scoreColor = healthScore >= 90 ? "text-emerald-400" : healthScore >= 70 ? "text-amber-400" : "text-destructive";
  const scoreLabel = healthScore >= 90 ? "Excelente" : healthScore >= 70 ? "Atenção" : "Crítico";

  return (
    <div className="space-y-5">
      {/* Health score */}
      <NeonCard glow className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="text-center md:text-left">
            <p className="text-[10px] font-black tracking-[0.2em] text-primary/60 uppercase">Saúde do Sistema</p>
            <p className={`text-7xl font-black ${scoreColor} drop-shadow-[0_0_18px_currentColor] mt-2`}>{healthScore}</p>
            <p className={`text-sm font-bold ${scoreColor}`}>{scoreLabel}</p>
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            {[
              { l: "DB Conexão", v: "OK", c: "text-emerald-400", i: Database },
              { l: "API Keys ativas", v: providerKeys.filter(k => k.status === "active").length, c: "text-emerald-400", i: KeyRound },
              { l: "Tickets pend.", v: stats.openTickets, c: stats.openTickets > 5 ? "text-amber-400" : "text-emerald-400", i: ShieldCheck },
              { l: "Banidos", v: stats.bannedUsers, c: stats.bannedUsers > 0 ? "text-amber-400" : "text-emerald-400", i: Ban },
            ].map(s => (
              <div key={s.l} className="flex items-center gap-3 p-3 rounded-xl border border-primary/10 bg-card/30">
                <s.i className={`w-4 h-4 ${s.c}`} />
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground/60">{s.l}</p>
                  <p className={`text-base font-black ${s.c}`}>{s.v}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </NeonCard>

      {/* AI Provider Keys */}
      <NeonCard className="p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary-glow" /> Provedores de IA
        </h3>
        {loadingKeys ? <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto my-4" /> : (
          <div className="space-y-2">
            {providerKeys.length === 0 && <p className="text-xs text-muted-foreground/40 text-center py-4">Nenhuma chave configurada</p>}
            {providerKeys.map((k, i) => {
              const usage = k.daily_limit > 0 ? (k.daily_used / k.daily_limit * 100) : 0;
              return (
                <div key={i} className="p-3 rounded-xl border border-primary/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        k.status === "active" ? "bg-emerald-400 animate-pulse" :
                        k.status === "exhausted" ? "bg-amber-400" : "bg-destructive"
                      }`} />
                      <p className="text-xs font-bold">{k.label}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground font-mono uppercase">{k.provider}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/60">{k.daily_used}/{k.daily_limit}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div className={`h-full transition-all ${
                      usage > 90 ? "bg-destructive" : usage > 70 ? "bg-amber-400" : "bg-emerald-400"
                    }`} style={{ width: `${Math.min(usage, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </NeonCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 *  BROADCAST
 * ═══════════════════════════════════════════════════════════════ */
function BroadcastTab() {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  const send = () => {
    if (!msg.trim()) { toast.error("Digite uma mensagem"); return; }
    setSending(true);
    setTimeout(() => {
      toast.success("📢 Broadcast enviado!");
      setMsg("");
      setSending(false);
    }, 1200);
  };

  return (
    <div className="space-y-5">
      <NeonCard glow className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.5)]">
            <Megaphone className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Broadcast Global</h3>
            <p className="text-[10px] text-muted-foreground/60">Mensagem para todos os usuários</p>
          </div>
        </div>
        <textarea
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Digite sua mensagem..."
          className="w-full h-32 bg-background/60 border border-primary/15 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/40"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-muted-foreground/40 font-mono">{msg.length} chars</p>
          <button
            onClick={send}
            disabled={sending || !msg.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-primary to-primary-glow text-primary-foreground disabled:opacity-50 hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)] transition-all"
          >
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </NeonCard>

      <NeonCard className="p-5">
        <h3 className="text-sm font-bold mb-3">Templates Rápidos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { l: "🎉 Atualização", m: "🚀 Nova atualização disponível! Confira as novidades." },
            { l: "⚠️ Manutenção", m: "⚠️ Manutenção programada. Sistema pode ficar instável." },
            { l: "🎁 Promoção", m: "🎁 Promoção especial! VIP com desconto por tempo limitado." },
            { l: "📢 Aviso", m: "📢 Novas regras de uso foram atualizadas." },
          ].map(t => (
            <button key={t.l} onClick={() => setMsg(t.m)} className="text-left px-3 py-2.5 rounded-xl border border-primary/10 bg-card/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-xs">
              <span className="font-bold">{t.l}</span>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">{t.m}</p>
            </button>
          ))}
        </div>
      </NeonCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 *  ACTIONS
 * ═══════════════════════════════════════════════════════════════ */
function ActionsTab({ onRefresh }: { onRefresh: () => void }) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const actions = [
    {
      label: "Resetar limites free", desc: "Zera contador de mensagens gratuitas", icon: RefreshCw, color: "text-cyan-400",
      action: async () => {
        const { error } = await supabase.from("profiles").update({ free_messages_used: 0, last_free_message_at: null } as any).gte("free_messages_used", 1);
        if (error) return toast.error("Erro: " + error.message);
        toast.success("✅ Limites resetados!"); onRefresh();
      },
    },
    {
      label: "Desbanir todos", desc: "Remove bans de todos os usuários", icon: CheckCircle2, color: "text-emerald-400",
      action: async () => {
        const { error } = await supabase.from("profiles").update({ banned_until: null } as any).not("banned_until", "is", null);
        if (error) return toast.error("Erro: " + error.message);
        toast.success("✅ Bans removidos!"); onRefresh();
      },
    },
    {
      label: "Fechar tickets resolvidos", desc: "Fecha tickets com status resolved", icon: ShieldCheck, color: "text-amber-400",
      action: async () => {
        const { error } = await supabase.from("support_tickets").update({ status: "closed" }).eq("status", "resolved");
        if (error) return toast.error("Erro: " + error.message);
        toast.success("✅ Tickets fechados!"); onRefresh();
      },
    },
    {
      label: "Verificar planos expirados", desc: "Desativa VIP/DEV/Steam/RPG vencidos", icon: Clock, color: "text-orange-400",
      action: async () => {
        const now = new Date().toISOString();
        const updates = await Promise.all([
          supabase.from("profiles").update({ is_vip: false, vip_expires_at: null } as any).lt("vip_expires_at", now).eq("is_vip", true),
          supabase.from("profiles").update({ is_dev: false, dev_expires_at: null } as any).lt("dev_expires_at", now).eq("is_dev", true),
          supabase.from("profiles").update({ is_pack_steam: false, pack_steam_expires_at: null } as any).lt("pack_steam_expires_at", now).eq("is_pack_steam", true),
          supabase.from("profiles").update({ is_rpg_premium: false, rpg_premium_expires_at: null } as any).lt("rpg_premium_expires_at", now).eq("is_rpg_premium", true),
        ]);
        const err = updates.find(u => u.error);
        if (err?.error) return toast.error("Erro: " + err.error.message);
        toast.success("✅ Planos expirados desativados!"); onRefresh();
      },
    },
    {
      label: "Reset uso diário API", desc: "Zera daily_used das chaves IA", icon: Cpu, color: "text-primary-glow",
      action: async () => {
        const { error } = await supabase.rpc("reset_daily_ai_usage");
        if (error) return toast.error("Erro: " + error.message);
        toast.success("✅ Uso diário resetado!");
      },
    },
    {
      label: "Sincronizar dados", desc: "Refaz busca de stats e perfis", icon: RefreshCw, color: "text-purple-400",
      action: async () => { onRefresh(); toast.success("✅ Sincronizado!"); },
    },
  ];

  return (
    <div className="space-y-5">
      <NeonCard className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-primary-glow" />
          <h3 className="text-sm font-bold">Ações Rápidas</h3>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mb-4">Operações em massa na plataforma</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {actions.map(a => (
            <button
              key={a.label}
              onClick={async () => { setLoadingKey(a.label); await a.action(); setLoadingKey(null); }}
              disabled={loadingKey === a.label}
              className="flex items-start gap-3 p-4 rounded-xl border border-primary/10 bg-card/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
            >
              <div className="mt-0.5">
                {loadingKey === a.label
                  ? <Loader2 className={`w-4 h-4 animate-spin ${a.color}`} />
                  : <a.icon className={`w-4 h-4 ${a.color}`} />}
              </div>
              <div>
                <p className="text-xs font-bold">{a.label}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </NeonCard>

      <DangerZone onRefresh={onRefresh} />
    </div>
  );
}

function DangerZone({ onRefresh }: { onRefresh: () => void }) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const clearConvs = async () => {
    if (!confirm("⚠️ Apagar TODAS as conversas? Irreversível.")) return;
    setLoadingKey("conv");
    try {
      await supabase.from("chat_messages").delete().gte("created_at", "2000-01-01");
      await supabase.from("chat_conversations").delete().gte("created_at", "2000-01-01");
      toast.success("🗑️ Conversas apagadas!"); onRefresh();
    } catch (e: any) { toast.error("Erro: " + e?.message); }
    setLoadingKey(null);
  };

  const toggleMaintenance = () => {
    const cur = localStorage.getItem("snyx_maintenance") === "true";
    localStorage.setItem("snyx_maintenance", cur ? "false" : "true");
    toast.success(cur ? "✅ Manutenção OFF" : "🚫 Manutenção ON");
  };

  const resetCache = async () => {
    setLoadingKey("cache");
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
      const auth: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sb-")) auth[k] = localStorage.getItem(k) || "";
      }
      localStorage.clear();
      Object.entries(auth).forEach(([k, v]) => localStorage.setItem(k, v));
      sessionStorage.clear();
      toast.success("💣 Cache resetado! Recarregando...");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) { toast.error("Erro: " + e?.message); }
    setLoadingKey(null);
  };

  return (
    <div className="rounded-2xl border border-destructive/25 bg-gradient-to-br from-destructive/10 to-background p-5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-destructive/50 to-transparent" />
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
        <h3 className="text-sm font-bold text-destructive">Zona de Perigo</h3>
      </div>
      <p className="text-[10px] text-muted-foreground/50 mb-4">Ações irreversíveis — use com cuidado</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={clearConvs} disabled={loadingKey === "conv"} className="px-3 py-2 rounded-xl text-[11px] font-bold border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all flex items-center gap-1.5">
          {loadingKey === "conv" && <Loader2 className="w-3 h-3 animate-spin" />}
          🗑️ Limpar conversas
        </button>
        <button onClick={toggleMaintenance} className="px-3 py-2 rounded-xl text-[11px] font-bold border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all">
          🚫 Modo manutenção
        </button>
        <button onClick={resetCache} disabled={loadingKey === "cache"} className="px-3 py-2 rounded-xl text-[11px] font-bold border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all flex items-center gap-1.5">
          {loadingKey === "cache" && <Loader2 className="w-3 h-3 animate-spin" />}
          💣 Reset cache
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 *  PLATFORM — serviços
 * ═══════════════════════════════════════════════════════════════ */
function PlatformTab({ stats }: { stats: PlatformStats }) {
  const services = [
    { name: "Chat AI", status: "online", icon: MessageCircle },
    { name: "Voice", status: "online", icon: Volume2 },
    { name: "Hosting", status: "online", icon: Globe },
    { name: "IPTV", status: "online", icon: Radio },
    { name: "Suporte", status: "online", icon: ShieldCheck },
    { name: "Pagamentos", status: "online", icon: Zap },
    { name: "Música AI", status: "online", icon: Volume2 },
    { name: "Auth", status: "online", icon: Users },
  ];

  return (
    <div className="space-y-5">
      <NeonCard glow className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-[0_0_15px_rgb(16_185_129/0.4)]">
            <Server className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Serviços da Plataforma</h3>
            <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Todos operacionais
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {services.map(s => (
            <div key={s.name} className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <s.icon className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold">{s.name}</span>
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          ))}
        </div>
      </NeonCard>

      <NeonCard className="p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" /> Sistema
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { l: "Plataforma", v: "SnyX" },
            { l: "Versão", v: "3.0.0" },
            { l: "Backend", v: "Lovable Cloud" },
            { l: "Database", v: "PostgreSQL" },
            { l: "Auth", v: "Integrado" },
            { l: "Storage", v: "Cloud" },
            { l: "Total Usuários", v: stats.totalUsers.toLocaleString("pt-BR") },
            { l: "Total Mensagens", v: stats.totalMessages.toLocaleString("pt-BR") },
          ].map(s => (
            <div key={s.l} className="flex items-center justify-between p-3 rounded-xl border border-primary/10 bg-card/30">
              <span className="text-xs text-muted-foreground/70">{s.l}</span>
              <span className="text-xs font-bold font-mono">{s.v}</span>
            </div>
          ))}
        </div>
      </NeonCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 *  ADMINS
 * ═══════════════════════════════════════════════════════════════ */
function AdminsTab() {
  const [searchEmail, setSearchEmail] = useState("");
  const [result, setResult] = useState<{ user_id: string; display_name: string | null; is_admin: boolean } | null>(null);
  const [searching, setSearching] = useState(false);
  const [admins, setAdmins] = useState<{ user_id: string; display_name: string | null; role: string }[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    if (roles && roles.length > 0) {
      const ids = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
      const map: Record<string, string | null> = {};
      (profiles || []).forEach(p => { map[p.user_id] = p.display_name; });
      setAdmins(roles.map(r => ({ ...r, display_name: map[r.user_id] || null })));
    } else setAdmins([]);
    setLoadingAdmins(false);
  };
  useEffect(() => { fetchAdmins(); }, []);

  const search = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true); setResult(null);
    try {
      const { data: uid, error } = await supabase.rpc("find_user_by_email", { p_email: searchEmail.trim() });
      if (error || !uid) { toast.error("Usuário não encontrado"); setSearching(false); return; }
      const { data: profile } = await supabase.from("profiles").select("user_id, display_name").eq("user_id", uid).single();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      setResult({ user_id: uid, display_name: profile?.display_name || null, is_admin: (roles || []).some(r => r.role === "admin") });
    } catch { toast.error("Erro na busca"); }
    setSearching(false);
  };

  const grant = async (uid: string) => {
    setActionId(uid);
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" as any });
    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) toast.info("Já é admin");
      else toast.error("Erro: " + error.message);
    } else {
      toast.success("✅ Admin concedido!");
      if (result) setResult({ ...result, is_admin: true });
      fetchAdmins();
    }
    setActionId(null);
  };

  const revoke = async (uid: string) => {
    setActionId(uid);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin" as any);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Admin removido"); if (result?.user_id === uid) setResult({ ...result, is_admin: false }); fetchAdmins(); }
    setActionId(null);
  };

  return (
    <div className="space-y-5">
      <NeonCard glow className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-primary-glow" />
          <h3 className="text-sm font-bold">Gerenciar Administradores</h3>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              type="email"
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search()}
              placeholder="email@exemplo.com"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-background/50 border border-primary/15 text-sm focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
          <button onClick={search} disabled={searching} className="px-4 py-2 rounded-xl bg-primary/15 text-primary-glow text-sm font-bold hover:bg-primary/25 transition-all border border-primary/25 flex items-center gap-2">
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Buscar
          </button>
        </div>

        {result && (
          <div className="mt-4 p-4 rounded-xl border border-primary/15 bg-card/40 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">{result.display_name || "Sem nome"}</p>
              <p className="text-[10px] text-muted-foreground/50 font-mono">{result.user_id.slice(0, 12)}...</p>
              {result.is_admin
                ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold mt-1 inline-block">✅ Admin</span>
                : <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground border border-border/20 mt-1 inline-block">Comum</span>}
            </div>
            {result.is_admin ? (
              <button onClick={() => revoke(result.user_id)} disabled={actionId === result.user_id} className="px-3 py-2 rounded-xl text-xs font-bold bg-destructive/15 text-destructive hover:bg-destructive/25 transition-all border border-destructive/25 flex items-center gap-1.5">
                {actionId === result.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                Remover
              </button>
            ) : (
              <button onClick={() => grant(result.user_id)} disabled={actionId === result.user_id} className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all border border-emerald-500/25 flex items-center gap-1.5">
                {actionId === result.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                Dar Admin
              </button>
            )}
          </div>
        )}
      </NeonCard>

      <NeonCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary-glow" />
            <h3 className="text-sm font-bold">Admins Atuais</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary-glow font-bold">{admins.length}</span>
          </div>
          <button onClick={fetchAdmins} className="text-muted-foreground/40 hover:text-foreground transition">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAdmins ? "animate-spin" : ""}`} />
          </button>
        </div>
        {loadingAdmins ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : admins.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground/40 py-6">Nenhum admin</p>
        ) : (
          <div className="space-y-2">
            {admins.map(a => (
              <div key={a.user_id + a.role} className="flex items-center justify-between p-3 rounded-xl border border-primary/10 hover:bg-primary/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-primary-glow" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">{a.display_name || "Sem nome"}</p>
                    <p className="text-[10px] text-muted-foreground/50 font-mono">{a.user_id.slice(0, 12)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/15 text-primary-glow border border-primary/25 font-black uppercase">{a.role}</span>
                  <button onClick={() => revoke(a.user_id)} disabled={actionId === a.user_id} className="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all">
                    {actionId === a.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </NeonCard>
    </div>
  );
}
