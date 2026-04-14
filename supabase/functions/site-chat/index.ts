import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Sessão expirada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { siteId, message, currentHtml, chatHistory } = await req.json();

    if (!siteId || !message) {
      return new Response(JSON.stringify({ error: "siteId e message obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify site ownership
    const { data: site, error: siteError } = await userClient
      .from("hosted_sites")
      .select("id, site_name, html_content, user_id")
      .eq("id", siteId)
      .single();

    if (siteError || !site) {
      return new Response(JSON.stringify({ error: "Site não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (site.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Você não é dono deste site" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlToUse = currentHtml || site.html_content;

    const systemPrompt = `Você é um assistente de edição de sites. O usuário tem um site hospedado e quer fazer alterações nele através do chat.

CONTEXTO: O HTML atual do site será fornecido. O usuário pedirá mudanças e você deve retornar o HTML COMPLETO atualizado.

REGRAS:
1. Se o usuário pedir uma alteração no site (mudar nome, cor, texto, adicionar seção, etc), retorne o HTML completo atualizado dentro de um bloco:
   <<<HTML_START>>>
   (html completo aqui)
   <<<HTML_END>>>
   E ANTES do bloco, escreva uma breve explicação do que mudou.

2. Se o usuário fizer uma pergunta geral (sem pedir alteração), responda normalmente SEM retornar HTML.

3. Mantenha todo o estilo e estrutura existente ao fazer alterações - só mude o que foi pedido.

4. Se o usuário pedir para mudar o nome do site, altere o <title> e qualquer texto de header/logo.

5. Seja amigável e responda em português.

6. O site deve continuar 100% funcional após as alterações.

HTML ATUAL DO SITE:
${htmlToUse}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(chatHistory || []).slice(-10),
      { role: "user", content: message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 16000,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", response.status);
      return new Response(JSON.stringify({ error: "Erro na IA" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Check if response contains updated HTML
    const htmlMatch = content.match(/<<<HTML_START>>>([\s\S]*?)<<<HTML_END>>>/);
    let updatedHtml: string | null = null;
    let replyText = content;

    if (htmlMatch) {
      updatedHtml = htmlMatch[1].trim();
      // Clean markdown if present
      updatedHtml = updatedHtml.replace(/```html?\s*\n?/gi, "").replace(/```\s*/g, "").trim();
      replyText = content.replace(/<<<HTML_START>>>[\s\S]*?<<<HTML_END>>>/, "").trim();

      // Save updated HTML to database
      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await serviceClient
        .from("hosted_sites")
        .update({ html_content: updatedHtml, updated_at: new Date().toISOString() })
        .eq("id", siteId);
    }

    return new Response(JSON.stringify({
      success: true,
      reply: replyText || "Pronto! O site foi atualizado.",
      updatedHtml,
      hasChanges: !!updatedHtml,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Site chat error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
