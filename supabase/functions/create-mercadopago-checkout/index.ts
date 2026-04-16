import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid prices for each plan
const VALID_PRICES: Record<string, number[]> = {
  vip: [25, 50, 150],
  rpg: [20, 50, 120],
  dev: [100, 150, 250],
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

    const { title, description, price, quantity, userId, userEmail, returnUrl } = await req.json();

    if (!title || !price || price <= 0) {
      return new Response(JSON.stringify({ error: "title and price are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== SERVER-SIDE PRICE VALIDATION =====
    const titleLower = title.toLowerCase();
    let plan = "";
    if (titleLower.includes("vip")) plan = "vip";
    else if (titleLower.includes("rpg")) plan = "rpg";
    else if (titleLower.includes("dev") || titleLower.includes("programador")) plan = "dev";

    if (plan && VALID_PRICES[plan]) {
      const validPrices = VALID_PRICES[plan];
      if (!validPrices.includes(Number(price))) {
        // Log fraud attempt
        if (userId) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supabase = createClient(supabaseUrl, supabaseKey);

          await supabase.from("fraud_attempts").insert({
            user_id: userId,
            attempt_type: "checkout_tamper",
            details: `Tentou criar checkout com preço R$${price} para ${plan} (preços válidos: ${validPrices.join(", ")})`,
          });

          // Check attempt count
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: attempts } = await supabase
            .from("fraud_attempts")
            .select("id")
            .eq("user_id", userId)
            .gte("created_at", oneDayAgo);

          const attemptCount = attempts?.length || 0;

          if (attemptCount >= 2) {
            // Ban for 1 hour
            await supabase.from("profiles").update({
              banned_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            }).eq("user_id", userId);

            console.log(`USER BANNED: ${userId} - ${attemptCount} checkout tamper attempts`);

            return new Response(JSON.stringify({ 
              error: "banned",
              message: "Sua conta foi suspensa temporariamente por tentativa de fraude.",
            }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ 
            error: "fraud_warning",
            message: "⚠️ Tentativa de manipulação detectada. Mais uma tentativa resultará em suspensão da conta.",
          }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ error: "Preço inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check if user is banned
    if (userId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: profile } = await supabase
        .from("profiles")
        .select("banned_until")
        .eq("user_id", userId)
        .single();

      if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
        return new Response(JSON.stringify({ 
          error: "banned",
          message: "Sua conta está suspensa temporariamente.",
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const preference = {
      items: [
        {
          title: title,
          description: description || title,
          quantity: quantity || 1,
          currency_id: "BRL",
          unit_price: Number(price),
        },
      ],
      payer: userEmail ? { email: userEmail } : undefined,
      metadata: userId ? { user_id: userId } : undefined,
      back_urls: {
        success: returnUrl || `${req.headers.get("origin")}/checkout/return?status=approved`,
        failure: returnUrl || `${req.headers.get("origin")}/checkout/return?status=rejected`,
        pending: returnUrl || `${req.headers.get("origin")}/checkout/return?status=pending`,
      },
      auto_return: "approved",
      statement_descriptor: "SnyX",
    };

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("MercadoPago error:", JSON.stringify(data));
      throw new Error(data.message || "Failed to create preference");
    }

    return new Response(JSON.stringify({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("create-mercadopago-checkout error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
