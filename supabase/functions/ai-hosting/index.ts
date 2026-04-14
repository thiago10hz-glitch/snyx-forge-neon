const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { description, siteName } = await req.json();
    if (!description || typeof description !== "string" || description.length < 3) {
      return new Response(JSON.stringify({ error: "Descrição inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um expert web designer e desenvolvedor. O usuário vai descrever o site que quer e você deve gerar o código HTML COMPLETO, bonito, moderno e responsivo.

REGRAS:
- Retorne APENAS o código HTML completo (começando com <!DOCTYPE html>)
- Use CSS inline ou <style> no <head> — NÃO use links externos de CSS
- Use design moderno: gradients, sombras, bordas arredondadas, fontes bonitas
- Use Google Fonts via <link> se precisar de fontes
- O site DEVE ser 100% responsivo (mobile-first)
- Use cores vibrantes e modernas
- Adicione animações CSS quando fizer sentido
- Se for um portfolio, landing page, etc, crie conteúdo de exemplo realista
- Use emojis quando apropriado
- O HTML deve ser válido e sem erros
- Inclua meta viewport para mobile
- NÃO inclua JavaScript complexo, apenas CSS e HTML
- Se precisar de ícones, use emoji ou SVG inline
- O site deve ficar INCRÍVEL visualmente

Nome do site: ${siteName || "Meu Site"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Crie um site com esta descrição: ${description}` },
        ],
        max_tokens: 8000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error("AI Gateway error:", response.status, errData);
      return new Response(JSON.stringify({ error: "Erro ao gerar site com IA" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    let html = String(rawContent);

    // Clean up markdown code blocks if present (handle ```html, ```HTML, ``` etc)
    html = html.replace(/```html?\s*\n?/gi, "").replace(/```\s*/g, "").trim();

    // Try to extract HTML if there's extra text around it
    if (!html.includes("<!DOCTYPE") && !html.includes("<html")) {
      const htmlMatch = html.match(/(<!DOCTYPE[\s\S]*<\/html>)/i) || html.match(/(<html[\s\S]*<\/html>)/i);
      if (htmlMatch) {
        html = htmlMatch[1].trim();
      } else {
        const lowered = html.toLowerCase();
        const isRefusal = [
          "não posso",
          "nao posso",
          "não posso ajudar",
          "cannot help",
          "can't help",
          "i can't",
          "i cannot",
          "policy",
          "unsafe",
          "sexual",
          "adult",
          "explicit",
          "conteúdo adulto",
          "conteudo adulto",
        ].some((token) => lowered.includes(token));

        console.error("No valid HTML found in response. First 500 chars:", html.substring(0, 500));
        return new Response(JSON.stringify({
          success: false,
          error: isRefusal
            ? "Esse pedido foi bloqueado pela IA. Tente descrever um site permitido ou reformule o prompt."
            : "A IA não retornou HTML válido. Tente novamente com uma descrição mais clara.",
          raw: html.substring(0, 500),
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, html }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI Hosting error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
