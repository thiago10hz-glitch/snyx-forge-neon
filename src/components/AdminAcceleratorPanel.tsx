import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Key, Copy, Check, Trash2, RefreshCw, Loader2, UserPlus, Eye, EyeOff } from "lucide-react";
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

interface GeneratedAccount {
  email: string;
  password: string;
  activation_key: string;
  expires_at: string | null;
  display_name: string;
}

export function AdminAcceleratorPanel() {
  const [keys, setKeys] = useState<AcceleratorKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expiresMonths, setExpiresMonths] = useState<number | null>(null);

  // Account generator state
  const [showAccountGen, setShowAccountGen] = useState(false);
  const [accEmail, setAccEmail] = useState("");
  const [accPassword, setAccPassword] = useState("");
  const [accName, setAccName] = useState("");
  const [accExpires, setAccExpires] = useState<number | null>(1);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [generatedAccount, setGeneratedAccount] = useState<GeneratedAccount | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  const copyField = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setAccPassword(pwd);
  };

  const createAccount = async () => {
    if (!accEmail || !accPassword) {
      toast.error("Preencha email e senha");
      return;
    }
    if (accPassword.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }

    setCreatingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-vpn-account", {
        body: {
          email: accEmail,
          password: accPassword,
          display_name: accName || undefined,
          expires_months: accExpires,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao criar conta");

      setGeneratedAccount(data.account);
      toast.success("Conta criada com sucesso!");
      fetchKeys();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar conta");
    }
    setCreatingAccount(false);
  };

  const copyAllCredentials = () => {
    if (!generatedAccount) return;
    const text = `📧 Email: ${generatedAccount.email}\n🔑 Senha: ${generatedAccount.password}\n🎫 Chave: ${generatedAccount.activation_key}${generatedAccount.expires_at ? `\n⏰ Expira: ${new Date(generatedAccount.expires_at).toLocaleDateString("pt-BR")}` : ""}`;
    navigator.clipboard.writeText(text);
    setCopiedField("all");
    setTimeout(() => setCopiedField(null), 2000);
    toast.success("Credenciais copiadas!");
  };

  const resetAccountForm = () => {
    setGeneratedAccount(null);
    setAccEmail("");
    setAccPassword("");
    setAccName("");
    setShowPassword(false);
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

      {/* Account Generator */}
      <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-3">
        <button
          onClick={() => { setShowAccountGen(!showAccountGen); if (!showAccountGen) resetAccountForm(); }}
          className="w-full flex items-center justify-between"
        >
          <h3 className="font-bold flex items-center gap-2 text-purple-400">
            <UserPlus className="w-4 h-4" />
            Gerar Conta VPN (Login + Chave)
          </h3>
          <span className="text-xs text-muted-foreground">{showAccountGen ? "▲" : "▼"}</span>
        </button>

        {showAccountGen && !generatedAccount && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email *</label>
                <input
                  type="email"
                  value={accEmail}
                  onChange={e => setAccEmail(e.target.value)}
                  placeholder="usuario@email.com"
                  className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/30 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome (opcional)</label>
                <input
                  type="text"
                  value={accName}
                  onChange={e => setAccName(e.target.value)}
                  placeholder="Nome do usuário"
                  className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/30 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Senha *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={accPassword}
                      onChange={e => setAccPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/30 text-sm pr-8"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    onClick={generateRandomPassword}
                    className="px-3 py-2 rounded-lg bg-muted/50 border border-border/30 text-xs hover:bg-muted transition whitespace-nowrap"
                  >
                    Gerar
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Validade</label>
                <select
                  value={accExpires ?? ""}
                  onChange={e => setAccExpires(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/30 text-sm"
                >
                  <option value="">Sem expiração</option>
                  <option value="1">1 mês</option>
                  <option value="3">3 meses</option>
                  <option value="6">6 meses</option>
                  <option value="12">12 meses</option>
                </select>
              </div>
            </div>

            <Button onClick={createAccount} disabled={creatingAccount} className="w-full gap-2 bg-purple-600 hover:bg-purple-700">
              {creatingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Criar Conta + Ativar Chave
            </Button>
          </div>
        )}

        {showAccountGen && generatedAccount && (
          <div className="space-y-3 pt-2">
            <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 space-y-3">
              <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                <Check className="w-4 h-4" /> Conta Criada com Sucesso!
              </div>

              {[
                { label: "📧 Email", value: generatedAccount.email, field: "email" },
                { label: "🔑 Senha", value: generatedAccount.password, field: "password" },
                { label: "🎫 Chave", value: generatedAccount.activation_key, field: "key" },
                ...(generatedAccount.expires_at ? [{ label: "⏰ Expira", value: new Date(generatedAccount.expires_at).toLocaleDateString("pt-BR"), field: "expires" }] : []),
              ].map(item => (
                <div key={item.field} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/20">
                  <div>
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <div className="font-mono text-sm font-bold">{item.value}</div>
                  </div>
                  <button
                    onClick={() => copyField(item.value, item.field)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition"
                  >
                    {copiedField === item.field ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                <Button onClick={copyAllCredentials} variant="outline" className="flex-1 gap-2 text-xs">
                  {copiedField === "all" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Copiar Tudo
                </Button>
                <Button onClick={resetAccountForm} variant="outline" className="flex-1 gap-2 text-xs">
                  <UserPlus className="w-3.5 h-3.5" />
                  Criar Outra
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate key only */}
      <div className="p-4 rounded-xl border border-border/20 bg-card/50 space-y-3">
        <h3 className="font-bold flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          Gerar Apenas Chave (sem conta)
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
