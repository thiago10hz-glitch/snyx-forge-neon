import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')!;
    const stripeKey = Deno.env.get('STRIPE_SANDBOX_API_KEY')!;

    // Try combination 1: Auth=stripe, X-Connection=lovable
    const r1 = await fetch("https://connector-gateway.lovable.dev/stripe/v1/prices?limit=1", {
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'X-Connection-Api-Key': lovableKey,
        'Lovable-API-Key': lovableKey,
      },
    });
    const t1 = await r1.text();
    console.log("Combo1 (Auth=stripe, XConn=lovable):", r1.status, t1.substring(0, 200));

    // Try combination 2: Auth=lovable, X-Connection=stripe
    const r2 = await fetch("https://connector-gateway.lovable.dev/stripe/v1/prices?limit=1", {
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': stripeKey,
        'Lovable-API-Key': lovableKey,
      },
    });
    const t2 = await r2.text();
    console.log("Combo2 (Auth=lovable, XConn=stripe):", r2.status, t2.substring(0, 200));

    // Try combination 3: Auth=stripe, X-Connection=stripe, Lovable-API-Key=lovable
    const r3 = await fetch("https://connector-gateway.lovable.dev/stripe/v1/prices?limit=1", {
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'X-Connection-Api-Key': stripeKey,
        'Lovable-API-Key': lovableKey,
      },
    });
    const t3 = await r3.text();
    console.log("Combo3 (Auth=stripe, XConn=stripe, Lovable=lovable):", r3.status, t3.substring(0, 200));

    // Try combination 4: Only Lovable-API-Key header
    const r4 = await fetch("https://connector-gateway.lovable.dev/stripe/v1/prices?limit=1", {
      headers: {
        'Lovable-API-Key': lovableKey,
        'X-Connection-Api-Key': stripeKey,
      },
    });
    const t4 = await r4.text();
    console.log("Combo4 (no Auth, Lovable+XConn):", r4.status, t4.substring(0, 200));

    return new Response(JSON.stringify({ combo1: t1.substring(0, 100), combo2: t2.substring(0, 100), combo3: t3.substring(0, 100), combo4: t4.substring(0, 100) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
