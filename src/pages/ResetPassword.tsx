import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const COMMON_PASSWORD_PATTERNS = [/123456/i, /password/i, /qwerty/i, /abc123/i, /admin/i, /letmein/i];

const validatePassword = (password: string) => {
  const p = password.trim();
  if (p.length < 12) return "Use pelo menos 12 caracteres.";
  if (!/[a-z]/.test(p)) return "Inclua pelo menos uma letra minúscula.";
  if (!/[A-Z]/.test(p)) return "Inclua pelo menos uma letra maiúscula.";
  if (!/[0-9]/.test(p)) return "Inclua pelo menos um número.";
  if (!/[^A-Za-z0-9]/.test(p)) return "Inclua pelo menos um símbolo.";
  if (COMMON_PASSWORD_PATTERNS.some((pat) => pat.test(p))) return "Evite senhas comuns.";
  return null;
};

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    // Also check hash for recovery token
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    const err = validatePassword(password);
    if (err) {
      toast({ title: "Senha fraca", description: err, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      toast({ title: "Senha alterada!", description: "Sua senha foi redefinida com sucesso." });
      setTimeout(() => navigate("/"), 2000);
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao redefinir senha.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Verificando link de recuperação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-wide text-foreground">Redefinir Senha</h1>
          <p className="text-xs text-muted-foreground/60 mt-1">Digite sua nova senha</p>
        </div>

        {success ? (
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10">
              <Check className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-sm text-foreground">Senha alterada com sucesso!</p>
            <p className="text-xs text-muted-foreground">Redirecionando...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground block">Nova senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  minLength={12}
                  className="w-full bg-muted/30 border border-border/30 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border/60 focus:bg-muted/40 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground/50 leading-relaxed mt-1.5">
                12+ caracteres com maiúscula, minúscula, número e símbolo.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground block">Confirmar nova senha</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={12}
                className="w-full bg-muted/30 border border-border/30 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border/60 focus:bg-muted/40 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-medium rounded-xl py-3 transition-all flex items-center justify-center gap-2 text-sm mt-6"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
