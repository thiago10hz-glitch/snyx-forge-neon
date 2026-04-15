import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
    }

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    // MercadoPago sends different types of notifications
    if (body.type === "payment" || body.action === "payment.updated" || body.action === "payment.created") {
      const paymentId = body.data?.id;
      if (!paymentId) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch payment details from MercadoPago
      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` },
      });

      const payment = await paymentRes.json();
      console.log("Payment details:", JSON.stringify(payment));

      if (payment.status === "approved") {
        const userId = payment.metadata?.user_id;
        if (userId) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supabase = createClient(supabaseUrl, supabaseKey);

          // Determine what was purchased based on the item description/title
          const itemTitle = payment.additional_info?.items?.[0]?.title?.toLowerCase() || "";

          if (itemTitle.includes("vip")) {
            await supabase.from("profiles").update({
              is_vip: true,
              vip_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }).eq("user_id", userId);
          } else if (itemTitle.includes("rpg")) {
            await supabase.from("profiles").update({
              is_rpg_premium: true,
              rpg_premium_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }).eq("user_id", userId);
          } else if (itemTitle.includes("dev") || itemTitle.includes("programador")) {
            await supabase.from("profiles").update({
              is_dev: true,
              dev_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }).eq("user_id", userId);
          } else if (itemTitle.includes("pack steam")) {
            await supabase.from("profiles").update({
              is_pack_steam: true,
              pack_steam_expires_at: null, // lifetime
            }).eq("user_id", userId);
          }

          console.log(`Payment approved for user ${userId}, item: ${itemTitle}`);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("mercadopago-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
