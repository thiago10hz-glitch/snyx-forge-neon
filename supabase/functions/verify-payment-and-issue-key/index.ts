import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateApiKey(): { key: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = `snyx_${raw}`;
  return { key, prefix: key.slice(0, 12) };
}

interface Body {
  payment_id: string;
  full_name: string;
  company_or_project: string;
  project_url?: string;
  use_case?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "no_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "invalid_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = (await req.json().catch(() => ({}))) as Body;
    const { payment_id, full_name, company_or_project, project_url, use_case } = body;

    if (!payment_id || !full_name?.trim() || !company_or_project?.trim()) {
      return new Response(JSON.stringify({ error: "validation", message: "Campos obrigatórios faltando." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica pagamento no Mercado Pago
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(payment_id)}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    if (!payRes.ok) {
      return new Response(JSON.stringify({ error: "payment_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payment = await payRes.json();

    if (payment.status !== "approved") {
      return new Response(JSON.stringify({
        error: "payment_not_approved",
        status: payment.status,
        message: "Pagamento ainda não foi aprovado.",
      }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirma que o pagamento pertence a este usuário
    if (payment.metadata?.user_id && payment.metadata.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "payment_user_mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemTitle: string = (payment.additional_info?.items?.[0]?.title || "").toLowerCase();
    const itemPrice: number = Number(payment.additional_info?.items?.[0]?.unit_price || payment.transaction_amount || 0);

    // Só processamos pagamentos de planos de API
    if (!itemTitle.includes("api snyx")) {
      return new Response(JSON.stringify({ error: "not_api_payment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Encontra plano por preço
    const { data: plans } = await admin
      .from("api_plans")
      .select("id, slug, name, price_brl")
      .eq("is_active", true);

    const plan = plans?.find((p: any) => Number(p.price_brl) === itemPrice && itemTitle.includes(p.name.toLowerCase()));
    if (!plan) {
      return new Response(JSON.stringify({ error: "plan_not_found", message: "Plano não identificado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Já existe chave ativa pra esse pagamento? (idempotência via project_url='mp:<payment_id>')
    const tag = `mp:${payment_id}`;
    const { data: existing } = await admin
      .from("api_clients")
      .select("api_key")
      .eq("user_id", user.id)
      .eq("plan_id", plan.id)
      .eq("name", `Chave ${plan.name} — pagamento ${payment_id}`.slice(0, 100))
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ status: "approved", api_key: existing.api_key, existed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Registra a application como aprovada por pagamento
    await admin.from("api_key_applications").insert({
      user_id: user.id,
      plan_id: plan.id,
      full_name,
      company_or_project,
      project_url: project_url || tag,
      use_case: use_case || `Plano pago via Mercado Pago. Payment ID: ${payment_id}`,
      status: "approved",
      ai_score: 100,
      ai_verdict: "approve",
      ai_reasoning: "Aprovado automaticamente: plano pago.",
      reviewed_at: new Date().toISOString(),
    });

    // Gera chave
    const { key, prefix } = generateApiKey();
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(); // 30 dias

    const { error: insertErr } = await admin.from("api_clients").insert({
      user_id: user.id,
      plan_id: plan.id,
      name: `Chave ${plan.name} — pagamento ${payment_id}`.slice(0, 100),
      api_key: key,
      api_key_prefix: prefix,
      status: "active",
      expires_at: expiresAt,
    });

    if (insertErr) {
      console.error("api_clients insert error", insertErr);
      return new Response(JSON.stringify({ error: "key_insert_failed", detail: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      status: "approved",
      api_key: key,
      plan_name: plan.name,
      expires_at: expiresAt,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("verify-payment-and-issue-key error", e);
    return new Response(JSON.stringify({ error: "internal", detail: e?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
