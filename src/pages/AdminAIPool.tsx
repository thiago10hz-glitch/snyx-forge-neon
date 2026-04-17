import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, ArrowLeft, Activity } from "lucide-react";

interface AIKey {
  id: string;
  provider: string;
  label: string;
  api_key: string;
  model_default: string | null;
  daily_limit: number;
  daily_used: number;
  total_used: number;
  priority: number;
  status: string;
  last_error: string | null;
  last_used_at: string | null;
  created_at: string;
}

const PROVIDERS = [
  { value: "groq", label: "Groq (14.4k req/dia)", model: "llama-3.3-70b-versatile", limit: 14400 },
  { value: "google", label: "Google AI (1.5k req/dia)", model: "gemini-2.0-flash-exp", limit: 1500 },
  { value: "lovable", label: "Lovable AI (~3k/mês)", model: "google/gemini-2.5-flash", limit: 3000 },
  { value: "cerebras", label: "Cerebras (14.4k req/dia)", model: "llama-3.3-70b", limit: 14400 },
  { value: "openrouter", label: "OpenRouter (Free tier)", model: "meta-llama/llama-3.3-70b-instruct:free", limit: 200 },
  { value: "mistral", label: "Mistral (1M tokens/mês)", model: "mistral-small-latest", limit: 1000 },
  { value: "github", label: "GitHub Models (150 req/dia)", model: "gpt-4o-mini", limit: 150 },
  { value: "together", label: "Together AI ($5 free)", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", limit: 5000 },
  { value: "cloudflare", label: "Cloudflare Workers AI (10k/dia)", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", limit: 10000 },
];

export default function AdminAIPool() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [keys, setKeys] = useState<AIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    provider: "groq",
    label: "",
    api_key: "",
    model_default: "",
    daily_limit: 14400,
    priority: 100,
  });

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    (async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!data) { navigate("/"); toast.error("Acesso negado"); return; }
      setIsAdmin(true);
      loadKeys();
    })();
  }, [user]);

  async function loadKeys() {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_provider_keys")
      .select("*")
      .order("priority", { ascending: true });
    if (error) toast.error(error.message);
    else setKeys((data as AIKey[]) || []);
    setLoading(false);
  }

  async function addKey() {
    if (!form.label || !form.api_key) { toast.error("Preencha label e api_key"); return; }
    const provider = PROVIDERS.find(p => p.value === form.provider);
    const { error } = await supabase.from("ai_provider_keys").insert({
      provider: form.provider,
      label: form.label,
      api_key: form.api_key,
      model_default: form.model_default || provider?.model,
      daily_limit: form.daily_limit,
      priority: form.priority,
      created_by: user!.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Chave adicionada!");
    setDialogOpen(false);
    setForm({ provider: "groq", label: "", api_key: "", model_default: "", daily_limit: 14400, priority: 100 });
    loadKeys();
  }

  async function deleteKey(id: string) {
    if (!confirm("Apagar esta chave?")) return;
    const { error } = await supabase.from("ai_provider_keys").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removida"); loadKeys(); }
  }

  async function resetUsage() {
    const { error } = await supabase.rpc("reset_daily_ai_usage");
    if (error) toast.error(error.message);
    else { toast.success("Uso diário resetado"); loadKeys(); }
  }

  async function reactivate(id: string) {
    const { error } = await supabase
      .from("ai_provider_keys")
      .update({ status: "active", last_error: null, daily_used: 0 })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Reativada"); loadKeys(); }
  }

  if (isAdmin === null) return <div className="p-8 text-center text-muted-foreground">Verificando...</div>;

  const totalCapacity = keys.filter(k => k.status === "active").reduce((s, k) => s + k.daily_limit, 0);
  const totalUsed = keys.reduce((s, k) => s + k.daily_used, 0);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">SnyX API — Pool de IAs</h1>
            <p className="text-sm text-muted-foreground">Gerencie chaves de provedores com failover automático</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetUsage}><RefreshCw className="h-4 w-4 mr-2" />Reset diário</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Adicionar chave</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova chave de IA</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Provedor</Label>
                  <Select value={form.provider} onValueChange={(v) => {
                    const p = PROVIDERS.find(pr => pr.value === v);
                    setForm({ ...form, provider: v, daily_limit: p?.limit || 1000, model_default: p?.model || "" });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Label (apelido)</Label><Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Ex: Groq Conta 1" /></div>
                <div><Label>API Key</Label><Input type="password" value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} placeholder="gsk_..., AIza..., sk-..." /></div>
                <div><Label>Modelo padrão</Label><Input value={form.model_default} onChange={e => setForm({ ...form, model_default: e.target.value })} placeholder="(deixe vazio p/ usar padrão)" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Limite/dia</Label><Input type="number" value={form.daily_limit} onChange={e => setForm({ ...form, daily_limit: +e.target.value })} /></div>
                  <div><Label>Prioridade</Label><Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: +e.target.value })} /></div>
                </div>
                <Button onClick={addKey} className="w-full">Adicionar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Chaves ativas</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{keys.filter(k => k.status === "active").length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Capacidade total/dia</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{totalCapacity.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Usado hoje</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{totalUsed.toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Chaves no pool</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Carregando...</p> :
           keys.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhuma chave cadastrada. Clique em "Adicionar chave" para começar.</p> :
            <div className="space-y-2">
              {keys.map(k => {
                const pct = Math.min(100, (k.daily_used / k.daily_limit) * 100);
                return (
                  <div key={k.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={k.status === "active" ? "default" : k.status === "exhausted" ? "secondary" : "destructive"}>{k.status}</Badge>
                        <span className="font-semibold">{k.label}</span>
                        <span className="text-xs text-muted-foreground">({k.provider})</span>
                        <Badge variant="outline" className="text-xs">prio {k.priority}</Badge>
                      </div>
                      <div className="flex gap-1">
                        {k.status !== "active" && <Button size="sm" variant="outline" onClick={() => reactivate(k.id)}>Reativar</Button>}
                        <Button size="sm" variant="ghost" onClick={() => deleteKey(k.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">Modelo: {k.model_default || "padrão"} • Total: {k.total_used.toLocaleString()} req</div>
                    <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${pct > 90 ? "bg-destructive" : pct > 70 ? "bg-yellow-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>{k.daily_used.toLocaleString()} / {k.daily_limit.toLocaleString()} req hoje</span>
                      {k.last_error && <span className="text-destructive truncate max-w-xs" title={k.last_error}>⚠ {k.last_error}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}
