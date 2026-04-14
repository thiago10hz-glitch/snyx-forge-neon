import { useSearchParams, Link } from "react-router-dom";
import { Check, ArrowLeft } from "lucide-react";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 animate-fade-in-up">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto border border-emerald-500/20">
          <Check className="w-10 h-10 text-emerald-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground">Pagamento Confirmado!</h1>
          <p className="text-sm text-muted-foreground/60">
            Seu plano foi ativado com sucesso. Aproveite todos os recursos premium!
          </p>
        </div>
        {sessionId && (
          <p className="text-[10px] text-muted-foreground/30 font-mono">
            Sessão: {sessionId.slice(0, 20)}...
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
