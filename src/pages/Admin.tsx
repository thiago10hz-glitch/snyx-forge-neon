import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { AdminDashboard } from "@/components/AdminDashboard";
import { UserTagModal } from "@/components/UserTagModal";
import {
  Loader2, ShieldCheck, ArrowLeft, Ban, KeyRound, Crown, Users, Search,
  RefreshCw, MessageCircle, Menu, X, TrendingUp, Copy, Check,
  ChevronDown, ChevronUp, Sparkles, LifeBuoy, ScrollText,
  KeySquare, Trash2, CheckCircle2, XCircle, AlertTriangle,
  Send, Plus, ChevronLeft, ChevronRight, Settings2,
} from "lucide-react";
import { ChatSettings } from "@/components/ChatSettings";
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
type AdminTab = "dashboard" | "users" | "tickets" | "audit" | "apikeys";

// ============ NEON CARD ============
function NeonCard({ children, className = "", glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`relative rounded-2xl border border-primary/15 bg-gradient-to-br from-card/80 via-card/40 to-card/20 backdrop-blur-xl ${glow ? "shadow-[0_0_40px_-12px_hsl(var(--primary)/0.4)]" : ""} ${className}`}>
      {glow && <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />}
      <div className="relative">{children}</div>
    </div>
  );
}

