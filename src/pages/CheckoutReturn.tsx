import { useSearchParams, Link } from "react-router-dom";
import { Check, X, Clock, ArrowLeft } from "lucide-react";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") || searchParams.get("collection_status");
  const sessionId = searchParams.get("session_id");
  const paymentId = searchParams.get("payment_id") || searchParams.get("collection_id");

  const isApproved = status === "approved";
  const isPending = status === "pending" || status === "in_process";
  const isRejected = status === "rejected" || status === "failure";

  const icon = isApproved ? Check : isPending ? Clock : isRejected ? X : Check;
  const IconComp = icon;
  const title = isApproved
    ? "Pagamento Confirmado!"
    : isPending
    ? "Pagamento Pendente"
    : isRejected
    ? "Pagamento Recusado"
    : "Pagamento Confirmado!";
  const desc = isApproved
    ? "Seu plano foi ativado com sucesso. Aproveite todos os recursos premium!"
    : isPending
    ? "Seu pagamento está sendo processado. Assim que for confirmado, seu plano será ativado automaticamente."
    : isRejected
    ? "Houve um problema com seu pagamento. Tente novamente ou use outro método de pagamento."
    : "Seu plano foi ativado com sucesso. Aproveite todos os recursos premium!";
  const color = isApproved ? "emerald" : isPending ? "yellow" : isRejected ? "red" : "emerald";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 animate-fade-in-up">
        <div className={`w-20 h-20 rounded-full bg-${color}-500/15 flex items-center justify-center mx-auto border border-${color}-500/20`}>
          <IconComp className={`w-10 h-10 text-${color}-400`} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground/60">{desc}</p>
        </div>
        {(sessionId || paymentId) && (
          <p className="text-[10px] text-muted-foreground/30 font-mono">
            ID: {(sessionId || paymentId || "").toString().slice(0, 20)}...
          </p>
        )}
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl transition-all hover:bg-primary/90 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao SnyX
        </Link>
      </div>
    </div>
  );
}
