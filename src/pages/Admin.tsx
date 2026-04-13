import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { AdminSupportPanel } from "@/components/AdminSupportPanel";
import { AdminNotesPanel } from "@/components/AdminNotesPanel";
import { AdminConnectionsPanel } from "@/components/AdminConnectionsPanel";
import { AdminSecurityPanel } from "@/components/AdminSecurityPanel";
import { AdminHostingKeysPanel } from "@/components/AdminHostingKeysPanel";
import { AdminLiveChatsPanel } from "@/components/AdminLiveChatsPanel";
import {
  Loader2, ShieldCheck, UserX, ArrowLeft, Trash2, Ban, ShieldOff, KeyRound,
  Crown, Users, Search, RefreshCw, MessageCircle, Phone,
  Clock, TrendingUp, Eye, Copy, Check, ChevronDown, ChevronUp, Code2, StickyNote, Link2, Shield
} from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  is_vip: boolean;
  is_dev: boolean;
  free_messages_used: number;
  created_at: string;
  banned_until: string | null;
  ip_address: string | null;
  device_fingerprint: string | null;
  vip_expires_at: string | null;
  dev_expires_at: string | null;
}

type SortField = "created_at" | "display_name" | "free_messages_used";
type SortDir = "asc" | "desc";
type FilterType = "all" | "vip" | "dev" | "free" | "banned" | "expired";

type AdminTab = "users" | "messages" | "support" | "notes" | "connections" | "security" | "hosting" | "livechats";

