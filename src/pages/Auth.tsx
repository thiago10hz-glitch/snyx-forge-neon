import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Mail,
  Check,
  KeyRound,
  Flame,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

const VIP_LINK = "https://wa.me/554388691650";

const COMMON_PASSWORD_PATTERNS = [/123456/i, /password/i, /qwerty/i, /abc123/i, /admin/i, /letmein/i];

const inputClassName =
  "w-full rounded-2xl border border-border/40 bg-muted/20 px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/45 transition-all duration-300 focus:outline-none focus:border-primary/40 focus:bg-card focus:shadow-lg focus:shadow-primary/10";

const secondaryButtonClassName =
  "w-full rounded-2xl border border-border/40 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground transition-all duration-300 hover:bg-muted/35 hover:border-border/70";

const validateSignupPassword = (password: string, email: string) => {
  const normalizedPassword = password.trim();
  const emailLocalPart = email.split("@")[0]?.toLowerCase() ?? "";

  if (normalizedPassword.length < 12) return "Use pelo menos 12 caracteres.";
  if (!/[a-z]/.test(normalizedPassword)) return "Inclua pelo menos uma letra minúscula.";
  if (!/[A-Z]/.test(normalizedPassword)) return "Inclua pelo menos uma letra maiúscula.";
  if (!/[0-9]/.test(normalizedPassword)) return "Inclua pelo menos um número.";
  if (!/[^A-Za-z0-9]/.test(normalizedPassword)) return "Inclua pelo menos um símbolo.";
  if (emailLocalPart && normalizedPassword.toLowerCase().includes(emailLocalPart)) {
    return "Não use partes do seu e-mail na senha.";
  }
  if (COMMON_PASSWORD_PATTERNS.some((pattern) => pattern.test(normalizedPassword))) {
    return "Evite senhas comuns ou sequências fáceis.";
  }
  return null;
};

const getErrorMessage = async (error: unknown) => {
  const functionError = error as { context?: Response };
  if (functionError.context instanceof Response) {
    try {
      const payload = await functionError.context.clone().json();
      if (payload?.message && typeof payload.message === "string") return payload.message;
      if (payload?.error && typeof payload.error === "string") return payload.error;
    } catch {
      try {
        const text = await functionError.context.text();
        if (text) return text;
      } catch { /* ignore */ }
    }
  }
  if (error instanceof Error) return error.message;
  return "Erro desconhecido";
};

