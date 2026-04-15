import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Key, Copy, Check, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AcceleratorKey {
  id: string;
  activation_key: string;
  status: string;
  created_at: string;
  activated_by: string | null;
  activated_at: string | null;
  expires_at: string | null;
  activated_user_name?: string;
}

export function AdminAcceleratorPanel() {
  const [keys, setKeys] = useState<AcceleratorKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expiresMonths, setExpiresMonths] = useState<number | null>(null);

  const fetchKeys = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("accelerator_keys")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar chaves");
      setLoading(false);
      return;
    }

    // Fetch display names for activated users
    const activatedIds = (data || []).filter((k: any) => k.activated_by).map((k: any) => k.activated_by);
    let namesMap: Record<string, string> = {};
    if (activatedIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", activatedIds);
      (profiles || []).forEach(p => {
        namesMap[p.user_id] = p.display_name || "Sem nome";
      });
    }

    setKeys((data || []).map((k: any) => ({
      ...k,
      activated_user_name: k.activated_by ? namesMap[k.activated_by] || k.activated_by.slice(0, 8) : undefined,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const generateKey = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc("generate_accelerator_key", {
        p_expires_months: expiresMonths,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || "Erro");
      toast.success(`Chave gerada: ${result.key}`);
      fetchKeys();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar chave");
    }
    setGenerating(false);
  };

  const revokeKey = async (id: string) => {
    const { error } = await (supabase as any)
      .from("accelerator_keys")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Erro ao revogar"); return; }
    toast.success("Chave revogada");
    fetchKeys();
  };

  const deleteKey = async (id: string) => {
    const { error } = await (supabase as any)
      .from("accelerator_keys")
      .delete()
      .eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Chave excluída");
    setKeys(prev => prev.filter(k => k.id !== id));
  };

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const availableCount = keys.filter(k => k.status === "available").length;
  const activeCount = keys.filter(k => k.status === "active").length;
  const revokedCount = keys.filter(k => k.status === "revoked").length;

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Disponíveis", value: availableCount, color: "text-green-400" },
          { label: "Ativas", value: activeCount, color: "text-cyan-400" },
          { label: "Revogadas", value: revokedCount, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-border/20 bg-card/50">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Generate key */}
      <div className="p-4 rounded-xl border border-border/20 bg-card/50 space-y-3">
        <h3 className="font-bold flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          Gerar Nova Chave
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={expiresMonths ?? ""}
            onChange={e => setExpiresMonths(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 rounded-lg bg-muted/50 border border-border/30 text-sm"
          >
            <option value="">Sem expiração</option>
            <option value="1">1 mês</option>
            <option value="3">3 meses</option>
            <option value="6">6 meses</option>
            <option value="12">12 meses</option>
          </select>
          <Button onClick={generateKey} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Gerar Chave
          </Button>
        </div>
      </div>

      {/* Keys list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">Chaves ({keys.length})</h3>
          <button onClick={fetchKeys} className="text-muted-foreground hover:text-foreground transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma chave gerada ainda
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {keys.map(k => (
              <div key={k.id} className="p-3 rounded-xl border border-border/20 bg-card/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-bold">{k.activation_key}</code>
                    <button onClick={() => copyKey(k.activation_key, k.id)} className="text-muted-foreground hover:text-foreground">
                      {copiedId === k.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      k.status === "available" ? "bg-green-500/20 text-green-400" :
                      k.status === "active" ? "bg-cyan-500/20 text-cyan-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>{k.status}</span>
                    {k.activated_user_name && <span>• Ativada por: {k.activated_user_name}</span>}
                    {k.expires_at && <span>• Expira: {new Date(k.expires_at).toLocaleDateString("pt-BR")}</span>}
                    <span>• {new Date(k.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {k.status === "active" && (
                    <button onClick={() => revokeKey(k.id)} className="p-1.5 rounded-lg text-yellow-400 hover:bg-yellow-500/10 transition" title="Revogar">
                      <Key className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => deleteKey(k.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition" title="Excluir">
                    <Trash2 className="w-3.5 h-3.5" />
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
