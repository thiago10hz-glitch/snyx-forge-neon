import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useNavigate } from "react-router-dom";
import {
  Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, Mail, Check, KeyRound,
  Flame, Crown, Zap, Shield, Sparkles, Star, X, Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMercadoPagoCheckout } from "@/hooks/useMercadoPagoCheckout";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

const COMMON_PASSWORD_PATTERNS = [/123456/i, /password/i, /qwerty/i, /abc123/i, /admin/i, /letmein/i];

const validateSignupPassword = (password: string, email: string) => {
  const normalizedPassword = password.trim();
  const emailLocalPart = email.split("@")[0]?.toLowerCase() ?? "";
  if (normalizedPassword.length < 12) return "Use pelo menos 12 caracteres.";
  if (!/[a-z]/.test(normalizedPassword)) return "Inclua pelo menos uma letra minúscula.";
  if (!/[A-Z]/.test(normalizedPassword)) return "Inclua pelo menos uma letra maiúscula.";
  if (!/[0-9]/.test(normalizedPassword)) return "Inclua pelo menos um número.";
  if (!/[^A-Za-z0-9]/.test(normalizedPassword)) return "Inclua pelo menos um símbolo.";
  if (emailLocalPart && normalizedPassword.toLowerCase().includes(emailLocalPart)) return "Não use partes do seu e-mail na senha.";
  if (COMMON_PASSWORD_PATTERNS.some((p) => p.test(normalizedPassword))) return "Evite senhas comuns ou sequências fáceis.";
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
      try { const text = await functionError.context.text(); if (text) return text; } catch {}
    }
  }
  if (error instanceof Error) return error.message;
  return "Erro desconhecido";
};

type AuthView = "login" | "signup" | "forgot" | "forgot-sent" | "vip-info";

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

const VIP_PLANS = [
  {
    icon: Crown,
    title: "VIP",
    planKey: "vip" as const,
    plans: [
      { label: "Semanal", price: "R$ 25", priceNum: 25 },
      { label: "Mensal", price: "R$ 40", priceNum: 40 },
      { label: "Anual", price: "R$ 120", priceNum: 120, badge: "Melhor" },
    ],
    features: [
      "Chat IA sem limite",
      "Todos os modos",
      "Geração de imagens",
      "Geração de música",
      "Prioridade no suporte",
    ],
    popular: true,
    gradient: "from-amber-500/15 via-yellow-500/10 to-orange-500/5",
    glow: "shadow-[0_0_40px_-15px_rgba(251,191,36,0.4)]",
    border: "border-amber-500/25",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/15",
  },
  {
    icon: Zap,
    title: "Desenvolvedor",
    planKey: "programmer" as const,
    plans: [
      { label: "Semanal", price: "R$ 100", priceNum: 100 },
      { label: "Mensal", price: "R$ 120", priceNum: 120 },
      { label: "Anual", price: "R$ 150", priceNum: 150, badge: "Melhor" },
    ],
    features: [
      "Tudo do VIP",
      "Acesso a betas",
      "Badge DEV brilhante",
      "Recursos exclusivos",
    ],
    popular: false,
    gradient: "from-cyan-500/15 via-blue-500/10 to-indigo-500/5",
    glow: "shadow-[0_0_40px_-15px_rgba(34,211,238,0.4)]",
    border: "border-cyan-500/25",
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-500/15",
  },
];

const PLAN_NAME_MAP = { vip: "SnyX VIP", programmer: "SnyX Desenvolvedor" } as const;

const FREE_FEATURES = [
  "5 mensagens de chat IA por dia",
  "Modo Amigo e Escola",
  "Suporte por ticket",
];

const inputClassName =
  "w-full rounded-xl border border-border/30 bg-background/30 backdrop-blur-sm px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 transition-all duration-200 focus:outline-none focus:border-primary/50 focus:bg-background/50 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]";

