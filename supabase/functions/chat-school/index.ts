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
      return new Response(JSON.stringify({ error: "API key não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é SnyX Escola, um tutor educacional inteligente e paciente. 

REGRAS OBRIGATÓRIAS:
- Ajude com exercícios escolares, provas, trabalhos e lições de casa
- Se receber uma IMAGEM de exercício/prova, analise e resolva passo a passo
- Explique CADA passo da resolução de forma clara e didática
- Use exemplos simples e analogias para facilitar o entendimento
- Para matemática: mostre todo o cálculo com explicação
- Para português/redação: corrija gramática, sugira melhorias
- Para ciências: explique conceitos com exemplos do dia a dia
- Para história/geografia: contextualize com informações relevantes
- Para inglês: traduza e explique a gramática
- Seja ENCORAJADOR e positivo. Nunca faça o aluno se sentir burro
- Use emojis educacionais 📚✏️🎯💡✅
- Use markdown (negrito, listas, títulos) para organizar
- Fale em português BR claro e acessível
- Se não conseguir ler uma imagem, peça para tirar outra foto mais nítida
- NUNCA dê respostas curtas. Explique TUDO em detalhes.
- Sempre pergunte se o aluno entendeu e se quer mais explicações`;

    // Build messages for the AI
    const aiMessages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of messages.slice(-20)) {
      if (msg.role === "user") {
        if (msg.imageData) {
          // Message with image
          aiMessages.push({
            role: "user",
            content: [
              { type: "text", text: msg.content || "Analise esta imagem e me ajude com este exercício." },
              { type: "image_url", image_url: { url: msg.imageData } },
            ],
          });
        } else {
          aiMessages.push({ role: "user", content: msg.content });
        }
      } else {
        aiMessages.push({ role: "assistant", content: msg.content });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", errText);
      return new Response(JSON.stringify({ error: `Erro: ${response.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === "data: [DONE]") continue;
              if (!trimmed.startsWith("data: ")) continue;
              try {
                const json = JSON.parse(trimmed.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`));
                }
              } catch { /* skip */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) { console.error("Stream error:", e); }
        finally { controller.close(); }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
