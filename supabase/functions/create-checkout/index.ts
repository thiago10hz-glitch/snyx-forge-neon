import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, stripeRequest } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { priceId, quantity, customerEmail, userId, returnUrl, environment } = await req.json();

    if (!priceId || typeof priceId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return new Response(JSON.stringify({ error: "Invalid priceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = (environment || 'sandbox') as StripeEnv;

    // Resolve human-readable price ID to Stripe price ID
    const prices = await stripeRequest(env, 'GET', `/v1/prices?lookup_keys[]=${encodeURIComponent(priceId)}`);

    if (!prices.data || !prices.data.length) {
      return new Response(JSON.stringify({ error: "Price not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    // Build form-encoded body for checkout session
    const params = new URLSearchParams();
    params.set('line_items[0][price]', stripePrice.id);
    params.set('line_items[0][quantity]', String(quantity || 1));
    params.set('mode', isRecurring ? 'subscription' : 'payment');
    params.set('ui_mode', 'embedded');
    params.set('return_url', returnUrl || `${req.headers.get("origin")}/checkout/return?session_id={CHECKOUT_SESSION_ID}`);

    if (customerEmail) params.set('customer_email', customerEmail);
    if (userId) {
      params.set('metadata[userId]', userId);
      if (isRecurring) params.set('subscription_data[metadata][userId]', userId);
      else params.set('payment_intent_data[metadata][userId]', userId);
    }

    const session = await stripeRequest(env, 'POST', '/v1/checkout/sessions', params.toString());

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-checkout error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
