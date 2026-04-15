import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Mail,
  Check,
  KeyRound,
  ShieldCheck,
  MessageCircle,
  Sparkles,
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
      } catch {
        // ignore parse errors
      }
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
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
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
        toast({
          title: "Erro",
          description: "Não foi possível identificar seu dispositivo. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("signup-with-fingerprint", {
        body: {
          email: trimmedEmail,
          password,
          fingerprint,
          redirectTo: window.location.origin,
        },
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
          title: isDeviceRegistered
            ? "Dispositivo já registrado"
            : isWeakPassword
              ? "Senha fraca"
              : isEmailRegistered
                ? "E-mail já cadastrado"
                : "Erro",
          description: isDeviceRegistered
            ? "Este dispositivo já possui uma conta. Não é permitido criar múltiplas contas."
            : isEmailRegistered
              ? "Já existe uma conta com esse e-mail. Tente entrar ou recuperar sua senha."
              : data.message || data.error,
          variant: "destructive",
        });
        return;
      }

      // Auto-confirm is enabled, so auto-login after signup
      if (data?.success) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (!loginError) {
          toast({ title: "Conta criada!", description: "Bem-vindo ao SnyX!" });
          navigate("/");
          return;
        }
      }

      toast({
        title: "Cadastro realizado",
        description: "Conta criada com sucesso! Faça login para continuar.",
      });
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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });

      if (result.error) {
        toast({
          title: "Erro",
          description: result.error instanceof Error ? result.error.message : "Erro ao conectar com Google.",
          variant: "destructive",
        });
        return;
      }

      if (result.redirected) return;
      navigate("/");
    } catch (err: unknown) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao conectar com Google.",
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
      case "login":
        return "Acesse sua conta";
      case "signup":
        return "Crie sua conta";
      case "forgot":
        return "Recuperar senha";
      case "forgot-sent":
        return "E-mail enviado";
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl motion-safe:animate-fade-in" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl motion-safe:animate-fade-in" />
        <div className="absolute left-1/3 top-1/2 h-60 w-60 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,520px)]">
        <section className="hidden border-r border-border/30 lg:flex lg:flex-col lg:justify-between lg:px-10 lg:py-10 xl:px-14 xl:py-12">
          <div className="space-y-8 motion-safe:animate-fade-in">
            <div className="inline-flex items-center gap-3 rounded-full border border-border/40 bg-card/60 px-4 py-2 backdrop-blur-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">SnyX Access</p>
                <p className="text-xs text-muted-foreground">Login, Google e recuperação segura</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-border/40 bg-muted/20 px-3 py-1 text-[11px] font-medium text-muted-foreground">Google Login</span>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">Reset por e-mail</span>
                <span className="rounded-full border border-border/40 bg-muted/20 px-3 py-1 text-[11px] font-medium text-muted-foreground">Acesso rápido</span>
              </div>

              <div className="max-w-xl space-y-4">
                <h1 className="text-4xl font-bold leading-tight text-foreground xl:text-5xl">
                  Entre no SnyX com uma experiência mais elegante, rápida e segura.
                </h1>
                <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
                  Login tradicional, acesso com Google e recuperação de senha integrados em uma tela mais premium,
                  com transições suaves e foco total na conversão.
                </p>
              </div>
            </div>

            <div className="grid max-w-xl gap-3 sm:grid-cols-2">
              <div className="hover-scale rounded-3xl border border-border/40 bg-card/70 p-5 backdrop-blur-md transition-all duration-300">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Segurança em primeiro lugar</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Recuperação por e-mail, senha forte e fluxo claro para o usuário entrar sem confusão.
                </p>
              </div>

              <div className="hover-scale rounded-3xl border border-border/40 bg-card/70 p-5 backdrop-blur-md transition-all duration-300">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Feito para voltar rápido</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Menos atrito para o usuário sair do login e voltar direto para o chat, TV e recursos premium.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/40 bg-card/70 p-6 backdrop-blur-md motion-safe:animate-enter">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Por que esse novo login?</p>
                <p className="text-xs text-muted-foreground">Mais claro, mais bonito e com melhor percepção de valor.</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                "Painel mais premium com foco visual melhor",
                "Animações suaves na troca entre login, cadastro e recuperação",
                "Google login integrado para entrar em poucos segundos",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/30 bg-muted/15 px-4 py-3">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-md motion-safe:animate-enter">
            <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/80 shadow-2xl backdrop-blur-xl">
              <div className="border-b border-border/30 bg-muted/15 px-5 py-5 sm:px-7">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-lg shadow-primary/10">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">SnyX</p>
                      <p className="text-xs text-muted-foreground">{getTitle()}</p>
                    </div>
                  </div>

                  <div className="hidden rounded-full border border-border/40 bg-card/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75 sm:inline-flex">
                    Secure Access
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
                  <span className="rounded-full border border-border/40 bg-muted/20 px-3 py-1 text-[11px] font-medium text-muted-foreground">Google Login</span>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">Reset por e-mail</span>
                </div>
              </div>

              <div className="p-5 sm:p-7">
                {isAuthForm && (
                  <div className="mb-6 grid grid-cols-2 rounded-2xl border border-border/30 bg-muted/20 p-1">
                    <button
                      type="button"
                      onClick={() => switchAuthView("login")}
                      className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                        view === "login"
                          ? "bg-card text-foreground shadow-lg shadow-primary/5"
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
                          ? "bg-card text-foreground shadow-lg shadow-primary/5"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Criar conta
                    </button>
                  </div>
                )}

                {view === "forgot-sent" && (
                  <div className="space-y-5 motion-safe:animate-fade-in">
                    <div className="rounded-[1.75rem] border border-primary/20 bg-primary/5 p-5 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10">
                        <Mail className="h-8 w-8 text-primary" />
                      </div>
                      <p className="text-base font-semibold text-foreground">Confira seu e-mail</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Enviamos o link de recuperação para <span className="font-medium text-foreground">{email}</span>.
                        Abra o e-mail, clique no link e defina sua nova senha.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/30 bg-muted/15 p-4 text-sm text-muted-foreground">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Dica rápida</p>
                          <p className="mt-1 leading-relaxed">Se não encontrar a mensagem, verifique spam ou promoções.</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button type="button" onClick={() => setView("forgot")} className={secondaryButtonClassName}>
                        Reenviar e-mail
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setView("login");
                          setPassword("");
                        }}
                        className="flex w-full items-center justify-center gap-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Voltar ao login
                      </button>
                    </div>
                  </div>
                )}

                {view === "forgot" && (
                  <div className="space-y-5 motion-safe:animate-fade-in">
                    <div className="rounded-[1.75rem] border border-border/30 bg-muted/15 p-5 text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10">
                        <KeyRound className="h-6 w-6 text-primary" />
                      </div>
                      <p className="text-base font-semibold text-foreground">Esqueceu sua senha?</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Digite seu e-mail e enviaremos um link seguro para redefinir sua senha.
                      </p>
                    </div>

                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="seu@email.com"
                          required
                          autoFocus
                          className={inputClassName}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:opacity-90 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        Enviar link de recuperação
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={() => {
                        setView("login");
                        setPassword("");
                      }}
                      className="flex w-full items-center justify-center gap-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Voltar ao login
                    </button>
                  </div>
                )}

                {isAuthForm && (
                  <div className="space-y-5 motion-safe:animate-fade-in">
                    {view === "signup" && (
                      <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                        Sua senha precisa ter <span className="font-medium text-foreground">12+ caracteres</span>, com maiúscula,
                        minúscula, número e símbolo.
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="seu@email.com"
                          required
                          className={inputClassName}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Senha</label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            required
                            minLength={view === "login" ? 6 : 12}
                            className={`${inputClassName} pr-11`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {view === "login" && (
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => setView("forgot")}
                            className="story-link text-[11px] font-medium text-primary/80 transition-colors hover:text-primary"
                          >
                            Esqueci minha senha
                          </button>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:opacity-90 disabled:opacity-50"
                      >
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

                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border/40" />
                      <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/50">ou</span>
                      <div className="h-px flex-1 bg-border/40" />
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border/40 bg-card px-4 py-3.5 text-sm font-medium text-foreground transition-all duration-300 hover:bg-muted/25 hover:border-border/70 disabled:opacity-50"
                    >
                      <GoogleIcon />
                      Continuar com Google
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3 text-center">
              <a
                href={VIP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="hover-scale inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/70 px-4 py-2 text-xs font-medium text-muted-foreground transition-all duration-300 hover:text-primary"
              >
                <Zap className="h-3.5 w-3.5" />
                Adquirir acesso VIP
              </a>
              <p className="text-[11px] leading-relaxed text-muted-foreground/55">
                Login com e-mail, Google e recuperação de senha no mesmo fluxo.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