interface ChatMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
  conversation?: { user_id: string; mode: string; title: string };
  user_display_name?: string;
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [vipModalUser, setVipModalUser] = useState<string | null>(null);
  const [devModalUser, setDevModalUser] = useState<string | null>(null);
  const [vipMonths, setVipMonths] = useState(1);
  const [devMonths, setDevMonths] = useState(1);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [banHoursInput, setBanHoursInput] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const [adminTab, setAdminTab] = useState<AdminTab>("users");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [totalMessagesCount, setTotalMessagesCount] = useState<number>(0);

  const fetchMessages = async () => {
    setLoadingMessages(true);
    // Get total count of all messages
    const { count: totalCount } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true });
    if (totalCount !== null) setTotalMessagesCount(totalCount);

    // Get recent messages with conversation info
    const { data: msgs, error } = await supabase
      .from("chat_messages")
      .select("id, conversation_id, role, content, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("Erro ao carregar mensagens");
      setLoadingMessages(false);
      return;
    }

    if (msgs && msgs.length > 0) {
      const convIds = [...new Set(msgs.map(m => m.conversation_id))];
      const { data: convs } = await supabase
        .from("chat_conversations")
        .select("id, user_id, mode, title")
        .in("id", convIds);

      const userIds = [...new Set((convs || []).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const namesMap: Record<string, string> = {};
      (profiles || []).forEach(p => { namesMap[p.user_id] = p.display_name || "Sem nome"; });
      setUserNames(namesMap);

      const convsMap: Record<string, { user_id: string; mode: string; title: string }> = {};
      (convs || []).forEach(c => { convsMap[c.id] = { user_id: c.user_id, mode: c.mode, title: c.title }; });

      const enriched: ChatMessage[] = msgs.map(m => ({
        ...m,
        conversation: convsMap[m.conversation_id],
        user_display_name: convsMap[m.conversation_id] ? namesMap[convsMap[m.conversation_id].user_id] : undefined,
      }));

      setMessages(enriched.reverse());
    }
    setLoadingMessages(false);
  };

  useEffect(() => {
    if (!user) return;
    checkAdmin();
  }, [user]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!isAdmin || adminTab !== "messages") return;
    fetchMessages();

    const channel = supabase
      .channel("admin-messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const newMsg = payload.new as { id: string; conversation_id: string; role: string; content: string; created_at: string };
          // Enrich with conversation/user info
          const { data: conv } = await supabase
            .from("chat_conversations")
            .select("id, user_id, mode, title")
            .eq("id", newMsg.conversation_id)
            .single();

          let displayName = "Desconhecido";
          if (conv) {
            const cached = userNames[conv.user_id];
            if (cached) {
              displayName = cached;
            } else {
              const { data: profile } = await supabase
                .from("profiles")
                .select("display_name")
                .eq("user_id", conv.user_id)
                .single();
              displayName = profile?.display_name || "Sem nome";
              setUserNames(prev => ({ ...prev, [conv.user_id]: displayName }));
            }
          }

          const enriched: ChatMessage = {
            ...newMsg,
            conversation: conv ? { user_id: conv.user_id, mode: conv.mode, title: conv.title } : undefined,
            user_display_name: displayName,
          };

          setMessages(prev => [...prev.slice(-199), enriched]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, adminTab]);

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
      .select("user_id, display_name, is_vip, is_dev, free_messages_used, created_at, banned_until, vip_expires_at, dev_expires_at")
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


  const grantDev = async (userId: string, months: number) => {
    setActionLoading(userId + "-grant_dev");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "grant_dev", target_user_id: userId, vip_months: months },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`DEV ativado por ${months} mês(es)`);
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, is_dev: true, dev_expires_at: data.dev_expires_at } : u)));
      setDevModalUser(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao conceder DEV");
    }
    setActionLoading(null);
  };

  const revokeDev = async (userId: string) => {
    setActionLoading(userId + "-revoke_dev");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "revoke_dev", target_user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("DEV removido");
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, is_dev: false, dev_expires_at: null } : u)));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao revogar DEV");
    }
    setActionLoading(null);
  };

  const grantVip = async (userId: string, months: number) => {
    setActionLoading(userId + "-grant_vip");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "grant_vip", target_user_id: userId, vip_months: months },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`VIP ativado por ${months} mês(es)`);
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, is_vip: true, vip_expires_at: data.vip_expires_at } : u)));
      setVipModalUser(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao conceder VIP");
    }
    setActionLoading(null);
  };

  const revokeVip = async (userId: string) => {
    setActionLoading(userId + "-revoke_vip");
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "revoke_vip", target_user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("VIP removido");
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, is_vip: false, vip_expires_at: null } : u)));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao revogar VIP");
    }
    setActionLoading(null);
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

  const filteredUsers = users
    .filter((u) => {
      if (filter === "vip") return u.is_vip && !isVipExpired(u);
      if (filter === "dev") return u.is_dev && !isDevExpired(u);
      if (filter === "free") return !u.is_vip && !u.is_dev;
      if (filter === "banned") return isBanned(u);
      if (filter === "expired") return (u.is_vip && isVipExpired(u)) || (u.is_dev && isDevExpired(u));
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
    banned: users.filter((u) => isBanned(u)).length,
    free: users.filter((u) => !u.is_vip && !u.is_dev).length,
    expired: users.filter((u) => (u.is_vip && isVipExpired(u)) || (u.is_dev && isDevExpired(u))).length,
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/30 bg-background sticky top-0 z-10">
        <div className="h-12 flex items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/" className="p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h1 className="text-sm font-bold">Admin</h1>
            </div>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[200px]">{user.email}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 sm:px-4 pb-2 overflow-x-auto scrollbar-hide">
          {([
            { key: "users" as AdminTab, label: "Usuários", icon: Users, activeClass: "bg-primary/15 text-primary border-primary/30" },
            { key: "messages" as AdminTab, label: "Mensagens", icon: MessageCircle, activeClass: "bg-primary/15 text-primary border-primary/30", dot: true },
            { key: "support" as AdminTab, label: "Suporte", icon: ShieldCheck, activeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
            { key: "notes" as AdminTab, label: "Notas", icon: StickyNote, activeClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
            { key: "connections" as AdminTab, label: "Conexões", icon: Link2, activeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
            { key: "security" as AdminTab, label: "Segurança", icon: Shield, activeClass: "bg-red-500/15 text-red-400 border-red-500/30" },
            { key: "hosting" as AdminTab, label: "Hosting", icon: KeyRound, activeClass: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
            { key: "livechats" as AdminTab, label: "Chat ao Vivo", icon: Phone, activeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setAdminTab(tab.key)}
              className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-all flex items-center gap-1 whitespace-nowrap shrink-0 ${
                adminTab === tab.key
                  ? `${tab.activeClass} border`
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
              {tab.dot && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            </button>
          ))}
        </div>
      </header>

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
                            {!u.is_vip && !u.is_dev && (
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

                        {/* Actions */}
                        {u.user_id !== user!.id && (
                          <div className="flex items-center gap-1 shrink-0">
                            <ActionButton
                              icon={Eye}
                              title="Detalhes"
                              color="text-muted-foreground hover:bg-muted/50 border-border/20"
                              onClick={() => setExpandedUser(isExpanded ? null : u.user_id)}
                              loading={false}
                              disabled={false}
                            />
                            <ActionButton
                              icon={Crown}
                              title="Dar VIP"
                              color="text-yellow-400 hover:bg-yellow-500/10 border-yellow-500/20"
                              onClick={() => setVipModalUser(u.user_id)}
                              loading={false}
                              disabled={actionLoading !== null}
                            />
                            {u.is_vip && (
                              <ActionButton
                                icon={UserX}
                                title="Revogar VIP"
                                color="text-destructive hover:bg-destructive/10 border-destructive/20"
                                onClick={() => revokeVip(u.user_id)}
                                loading={actionLoading === u.user_id + "-revoke_vip"}
                                disabled={actionLoading !== null}
                              />
                            )}
                            <ActionButton
                              icon={Code2}
                              title="Dar DEV"
                              color="text-cyan-400 hover:bg-cyan-500/10 border-cyan-500/20"
                              onClick={() => setDevModalUser(u.user_id)}
                              loading={false}
                              disabled={actionLoading !== null}
                            />
                            {u.is_dev && (
                              <ActionButton
                                icon={UserX}
                                title="Revogar DEV"
                                color="text-orange-400 hover:bg-orange-500/10 border-orange-500/20"
                                onClick={() => revokeDev(u.user_id)}
                                loading={actionLoading === u.user_id + "-revoke_dev"}
                                disabled={actionLoading !== null}
                              />
                            )}
                            {isBanned(u) ? (
                              <ActionButton
                                icon={ShieldOff}
                                title="Desbanir"
                                color="text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20"
                                onClick={() => adminAction("unban", u.user_id)}
                                loading={actionLoading === u.user_id + "-unban"}
                                disabled={actionLoading !== null}
                              />
                            ) : (
                              <ActionButton
                                icon={Ban}
                                title="Banir"
                                color="text-orange-400 hover:bg-orange-500/10 border-orange-500/20"
                                onClick={() => adminAction("ban", u.user_id, banHoursInput[u.user_id] || 24)}
                                loading={actionLoading === u.user_id + "-ban"}
                                disabled={actionLoading !== null}
                              />
                            )}
                            <ActionButton
                              icon={Trash2}
                              title="Excluir"
                              color="text-destructive hover:bg-destructive/10 border-destructive/20"
                              onClick={() => {
                                if (confirm("Excluir este usuário? Isso é irreversível!")) {
                                  adminAction("delete", u.user_id);
                                }
                              }}
                              loading={actionLoading === u.user_id + "-delete"}
                              disabled={actionLoading !== null}
                            />
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

      {/* Messages Tab */}
      {adminTab === "messages" && (
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold">Mensagens em Tempo Real</h2>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <button
              onClick={fetchMessages}
              className="p-2 rounded-xl bg-muted/20 border border-border/20 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
              title="Atualizar"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {loadingMessages ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16">
              <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/50">Nenhuma mensagem ainda</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[calc(100vh-180px)] overflow-y-auto rounded-xl border border-border/20 bg-muted/5 p-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 p-3 rounded-xl transition-all ${
                    msg.role === "user"
                      ? "bg-primary/5 border border-primary/10"
                      : "bg-muted/20 border border-border/10"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    msg.role === "user" ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground"
                  }`}>
                    {msg.role === "user" ? <Users className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[11px] font-medium text-foreground">
                        {msg.role === "user" ? (msg.user_display_name || "Usuário") : "IA"}
                      </span>
                      {msg.conversation?.mode && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${
                          msg.conversation.mode === "programmer" ? "bg-cyan-500/10 text-cyan-400" :
                          msg.conversation.mode === "vip" ? "bg-emerald-500/10 text-emerald-400" :
                          "bg-muted/40 text-muted-foreground"
                        }`}>
                          {msg.conversation.mode}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/40">
                        {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words line-clamp-3">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      )}

      {adminTab === "support" && (
        <AdminSupportPanel />
      )}

      {adminTab === "notes" && (
        <AdminNotesPanel />
      )}

      {adminTab === "connections" && (
        <AdminConnectionsPanel />
      )}

      {adminTab === "security" && (
        <AdminSecurityPanel />
      )}

      {adminTab === "hosting" && (
        <AdminHostingKeysPanel />
      )}

      {adminTab === "livechats" && (
        <AdminLiveChatsPanel />
      )}

      {vipModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