type AuthView = "login" | "signup" | "forgot" | "forgot-sent";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export default function Auth() {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const isAuthForm = view === "login" || view === "signup";

  useEffect(() => {
    const getFingerprint = async () => {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setFingerprint(result.visitorId);
    };
    getFingerprint();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) return;

    if (view === "signup") {
      const passwordError = validateSignupPassword(password, trimmedEmail);
      if (passwordError) {
        toast({ title: "Senha fraca", description: passwordError, variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    try {
      if (view === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
        if (error) throw error;

        if (data.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("banned_until")
            .eq("user_id", data.user.id)
            .single();

          if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
            await supabase.auth.signOut();
            const banDate = new Date(profile.banned_until).toLocaleString("pt-BR");
            toast({ title: "Conta suspensa", description: `Sua conta está banida até ${banDate}`, variant: "destructive" });
            return;
          }
        }
        navigate("/");
        return;
      }

      if (!fingerprint) {
        toast({ title: "Erro", description: "Não foi possível identificar seu dispositivo. Tente novamente.", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("signup-with-fingerprint", {
        body: { email: trimmedEmail, password, fingerprint, redirectTo: window.location.origin },
      });

      if (error) {
        const description = await getErrorMessage(error);
        toast({ title: "Erro no cadastro", description, variant: "destructive" });
        return;
      }

      if (data?.error) {
        const isDeviceRegistered = data.error === "DEVICE_ALREADY_REGISTERED";
        const isWeakPassword = data.error === "WEAK_PASSWORD";
        const isEmailRegistered = data.error === "EMAIL_ALREADY_REGISTERED";

        toast({
          title: isDeviceRegistered ? "Dispositivo já registrado" : isWeakPassword ? "Senha fraca" : isEmailRegistered ? "E-mail já cadastrado" : "Erro",
          description: isDeviceRegistered
            ? "Este dispositivo já possui uma conta. Não é permitido criar múltiplas contas."
            : isEmailRegistered
              ? "Já existe uma conta com esse e-mail. Tente entrar ou recuperar sua senha."
              : data.message || data.error,
          variant: "destructive",
        });
        return;
      }

      if (data?.success) {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
        if (!loginError) {
          toast({ title: "Conta criada!", description: "Bem-vindo ao SnyX!" });
          navigate("/");
          return;
        }
      }

      toast({ title: "Cadastro realizado", description: "Conta criada com sucesso! Faça login para continuar." });
      setPassword("");
      setView("login");
    } catch (err: unknown) {
      const description = await getErrorMessage(err);
      toast({ title: "Erro", description, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast({ title: "Preencha o e-mail", description: "Digite seu e-mail para receber o link.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setView("forgot-sent");
    } catch (err: unknown) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro ao enviar e-mail.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
        ...(provider === "google" ? { extraParams: { prompt: "select_account" } } : {}),
      });

      if (result.error) {
        toast({
          title: "Erro",
          description: result.error instanceof Error ? result.error.message : `Erro ao conectar com ${provider === "google" ? "Google" : "Apple"}.`,
          variant: "destructive",
        });
        return;
      }
      if (result.redirected) return;
      navigate("/");
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao conectar.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const switchAuthView = (nextView: "login" | "signup") => {
    setView(nextView);
    setPassword("");
  };

  const getTitle = () => {
    switch (view) {
      case "login": return "Acesse sua conta";
      case "signup": return "Crie sua conta";
      case "forgot": return "Recuperar senha";
      case "forgot-sent": return "E-mail enviado";
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/8 blur-[140px]" />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md px-4 py-8">
        {/* Card */}
        <div className="overflow-hidden rounded-3xl border border-border/30 bg-card/80 shadow-2xl shadow-black/30 backdrop-blur-xl">
          {/* Header */}
          <div className="border-b border-border/20 bg-muted/10 px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 shadow-lg shadow-primary/10">
                <Flame className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-foreground">SnyX</h1>
                <p className="text-xs text-muted-foreground">{getTitle()}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Auth tabs */}
            {isAuthForm && (
              <div className="mb-6 grid grid-cols-2 rounded-2xl border border-border/20 bg-muted/15 p-1">
                <button
                  type="button"
                  onClick={() => switchAuthView("login")}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                    view === "login"
                      ? "bg-card text-foreground shadow-lg shadow-primary/5 border border-border/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => switchAuthView("signup")}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                    view === "signup"
                      ? "bg-card text-foreground shadow-lg shadow-primary/5 border border-border/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Criar conta
                </button>
              </div>
            )}

            {/* Forgot sent */}
            {view === "forgot-sent" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Mail className="h-7 w-7 text-primary" />
                  </div>
                  <p className="text-base font-semibold text-foreground">Confira seu e-mail</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Enviamos o link para <span className="font-medium text-foreground">{email}</span>.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/20 bg-muted/10 p-4 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <p>Não encontrou? Verifique spam ou promoções.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <button type="button" onClick={() => setView("forgot")} className={secondaryButtonClassName}>
                    Reenviar e-mail
                  </button>
                  <button type="button" onClick={() => { setView("login"); setPassword(""); }}
                    className="flex w-full items-center justify-center gap-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
                    <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
                  </button>
                </div>
              </div>
            )}

            {/* Forgot form */}
            {view === "forgot" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-border/20 bg-muted/10 p-5 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <KeyRound className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-base font-semibold text-foreground">Esqueceu sua senha?</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Digite seu e-mail para receber o link de recuperação.
                  </p>
                </div>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com" required autoFocus className={inputClassName} />
                  </div>
                  <button type="submit" disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Enviar link
                  </button>
                </form>
                <button type="button" onClick={() => { setView("login"); setPassword(""); }}
                  className="flex w-full items-center justify-center gap-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
                </button>
              </div>
            )}

            {/* Login / Signup form */}
            {isAuthForm && (
              <div className="space-y-5">
                {view === "signup" && (
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                    Senha: <span className="font-medium text-foreground">12+ caracteres</span>, maiúscula, minúscula, número e símbolo.
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com" required className={inputClassName} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Senha</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••" required
                        minLength={view === "login" ? 6 : 12}
                        className={`${inputClassName} pr-11`}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {view === "login" && (
                    <div className="text-right">
                      <button type="button" onClick={() => setView("forgot")}
                        className="text-[11px] font-medium text-primary/80 transition-colors hover:text-primary">
                        Esqueci minha senha
                      </button>
                    </div>
                  )}

                  <button type="submit" disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 btn-glow">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {view === "login" ? "Entrar agora" : "Criar conta"}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/30" />
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/40">ou continue com</span>
                  <div className="h-px flex-1 bg-border/30" />
                </div>

                {/* Social buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleOAuthSignIn("google")}
                    disabled={loading}
                    className="flex items-center justify-center gap-2.5 rounded-2xl border border-border/30 bg-card/80 px-4 py-3 text-sm font-medium text-foreground transition-all duration-300 hover:bg-muted/25 hover:border-border/50 disabled:opacity-50"
                  >
                    <GoogleIcon />
                    Google
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuthSignIn("apple")}
                    disabled={loading}
                    className="flex items-center justify-center gap-2.5 rounded-2xl border border-border/30 bg-card/80 px-4 py-3 text-sm font-medium text-foreground transition-all duration-300 hover:bg-muted/25 hover:border-border/50 disabled:opacity-50"
                  >
                    <AppleIcon />
                    Apple
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 text-center space-y-3">
          <a
            href={VIP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/60 px-4 py-2 text-xs font-medium text-muted-foreground transition-all hover:text-primary hover:border-primary/20 backdrop-blur-sm"
          >
            <Flame className="h-3.5 w-3.5" />
            Adquirir acesso VIP
          </a>
          <p className="text-[10px] text-muted-foreground/40">
            Login seguro com e-mail, Google ou Apple
          </p>
        </div>
      </div>
    </div>
  );
}
