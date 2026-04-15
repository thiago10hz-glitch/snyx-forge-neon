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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const stripeKey = Deno.env.get('STRIPE_SANDBOX_API_KEY');
    
    console.log("Keys present:", { lovable: !!lovableApiKey, stripe: !!stripeKey });
    console.log("Lovable key prefix:", lovableApiKey?.substring(0, 10));
    console.log("Stripe key prefix:", stripeKey?.substring(0, 10));
    
    const resp = await fetch("https://connector-gateway.lovable.dev/stripe/v1/prices?lookup_keys[]=vip_monthly", {
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": stripeKey!,
      },
    });
    
    const body = await resp.text();
    console.log("Gateway response status:", resp.status);
    console.log("Gateway response:", body.substring(0, 500));
    
    return new Response(body, {
      status: resp.status,
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
