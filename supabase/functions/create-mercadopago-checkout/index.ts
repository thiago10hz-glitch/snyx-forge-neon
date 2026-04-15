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
