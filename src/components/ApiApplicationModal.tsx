import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  planSlug: string;
  planName: string;
  onApproved: (apiKey: string) => void;
}

export function ApiApplicationModal({ open, onClose, planSlug, planName, onApproved }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    company_or_project: "",
    project_url: "",
    use_case: "",
    estimated_volume: "",
    category: "",
  });

  const update = (k: keyof typeof form) => (e: any) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.use_case.trim().length < 60) {
      toast.error("Descreva o caso de uso com mais detalhes (mínimo 60 caracteres).");
      return;
    }
    setSubmitting(true);
    setRejected(null);
    try {
      const { data, error } = await supabase.functions.invoke("apply-api-key", {
        body: { plan_slug: planSlug, ...form },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.status === "approved") {
        onApproved(res.api_key);
      } else if (res?.status === "rejected") {
        setRejected(res.message || "Solicitação recusada.");
      } else if (res?.error) {
        toast.error(res.message || res.error);
      }
    } catch (err: any) {
      toast.error("Erro ao enviar solicitação", { description: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    if (submitting) return;
    setRejected(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Solicitar API SnyX — {planName}
          </DialogTitle>
          <DialogDescription>
            Pra evitar abuso, fazemos uma verificação rápida. Responda com sinceridade — nossa IA analisa cada solicitação.
          </DialogDescription>
        </DialogHeader>

        {rejected ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-foreground">{rejected}</div>
            </div>
            <Button onClick={close} variant="outline" className="w-full">Entendi</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="full_name">Nome completo *</Label>
                <Input id="full_name" required minLength={3} maxLength={150}
                  value={form.full_name} onChange={update("full_name")}
                  placeholder="Ex: Maria Silva" />
              </div>
              <div>
                <Label htmlFor="company_or_project">Empresa / Projeto *</Label>
                <Input id="company_or_project" required minLength={2} maxLength={150}
                  value={form.company_or_project} onChange={update("company_or_project")}
                  placeholder="Ex: Acme SaaS / Meu TCC" />
              </div>
            </div>

            <div>
              <Label htmlFor="project_url">Site / URL do projeto (opcional)</Label>
              <Input id="project_url" type="url" maxLength={300}
                value={form.project_url} onChange={update("project_url")}
                placeholder="https://meusite.com" />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="category">Tipo de aplicação</Label>
                <select id="category" value={form.category} onChange={update("category")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Selecione...</option>
                  <option value="chatbot">Chatbot / Assistente</option>
                  <option value="saas">SaaS / Web app</option>
                  <option value="mobile">App mobile</option>
                  <option value="internal">Ferramenta interna</option>
                  <option value="research">Estudo / Pesquisa</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              <div>
                <Label htmlFor="estimated_volume">Volume estimado/dia</Label>
                <select id="estimated_volume" value={form.estimated_volume} onChange={update("estimated_volume")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Selecione...</option>
                  <option value="<100">Até 100 requisições</option>
                  <option value="100-1000">100 – 1.000</option>
                  <option value="1000-5000">1.000 – 5.000</option>
                  <option value=">5000">Mais de 5.000</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="use_case">Como você vai usar a API? *</Label>
              <Textarea id="use_case" required minLength={60} maxLength={2000} rows={5}
                value={form.use_case} onChange={update("use_case")}
                placeholder="Ex: Vou integrar a API no chatbot do meu site de e-commerce para responder dúvidas sobre produtos. Pretendo usar o modelo básico para classificar mensagens..." />
              <p className="text-xs text-muted-foreground mt-1">
                {form.use_case.length}/2000 — mínimo 60 caracteres. Seja específico: a IA detecta texto vago/falso.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Analisando...</>) : "Enviar solicitação"}
              </Button>
              <Button type="button" variant="outline" onClick={close} disabled={submitting}>Cancelar</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
