import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  KeyRound, RotateCcw, Ban, Trash2, CheckCircle2, Search,
  Loader2, Calendar, Activity, AlertTriangle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ApiClient {
  id: string;
  user_id: string;
  name: string;
  api_key_prefix: string;
  status: string;
  daily_used: number;
  monthly_used: number;
  total_used: number;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  plan_id: string;
  // joined
  plan_name?: string;
  plan_slug?: string;
  plan_price?: number;
  user_email?: string;
  user_display_name?: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  revoked: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  expired: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export default function ApiClientsManager() {
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "free" | "paid" | "revoked">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    // Busca clients + planos
    const { data: clientsData, error } = await supabase
      .from("api_clients")
      .select("*, api_plans(name, slug, price_brl)")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast.error("Erro ao carregar API clients");
      setLoading(false);
      return;
    }

    // Busca display_names em batch
    const userIds = Array.from(new Set((clientsData || []).map((c: any) => c.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.display_name]));

    const enriched: ApiClient[] = (clientsData || []).map((c: any) => ({
      ...c,
      plan_name: c.api_plans?.name,
      plan_slug: c.api_plans?.slug,
      plan_price: c.api_plans?.price_brl,
      user_display_name: profileMap.get(c.user_id) || "Sem nome",
    }));

    setClients(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = clients.filter(c => {
    if (filter === "free" && Number(c.plan_price || 0) > 0) return false;
    if (filter === "paid" && Number(c.plan_price || 0) === 0) return false;
    if (filter === "revoked" && c.status !== "revoked") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.user_display_name?.toLowerCase().includes(q) ||
        c.api_key_prefix?.toLowerCase().includes(q) ||
        c.user_id?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const revoke = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.rpc("admin_revoke_api_client" as any, { p_client_id: id });
    setBusyId(null);
    if (error || !(data as any)?.success) { toast.error("Falha ao revogar"); return; }
    toast.success("Chave revogada");
    load();
  };

  const reactivate = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.rpc("admin_reactivate_api_client" as any, { p_client_id: id });
    setBusyId(null);
    if (error || !(data as any)?.success) { toast.error("Falha ao reativar"); return; }
    toast.success("Chave reativada");
    load();
  };

  const reset = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.rpc("admin_reset_api_client_usage" as any, { p_client_id: id });
    setBusyId(null);
    if (error || !(data as any)?.success) { toast.error("Falha ao resetar"); return; }
    toast.success("Uso resetado (diário e mensal zerados)");
    load();
  };

  const remove = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.rpc("admin_delete_api_client" as any, { p_client_id: id });
    setBusyId(null);
    if (error || !(data as any)?.success) { toast.error("Falha ao deletar"); return; }
    toast.success("Chave deletada permanentemente");
    load();
  };

  const stats = {
    total: clients.length,
    free: clients.filter(c => Number(c.plan_price || 0) === 0).length,
    paid: clients.filter(c => Number(c.plan_price || 0) > 0).length,
    revoked: clients.filter(c => c.status === "revoked").length,
  };

  return (
    <div className="space-y-4">
      {/* Header + filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold">Gerenciar API Keys</h3>
            <p className="text-xs text-muted-foreground">Revogue, resete ou apague chaves dos clientes da API</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`p-3 rounded-xl border text-left transition-all ${filter === "all" ? "border-primary/60 bg-primary/10" : "border-border/40 bg-card/40 hover:border-primary/30"}`}
        >
          <p className="text-[10px] text-muted-foreground uppercase">Todas</p>
          <p className="text-xl font-black">{stats.total}</p>
        </button>
        <button
          onClick={() => setFilter("free")}
          className={`p-3 rounded-xl border text-left transition-all ${filter === "free" ? "border-emerald-500/60 bg-emerald-500/10" : "border-border/40 bg-card/40 hover:border-emerald-500/30"}`}
        >
          <p className="text-[10px] text-emerald-400 uppercase">Grátis</p>
          <p className="text-xl font-black text-emerald-400">{stats.free}</p>
        </button>
        <button
          onClick={() => setFilter("paid")}
          className={`p-3 rounded-xl border text-left transition-all ${filter === "paid" ? "border-amber-500/60 bg-amber-500/10" : "border-border/40 bg-card/40 hover:border-amber-500/30"}`}
        >
          <p className="text-[10px] text-amber-400 uppercase">Pagas</p>
          <p className="text-xl font-black text-amber-400">{stats.paid}</p>
        </button>
        <button
          onClick={() => setFilter("revoked")}
          className={`p-3 rounded-xl border text-left transition-all ${filter === "revoked" ? "border-rose-500/60 bg-rose-500/10" : "border-border/40 bg-card/40 hover:border-rose-500/30"}`}
        >
          <p className="text-[10px] text-rose-400 uppercase">Revogadas</p>
          <p className="text-xl font-black text-rose-400">{stats.revoked}</p>
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, prefixo da chave ou user_id..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <KeyRound className="w-10 h-10 mx-auto mb-3 opacity-30" />
          Nenhuma API key encontrada
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((c) => {
            const isFreePlan = Number(c.plan_price || 0) === 0;
            const isRevoked = c.status === "revoked";
            return (
              <div
                key={c.id}
                className={`p-4 rounded-xl border bg-card/40 backdrop-blur-sm transition-all ${
                  isRevoked ? "border-rose-500/30 opacity-70" : "border-border/40 hover:border-primary/30"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm truncate">{c.user_display_name}</span>
                      <Badge variant="outline" className={STATUS_STYLES[c.status] || ""}>
                        {c.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={isFreePlan ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}
                      >
                        {c.plan_name} {!isFreePlan && `· R$ ${Number(c.plan_price).toFixed(2)}`}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">
                      {c.api_key_prefix}··· · ID: {c.user_id.slice(0, 8)}
                    </div>
                  </div>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                  <div className="px-2 py-1.5 rounded-lg bg-muted/30">
                    <div className="text-[10px] text-muted-foreground">Hoje</div>
                    <div className="font-bold text-cyan-400">{c.daily_used.toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="px-2 py-1.5 rounded-lg bg-muted/30">
                    <div className="text-[10px] text-muted-foreground">Mês</div>
                    <div className="font-bold text-purple-400">{c.monthly_used.toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="px-2 py-1.5 rounded-lg bg-muted/30">
                    <div className="text-[10px] text-muted-foreground">Total</div>
                    <div className="font-bold">{c.total_used.toLocaleString("pt-BR")}</div>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground/70 mb-3 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Criada {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  {c.last_used_at && (
                    <span className="inline-flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      Último uso {new Date(c.last_used_at).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reset(c.id)}
                    disabled={busyId === c.id}
                    className="h-8 text-xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Resetar uso
                  </Button>

                  {isRevoked ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reactivate(c.id)}
                      disabled={busyId === c.id}
                      className="h-8 text-xs text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Reativar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => revoke(c.id)}
                      disabled={busyId === c.id}
                      className="h-8 text-xs text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
                    >
                      <Ban className="w-3 h-3" />
                      Revogar
                    </Button>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === c.id}
                        className="h-8 text-xs text-rose-400 border-rose-500/40 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                        Apagar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-rose-400" />
                          Apagar permanentemente?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          A chave <code className="px-1 bg-muted rounded text-xs">{c.api_key_prefix}···</code> de
                          <strong className="mx-1">{c.user_display_name}</strong>
                          será apagada junto com todos os logs de uso. Essa ação não pode ser desfeita.
                          O usuário poderá pedir uma nova chave depois.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => remove(c.id)}
                          className="bg-rose-500 hover:bg-rose-600"
                        >
                          Apagar para sempre
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
