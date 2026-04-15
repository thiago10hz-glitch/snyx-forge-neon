import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const commonPasswordPatterns = [/123456/i, /password/i, /qwerty/i, /abc123/i, /admin/i, /letmein/i];

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
  if (commonPasswordPatterns.some((pattern) => pattern.test(normalizedPassword))) {
    return "Evite senhas comuns ou sequências fáceis.";
  }

  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const rawEmail = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const fingerprint = typeof body?.fingerprint === "string" ? body.fingerprint : "";
    const redirectTo = typeof body?.redirectTo === "string" && body.redirectTo.startsWith("http")
      ? body.redirectTo
      : req.headers.get("origin") || undefined;

    const email = rawEmail.trim().toLowerCase();

    if (!email || !password.trim() || !fingerprint.trim()) {
      return jsonResponse({ error: "INVALID_INPUT", message: "E-mail, senha e dispositivo são obrigatórios." }, 400);
    }

    const passwordError = validateSignupPassword(password, email);
    if (passwordError) {
      return jsonResponse({ error: "WEAK_PASSWORD", message: passwordError }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Missing env vars for signup-with-fingerprint");
      return jsonResponse({ error: "SERVER_MISCONFIGURED", message: "Configuração de autenticação incompleta." }, 500);
    }

    const publicClient = createClient(supabaseUrl, anonKey);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Run both checks in parallel for speed
    const [emailResult, trackingResult] = await Promise.all([
      adminClient.rpc("find_user_by_email", { p_email: email }),
      adminClient.from("user_tracking").select("user_id").eq("device_fingerprint", fingerprint).maybeSingle(),
    ]);

    if (emailResult.error) {
      console.error("Email lookup failed", emailResult.error);
      return jsonResponse({ error: "LOOKUP_FAILED", message: "Não foi possível validar o e-mail agora." }, 500);
    }
    if (emailResult.data) {
      return jsonResponse({ error: "EMAIL_ALREADY_REGISTERED", message: "Já existe uma conta com este e-mail." }, 409);
    }

    if (trackingResult.error) {
      console.error("Tracking lookup failed", trackingResult.error);
      return jsonResponse({ error: "TRACKING_LOOKUP_FAILED", message: "Não foi possível validar o dispositivo." }, 500);
    }
    if (trackingResult.data?.user_id) {
      return jsonResponse({ error: "DEVICE_ALREADY_REGISTERED", message: "Este dispositivo já possui uma conta cadastrada." }, 409);
    }

    const { data: signUpData, error: signUpError } = await publicClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (signUpError) {
      console.error("Sign up failed", signUpError);
      return jsonResponse({ error: signUpError.name || "SIGNUP_FAILED", message: signUpError.message }, 400);
    }

    if (!signUpData.user) {
      return jsonResponse({ error: "SIGNUP_FAILED", message: "Não foi possível criar sua conta." }, 400);
    }

    if (Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
      return jsonResponse({
        error: "EMAIL_ALREADY_REGISTERED",
        message: "Já existe uma conta com este e-mail.",
      }, 409);
    }

    const { error: trackingSaveError } = await adminClient
      .from("user_tracking")
      .insert({
        user_id: signUpData.user.id,
        device_fingerprint: fingerprint,
      });

    if (trackingSaveError) {
      console.error("Tracking save failed", trackingSaveError);
      await adminClient.auth.admin.deleteUser(signUpData.user.id);

      return jsonResponse({
        error: "TRACKING_SAVE_FAILED",
        message: "Não foi possível finalizar o cadastro do dispositivo. Tente novamente.",
      }, 500);
    }

    return jsonResponse({
      success: true,
      requires_email_confirmation: !signUpData.session,
      message: !signUpData.session
        ? "Conta criada. Verifique seu e-mail para confirmar o cadastro."
        : "Conta criada com sucesso.",
    });
  } catch (error) {
    console.error("signup-with-fingerprint error", error);

    return jsonResponse({
      error: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Erro interno no cadastro.",
    }, 500);
  }
});