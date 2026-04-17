import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useNavigate } from "react-router-dom";
import {
  Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, Mail, Check, KeyRound,
  Flame, Crown, Zap, Shield, Gamepad2, MonitorPlay, Sparkles, Star, X,
  Globe, Users,
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
    plans: [
      { label: "Semanal", price: "R$ 25,00" },
      { label: "Mensal", price: "R$ 50,00" },
      { label: "Anual", price: "R$ 150,00", badge: "Melhor custo" },
    ],
    features: [
      "Chat IA sem limite de mensagens",
      "Todos os modos (Amigo, Escola, Programador, Rewrite)",
      "Geração de imagens com IA",
      "Chamada de voz com IA",
      "Geração de música com IA",
      "Prioridade no suporte",
      "Sem restrição de horário",
    ],
    popular: true,
    color: "from-amber-500/20 to-orange-600/20",
    borderColor: "border-amber-500/30",
    iconColor: "text-amber-400",
  },
  {
    icon: Zap,
    title: "Desenvolvedor",
    plans: [
      { label: "Semanal", price: "R$ 100,00" },
      { label: "Mensal", price: "R$ 150,00" },
      { label: "Anual", price: "R$ 250,00", badge: "Melhor custo" },
    ],
    features: [
      "Tudo do VIP incluso",
      "SnyX Optimizer (otimização de PC)",
      "VPN integrada com WireGuard",
      "Hospedagem de sites grátis",
      "Pack Steam com jogos",
      "Downloads exclusivos",
      "Acesso antecipado a novidades",
      "Badge DEV no perfil",
    ],
    popular: false,
    color: "from-blue-500/20 to-cyan-500/20",
    borderColor: "border-blue-500/30",
    iconColor: "text-blue-400",
  },
];

const FREE_FEATURES = [
  "15 mensagens de chat IA por dia",
  "Modo Amigo e Escola",
  "Suporte por ticket",
];

