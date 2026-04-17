import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertCircle, ArrowLeft, CheckCircle2, Copy, KeyRound,
  Loader2, ShieldCheck, XCircle,
} from "lucide-react";
import { toast } from "sonner";

type Status = "approved" | "rejected" | "pending" | null;

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const { loading: authLoading } = useAuth();
  const status = (params.get("status") || params.get("collection_status")) as Status;
  const paymentId = params.get("payment_id") || params.get("collection_id") || "";

  const [form, setForm] = useState({ full_name: "", company_or_project: "", project_url: "", use_case: "" });
  const [submitting, setSubmitting] = useState(false);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = status === "approved"
      ? "Pagamento aprovado — API SnyX"
      : "Pagamento — API SnyX";
  }, [status]);

  const update = (k: keyof typeof form) => (e: any) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error("Aceite os termos de uso para continuar.");
      return;
    }
    if (!paymentId) {
      toast.error("Identificador de pagamento ausente.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment-and-issue-key", {
        body: { payment_id: paymentId, ...form },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.status === "approved" && res?.api_key) {
        setIssuedKey(res.api_key);
        setPlanName(res.plan_name || null);
      } else {
        setErrorMsg(res?.message || res?.error || "Não foi possível emitir a chave.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Falha ao validar pagamento.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyKey = async () => {
    if (!issuedKey) return;
    await navigator.clipboard.writeText(issuedKey);
    toast.success("Chave copiada!");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <AuroraBackground />
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <Link to="/api" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar para planos
        </Link>

        {/* === STATUS: NÃO APROVADO === */}
        {status !== "approved" && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/15 flex items-center justify-center mb-4">
              {status === "pending" ? (
                <AlertCircle className="w-8 h-8 text-yellow-500" />
              ) : (
                <XCircle className="w-8 h-8 text-destructive" />
              )}
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {status === "pending" ? "Pagamento pendente" : "Pagamento não finalizado"}
            </h1>
            <p className="text-muted-foreground mb-6">
              {status === "pending"
                ? "Seu pagamento está em análise. Assim que for aprovado, volte aqui para gerar sua API key."
                : "Não conseguimos confirmar seu pagamento. Nenhum valor foi cobrado. Tente novamente quando quiser."}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button asChild>
                <Link to="/api">Tentar novamente</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Ir para o início</Link>
              </Button>
            </div>
          </div>
        )}

        {/* === STATUS: APROVADO — Formulário + termos === */}
        {status === "approved" && !issuedKey && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Pagamento aprovado!</h1>
                <p className="text-sm text-muted-foreground">Falta só preencher seus dados para gerar sua API key.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="full_name">Nome completo *</Label>
                  <Input id="full_name" required minLength={3} maxLength={150}
                    value={form.full_name} onChange={update("full_name")} placeholder="Seu nome" />
                </div>
                <div>
                  <Label htmlFor="company_or_project">Empresa / Projeto *</Label>
                  <Input id="company_or_project" required minLength={2} maxLength={150}
                    value={form.company_or_project} onChange={update("company_or_project")}
                    placeholder="Onde vai usar" />
                </div>
              </div>

              <div>
                <Label htmlFor="project_url">Site / URL (opcional)</Label>
                <Input id="project_url" type="url" maxLength={300}
                  value={form.project_url} onChange={update("project_url")} placeholder="https://..." />
              </div>

              <div>
                <Label htmlFor="use_case">Como vai usar a API? (opcional)</Label>
                <Textarea id="use_case" maxLength={1000} rows={3}
                  value={form.use_case} onChange={update("use_case")}
                  placeholder="Breve descrição do uso..." />
              </div>

              {/* Termos de uso */}
              <div className="rounded-lg border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground space-y-2 max-h-48 overflow-y-auto">
                <h3 className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Termos de uso da API SnyX
                </h3>
                <p>1. <strong>Uso pessoal e comercial</strong> permitidos dentro dos limites do plano contratado.</p>
                <p>2. <strong>Proibido</strong>: revender, compartilhar, expor publicamente a chave, fazer scraping abusivo, gerar conteúdo ilegal, fraudulento ou que viole direitos de terceiros.</p>
                <p>3. A chave é <strong>pessoal e intransferível</strong>. Em caso de vazamento, comunique imediatamente para revogação.</p>
                <p>4. A SnyX pode <strong>suspender ou revogar</strong> a chave em caso de uso indevido, sem reembolso.</p>
                <p>5. Limites de requisições/dia e /minuto são aplicados conforme o plano. Excessos são bloqueados automaticamente.</p>
                <p>6. Logs de uso são mantidos para auditoria e melhoria do serviço.</p>
              </div>

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-muted-foreground">
                  Li e aceito os <strong className="text-foreground">termos de uso</strong> da API SnyX.
                </span>
              </label>

              {errorMsg && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {errorMsg}
                </div>
              )}

              <Button type="submit" disabled={submitting || !acceptedTerms} className="w-full">
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando sua API key...</>
                ) : (
                  <><KeyRound className="w-4 h-4 mr-2" /> Gerar minha API key</>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* === MODAL: Chave emitida === */}
        <Dialog open={!!issuedKey} onOpenChange={() => {}}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="w-5 h-5" /> Sua API key está pronta!
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {planName && (
                <p className="text-sm text-muted-foreground">
                  Plano <strong className="text-foreground">{planName}</strong> ativado por 30 dias.
                </p>
              )}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 font-mono text-xs break-all">
                {issuedKey}
              </div>
              <Button onClick={copyKey} variant="outline" className="w-full">
                <Copy className="w-4 h-4 mr-2" /> Copiar chave
              </Button>
              <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-semibold text-foreground">Como usar:</p>
                <pre className="whitespace-pre-wrap text-muted-foreground">{`Authorization: Bearer ${issuedKey?.slice(0, 12)}...`}</pre>
              </div>
              <p className="text-xs text-destructive">
                ⚠️ Guarde essa chave em local seguro. Por segurança, ela não será exibida novamente na íntegra.
              </p>
              <Button asChild className="w-full">
                <Link to="/api">Concluir</Link>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
