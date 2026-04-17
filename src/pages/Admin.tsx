import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Navigate, Link } from "react-router-dom";
import { AdminDashboard } from "@/components/AdminDashboard";
import { UserTagModal } from "@/components/UserTagModal";


import {
  Loader2, ShieldCheck, ArrowLeft, KeyRound,
  Crown, Users, Search, RefreshCw, MessageCircle, Menu, X,
  Clock, TrendingUp, Copy, Check, ChevronDown, ChevronUp, Sparkles
} from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  is_vip: boolean;
  is_dev: boolean;
  is_pack_steam: boolean;
  is_rpg_premium: boolean;
  free_messages_used: number;
  created_at: string;
  banned_until: string | null;
  ip_address: string | null;
  device_fingerprint: string | null;
  vip_expires_at: string | null;
  dev_expires_at: string | null;
  pack_steam_expires_at: string | null;
  rpg_premium_expires_at: string | null;
  team_badge: string | null;
}

type SortField = "created_at" | "display_name" | "free_messages_used";
type SortDir = "asc" | "desc";
type FilterType = "all" | "vip" | "dev" | "pack_steam" | "rpg_premium" | "free" | "banned" | "expired";

type AdminTab = "dashboard" | "users";


export default function Admin() {
  const { user, loading: authLoading, isAdmin: cachedIsAdmin } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(cachedIsAdmin || null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [banHoursInput, setBanHoursInput] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [totalMessagesCount, setTotalMessagesCount] = useState<number>(0);
  const [tagModalUserId, setTagModalUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Use cached admin status for instant render, then verify
    if (cachedIsAdmin) {
      setIsAdmin(true);
      fetchUsers();
      supabase.from("chat_messages").select("id", { count: "exact", head: true }).then(({ count }) => {
        if (count !== null) setTotalMessagesCount(count);
      });
    } else {
      checkAdmin();
    }
  }, [user, cachedIsAdmin]);

  // (Mensagens em tempo real removido)

  const checkAdmin = async () => {
    const { data } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
    setIsAdmin(!!data);
    if (data) {
      fetchUsers();
      const { count } = await supabase.from("chat_messages").select("id", { count: "exact", head: true });
      if (count !== null) setTotalMessagesCount(count);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, display_name, is_vip, is_dev, is_pack_steam, is_rpg_premium, free_messages_used, created_at, banned_until, vip_expires_at, dev_expires_at, pack_steam_expires_at, rpg_premium_expires_at, team_badge")
      .order("created_at", { ascending: false });
    if (error) { toast.error("Erro ao carregar usuários"); setLoadingUsers(false); return; }

    // Fetch tracking data separately from user_tracking table (cast to bypass type generation lag)
    const { data: trackingData } = await (supabase as any)
      .from("user_tracking")
      .select("user_id, ip_address, device_fingerprint");

    const trackingMap: Record<string, { ip_address: string | null; device_fingerprint: string | null }> = {};
    (trackingData || []).forEach((t: any) => {
      trackingMap[t.user_id] = { ip_address: t.ip_address, device_fingerprint: t.device_fingerprint };
    });

    const merged = (data || []).map((u: any) => ({
      ...u,
      ip_address: trackingMap[u.user_id]?.ip_address || null,
      device_fingerprint: trackingMap[u.user_id]?.device_fingerprint || null,
    }));

    setUsers(merged as UserProfile[]);
    setLoadingUsers(false);
  };


  

  const adminAction = async (action: string, targetUserId: string, banHours?: number) => {
    setActionLoading(targetUserId + "-" + action);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action, target_user_id: targetUserId, ban_hours: banHours },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (action === "delete") {
        toast.success("Usuário excluído");
        setUsers((prev) => prev.filter((u) => u.user_id !== targetUserId));
      } else if (action === "ban") {
        toast.success(`Usuário banido por ${banHours || 24}h`);
        setUsers((prev) => prev.map((u) => u.user_id === targetUserId ? { ...u, banned_until: data.banned_until } : u));
      } else if (action === "unban") {
        toast.success("Ban removido");
        setUsers((prev) => prev.map((u) => u.user_id === targetUserId ? { ...u, banned_until: null } : u));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro na operação");
    }
    setActionLoading(null);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isBanned = (u: UserProfile) => u.banned_until && new Date(u.banned_until) > new Date();
  const isVipExpired = (u: UserProfile) => u.vip_expires_at && new Date(u.vip_expires_at) < new Date();
  const isDevExpired = (u: UserProfile) => u.dev_expires_at && new Date(u.dev_expires_at) < new Date();
  const isPackSteamExpired = (u: UserProfile) => u.pack_steam_expires_at && new Date(u.pack_steam_expires_at) < new Date();
  const isRpgExpired = (u: UserProfile) => u.rpg_premium_expires_at && new Date(u.rpg_premium_expires_at) < new Date();

  const filteredUsers = users
    .filter((u) => {
      if (filter === "vip") return u.is_vip && !isVipExpired(u);
      if (filter === "dev") return u.is_dev && !isDevExpired(u);
      if (filter === "pack_steam") return u.is_pack_steam && !isPackSteamExpired(u);
      if (filter === "rpg_premium") return u.is_rpg_premium && !isRpgExpired(u);
      if (filter === "free") return !u.is_vip && !u.is_dev && !u.is_pack_steam && !u.is_rpg_premium;
      if (filter === "banned") return isBanned(u);
      if (filter === "expired") return (u.is_vip && isVipExpired(u)) || (u.is_dev && isDevExpired(u)) || (u.is_pack_steam && isPackSteamExpired(u)) || (u.is_rpg_premium && isRpgExpired(u));
      return true;
    })
    .filter((u) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        u.display_name?.toLowerCase().includes(s) ||
        u.user_id.toLowerCase().includes(s) ||
        u.ip_address?.toLowerCase().includes(s) ||
        u.device_fingerprint?.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortField === "display_name") cmp = (a.display_name || "").localeCompare(b.display_name || "");
      else if (sortField === "free_messages_used") cmp = a.free_messages_used - b.free_messages_used;
      return sortDir === "desc" ? -cmp : cmp;
    });

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats = {
    total: users.length,
    vip: users.filter((u) => u.is_vip && !isVipExpired(u)).length,
    dev: users.filter((u) => u.is_dev && !isDevExpired(u)).length,
    pack_steam: users.filter((u) => u.is_pack_steam && !isPackSteamExpired(u)).length,
    rpg_premium: users.filter((u) => u.is_rpg_premium && !isRpgExpired(u)).length,
    banned: users.filter((u) => isBanned(u)).length,
    free: users.filter((u) => !u.is_vip && !u.is_dev && !u.is_pack_steam && !u.is_rpg_premium).length,
    expired: users.filter((u) => (u.is_vip && isVipExpired(u)) || (u.is_dev && isDevExpired(u)) || (u.is_pack_steam && isPackSteamExpired(u)) || (u.is_rpg_premium && isRpgExpired(u))).length,
    totalMessages: totalMessagesCount,
    todaySignups: users.filter((u) => {
      const d = new Date(u.created_at);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length,
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
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

  const tabs: { key: AdminTab; label: string; icon: any; color: string; dot?: boolean }[] = [
    { key: "dashboard", label: "Dashboard", icon: TrendingUp, color: "text-primary" },
    { key: "users", label: "Usuários", icon: Users, color: "text-primary" },
  ];

  const currentTab = tabs.find(t => t.key === adminTab);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* === SIDEBAR === */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-[100dvh] w-64 shrink-0 z-50 md:z-10
        bg-sidebar/95 backdrop-blur-xl border-r border-border/15
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center border border-primary/20">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Admin</h1>
              <p className="text-[9px] text-muted-foreground/50 font-medium">SnyX Console</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/20">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Painel</p>
          {tabs.map((tab) => {
            const active = adminTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setAdminTab(tab.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_20px_-8px_hsl(var(--primary)/0.4)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/15 border border-transparent"
                }`}
              >
                <tab.icon className={`w-4 h-4 ${active ? tab.color : ""}`} />
                <span className="flex-1 text-left">{tab.label}</span>
                {tab.dot && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-border/10 space-y-1 shrink-0">
          <Link to="/" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/15 transition-all">
            <ArrowLeft className="w-4 h-4" /><span>Voltar ao app</span>
          </Link>
          <div className="px-3 py-2 rounded-xl bg-muted/10 border border-border/10">
            <p className="text-[10px] text-muted-foreground/50 truncate">{user.email}</p>
          </div>
        </div>
      </aside>

      {/* === MAIN === */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-14 flex items-center justify-between px-4 border-b border-border/10 bg-background/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/20">
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              {currentTab && <currentTab.icon className={`w-4 h-4 ${currentTab.color}`} />}
              <h2 className="text-sm font-bold">{currentTab?.label || "Admin"}</h2>
            </div>
          </div>
        </header>

      {adminTab === "dashboard" && (
        <div className="max-w-6xl mx-auto px-4 py-6 w-full">
          <AdminDashboard />
        </div>
      )}

      {adminTab === "users" && (
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
          {[
            { label: "Total", value: stats.total, icon: Users, color: "text-foreground" },
            { label: "VIP Ativo", value: stats.vip, icon: Crown, color: "text-emerald-400" },
            { label: "DEV Ativo", value: stats.dev, icon: Code2, color: "text-cyan-400" },
            { label: "Free", value: stats.free, icon: Users, color: "text-muted-foreground" },
            { label: "Banidos", value: stats.banned, icon: Ban, color: "text-destructive" },
            { label: "Expirados", value: stats.expired, icon: Clock, color: "text-yellow-400" },
            { label: "Msgs Total", value: stats.totalMessages, icon: MessageCircle, color: "text-primary" },
            { label: "Hoje", value: stats.todaySignups, icon: TrendingUp, color: "text-cyan-400" },
          ].map((s) => (
            <div key={s.label} className="bg-muted/20 border border-border/20 rounded-xl p-3 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted/40">
                <s.icon size={14} className={s.color} />
              </div>
              <div>
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {(["all", "vip", "dev", "free", "banned", "expired"] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filter === f
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground bg-muted/20 border border-border/20"
              }`}
            >
              {f === "all" ? "Todos" : f === "vip" ? "VIP" : f === "dev" ? "DEV" : f === "free" ? "Free" : f === "banned" ? "Banidos" : "Expirados"}
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar por nome, ID, IP, fingerprint..."
              className="w-full bg-muted/20 border border-border/20 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-border/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-1">
            {([
              { field: "created_at" as SortField, label: "Data" },
              { field: "display_name" as SortField, label: "Nome" },
              { field: "free_messages_used" as SortField, label: "Msgs" },
            ]).map(s => (
              <button
                key={s.field}
                onClick={() => toggleSort(s.field)}
                className={`px-2.5 py-2 text-[11px] font-medium rounded-lg transition-all flex items-center gap-1 ${
                  sortField === s.field
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground bg-muted/20 border border-border/20 hover:text-foreground"
                }`}
              >
                {s.label}
                {sortField === s.field && (sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
              </button>
            ))}
          </div>
          <button
            onClick={fetchUsers}
            className="p-2.5 rounded-xl bg-muted/20 border border-border/20 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
            title="Atualizar"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* User list */}
        {loadingUsers ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground/50">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedUsers.map((u) => {
                const isExpanded = expandedUser === u.user_id;
                return (
                  <div
                    key={u.user_id}
                    className={`rounded-xl border transition-all ${
                      isBanned(u)
                        ? "border-destructive/20 bg-destructive/5"
                        : "border-border/20 bg-muted/10 hover:bg-muted/20"
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* User info */}
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedUser(isExpanded ? null : u.user_id)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">
                              {u.display_name || "Sem nome"}
                            </span>
                            {u.is_vip && !isVipExpired(u) && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                VIP
                              </span>
                            )}
                            {u.is_dev && !isDevExpired(u) && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                DEV
                              </span>
                            )}
                            
                            {u.is_vip && isVipExpired(u) && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                VIP Expirado
                              </span>
                            )}
                            {u.is_dev && isDevExpired(u) && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                DEV Expirado
                              </span>
                            )}
                            
                            {u.team_badge && (u.team_badge === "Dono" || u.team_badge === "Dona") ? (
                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-amber-500/15 via-yellow-400/20 to-amber-500/15 text-amber-300 border border-amber-400/30 shadow-lg shadow-amber-500/10 flex items-center gap-1">
                                👑 {u.team_badge}
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                  <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="rgba(251,191,36,0.15)"/>
                                </svg>
                              </span>
                            ) : u.team_badge ? (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                                🛡️ {u.team_badge}
                              </span>
                            ) : null}
                            {!u.is_vip && !u.is_dev && !u.is_pack_steam && !u.is_rpg_premium && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-muted text-muted-foreground">
                                Free
                              </span>
                            )}
                            {isBanned(u) && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                                Banido
                              </span>
                            )}
                            {u.user_id === user!.id && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-primary/10 text-primary">
                                Você
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-muted-foreground/60">
                            <span className="flex items-center gap-1"><MessageCircle size={10} /> {u.free_messages_used} msgs</span>
                            <span>Desde: {new Date(u.created_at).toLocaleDateString("pt-BR")}</span>
                            {u.vip_expires_at && (
                              <span className="text-yellow-400/70">VIP até: {new Date(u.vip_expires_at).toLocaleDateString("pt-BR")}</span>
                            )}
                            {u.dev_expires_at && (
                              <span className="text-cyan-400/70">DEV até: {new Date(u.dev_expires_at).toLocaleDateString("pt-BR")}</span>
                            )}
                            
                            {isBanned(u) && (
                              <span className="text-destructive/70">Ban até: {new Date(u.banned_until!).toLocaleString("pt-BR")}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions: tudo dentro do perfil */}
                        {u.user_id !== user!.id && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setExpandedUser(isExpanded ? null : u.user_id)}
                              className="p-2 rounded-xl border border-border/20 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
                              title="Ver detalhes técnicos"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => setTagModalUserId(u.user_id)}
                              className="px-3 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center gap-1.5 text-xs font-bold"
                              title="Abrir perfil de admin"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Abrir perfil</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-border/20 p-4 bg-muted/5 space-y-3 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground/50 mb-1">User ID</p>
                            <div className="flex items-center gap-2">
                              <code className="text-[11px] text-foreground/70 font-mono bg-muted/40 px-2 py-1 rounded-lg truncate flex-1">{u.user_id}</code>
                              <button onClick={() => copyToClipboard(u.user_id, u.user_id + "-id")} className="p-1 rounded hover:bg-muted/50">
                                {copiedId === u.user_id + "-id" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-muted-foreground" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground/50 mb-1">IP Address</p>
                            <div className="flex items-center gap-2">
                              <code className="text-[11px] text-foreground/70 font-mono bg-muted/40 px-2 py-1 rounded-lg truncate flex-1">{u.ip_address || "N/A"}</code>
                              {u.ip_address && (
                                <button onClick={() => copyToClipboard(u.ip_address!, u.user_id + "-ip")} className="p-1 rounded hover:bg-muted/50">
                                  {copiedId === u.user_id + "-ip" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-muted-foreground" />}
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground/50 mb-1">Device Fingerprint</p>
                            <div className="flex items-center gap-2">
                              <code className="text-[11px] text-foreground/70 font-mono bg-muted/40 px-2 py-1 rounded-lg truncate flex-1">{u.device_fingerprint || "N/A"}</code>
                              {u.device_fingerprint && (
                                <button onClick={() => copyToClipboard(u.device_fingerprint!, u.user_id + "-fp")} className="p-1 rounded hover:bg-muted/50">
                                  {copiedId === u.user_id + "-fp" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-muted-foreground" />}
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground/50 mb-1">Criado em</p>
                            <code className="text-[11px] text-foreground/70 font-mono bg-muted/40 px-2 py-1 rounded-lg block">
                              {new Date(u.created_at).toLocaleString("pt-BR")}
                            </code>
                          </div>
                        </div>

                        {/* Custom ban duration */}
                        {!isBanned(u) && u.user_id !== user!.id && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[11px] text-muted-foreground">Banir por:</span>
                            <input
                              type="number"
                              min={1}
                              max={8760}
                              value={banHoursInput[u.user_id] || 24}
                              onChange={(e) => setBanHoursInput(prev => ({ ...prev, [u.user_id]: parseInt(e.target.value) || 24 }))}
                              className="w-16 bg-muted/30 border border-border/30 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-border/60"
                            />
                            <span className="text-[11px] text-muted-foreground">horas</span>
                            <button
                              onClick={() => adminAction("ban", u.user_id, banHoursInput[u.user_id] || 24)}
                              disabled={actionLoading !== null}
                              className="px-3 py-1 text-[11px] font-medium rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all disabled:opacity-50"
                            >
                              Banir
                            </button>
                          </div>
                        )}

                        {/* Quick actions */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            onClick={async () => {
                              setActionLoading(u.user_id + "-reset_password");
                              try {
                                const { data, error } = await supabase.functions.invoke("admin-users", {
                                  body: { action: "reset_password", target_user_id: u.user_id },
                                });
                                if (error) throw error;
                                if (data?.error) throw new Error(data.error);
                                toast.success(`Email enviado para ${data.email}`);
                              } catch (err: unknown) {
                                toast.error(err instanceof Error ? err.message : "Erro");
                              }
                              setActionLoading(null);
                            }}
                            disabled={actionLoading !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                          >
                            <KeyRound size={12} />
                            Resetar Senha
                            {actionLoading === u.user_id + "-reset_password" && <Loader2 size={12} className="animate-spin" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  {filteredUsers.length} usuário(s) • Página {page + 1} de {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-xs rounded-lg bg-muted/20 border border-border/20 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-xs rounded-lg bg-muted/20 border border-border/20 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      )}


      <UserTagModal
        open={tagModalUserId !== null}
        user={users.find((u) => u.user_id === tagModalUserId) ?? null}
        onClose={() => setTagModalUserId(null)}
        onUpdated={(patch) =>
          setUsers((prev) =>
            prev.map((u) => (u.user_id === tagModalUserId ? { ...u, ...patch } : u))
          )
        }
      />


      {vipModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60  p-4">
          <div className="bg-card border border-border/50 rounded-2xl p-6 max-w-xs w-full text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-yellow-500/10 mb-4">
              <Crown className="w-6 h-6 text-yellow-400" />
            </div>
            <h2 className="text-base font-semibold mb-1">Conceder VIP</h2>
            <p className="text-xs text-muted-foreground/60 mb-4">Selecione a duração</p>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {[1, 2, 3, 6].map((m) => (
                <button
                  key={m}
                  onClick={() => setVipMonths(m)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                    vipMonths === m
                      ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/40"
                      : "bg-muted/30 text-muted-foreground border border-border/20 hover:border-border/50"
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setVipModalUser(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-border/20 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => grantVip(vipModalUser, vipMonths)}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 border border-yellow-500/30 transition-all"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEV Duration Modal */}
      {devModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60  p-4">
          <div className="bg-card border border-border/50 rounded-2xl p-6 max-w-xs w-full text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/10 mb-4">
              <Code2 className="w-6 h-6 text-cyan-400" />
            </div>
            <h2 className="text-base font-semibold mb-1">Conceder DEV</h2>
            <p className="text-xs text-muted-foreground/60 mb-4">Selecione a duração</p>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {[1, 2, 3, 6].map((m) => (
                <button
                  key={m}
                  onClick={() => setDevMonths(m)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                    devMonths === m
                      ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/40"
                      : "bg-muted/30 text-muted-foreground border border-border/20 hover:border-border/50"
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDevModalUser(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-border/20 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => grantDev(devModalUser, devMonths)}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/30 transition-all"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

              
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  title,
  color,
  onClick,
  loading,
  disabled,
}: {
  icon: typeof Crown;
  title: string;
  color: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-xl border transition-all disabled:opacity-50 ${color}`}
      title={title}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
    </button>
  );
}
