import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link2, X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectionModal({ isOpen, onClose }: ConnectionModalProps) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const { user } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !email.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from("chat_connections")
        .insert({
          requester_id: user.id,
          target_email: email.trim(),
          target_user_id: null,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("Você já enviou um pedido para este email");
        } else {
          throw error;
        }
      } else {
        toast.success("Pedido de conexão enviado! O admin vai analisar e aprovar. 🔗");
        setEmail("");
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar pedido de conexão");
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 ">
      <div className="bg-card border border-border/30 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold">Conectar com alguém</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/50 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Digite o email da pessoa que você quer conectar. O admin vai aprovar e vocês poderão conversar juntos com a IA! 🤝
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border/30 text-sm focus:outline-none focus:border-primary/50 transition-all"
            required
          />
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar pedido
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
