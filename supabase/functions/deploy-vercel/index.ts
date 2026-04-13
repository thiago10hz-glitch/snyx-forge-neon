const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");
    if (!VERCEL_TOKEN) {
      return new Response(JSON.stringify({ error: "VERCEL_TOKEN não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { html, projectName } = await req.json();
    if (!html || typeof html !== "string") {
      return new Response(JSON.stringify({ error: "HTML inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeName = (projectName || "snyx-site")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);

    // Deploy using Vercel API v13
    const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: safeName,
        files: [
          {
            file: "index.html",
            data: btoa(unescape(encodeURIComponent(html))),
            encoding: "base64",
          },
        ],
        projectSettings: {
          framework: null,
        },
        target: "production",
      }),
    });

    const deployData = await deployRes.json();

    if (!deployRes.ok) {
      console.error("Vercel API error:", deployRes.status, JSON.stringify(deployData));
      return new Response(
        JSON.stringify({
          error: `Erro Vercel: ${deployData.error?.message || deployRes.status}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const url = deployData.url
      ? `https://${deployData.url}`
      : deployData.alias?.[0]
        ? `https://${deployData.alias[0]}`
        : null;

    return new Response(
      JSON.stringify({
        success: true,
        url,
        deploymentId: deployData.id,
        readyState: deployData.readyState,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Deploy error:", err);
    return new Response(JSON.stringify({ error: "Erro interno no deploy" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