export default function Auth() {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { openCheckout, isLoading: checkoutLoading } = useMercadoPagoCheckout();

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
          const { data: profile } = await supabase.from("profiles").select("banned_until").eq("user_id", data.user.id).single();
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
        toast({ title: "Erro", description: result.error instanceof Error ? result.error.message : `Erro ao conectar com ${provider === "google" ? "Google" : "Apple"}.`, variant: "destructive" });
        return;
      }
      if (result.redirected) return;
      navigate("/");
    } catch (err: unknown) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro ao conectar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const switchAuthView = (nextView: "login" | "signup") => {
    setView(nextView);
    setPassword("");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center px-4 py-8">
      {/* === Aurora animated background === */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        {/* Floating blobs */}
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/15 blur-[140px] animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full bg-amber-500/10 blur-[140px] animate-[pulse_10s_ease-in-out_infinite_2s]" />
        <div className="absolute left-1/3 -bottom-40 h-[450px] w-[450px] rounded-full bg-cyan-500/10 blur-[140px] animate-[pulse_12s_ease-in-out_infinite_4s]" />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_85%)]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo above card */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-primary/40 blur-xl rounded-2xl animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 border border-primary/40 shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.5)]">
              <Flame className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">SnyX</h1>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5 font-medium tracking-wider uppercase">Plataforma IA</p>
        </div>

        {/* === Glass card === */}
        <div className="relative rounded-3xl border border-border/30 bg-card/40 backdrop-blur-2xl shadow-[0_20px_70px_-15px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Top sheen */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />

          {/* === VIP Info inside card === */}
          {view === "vip-info" && (
            <div className="p-6 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" /> Planos
                  </h2>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">Escolha o ideal para você</p>
                </div>
                <button onClick={() => setView("login")} className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Free */}
              <div className="rounded-2xl border border-border/20 bg-muted/5 p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-muted/20 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground">Grátis</p>
                    <p className="text-[9px] text-muted-foreground/60">R$ 0 • Sem cartão</p>
                  </div>
                </div>
                <ul className="grid grid-cols-1 gap-y-0.5 mt-2">
                  {FREE_FEATURES.map((f, j) => (
                    <li key={j} className="flex items-start gap-1.5 text-[10px] text-muted-foreground/70">
                      <Check className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0 mt-1" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Premium plans */}
              <div className="space-y-3">
                {VIP_PLANS.map((plan, i) => (
                  <div key={i} className={`relative overflow-hidden rounded-2xl border ${plan.border} bg-gradient-to-br ${plan.gradient} backdrop-blur-sm p-4 transition-all duration-300 hover:scale-[1.01] ${plan.popular ? plan.glow : ''}`}>
                    {plan.popular && (
                      <div className="absolute -top-px right-4 flex items-center gap-1 rounded-b-md bg-amber-500 px-2.5 py-0.5 text-[9px] font-black text-black uppercase tracking-wider">
                        <Star className="h-2.5 w-2.5" /> Popular
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${plan.iconBg} ${plan.iconColor} shadow-inner`}>
                        <plan.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-foreground text-sm">{plan.title}</h3>
                        <ul className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
                          {plan.features.map((f, j) => (
                            <li key={j} className="flex items-start gap-1 text-[9px] text-muted-foreground/80">
                              <Check className={`h-2 w-2 ${plan.iconColor} shrink-0 mt-0.5`} />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      {plan.plans.map((p, k) => (
                        <button
                          key={k}
                          disabled={checkoutLoading}
                          onClick={() => openCheckout({
                            title: PLAN_NAME_MAP[plan.planKey],
                            description: `Assinatura ${p.label.toLowerCase()} ${PLAN_NAME_MAP[plan.planKey]}`,
                            price: p.priceNum,
                            quantity: 1,
                          })}
                          className="relative flex flex-col items-center rounded-xl border border-border/20 bg-background/30 backdrop-blur-sm py-1.5 hover:bg-background/50 hover:border-primary/30 transition-all cursor-pointer disabled:opacity-50 group/btn"
                        >
                          {p.badge && (
                            <span className="absolute -top-1.5 text-[7px] font-black bg-primary text-primary-foreground px-1.5 py-0 rounded-full shadow-md">{p.badge}</span>
                          )}
                          <span className="text-[8px] text-muted-foreground/60 uppercase font-bold">{p.label}</span>
                          <span className="text-[12px] font-black text-foreground group-hover/btn:text-primary transition-colors">{p.price}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-border/15 bg-muted/5 p-2.5">
                <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-[10px] text-muted-foreground/60">Mercado Pago • Ativação na hora • Cancele quando quiser</p>
              </div>

              <button onClick={() => setView("login")} className="flex w-full items-center justify-center gap-1.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-3 w-3" /> Voltar ao login
              </button>
            </div>
          )}

          {/* === Forgot sent === */}
          {view === "forgot-sent" && (
            <div className="p-6 space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <p className="text-base font-bold text-foreground">Confira seu e-mail</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enviamos o link para <span className="font-semibold text-foreground">{email}</span>.
                </p>
              </div>
              <div className="rounded-xl border border-border/20 bg-muted/5 p-3 text-xs text-muted-foreground flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p>Não encontrou? Verifique spam ou promoções.</p>
              </div>
              <button type="button" onClick={() => setView("forgot")} className="w-full rounded-xl border border-border/30 bg-muted/15 px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted/25 transition-all">Reenviar e-mail</button>
              <button type="button" onClick={() => { setView("login"); setPassword(""); }} className="flex w-full items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
              </button>
            </div>
          )}

          {/* === Forgot form === */}
          {view === "forgot" && (
            <div className="p-6 space-y-4">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                  <KeyRound className="h-5 w-5 text-primary" />
                </div>
                <p className="text-base font-bold text-foreground">Esqueceu sua senha?</p>
                <p className="mt-1 text-xs text-muted-foreground">Digite seu e-mail para receber o link.</p>
              </div>
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus className={inputClassName} />
                <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-3.5 w-3.5" /> Enviar link</>}
                </button>
              </form>
              <button type="button" onClick={() => { setView("login"); setPassword(""); }} className="flex w-full items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
              </button>
            </div>
          )}

          {/* === Login / Signup === */}
          {isAuthForm && (
            <div className="p-6 space-y-5">
              {/* Heading */}
              <div className="text-center">
                <h2 className="text-xl font-black text-foreground">
                  {view === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
                </h2>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {view === "login" ? "Entre para continuar onde parou" : "Comece grátis em segundos"}
                </p>
              </div>

              {/* Tabs */}
              <div className="grid grid-cols-2 rounded-xl border border-border/20 bg-background/30 backdrop-blur-sm p-1">
                <button type="button" onClick={() => switchAuthView("login")}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition-all ${view === "login" ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:text-foreground"}`}>
                  Entrar
                </button>
                <button type="button" onClick={() => switchAuthView("signup")}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition-all ${view === "signup" ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:text-foreground"}`}>
                  Criar conta
                </button>
              </div>

              {/* Social — primeiro pra dar destaque */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleOAuthSignIn("google")} disabled={loading}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border/30 bg-background/40 backdrop-blur-sm px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-background/60 hover:border-border/50 transition-all disabled:opacity-50">
                  <GoogleIcon /> Google
                </button>
                <button type="button" onClick={() => handleOAuthSignIn("apple")} disabled={loading}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border/30 bg-background/40 backdrop-blur-sm px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-background/60 hover:border-border/50 transition-all disabled:opacity-50">
                  <AppleIcon /> Apple
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/20" />
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 font-bold">ou com e-mail</span>
                <div className="h-px flex-1 bg-border/20" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className={`${inputClassName} pl-10`} />
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={view === "signup" ? "Mínimo 12 caracteres" : "Sua senha"} required minLength={view === "login" ? 6 : 12}
                    className={`${inputClassName} pl-10 pr-10`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {view === "signup" && (
                  <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground/80">
                    <span className="font-semibold text-foreground">12+ caracteres</span> com maiúscula, minúscula, número e símbolo.
                  </div>
                )}

                {view === "login" && (
                  <div className="text-right">
                    <button type="button" onClick={() => setView("forgot")} className="text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors">
                      Esqueci minha senha
                    </button>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-3 py-3 text-sm font-bold text-primary-foreground hover:shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.6)] transition-all disabled:opacity-50 overflow-hidden">
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <span>{view === "login" ? "Entrar agora" : "Criar minha conta"}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        {view !== "vip-info" && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <button
              onClick={() => setView("vip-info")}
              className="group inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 backdrop-blur-sm px-5 py-2.5 text-xs font-bold text-amber-300 hover:from-amber-500/20 hover:via-yellow-500/20 hover:to-amber-500/20 hover:border-amber-500/50 transition-all shadow-[0_4px_20px_-8px_rgba(251,191,36,0.4)]"
            >
              <Crown className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform" />
              Ver planos Premium
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            <p className="text-[10px] text-muted-foreground/40 flex items-center gap-1.5">
              <Shield className="h-3 w-3" /> Login seguro • Criptografia ponta-a-ponta
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