const inputClassName =
  "w-full rounded-xl border border-border/30 bg-muted/15 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 transition-all duration-200 focus:outline-none focus:border-primary/40 focus:bg-card/80 focus:shadow-md focus:shadow-primary/5";

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
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[140px]" />
        <div className="absolute right-0 bottom-0 h-[300px] w-[300px] rounded-full bg-primary/3 blur-[120px]" />
      </div>

      {/* Main layout */}
      <div className="relative flex min-h-screen flex-col lg:flex-row">
        {/* Left: Auth form — compact */}
        <div className="flex flex-1 items-center justify-center px-4 py-6 lg:py-0">
          <div className="w-full max-w-[360px]">
            {/* Logo */}
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/15">
                <Flame className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-foreground">SnyX</h1>
                <p className="text-[10px] text-muted-foreground/60">Plataforma IA completa</p>
              </div>
            </div>

            {/* VIP Info View */}
            {view === "vip-info" && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Planos</h2>
                    <p className="text-[10px] text-muted-foreground">Escolha o ideal para você</p>
                  </div>
                  <button onClick={() => setView("login")} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Free tier */}
                <div className="rounded-xl border border-border/20 bg-muted/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-muted/20 flex items-center justify-center">
                      <Users className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-bold text-foreground">Grátis</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/20 text-muted-foreground">R$ 0</span>
                  </div>
                  <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {FREE_FEATURES.map((f, j) => (
                      <li key={j} className="flex items-start gap-1 text-[10px] text-muted-foreground/70">
                        <Check className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  {VIP_PLANS.map((plan, i) => {
                    const planKey = plan.title === "VIP" ? "vip" : plan.title === "RPG Premium" ? "rpg" : "programmer";
                    const planNameMap: Record<string, string> = { vip: "SnyX VIP", rpg: "SnyX RPG Premium", programmer: "SnyX Programador DEV" };
                    const priceMap: Record<string, Record<string, number>> = {
                      vip: { Semanal: 25, Mensal: 50, Anual: 150 },
                      rpg: { Semanal: 20, Mensal: 50, Anual: 120 },
                      programmer: { Semanal: 100, Mensal: 150, Anual: 250 },
                    };

                    return (
                    <div key={i} className={`group relative rounded-2xl border ${plan.popular ? plan.borderColor + ' shadow-lg shadow-amber-500/5' : 'border-border/30'} bg-gradient-to-br ${plan.color}  p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}>
                      {plan.popular && (
                        <div className="absolute -top-3 right-4 flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold text-black uppercase tracking-wider">
                          <Star className="h-3 w-3" /> Popular
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/40 ${plan.iconColor}`}>
                          <plan.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-foreground text-sm">{plan.title}</h3>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {plan.plans.map((p, k) => (
                              <button
                                key={k}
                                disabled={checkoutLoading}
                                onClick={() => {
                                  const price = priceMap[planKey][p.label];
                                  const periodLabel = p.label.toLowerCase();
                                  openCheckout({
                                    title: planNameMap[planKey],
                                    description: `Assinatura ${periodLabel} ${planNameMap[planKey]}`,
                                    price,
                                    quantity: 1,
                                  });
                                }}
                                className="relative flex flex-col items-center rounded-lg border border-border/15 bg-background/25 px-2 py-1 min-w-[60px] hover:bg-primary/15 hover:border-primary/30 transition-all cursor-pointer disabled:opacity-50"
                              >
                                {p.badge && (
                                  <span className="absolute -top-1.5 text-[7px] font-bold bg-primary text-primary-foreground px-1 py-0 rounded-full">{p.badge}</span>
                                )}
                                <span className="text-[8px] text-muted-foreground/60 uppercase">{p.label}</span>
                                <span className="text-[11px] font-black text-foreground">{p.price}</span>
                              </button>
                            ))}
                          </div>
                          <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5">
                            {plan.features.map((f, j) => (
                              <li key={j} className="flex items-start gap-1 text-[9px] text-muted-foreground/80">
                                <Check className="h-2.5 w-2.5 text-primary shrink-0 mt-0.5" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>

                <p className="text-[10px] text-center text-muted-foreground/40">
                  Clique no período desejado para ir ao pagamento
                </p>

                <div className="flex items-center gap-2 rounded-lg border border-border/15 bg-muted/5 p-2">
                  <Shield className="h-3 w-3 text-primary shrink-0" />
                  <p className="text-[9px] text-muted-foreground/60">Pagamento seguro via Mercado Pago • Ativação instantânea • Cancele quando quiser</p>
                </div>

                <button onClick={() => setView("login")} className="flex w-full items-center justify-center gap-1.5 py-1.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground">
                  <ArrowLeft className="h-3 w-3" /> Voltar ao login
                </button>
              </div>
            )}

            {/* Card for auth forms */}
            {view !== "vip-info" && (
              <div className="overflow-hidden rounded-2xl border border-border/20 bg-card/60 shadow-xl shadow-black/15 ">
                <div className="p-4 space-y-4">
                  {/* Tabs */}
                  {isAuthForm && (
                    <div className="grid grid-cols-2 rounded-xl border border-border/15 bg-muted/10 p-0.5">
                      <button type="button" onClick={() => switchAuthView("login")}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ${view === "login" ? "bg-card text-foreground shadow-sm border border-border/15" : "text-muted-foreground hover:text-foreground"}`}>
                        Entrar
                      </button>
                      <button type="button" onClick={() => switchAuthView("signup")}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ${view === "signup" ? "bg-card text-foreground shadow-sm border border-border/15" : "text-muted-foreground hover:text-foreground"}`}>
                        Criar conta
                      </button>
                    </div>
                  )}

                  {/* Forgot sent */}
                  {view === "forgot-sent" && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-center">
                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                          <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">Confira seu e-mail</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Enviamos o link para <span className="font-medium text-foreground">{email}</span>.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/20 bg-muted/10 p-4 text-sm text-muted-foreground">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10"><Check className="h-3 w-3 text-primary" /></div>
                          <p>Não encontrou? Verifique spam ou promoções.</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setView("forgot")} className="w-full rounded-xl border border-border/30 bg-muted/15 px-3 py-2.5 text-xs font-medium text-foreground transition-all hover:bg-muted/25">Reenviar e-mail</button>
                      <button type="button" onClick={() => { setView("login"); setPassword(""); }} className="flex w-full items-center justify-center gap-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login</button>
                    </div>
                  )}

                  {/* Forgot form */}
                  {view === "forgot" && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-border/15 bg-muted/5 p-3 text-center">
                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><KeyRound className="h-4 w-4 text-primary" /></div>
                        <p className="text-sm font-semibold text-foreground">Esqueceu sua senha?</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">Digite seu e-mail para receber o link.</p>
                      </div>
                      <form onSubmit={handleForgotPassword} className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus className={inputClassName} />
                        </div>
                        <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50">
                          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Enviar link
                        </button>
                      </form>
                      <button type="button" onClick={() => { setView("login"); setPassword(""); }} className="flex w-full items-center justify-center gap-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login</button>
                    </div>
                  )}

                  {/* Login / Signup form */}
                  {isAuthForm && (
                    <div className="space-y-3">
                      {view === "signup" && (
                        <div className="rounded-lg border border-primary/10 bg-primary/5 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
                          Senha: <span className="font-medium text-foreground">12+ chars</span>, maiúscula, minúscula, número e símbolo.
                        </div>
                      )}

                      <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className={inputClassName} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Senha</label>
                          <div className="relative">
                            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••••••" required minLength={view === "login" ? 6 : 12} className={`${inputClassName} pr-11`} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-foreground">
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {view === "login" && (
                          <div className="text-right">
                            <button type="button" onClick={() => setView("forgot")} className="text-[11px] font-medium text-primary/80 transition-colors hover:text-primary">Esqueci minha senha</button>
                          </div>
                        )}

                        <button type="submit" disabled={loading}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 btn-glow">
                          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>{view === "login" ? "Entrar" : "Criar conta"}<ArrowRight className="h-3.5 w-3.5" /></>}
                        </button>
                      </form>

                      {/* Social divider */}
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-border/20" />
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/30">ou</span>
                        <div className="h-px flex-1 bg-border/20" />
                      </div>

                      {/* Social buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => handleOAuthSignIn("google")} disabled={loading}
                          className="flex items-center justify-center gap-2 rounded-xl border border-border/20 bg-card/60 px-3 py-2 text-[11px] font-medium text-foreground transition-all hover:bg-muted/20 disabled:opacity-50">
                          <GoogleIcon /> Google
                        </button>
                        <button type="button" onClick={() => handleOAuthSignIn("apple")} disabled={loading}
                          className="flex items-center justify-center gap-2 rounded-xl border border-border/20 bg-card/60 px-3 py-2 text-[11px] font-medium text-foreground transition-all hover:bg-muted/20 disabled:opacity-50">
                          <AppleIcon /> Apple
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            {view !== "vip-info" && (
              <div className="mt-4 text-center space-y-2">
                <button
                  onClick={() => setView("vip-info")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-4 py-2 text-[10px] font-semibold text-amber-400 transition-all hover:from-amber-500/20 hover:to-orange-500/20 hover:border-amber-500/40"
                >
                  <Crown className="h-3 w-3" />
                  Ver planos Premium
                  <Sparkles className="h-3 w-3" />
                </button>
                <p className="text-[9px] text-muted-foreground/30 flex items-center justify-center gap-1">
                  <Shield className="h-2.5 w-2.5" /> Login seguro • E-mail, Google ou Apple
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Feature showcase (desktop) */}
        <div className="hidden lg:flex lg:w-[380px] xl:w-[440px] items-center justify-center border-l border-border/10 bg-gradient-to-br from-muted/3 to-transparent px-6">
          <div className="w-full max-w-xs space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">Tudo em um só lugar</h2>
              <p className="mt-1 text-[11px] text-muted-foreground/70 leading-relaxed">Chat IA, otimização, IPTV, hospedagem, RPG e mais.</p>
            </div>

            <div className="space-y-2">
              {[
                { icon: Sparkles, label: "Chat IA Avançado", desc: "6 modos: Amigo, Escola, Programador, RPG", color: "text-amber-400", bg: "bg-amber-500/10" },
                { icon: Zap, label: "SnyX Optimizer", desc: "Otimize CPU, RAM, rede e GPU", color: "text-cyan-400", bg: "bg-cyan-500/10" },
                { icon: MonitorPlay, label: "IPTV", desc: "Canais ao vivo com player integrado", color: "text-green-400", bg: "bg-green-500/10" },
                { icon: Shield, label: "VPN WireGuard", desc: "Navegação segura e anônima", color: "text-purple-400", bg: "bg-purple-500/10" },
                { icon: Globe, label: "Hospedagem", desc: "Publique sites direto na plataforma", color: "text-blue-400", bg: "bg-blue-500/10" },
                { icon: Gamepad2, label: "RPG com IA", desc: "Personagens e aventuras com IA", color: "text-pink-400", bg: "bg-pink-500/10" },
              ].map((item, i) => (
                <div key={i} className="group flex items-center gap-3 rounded-xl border border-border/10 bg-card/20 p-2.5 transition-all hover:bg-card/40">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.bg} ${item.color}`}>
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-foreground">{item.label}</p>
                    <p className="text-[9px] text-muted-foreground/60">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-primary/10 bg-primary/5 p-3">
              <p className="text-[10px] font-semibold text-foreground mb-1">Plano Grátis inclui:</p>
              <p className="text-[9px] text-muted-foreground/60 leading-relaxed">15 mensagens/dia • Modo Amigo e Escola • Suporte por ticket • Sem cartão</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
