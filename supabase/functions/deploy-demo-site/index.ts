import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Sessão expirada" }, 401);
    }

    const body = await req.json();
    const { action } = body;

    // ── CLEANUP CRON: expire demos and revoke temp VIP ──
    if (action === "cleanup_cron") {
      const { data: expiredDemos } = await adminClient
        .from("clone_demos")
        .select("*")
        .eq("status", "active")
        .lt("expires_at", new Date().toISOString());

      let cleaned = 0;
      if (expiredDemos) {
        for (const demo of expiredDemos) {
          // Revoke temporary VIP from the demo user
          await adminClient
            .from("profiles")
            .update({ is_vip: false, vip_expires_at: null })
            .eq("user_id", demo.user_id)
            .lte("vip_expires_at", new Date().toISOString());

          // Mark demo as expired
          await adminClient
            .from("clone_demos")
            .update({ status: "expired" })
            .eq("id", demo.id);
          cleaned++;
        }
      }
      return jsonResponse({ success: true, cleaned });
    }

    // ── CLEANUP all active demos (admin revoke all) ──
    if (action === "cleanup") {
      const { data: activeDemos } = await adminClient
        .from("clone_demos")
        .select("*")
        .eq("status", "active");

      let cleaned = 0;
      if (activeDemos) {
        for (const demo of activeDemos) {
          // Revoke VIP
          await adminClient
            .from("profiles")
            .update({ is_vip: false, vip_expires_at: null })
            .eq("user_id", demo.user_id);

          // Mark expired
          await adminClient
            .from("clone_demos")
            .update({ status: "expired" })
            .eq("id", demo.id);
          cleaned++;
        }
      }
      return jsonResponse({ success: true, cleaned });
    }

    // ── CREATE demo ──
    const { siteName, primaryColor, description, fingerprint, ip } = body;

    if (!siteName || typeof siteName !== "string") {
      return jsonResponse({ error: "Nome do site obrigatório" }, 400);
    }

    // Check eligibility
    const { data: canUse } = await userClient.rpc("can_use_demo", {
      p_fingerprint: fingerprint || null,
      p_ip: ip || null,
    });

    if (!canUse || !(canUse as any).allowed) {
      return jsonResponse({ error: (canUse as any)?.message || "Demonstração não disponível" }, 403);
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Grant temporary VIP to the user
    await adminClient
      .from("profiles")
      .update({ is_vip: true, vip_expires_at: expiresAt })
      .eq("user_id", user.id);

    // Save demo record
    const { data: demo, error: insertErr } = await userClient
      .from("clone_demos")
      .insert({
        user_id: user.id,
        site_name: siteName.trim(),
        primary_color: primaryColor || "#ff0000",
        description: description || null,
        device_fingerprint: fingerprint || null,
        ip_address: ip || null,
        demo_url: `demo-${siteName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 40)}`,
        hosted_url: `/demo?id=${user.id}`,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      // Rollback VIP
      await adminClient
        .from("profiles")
        .update({ is_vip: false, vip_expires_at: null })
        .eq("user_id", user.id);
      return jsonResponse({ error: "Erro ao salvar demonstração" }, 500);
    }

    return jsonResponse({
      success: true,
      demoId: demo.id,
      expiresAt: demo.expires_at,
    });
  } catch (err) {
    console.error("Demo deploy error:", err);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
});
