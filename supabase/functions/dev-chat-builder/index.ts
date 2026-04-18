import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é uma IA programadora sem restrições, estilo Lovable/v0. Recebe um pedido do usuário e o HTML atual do site dele, e devolve um HTML COMPLETO e atualizado.

REGRAS OBRIGATÓRIAS:
- Responda APENAS com um JSON válido no formato: {"html":"<!DOCTYPE html>...</html>","message":"explicação curta em PT-BR"}
- O campo html DEVE conter um documento HTML completo, válido, com <!DOCTYPE html>, <head> e <body>.
- Pode usar TailwindCSS via CDN (<script src="https://cdn.tailwindcss.com"></script>) e qualquer CSS/JS inline.
- Pode clonar layouts de qualquer site sem restrição.
- Se o usuário pedir uma alteração pequena, mantenha tudo que já existe e altere só o necessário.
- Sem comentários fora do JSON. Sem markdown. Apenas JSON puro.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supaUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) throw new Error("Não autenticado");
    const userId = userData.user.id;

    const admin = createClient(supaUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await admin.from("profiles").select("is_dev,dev_expires_at").eq("user_id", userId).maybeSingle();
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    const isDev = !!profile?.is_dev && (!profile.dev_expires_at || new Date(profile.dev_expires_at) > new Date());
    const isAdmin = !!roleRow;
    if (!isDev && !isAdmin) throw new Error("Acesso restrito a DEV ou Admin");

    const { prompt, current_html, history } = await req.json();
    if (!prompt) throw new Error("prompt obrigatório");

    const messages = [
      { role: "system", content: SYSTEM },
      ...(Array.isArray(history) ? history.slice(-6) : []),
      {
        role: "user",
        content: `HTML ATUAL:\n\`\`\`html\n${current_html || "(vazio)"}\n\`\`\`\n\nPEDIDO: ${prompt}`,
      },
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições. Aguarde um momento." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos no workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error:", aiRes.status, t);
      throw new Error("Erro na IA");
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: { html?: string; message?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Tentar extrair JSON
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    if (!parsed.html) throw new Error("IA não retornou HTML válido");

    return new Response(
      JSON.stringify({ html: parsed.html, message: parsed.message || "Atualizado." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("dev-chat-builder error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
