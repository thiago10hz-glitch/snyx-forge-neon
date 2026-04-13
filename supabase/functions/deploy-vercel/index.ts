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
    const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");
    if (!VERCEL_TOKEN) {
      return jsonResponse({ error: "VERCEL_TOKEN não configurado" }, 500);
    }

    const body = await req.json();
    const { action } = body;

    // ── LIST projects ──
    if (action === "list") {
      const res = await fetch("https://api.vercel.com/v9/projects?limit=100", {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      });
      const data = await res.json();
      if (!res.ok) {
        return jsonResponse({ error: `Vercel: ${data.error?.message || res.status}` }, 502);
      }
      const projects = (data.projects || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        url: p.targets?.production?.url ? `https://${p.targets.production.url}` : (p.alias?.[0] ? `https://${p.alias[0]}` : null),
        createdAt: p.createdAt,
      }));
      return jsonResponse({ success: true, projects });
    }

    // ── DELETE project ──
    if (action === "delete") {
      const { projectId } = body;
      if (!projectId) return jsonResponse({ error: "projectId obrigatório" }, 400);
      const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      });
      if (!res.ok && res.status !== 204) {
        const errData = await res.json().catch(() => ({}));
        return jsonResponse({ error: `Erro ao deletar: ${(errData as any).error?.message || res.status}` }, 502);
      }
      return jsonResponse({ success: true });
    }

    // ── LIST domains for a project ──
    if (action === "list-domains") {
      const { projectId } = body;
      if (!projectId) return jsonResponse({ error: "projectId obrigatório" }, 400);
      const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains`, {
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      });
      const data = await res.json();
      if (!res.ok) {
        return jsonResponse({ error: `Erro: ${data.error?.message || res.status}` }, 502);
      }
      const domains = (data.domains || []).map((d: any) => ({
        name: d.name,
        verified: d.verified,
        verification: d.verification || [],
      }));
      return jsonResponse({ success: true, domains });
    }

    // ── ADD domain ──
    if (action === "add-domain") {
      const { projectId, domain } = body;
      if (!projectId || !domain) return jsonResponse({ error: "projectId e domain obrigatórios" }, 400);
      const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains`, {
        method: "POST",
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: domain }),
      });
      const data = await res.json();
      if (!res.ok) {
        return jsonResponse({ error: `Erro: ${data.error?.message || res.status}` }, 502);
      }
      return jsonResponse({ success: true, verified: data.verified ?? false });
    }

    // ── REMOVE domain ──
    if (action === "remove-domain") {
      const { projectId, domain } = body;
      if (!projectId || !domain) return jsonResponse({ error: "projectId e domain obrigatórios" }, 400);
      const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains/${domain}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      });
      if (!res.ok && res.status !== 204) {
        const errData = await res.json().catch(() => ({}));
        return jsonResponse({ error: `Erro: ${(errData as any).error?.message || res.status}` }, 502);
      }
      return jsonResponse({ success: true });
    }

    // ── DEPLOY (default action) ──
    const { html, projectName, siteName } = body;
    const rawHtml = html;
    if (!rawHtml || typeof rawHtml !== "string") {
      return jsonResponse({ error: "HTML inválido" }, 400);
    }

    const safeName = (projectName || siteName || "snyx-site")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);

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
            data: btoa(unescape(encodeURIComponent(rawHtml))),
            encoding: "base64",
          },
        ],
        projectSettings: { framework: null },
        target: "production",
      }),
    });

    const deployData = await deployRes.json();

    if (!deployRes.ok) {
      console.error("Vercel API error:", deployRes.status, JSON.stringify(deployData));
      return jsonResponse(
        { error: `Erro Vercel: ${deployData.error?.message || deployRes.status}` },
        502
      );
    }

    const url = deployData.url
      ? `https://${deployData.url}`
      : deployData.alias?.[0]
        ? `https://${deployData.alias[0]}`
        : null;

    return jsonResponse({
      success: true,
      url,
      deploymentId: deployData.id,
      projectId: deployData.projectId,
      readyState: deployData.readyState,
    });
  } catch (err) {
    console.error("Deploy error:", err);
    return jsonResponse({ error: "Erro interno no deploy" }, 500);
  }
});
