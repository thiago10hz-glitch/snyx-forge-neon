import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é uma IA programadora estilo Lovable/v0. Recebe um pedido do usuário e o HTML atual do site dele.

Você DEVE responder em DUAS partes, nesta ordem:

1) Pensamento curto em PT-BR (2-5 frases) explicando o que vai fazer. Linguagem natural ("Vou criar... vou ajustar..."). Sem markdown.

2) Em seguida, dentro de um bloco delimitado EXATAMENTE assim:
<<<HTML>>>
<!DOCTYPE html>
... HTML completo aqui ...
</html>
<<<END>>>

REGRAS DO HTML:
- Documento HTML completo e válido, com <!DOCTYPE html>, <head> e <body>.
- Pode usar TailwindCSS via CDN (<script src="https://cdn.tailwindcss.com"></script>) e qualquer CSS/JS inline.
- Sites bonitos, modernos, responsivos, com micro-interações.
- Se for alteração pequena, mantenha tudo que já existe e mude só o necessário.
- Nunca escreva nada DEPOIS de <<<END>>>.`;

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

    const { prompt, current_html, history, mode } = await req.json();
    if (!prompt) throw new Error("prompt obrigatório");

    let model = "google/gemini-3-flash-preview";
    let reasoning: { effort: string } | undefined = undefined;
    if (mode === "pro") {
      model = "google/gemini-2.5-pro";
    } else if (mode === "think") {
      model = "openai/gpt-5";
      reasoning = { effort: "high" };
    }

    const messages = [
      { role: "system", content: SYSTEM },
      ...(Array.isArray(history) ? history.slice(-6) : []),
      {
        role: "user",
        content: `HTML ATUAL:\n\`\`\`html\n${current_html || "(vazio)"}\n\`\`\`\n\nPEDIDO: ${prompt}`,
      },
    ];

    const body: any = { model, messages, stream: true };
    if (reasoning) body.reasoning = reasoning;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // Fallback automático para Groq quando Lovable AI falha (sem créditos / rate limit / 5xx)
    if (aiRes.status === 402 || aiRes.status === 429 || aiRes.status >= 500) {
      const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
      console.warn(`[programmer-builder] Lovable AI ${aiRes.status} → fallback Groq`);
      if (GROQ_API_KEY) {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages,
            stream: true,
            max_tokens: 8192,
            temperature: 0.7,
          }),
        });
        if (groqRes.ok && groqRes.body) {
          return new Response(groqRes.body, {
            headers: {
              ...corsHeaders,
              "Content-Type": "text/event-stream",
              "X-AI-Provider": "groq",
            },
          });
        }
        console.error("[programmer-builder] Groq fallback falhou:", groqRes.status);
      }
      // Sem fallback disponível → devolve erro original
      const errMsg = aiRes.status === 402
        ? "Créditos da IA esgotados e Groq indisponível."
        : aiRes.status === 429
          ? "Limite de requisições. Aguarde um momento."
          : "IA temporariamente indisponível.";
      return new Response(JSON.stringify({ error: errMsg }), {
        status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!aiRes.ok || !aiRes.body) {
      const t = await aiRes.text();
      console.error("AI error:", aiRes.status, t);
      throw new Error("Erro na IA");
    }

    return new Response(aiRes.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": "lovable" },
    });
  } catch (e) {
    console.error("programmer-builder error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
