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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    if (body.type === "payment" || body.action === "payment.updated" || body.action === "payment.created") {
      const paymentId = body.data?.id;
      if (!paymentId) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` },
      });

      const payment = await paymentRes.json();
      console.log("Payment details:", JSON.stringify(payment));

      const userId = payment.metadata?.user_id;
      const itemTitle = payment.additional_info?.items?.[0]?.title?.toLowerCase() || "";
      const itemPrice = payment.additional_info?.items?.[0]?.unit_price || payment.transaction_amount || 0;

      // ===== ANTI-FRAUD DETECTION =====
      if (userId) {
        const isFraud = await detectFraud(supabase, payment, userId, itemTitle, itemPrice);
        if (isFraud) {
          console.log(`FRAUD DETECTED for user ${userId}`);
          return new Response(JSON.stringify({ ok: true, fraud: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (payment.status === "approved" && userId) {
        // Determine duration based on price
        const durationDays = getDurationFromPayment(itemTitle, itemPrice);

        if (itemTitle.includes("vip")) {
          await supabase.from("profiles").update({
            is_vip: true,
            vip_expires_at: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
          }).eq("user_id", userId);
        } else if (itemTitle.includes("rpg")) {
          await supabase.from("profiles").update({
            is_rpg_premium: true,
            rpg_premium_expires_at: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
          }).eq("user_id", userId);
        } else if (itemTitle.includes("dev") || itemTitle.includes("programador")) {
          await supabase.from("profiles").update({
            is_dev: true,
            dev_expires_at: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
          }).eq("user_id", userId);
        } else if (itemTitle.includes("pack steam")) {
          await supabase.from("profiles").update({
            is_pack_steam: true,
            pack_steam_expires_at: null,
          }).eq("user_id", userId);
        }

        console.log(`Payment approved for user ${userId}, item: ${itemTitle}, duration: ${durationDays} days`);
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

// Valid prices for each plan
const VALID_PRICES: Record<string, number[]> = {
  vip: [25, 50, 150],
  rpg: [20, 50, 120],
  dev: [100, 150, 250],
};

function getDurationFromPayment(itemTitle: string, price: number): number {
  // Map price to duration
  let plan = "";
  if (itemTitle.includes("vip")) plan = "vip";
  else if (itemTitle.includes("rpg")) plan = "rpg";
  else if (itemTitle.includes("dev") || itemTitle.includes("programador")) plan = "dev";

  const prices = VALID_PRICES[plan];
  if (!prices) return 30;

  // weekly prices are the lowest, yearly the highest
  if (price === prices[0]) return 7;    // weekly
  if (price === prices[1]) return 30;   // monthly
  if (price === prices[2]) return 365;  // yearly
  return 30; // default monthly
}

async function detectFraud(supabase: any, payment: any, userId: string, itemTitle: string, itemPrice: number): Promise<boolean> {
  // Determine the plan
  let plan = "";
  if (itemTitle.includes("vip")) plan = "vip";
  else if (itemTitle.includes("rpg")) plan = "rpg";
  else if (itemTitle.includes("dev") || itemTitle.includes("programador")) plan = "dev";

  if (!plan) return false;

  const validPrices = VALID_PRICES[plan];
  if (!validPrices) return false;

  // Check if price was tampered (not matching any valid price)
  const priceTampered = !validPrices.includes(Number(itemPrice));

  // Check for rejected/cancelled payments (possible card testing)
  const isRejected = ["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status);
  const isChargedBack = payment.status === "charged_back";

  if (!priceTampered && !isRejected && !isChargedBack) return false;

  const attemptType = priceTampered ? "price_tamper" : isChargedBack ? "chargeback" : "payment_rejected";
  const details = priceTampered 
    ? `Preço inválido: R$${itemPrice} (esperado: ${validPrices.join(", ")}) para ${plan}`
    : `Payment ${payment.status} - possível fraude`;

  // Log the fraud attempt
  await supabase.from("fraud_attempts").insert({
    user_id: userId,
    attempt_type: attemptType,
    details,
  });

  // Count recent fraud attempts (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: attempts } = await supabase
    .from("fraud_attempts")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", oneDayAgo);

  const attemptCount = attempts?.length || 0;

  if (attemptCount >= 2) {
    // Second+ attempt: ban for 1 hour
    await supabase.from("profiles").update({
      banned_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }).eq("user_id", userId);
    console.log(`USER BANNED for 1 hour: ${userId} (${attemptCount} fraud attempts)`);
  } else {
    console.log(`FRAUD WARNING issued to user: ${userId} (attempt #${attemptCount})`);
  }

  // If price was tampered, never approve
  if (priceTampered) return true;

  return false;
}
