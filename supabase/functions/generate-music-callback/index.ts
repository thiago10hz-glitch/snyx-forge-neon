// Callback endpoint for Suno API - receives webhook notifications
// This is a dummy endpoint that just accepts the callback
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Just acknowledge the callback
  try {
    const body = await req.text();
    console.log("Suno callback received:", body.slice(0, 500));
  } catch (_) {
    // ignore
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
