import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Plus, Copy, Check, Trash2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface LicenseKey {
  id: string;
  key_code: string;
  is_used: boolean;
  used_by_email: string | null;
  used_at: string | null;
  created_at: string;
}

type KeyTier = "basic" | "pro" | "unlimited";

export function AdminHostingKeysPanel() {
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<KeyTier>("basic");
  const [quantity, setQuantity] = useState(1);

  const fetchKeys = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("license_keys")
      .select("*")
      .like("key_code", "HOST-%")
      .order("created_at", { ascending: false });

    if (!error && data) setKeys(data);
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const generateKeys = async () => {
    setGenerating(true);
    try {
      const newKeys: { key_code: string }[] = [];
      for (let i = 0; i < quantity; i++) {
        const rand = crypto.getRandomValues(new Uint8Array(8));
        const hex = Array.from(rand).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        const tierPrefix = selectedTier.toUpperCase();
        newKeys.push({ key_code: `HOST-${tierPrefix}-${hex}` });
      }

      const { error } = await supabase
        .from("license_keys")
        .insert(newKeys);

      if (error) throw error;
      toast.success(`${quantity} chave(s) ${selectedTier} gerada(s)! 🔑`);
      fetchKeys();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar chaves");
    }
    setGenerating(false);
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from("license_keys").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao deletar chave");
    } else {
      toast.success("Chave deletada");
      setKeys(prev => prev.filter(k => k.id !== id));
    }
  };

  const revokeAndDelete = async (key: LicenseKey) => {
    if (!confirm(`Revogar acesso de ${key.used_by_email || "usuário"} e deletar a chave?`)) return;
    try {
      // Revoke hosting tier if used by someone
      if (key.used_by_email) {
        const { data: userId } = await supabase.rpc("find_user_by_email", { p_email: key.used_by_email });
        if (userId) {
          await supabase.rpc("admin_revoke_hosting", { p_user_id: userId });
        }
      }
      // Delete the key
      const { error } = await supabase.from("license_keys").delete().eq("id", key.id);
      if (error) throw error;
      toast.success(`Chave revogada e deletada! ${key.used_by_email || ""}`);
      setKeys(prev => prev.filter(k => k.id !== key.id));
    } catch (err) {
      console.error(err);
      toast.error("Erro ao revogar chave");
    }

  const copyKey = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const tiers: { value: KeyTier; label: string; color: string; sites: string }[] = [
    { value: "basic", label: "Basic", color: "text-blue-400 border-blue-500/30 bg-blue-500/10", sites: "3 sites" },
    { value: "pro", label: "Pro", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", sites: "10 sites" },
    { value: "unlimited", label: "Unlimited", color: "text-amber-400 border-amber-500/30 bg-amber-500/10", sites: "∞ sites" },
  ];

  const usedCount = keys.filter(k => k.is_used).length;
  const availableCount = keys.filter(k => !k.is_used).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card/50 border border-border/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{keys.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="bg-card/50 border border-border/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{availableCount}</p>
          <p className="text-xs text-muted-foreground">Disponíveis</p>
        </div>
        <div className="bg-card/50 border border-border/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{usedCount}</p>
          <p className="text-xs text-muted-foreground">Usadas</p>
        </div>
      </div>

      {/* Generate */}
      <div className="bg-card/50 border border-border/20 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          Gerar Chaves de Hosting
        </h3>

        <div className="flex flex-wrap gap-2">
          {tiers.map(t => (
            <button
              key={t.value}
              onClick={() => setSelectedTier(t.value)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                selectedTier === t.value ? t.color : "text-muted-foreground border-border/20 hover:border-border/40"
              }`}
            >
              {t.label} ({t.sites})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">Quantidade:</label>
          <div className="flex items-center gap-1">
            {[1, 5, 10, 25].map(n => (
              <button
                key={n}
                onClick={() => setQuantity(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  quantity === n ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground border-border/20 hover:border-border/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={generateKeys}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          Gerar {quantity} chave(s) {selectedTier}
        </button>
      </div>

      {/* Keys list */}
      <div className="bg-card/50 border border-border/20 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Chaves Geradas</h3>
          <button onClick={fetchKeys} className="p-1.5 rounded-lg hover:bg-muted/50 transition-all text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhuma chave de hosting gerada ainda</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {keys.map(key => {
              const tier = key.key_code.split("-")[1]?.toLowerCase() || "basic";
              const tierInfo = tiers.find(t => t.value === tier) || tiers[0];

              return (
                <div
                  key={key.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    key.is_used ? "border-border/10 opacity-50" : "border-border/20 hover:border-border/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${tierInfo.color}`}>
                      {tier}
                    </span>
                    <code className="text-xs font-mono truncate">{key.key_code}</code>
                    {key.is_used && (
                      <span className="text-[10px] text-muted-foreground">
                        Usada por {key.used_by_email || "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyKey(key.id, key.key_code)}
                      className="p-1.5 rounded-lg hover:bg-muted/50 transition-all text-muted-foreground"
                      title="Copiar"
                    >
                      {copiedId === key.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => key.is_used ? revokeAndDelete(key) : deleteKey(key.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-all text-muted-foreground hover:text-red-400"
                      title={key.is_used ? "Revogar acesso e deletar" : "Deletar"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