// ============ TICKETS TAB ============
function TicketsTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("support_tickets").select("*").order("updated_at", { ascending: false });
    setTickets(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openTicket = async (t: any) => {
    setActive(t);
    const { data } = await supabase.from("support_messages").select("*").eq("ticket_id", t.id).order("created_at");
    setMessages(data || []);
  };

  const send = async () => {
    if (!reply.trim() || !active) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: active.id, sender_id: user.id, sender_role: "admin", content: reply.trim(),
    });
    if (error) return toast.error("Erro ao enviar");
    setReply("");
    openTicket(active);
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
    if (error) return toast.error("Erro");
    toast.success(`Ticket ${status === "closed" ? "fechado" : "reaberto"}`);
    load();
    if (active?.id === id) setActive({ ...active, status });
  };

  const filtered = tickets.filter(t => filter === "all" ? true : t.status === filter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 h-[calc(100dvh-9rem)]">
      <NeonCard className="overflow-hidden flex flex-col">
        <div className="p-3 border-b border-primary/10 flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2"><LifeBuoy size={14} className="text-primary" /> Tickets</h3>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground"><RefreshCw size={12} /></button>
        </div>
        <div className="flex gap-1 p-2 border-b border-primary/10">
          {(["open", "closed", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`flex-1 px-2 py-1.5 text-[11px] font-medium rounded-lg transition-all ${filter === f ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:bg-muted/20"}`}>
              {f === "open" ? "Abertos" : f === "closed" ? "Fechados" : "Todos"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto mt-8 text-primary" /> :
            filtered.length === 0 ? <p className="text-xs text-muted-foreground/50 text-center py-8">Nenhum ticket</p> :
            filtered.map(t => (
              <button key={t.id} onClick={() => openTicket(t)} className={`w-full text-left p-2.5 rounded-xl transition-all ${active?.id === t.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/15 border border-transparent"}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold truncate">{t.subject}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${t.status === "open" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/30 text-muted-foreground"}`}>{t.status}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 font-mono truncate">{t.user_id.slice(0, 12)}…</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">{new Date(t.updated_at).toLocaleString("pt-BR")}</p>
              </button>
            ))}
        </div>
      </NeonCard>

      <NeonCard className="overflow-hidden flex flex-col">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <LifeBuoy size={32} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground/50">Selecione um ticket</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-primary/10 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate">{active.subject}</h3>
                <p className="text-[10px] text-muted-foreground/50 font-mono">{active.user_id}</p>
              </div>
              <button onClick={() => setStatus(active.id, active.status === "open" ? "closed" : "open")} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg ${active.status === "open" ? "bg-destructive/15 text-destructive border border-destructive/30" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"}`}>
                {active.status === "open" ? "Fechar" : "Reabrir"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] p-2.5 rounded-xl text-xs ${m.sender_role === "admin" ? "bg-primary/15 border border-primary/30 text-foreground" : "bg-muted/20 border border-border/20"}`}>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className="text-[9px] text-muted-foreground/40 mt-1">{new Date(m.created_at).toLocaleTimeString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
            {active.status === "open" && (
              <div className="p-2 border-t border-primary/10 flex gap-2">
                <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Responder..." className="flex-1 bg-muted/20 border border-border/30 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50" />
                <button onClick={send} className="px-3 py-2 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25"><Send size={14} /></button>
              </div>
            )}
          </>
        )}
      </NeonCard>
    </div>
  );
}

// ============ LOGS TAB ============
function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [fraud, setFraud] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"audit" | "fraud">("audit");

  const load = async () => {
    setLoading(true);
    const [a, f] = await Promise.all([
      supabase.from("security_audit_log").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("fraud_attempts").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setLogs(a.data || []);
    setFraud(f.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sevColor = (s: string) => s === "critical" ? "text-destructive bg-destructive/10 border-destructive/30"
    : s === "high" ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
    : s === "warning" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
    : "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";

  return (
    <NeonCard className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          <button onClick={() => setTab("audit")} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${tab === "audit" ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:bg-muted/15 border border-transparent"}`}>
            <ScrollText size={12} className="inline mr-1.5" />Auditoria ({logs.length})
          </button>
          <button onClick={() => setTab("fraud")} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${tab === "fraud" ? "bg-destructive/15 text-destructive border border-destructive/30" : "text-muted-foreground hover:bg-muted/15 border border-transparent"}`}>
            <AlertTriangle size={12} className="inline mr-1.5" />Fraudes ({fraud.length})
          </button>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-muted/20 text-muted-foreground"><RefreshCw size={14} /></button>
      </div>

      {loading ? <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto my-12" /> : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {tab === "audit" && (logs.length === 0 ? <p className="text-xs text-muted-foreground/50 text-center py-12">Sem eventos</p> :
            logs.map(l => (
              <div key={l.id} className="p-3 rounded-xl border border-border/15 bg-muted/5 flex items-start gap-3">
                <span className={`text-[9px] font-bold px-2 py-1 rounded-md border uppercase ${sevColor(l.severity)}`}>{l.severity}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{l.event_type}{l.resource && <span className="text-muted-foreground/60"> · {l.resource}</span>}</p>
                  <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5 truncate">{l.user_id}</p>
                  {l.details && Object.keys(l.details || {}).length > 0 && (
                    <pre className="text-[10px] text-muted-foreground/60 mt-1 font-mono bg-muted/20 p-1.5 rounded overflow-x-auto">{JSON.stringify(l.details, null, 0)}</pre>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/40 shrink-0">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
              </div>
            )))}

          {tab === "fraud" && (fraud.length === 0 ? <p className="text-xs text-muted-foreground/50 text-center py-12">Sem fraudes</p> :
            fraud.map(f => (
              <div key={f.id} className="p-3 rounded-xl border border-destructive/20 bg-destructive/5 flex items-start gap-3">
                <AlertTriangle size={14} className="text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-destructive">{f.attempt_type}</p>
                  <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5 truncate">{f.user_id}</p>
                  {f.details && <p className="text-[10px] text-muted-foreground/60 mt-1">{f.details}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground/40 shrink-0">{new Date(f.created_at).toLocaleString("pt-BR")}</span>
              </div>
            )))}
        </div>
      )}
    </NeonCard>
  );
}

// ============ NOTES TAB ============
function NotesTab() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPriority, setNewPriority] = useState("medium");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("admin_notes").select("*").order("created_at", { ascending: false });
    setNotes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin_notes_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notes" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const create = async () => {
    const q = newUser.trim();
    if (!q || !newContent.trim()) return toast.error("Preencha tudo");
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let userId = q;
    if (!uuidRe.test(q)) {
      // tenta resolver por email ou display_name
      if (q.includes("@")) {
        const { data: uid } = await supabase.rpc("find_user_by_email", { p_email: q });
        if (!uid) return toast.error("Email não encontrado");
        userId = uid as string;
      } else {
        const { data: prof } = await supabase.from("profiles").select("user_id").ilike("display_name", q).limit(1).maybeSingle();
        if (!prof?.user_id) return toast.error("Usuário não encontrado. Use UUID, email ou nome exato.");
        userId = prof.user_id;
      }
    }
    const { error } = await supabase.from("admin_notes").insert({
      user_id: userId, content: newContent.trim(), priority: newPriority,
    });
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Nota criada");
    setNewUser(""); setNewContent("");
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("admin_notes").update({ status }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("admin_notes").delete().eq("id", id);
    toast.success("Removida");
    load();
  };

  const prioColor = (p: string) => p === "high" ? "border-destructive/30 bg-destructive/5" : p === "low" ? "border-cyan-500/20 bg-cyan-500/5" : "border-yellow-500/20 bg-yellow-500/5";

  return (
    <div className="space-y-4">
      <NeonCard className="p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Plus size={14} className="text-primary" /> Nova nota</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-2">
          <input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="User ID (UUID)" className="bg-muted/20 border border-border/30 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary/50" />
          <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="bg-muted/20 border border-border/30 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50">
            <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option>
          </select>
        </div>
        <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Anotação sobre o usuário..." rows={3} className="w-full mt-2 bg-muted/20 border border-border/30 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50 resize-none" />
        <button onClick={create} className="mt-2 w-full px-4 py-2 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 text-xs font-bold">Criar nota</button>
      </NeonCard>

      <NeonCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Notas ({notes.length})</h3>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground"><RefreshCw size={12} /></button>
        </div>
        {loading ? <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto my-8" /> :
          notes.length === 0 ? <p className="text-xs text-muted-foreground/50 text-center py-8">Sem notas</p> : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {notes.map(n => (
                <div key={n.id} className={`p-3 rounded-xl border ${prioColor(n.priority)}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-background/40">{n.priority}</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${n.status === "resolved" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/30"}`}>{n.status}</span>
                      <code className="text-[10px] text-muted-foreground/60 font-mono">{n.user_id.slice(0, 8)}…</code>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateStatus(n.id, n.status === "resolved" ? "pending" : "resolved")} className="p-1 rounded hover:bg-muted/30" title="Toggle">
                        {n.status === "resolved" ? <XCircle size={12} className="text-muted-foreground" /> : <CheckCircle2 size={12} className="text-emerald-400" />}
                      </button>
                      <button onClick={() => remove(n.id)} className="p-1 rounded hover:bg-destructive/20"><Trash2 size={12} className="text-destructive" /></button>
                    </div>
                  </div>
                  <p className="text-xs whitespace-pre-wrap">{n.content}</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
          )}
      </NeonCard>
    </div>
  );
}

// ============ API KEYS TAB ============
function ApiKeysTab() {
  const [apps, setApps] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"applications" | "clients">("applications");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const load = async () => {
    setLoading(true);
    const [a, c] = await Promise.all([
      supabase.from("api_key_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("api_clients").select("*, api_plans(name, slug)").order("created_at", { ascending: false }),
    ]);
    setApps(a.data || []);
    setClients(c.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const review = async (id: string, status: "approved" | "rejected") => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("api_key_applications").update({
      status, reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(status === "approved" ? "Aprovado" : "Rejeitado");
    load();
  };

  const filtered = apps.filter(a => filter === "all" ? true : a.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab("applications")} className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${tab === "applications" ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:bg-muted/15 border border-border/15"}`}>
          Pedidos ({apps.filter(a => a.status === "pending").length})
        </button>
        <button onClick={() => setTab("clients")} className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${tab === "clients" ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:bg-muted/15 border border-border/15"}`}>
          Clientes ativos ({clients.length})
        </button>
        <button onClick={load} className="ml-auto p-2 rounded-xl hover:bg-muted/20 text-muted-foreground"><RefreshCw size={14} /></button>
      </div>

      {tab === "applications" && (
        <NeonCard className="p-4">
          <div className="flex gap-1 mb-3 flex-wrap">
            {(["pending", "approved", "rejected", "all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 text-[11px] font-medium rounded-lg ${filter === f ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground bg-muted/20 border border-border/20"}`}>
                {f === "pending" ? "Pendentes" : f === "approved" ? "Aprovados" : f === "rejected" ? "Rejeitados" : "Todos"}
              </button>
            ))}
          </div>
          {loading ? <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto my-8" /> :
            filtered.length === 0 ? <p className="text-xs text-muted-foreground/50 text-center py-8">Nenhum pedido</p> :
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {filtered.map(a => (
                <div key={a.id} className="p-4 rounded-xl border border-border/20 bg-muted/5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{a.full_name} <span className="text-muted-foreground font-normal">· {a.company_or_project}</span></p>
                      <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{a.user_id}</p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded ${a.status === "pending" ? "bg-yellow-500/15 text-yellow-400" : a.status === "approved" ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"}`}>{a.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground mb-2">
                    {a.project_url && <p>🔗 {a.project_url}</p>}
                    {a.estimated_volume && <p>📊 {a.estimated_volume}</p>}
                    {a.category && <p>🏷️ {a.category}</p>}
                    {a.ai_score !== null && <p>🤖 Score IA: {a.ai_score}/100</p>}
                  </div>
                  <p className="text-xs bg-muted/15 p-2 rounded-lg whitespace-pre-wrap mb-2">{a.use_case}</p>
                  {a.ai_reasoning && <p className="text-[10px] text-cyan-400/80 italic mb-2">💭 IA: {a.ai_reasoning}</p>}
                  {a.status === "pending" && (
                    <div className="flex gap-2">
                      <button onClick={() => review(a.id, "approved")} className="flex-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25">
                        <CheckCircle2 size={12} className="inline mr-1" />Aprovar
                      </button>
                      <button onClick={() => review(a.id, "rejected")} className="flex-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25">
                        <XCircle size={12} className="inline mr-1" />Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          }
        </NeonCard>
      )}

      {tab === "clients" && (
        <NeonCard className="p-4">
          {loading ? <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto my-8" /> :
            clients.length === 0 ? <p className="text-xs text-muted-foreground/50 text-center py-8">Sem clientes</p> :
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {clients.map(c => (
                <div key={c.id} className="p-3 rounded-xl border border-border/15 bg-muted/5">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2">
                      <KeySquare size={14} className="text-primary" />
                      <span className="text-sm font-bold">{c.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">{c.api_plans?.name || "—"}</span>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${c.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/30"}`}>{c.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground mt-1">
                    <span>📅 Hoje: {c.daily_used}</span>
                    <span>📆 Mês: {c.monthly_used}</span>
                    <span>🔢 Total: {c.total_used}</span>
                  </div>
                  <code className="text-[10px] font-mono text-muted-foreground/50 mt-1 block">{c.api_key_prefix}…</code>
                </div>
              ))}
            </div>
          }
        </NeonCard>
      )}
    </div>
  );
}

// ============ MAIN ADMIN ============
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tagModalUserId, setTagModalUserId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ tickets: 0, apps: 0 });
  const [botSettingsOpen, setBotSettingsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (cachedIsAdmin) {
      setIsAdmin(true);
      fetchUsers();
      fetchCounts();
    } else {
      checkAdmin();
    }
  }, [user, cachedIsAdmin]);

  const checkAdmin = async () => {
    const { data } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
    setIsAdmin(!!data);
    if (data) { fetchUsers(); fetchCounts(); }
  };

  const fetchCounts = async () => {
    const [t, a] = await Promise.all([
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("api_key_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setCounts({ tickets: t.count || 0, apps: a.count || 0 });
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, display_name, is_vip, is_dev, is_pack_steam, is_rpg_premium, free_messages_used, created_at, banned_until, vip_expires_at, dev_expires_at, pack_steam_expires_at, rpg_premium_expires_at, team_badge")
      .order("created_at", { ascending: false });
    if (error) { toast.error("Erro ao carregar usuários"); setLoadingUsers(false); return; }
    const { data: trackingData } = await (supabase as any).from("user_tracking").select("user_id, ip_address, device_fingerprint");
    const trackingMap: Record<string, any> = {};
    (trackingData || []).forEach((t: any) => { trackingMap[t.user_id] = { ip_address: t.ip_address, device_fingerprint: t.device_fingerprint }; });
    const merged = (data || []).map((u: any) => ({ ...u, ip_address: trackingMap[u.user_id]?.ip_address || null, device_fingerprint: trackingMap[u.user_id]?.device_fingerprint || null }));
    setUsers(merged as UserProfile[]);
    setLoadingUsers(false);
  };

  const adminAction = async (action: string, targetUserId: string, banHours?: number) => {
    setActionLoading(targetUserId + "-" + action);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", { body: { action, target_user_id: targetUserId, ban_hours: banHours } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (action === "delete") { toast.success("Excluído"); setUsers(p => p.filter(u => u.user_id !== targetUserId)); }
      else if (action === "ban") { toast.success(`Banido por ${banHours || 24}h`); setUsers(p => p.map(u => u.user_id === targetUserId ? { ...u, banned_until: data.banned_until } : u)); }
      else if (action === "unban") { toast.success("Desbanido"); setUsers(p => p.map(u => u.user_id === targetUserId ? { ...u, banned_until: null } : u)); }
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Erro"); }
    setActionLoading(null);
  };

  const copyToClipboard = (text: string, id: string) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
  const isBanned = (u: UserProfile) => u.banned_until && new Date(u.banned_until) > new Date();
  const isVipExpired = (u: UserProfile) => u.vip_expires_at && new Date(u.vip_expires_at) < new Date();
  const isDevExpired = (u: UserProfile) => u.dev_expires_at && new Date(u.dev_expires_at) < new Date();
  const isPackSteamExpired = (u: UserProfile) => u.pack_steam_expires_at && new Date(u.pack_steam_expires_at) < new Date();
  const isRpgExpired = (u: UserProfile) => u.rpg_premium_expires_at && new Date(u.rpg_premium_expires_at) < new Date();

  const filteredUsers = useMemo(() => users
    .filter(u => {
      if (filter === "vip") return u.is_vip && !isVipExpired(u);
      if (filter === "dev") return u.is_dev && !isDevExpired(u);
      if (filter === "pack_steam") return u.is_pack_steam && !isPackSteamExpired(u);
      if (filter === "rpg_premium") return u.is_rpg_premium && !isRpgExpired(u);
      if (filter === "free") return !u.is_vip && !u.is_dev && !u.is_pack_steam && !u.is_rpg_premium;
      if (filter === "banned") return isBanned(u);
      if (filter === "expired") return (u.is_vip && isVipExpired(u)) || (u.is_dev && isDevExpired(u)) || (u.is_pack_steam && isPackSteamExpired(u)) || (u.is_rpg_premium && isRpgExpired(u));
      return true;
    })
    .filter(u => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return u.display_name?.toLowerCase().includes(s) || u.user_id.toLowerCase().includes(s) || u.ip_address?.toLowerCase().includes(s) || u.device_fingerprint?.toLowerCase().includes(s);
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortField === "display_name") cmp = (a.display_name || "").localeCompare(b.display_name || "");
      else if (sortField === "free_messages_used") cmp = a.free_messages_used - b.free_messages_used;
      return sortDir === "desc" ? -cmp : cmp;
    }), [users, filter, search, sortField, sortDir]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(p => p === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  if (authLoading || isAdmin === null) {
    return <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const tabs: { key: AdminTab; label: string; icon: any; badge?: number }[] = [
    { key: "dashboard", label: "Dashboard", icon: TrendingUp },
    { key: "users", label: "Usuários", icon: Users },
    { key: "tickets", label: "Tickets", icon: LifeBuoy, badge: counts.tickets },
    { key: "apikeys", label: "API Keys", icon: KeySquare, badge: counts.apps },
    { key: "audit", label: "Auditoria", icon: ScrollText },
  ];

  const currentTab = tabs.find(t => t.key === adminTab);

  return (
    <div className="min-h-screen bg-background text-foreground flex relative overflow-hidden">
      {/* neon ambient bg */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* SIDEBAR */}
      <aside className={`fixed md:sticky top-0 left-0 h-[100dvh] shrink-0 z-50 md:z-10 bg-sidebar/90 backdrop-blur-2xl border-r border-primary/15 flex flex-col transition-all duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} ${sidebarCollapsed ? "w-16" : "w-64"}`}>
        <div className="h-14 flex items-center justify-between px-3 border-b border-primary/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-primary/40 to-primary/5 flex items-center justify-center border border-primary/30 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-black tracking-tight bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent">ADMIN</h1>
                <p className="text-[9px] text-primary/60 font-bold uppercase tracking-widest truncate">SnyX Console</p>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/20"><X className="w-4 h-4" /></button>
          <button onClick={() => setSidebarCollapsed(c => !c)} className="hidden md:flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/20" title={sidebarCollapsed ? "Expandir" : "Recolher"}>
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {!sidebarCollapsed && <p className="px-3 pb-2 pt-1 text-[9px] font-black text-primary/40 uppercase tracking-widest">Painel</p>}
          {tabs.map(tab => {
            const active = adminTab === tab.key;
            return (
              <button key={tab.key} onClick={() => { setAdminTab(tab.key); setSidebarOpen(false); }} title={sidebarCollapsed ? tab.label : undefined} className={`w-full flex items-center gap-3 ${sidebarCollapsed ? "justify-center px-0" : "px-3"} py-2.5 rounded-xl text-sm font-medium transition-all group relative ${active ? "bg-gradient-to-r from-primary/15 to-transparent text-primary border border-primary/25 shadow-[0_0_20px_-8px_hsl(var(--primary)/0.5)]" : "text-muted-foreground hover:text-foreground hover:bg-primary/5 border border-transparent"}`}>
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full shadow-[0_0_8px_hsl(var(--primary))]" />}
                <tab.icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="flex-1 text-left">{tab.label}</span>}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground min-w-[18px] text-center ${sidebarCollapsed ? "absolute -top-0.5 -right-0.5" : ""}`}>{tab.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-primary/10 space-y-1 shrink-0">
          <Link to="/owner-panel" title={sidebarCollapsed ? "Painel do Dono" : undefined} className={`w-full flex items-center gap-3 ${sidebarCollapsed ? "justify-center px-0" : "px-3"} py-2 rounded-xl text-xs text-amber-400 hover:bg-amber-500/10 transition-all border border-amber-500/20 bg-amber-500/5`}>
            <Crown className="w-3.5 h-3.5 shrink-0" />{!sidebarCollapsed && <span className="font-bold">Painel do Dono</span>}
          </Link>
          <Link to="/" title={sidebarCollapsed ? "Voltar" : undefined} className={`w-full flex items-center gap-3 ${sidebarCollapsed ? "justify-center px-0" : "px-3"} py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted/15 transition-all`}>
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />{!sidebarCollapsed && <span>Voltar ao app</span>}
          </Link>
          {!sidebarCollapsed && (
            <div className="px-3 py-2 rounded-xl bg-muted/10 border border-border/10">
              <p className="text-[10px] text-muted-foreground/50 truncate">{user.email}</p>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-2 border-b border-primary/10 bg-background/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/20"><Menu className="w-4 h-4" /></button>
            <div className="flex items-center gap-2 min-w-0">
              {currentTab && <currentTab.icon className="w-4 h-4 text-primary shrink-0" />}
              <h2 className="text-sm font-black tracking-tight truncate">{currentTab?.label || "Admin"}</h2>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 hidden sm:inline">v2</span>
            </div>
          </div>

          {/* Stats strip */}
          <div className="hidden md:flex items-center gap-2">
            {[
              { label: "Usuários", value: users.length, icon: Users, color: "text-cyan-400" },
              { label: "Tickets", value: counts.tickets, icon: LifeBuoy, color: "text-emerald-400" },
              { label: "API Pend.", value: counts.apps, icon: KeySquare, color: "text-amber-400" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card/40 border border-primary/10">
                <s.icon className={`w-3 h-3 ${s.color}`} />
                <span className="text-[10px] text-muted-foreground/70 font-medium">{s.label}</span>
                <span className={`text-xs font-black ${s.color}`}>{s.value}</span>
              </div>
            ))}
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />ONLINE
            </span>
            <button
              onClick={() => setBotSettingsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary hover:bg-primary/20 hover:border-primary/40 transition-all"
              title="Personalizar bot"
            >
              <Settings2 className="w-3 h-3" />
              <span className="hidden sm:inline">BOT</span>
            </button>
          </div>
        </header>

        <ChatSettings open={botSettingsOpen} onClose={() => setBotSettingsOpen(false)} />

        <div className="flex-1 overflow-y-auto">
          {adminTab === "dashboard" && <div className="max-w-7xl mx-auto px-4 py-6 w-full"><AdminDashboard /></div>}
          {adminTab === "tickets" && <div className="max-w-7xl mx-auto px-4 py-6 w-full"><TicketsTab /></div>}
          {adminTab === "audit" && (
            <div className="max-w-7xl mx-auto px-4 py-6 w-full space-y-6">
              <LogsTab />
              <NotesTab />
            </div>
          )}
          {adminTab === "apikeys" && <div className="max-w-7xl mx-auto px-4 py-6 w-full"><ApiKeysTab /></div>}

          {adminTab === "users" && (
            <div className="max-w-7xl mx-auto px-4 py-6">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {(["all", "vip", "dev", "free", "banned", "expired"] as FilterType[]).map(f => (
                  <button key={f} onClick={() => { setFilter(f); setPage(0); }} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === f ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_15px_-5px_hsl(var(--primary)/0.4)]" : "text-muted-foreground hover:text-foreground bg-muted/15 border border-border/15"}`}>
                    {f === "all" ? "Todos" : f === "vip" ? "VIP" : f === "dev" ? "DEV" : f === "free" ? "Free" : f === "banned" ? "Banidos" : "Expirados"}
                  </button>
                ))}
              </div>

              {/* Search & Sort */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar por nome, ID, IP, fingerprint..." className="w-full bg-muted/20 border border-border/20 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-all" />
                </div>
                <div className="flex items-center gap-1">
                  {([{ field: "created_at" as SortField, label: "Data" }, { field: "display_name" as SortField, label: "Nome" }, { field: "free_messages_used" as SortField, label: "Msgs" }]).map(s => (
                    <button key={s.field} onClick={() => toggleSort(s.field)} className={`px-2.5 py-2 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${sortField === s.field ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground bg-muted/20 border border-border/20 hover:text-foreground"}`}>
                      {s.label}
                      {sortField === s.field && (sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                    </button>
                  ))}
                </div>
                <button onClick={fetchUsers} className="p-2.5 rounded-xl bg-muted/20 border border-border/20 text-muted-foreground hover:text-foreground hover:bg-primary/10" title="Atualizar"><RefreshCw size={16} /></button>
              </div>

              {/* User list */}
              {loadingUsers ? <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div> :
                filteredUsers.length === 0 ? <div className="text-center py-16"><p className="text-sm text-muted-foreground/50">Nenhum usuário encontrado</p></div> : (
                  <>
                    <div className="space-y-2">
                      {paginatedUsers.map(u => {
                        const isExpanded = expandedUser === u.user_id;
                        return (
                          <div key={u.user_id} className={`rounded-xl border transition-all backdrop-blur-sm ${isBanned(u) ? "border-destructive/30 bg-destructive/5" : "border-primary/10 bg-card/40 hover:border-primary/25 hover:bg-primary/5"}`}>
                            <div className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedUser(isExpanded ? null : u.user_id)}>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold truncate">{u.display_name || "Sem nome"}</span>
                                    {u.is_vip && !isVipExpired(u) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">VIP</span>}
                                    {u.is_dev && !isDevExpired(u) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">DEV</span>}
                                    {u.is_pack_steam && !isPackSteamExpired(u) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">STEAM</span>}
                                    {u.is_rpg_premium && !isRpgExpired(u) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">RPG+</span>}
                                    {u.is_vip && isVipExpired(u) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">VIP Exp</span>}
                                    {u.team_badge && (u.team_badge === "Dono" || u.team_badge === "Dona") ? (
                                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-amber-500/15 via-yellow-400/20 to-amber-500/15 text-amber-300 border border-amber-400/30 shadow-lg shadow-amber-500/10">👑 {u.team_badge}</span>
                                    ) : u.team_badge ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">🛡️ {u.team_badge}</span>
                                    ) : null}
                                    {!u.is_vip && !u.is_dev && !u.is_pack_steam && !u.is_rpg_premium && <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-muted text-muted-foreground">Free</span>}
                                    {isBanned(u) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">Banido</span>}
                                    {u.user_id === user!.id && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary">Você</span>}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-muted-foreground/60">
                                    <span className="flex items-center gap-1"><MessageCircle size={10} /> {u.free_messages_used} msgs</span>
                                    <span>Desde: {new Date(u.created_at).toLocaleDateString("pt-BR")}</span>
                                    {u.vip_expires_at && <span className="text-yellow-400/70">VIP até: {new Date(u.vip_expires_at).toLocaleDateString("pt-BR")}</span>}
                                    {u.dev_expires_at && <span className="text-cyan-400/70">DEV até: {new Date(u.dev_expires_at).toLocaleDateString("pt-BR")}</span>}
                                    {isBanned(u) && <span className="text-destructive/70">Ban até: {new Date(u.banned_until!).toLocaleString("pt-BR")}</span>}
                                  </div>
                                </div>
                                {u.user_id !== user!.id && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => setExpandedUser(isExpanded ? null : u.user_id)} className="p-2 rounded-xl border border-border/20 text-muted-foreground hover:text-foreground hover:bg-muted/30">
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={() => setTagModalUserId(u.user_id)} className="px-3 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center gap-1.5 text-xs font-bold shadow-[0_0_15px_-5px_hsl(var(--primary)/0.4)]">
                                      <Sparkles className="w-3.5 h-3.5" /><span className="hidden sm:inline">Abrir perfil</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="border-t border-border/20 p-4 bg-muted/5 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                  {[
                                    { label: "User ID", val: u.user_id, key: "id" },
                                    { label: "IP", val: u.ip_address, key: "ip" },
                                    { label: "Fingerprint", val: u.device_fingerprint, key: "fp" },
                                  ].map(f => (
                                    <div key={f.key}>
                                      <p className="text-muted-foreground/50 mb-1">{f.label}</p>
                                      <div className="flex items-center gap-2">
                                        <code className="text-[11px] text-foreground/70 font-mono bg-muted/40 px-2 py-1 rounded-lg truncate flex-1">{f.val || "N/A"}</code>
                                        {f.val && (
                                          <button onClick={() => copyToClipboard(f.val!, u.user_id + "-" + f.key)} className="p-1 rounded hover:bg-muted/50">
                                            {copiedId === u.user_id + "-" + f.key ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-muted-foreground" />}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  <div>
                                    <p className="text-muted-foreground/50 mb-1">Criado em</p>
                                    <code className="text-[11px] text-foreground/70 font-mono bg-muted/40 px-2 py-1 rounded-lg block">{new Date(u.created_at).toLocaleString("pt-BR")}</code>
                                  </div>
                                </div>

                                {!isBanned(u) && u.user_id !== user!.id && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[11px] text-muted-foreground">Banir por:</span>
                                    <input type="number" min={1} max={8760} value={banHoursInput[u.user_id] || 24} onChange={e => setBanHoursInput(p => ({ ...p, [u.user_id]: parseInt(e.target.value) || 24 }))} className="w-16 bg-muted/30 border border-border/30 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-primary/50" />
                                    <span className="text-[11px] text-muted-foreground">horas</span>
                                    <button onClick={() => adminAction("ban", u.user_id, banHoursInput[u.user_id] || 24)} disabled={actionLoading !== null} className="px-3 py-1 text-[11px] font-bold rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 disabled:opacity-50">
                                      <Ban size={11} className="inline mr-1" />Banir
                                    </button>
                                  </div>
                                )}
                                {isBanned(u) && (
                                  <button onClick={() => adminAction("unban", u.user_id)} disabled={actionLoading !== null} className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50">
                                    <CheckCircle2 size={11} className="inline mr-1" />Desbanir
                                  </button>
                                )}

                                <div className="flex flex-wrap gap-2 pt-1">
                                  <button onClick={async () => {
                                    setActionLoading(u.user_id + "-reset_password");
                                    try {
                                      const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "reset_password", target_user_id: u.user_id } });
                                      if (error) throw error;
                                      if (data?.error) throw new Error(data.error);
                                      toast.success(`Email enviado para ${data.email}`);
                                    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Erro"); }
                                    setActionLoading(null);
                                  }} disabled={actionLoading !== null} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 disabled:opacity-50">
                                    <KeyRound size={12} />Resetar Senha
                                    {actionLoading === u.user_id + "-reset_password" && <Loader2 size={12} className="animate-spin" />}
                                  </button>
                                  <button onClick={() => { if (confirm(`Excluir ${u.display_name || u.user_id}?`)) adminAction("delete", u.user_id); }} disabled={actionLoading !== null} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 disabled:opacity-50">
                                    <Trash2 size={12} />Excluir
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-xs text-muted-foreground">{filteredUsers.length} usuário(s) • Página {page + 1} de {totalPages}</p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-xs rounded-lg bg-muted/20 border border-border/20 text-muted-foreground hover:text-foreground disabled:opacity-30">Anterior</button>
                          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-xs rounded-lg bg-muted/20 border border-border/20 text-muted-foreground hover:text-foreground disabled:opacity-30">Próximo</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
            </div>
          )}
        </div>

        <UserTagModal
          open={tagModalUserId !== null}
          user={users.find(u => u.user_id === tagModalUserId) ?? null}
          onClose={() => setTagModalUserId(null)}
          onUpdated={patch => setUsers(prev => prev.map(u => u.user_id === tagModalUserId ? { ...u, ...patch } : u))}
          onDeleted={uid => { setUsers(prev => prev.filter(u => u.user_id !== uid)); setTagModalUserId(null); }}
        />
      </div>
    </div>
  );
}
