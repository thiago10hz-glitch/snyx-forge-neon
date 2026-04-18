import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

interface AgeGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}

export function AgeGateModal({ open, onOpenChange, onVerified }: AgeGateModalProps) {
  const { user } = useAuth();
  const [confirm1, setConfirm1] = useState(false);
  const [confirm2, setConfirm2] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!user) return;
    if (!confirm1 || !confirm2) {
      toast.error("Confirme as duas declarações");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ age_verified: true, age_verified_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Verificação ativada");
      onVerified();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao verificar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-destructive/30">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center mb-2">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">Conteúdo +18</DialogTitle>
          <DialogDescription className="text-center text-sm">
            Pra ver personagens marcados como adultos, confirme:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border/50 cursor-pointer hover:bg-muted/30">
            <Checkbox checked={confirm1} onCheckedChange={(v) => setConfirm1(!!v)} className="mt-0.5" />
            <span className="text-sm leading-snug">
              Tenho <strong>18 anos ou mais</strong> e estou em jurisdição onde conteúdo adulto é legal.
            </span>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-border/50 cursor-pointer hover:bg-muted/30">
            <Checkbox checked={confirm2} onCheckedChange={(v) => setConfirm2(!!v)} className="mt-0.5" />
            <span className="text-sm leading-snug">
              Entendo que personagens são <strong>fictícios e adultos</strong>. SnyX proíbe qualquer conteúdo envolvendo menores.
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!confirm1 || !confirm2 || loading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {loading ? "Verificando..." : "Confirmar e desbloquear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
