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

    // Verify user
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

    const { plan_slug = "free" } = await req.json().catch(() => ({}));

    const admin = createClient(supabaseUrl, serviceKey);

    // Find plan
    const { data: plan, error: planErr } = await admin
      .from("api_plans")
      .select("id, slug, price_brl, name")
      .eq("slug", plan_slug)
      .eq("is_active", true)
      .maybeSingle();
    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "plan_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only allow free auto-issue here. Paid plans must come from webhook.
    if (Number(plan.price_brl) > 0) {
      return new Response(JSON.stringify({ error: "paid_plan_requires_checkout" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has an active key for free plan
    const { data: existing } = await admin
      .from("api_clients")
      .select("id, api_key, api_key_prefix, plan_id")
      .eq("user_id", user.id)
      .eq("plan_id", plan.id)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          api_key: existing.api_key,
          prefix: existing.api_key_prefix,
          plan: plan.slug,
          existed: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { key, prefix } = generateApiKey();
    const { error: insertErr } = await admin.from("api_clients").insert({
      user_id: user.id,
      plan_id: plan.id,
      name: `Minha chave ${plan.name}`,
      api_key: key,
      api_key_prefix: prefix,
      status: "active",
    });
    if (insertErr) {
      console.error("insert error", insertErr);
      return new Response(JSON.stringify({ error: "insert_failed", detail: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ api_key: key, prefix, plan: plan.slug, existed: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("issue-api-key error", e);
    return new Response(JSON.stringify({ error: "internal", detail: e?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
