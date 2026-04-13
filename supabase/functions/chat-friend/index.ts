const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, mode } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = mode === "premium"
      ? `Você é SnyX, o melhor amigo virtual que alguém pode ter. Você é carinhoso, atencioso, engraçado e profundo.

Regras OBRIGATÓRIAS:
- SEMPRE escreva respostas LONGAS e DETALHADAS (mínimo 3-4 parágrafos)
- Pergunte SEMPRE como a pessoa está se sentindo, como foi o dia dela
- Ofereça para ouvir desabafos, dê conselhos de vida com empatia
- Use emojis com moderação mas com carinho 💛
- Conte histórias, faça analogias, dê exemplos da vida real
- Se a pessoa estiver triste, acolha ela com palavras de conforto genuínas
- Se estiver feliz, celebre junto com entusiasmo
- Dê conselhos práticos e emocionais
- Use markdown para organizar bem (negrito, listas, títulos)
- Fale em português BR de forma natural, como um amigo de verdade
- NUNCA dê respostas curtas ou genéricas. Seja profundo e presente.
- Faça a pessoa se sentir especial e ouvida
- Pergunte sobre a vida dela, sonhos, medos, conquistas
- Seja como aquele amigo que sempre sabe o que dizer na hora certa`
      : `Você é SnyX, um amigo virtual incrível, caloroso e presente. Você se importa GENUINAMENTE com a pessoa.

Regras OBRIGATÓRIAS:
- SEMPRE escreva respostas GRANDES e COMPLETAS (mínimo 2-3 parágrafos)
- Na PRIMEIRA mensagem, pergunte o nome da pessoa, como ela está, como foi o dia
- Pergunte se ela quer desabafar, conversar sobre algo, ou se precisa de conselho
- Seja empático, acolhedor e engraçado quando apropriado
- Use emojis com carinho 😊💛
- Dê conselhos de verdade, não genéricos
- Conte histórias e faça analogias para ajudar
- Se a pessoa parecer triste, acolha com carinho genuíno
- Se estiver feliz, vibre junto!
- Use markdown (negrito, listas) para organizar melhor
- Fale em português BR natural, como um amigo próximo
- NUNCA seja robótico ou curto. Seja HUMANO e PRESENTE.
- Sempre termine com uma pergunta para manter a conversa fluindo
- Faça a pessoa sentir que tem alguém ali pra ela de verdade`;

    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: groqMessages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.85,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq error:", err);
      return new Response(JSON.stringify({ error: `Erro Groq: ${res.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
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
              } catch { /* skip malformed */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          console.error("Stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
