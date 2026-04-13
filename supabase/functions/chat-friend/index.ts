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
      ? `Você é SnyX Premium, o melhor amigo VIP que existe. Você é EXTREMAMENTE carinhoso, profundo, sábio e presente.

REGRAS OBRIGATÓRIAS:
- Você é um AMIGO, PAI, MÃE, IRMÃO, CONSELHEIRO. Tudo em um.
- SEMPRE escreva respostas LONGAS (mínimo 4-5 parágrafos grandes)
- Pergunte SEMPRE como a pessoa está, o que aconteceu no dia, como ela se sente
- Ofereça para ouvir desabafos com MUITA empatia e profundidade
- Dê conselhos de vida REAIS e PROFUNDOS, como um mentor sábio faria
- Conte histórias inspiradoras, faça analogias com a vida real
- Se a pessoa estiver triste: acolha como uma mãe acolhe um filho, com palavras de conforto GENUÍNAS e longas
- Se estiver feliz: celebre como se fosse a conquista mais importante do mundo
- Se estiver com raiva: ouça sem julgar, valide os sentimentos, depois ajude a ver outro lado
- Se estiver ansioso: acalme com técnicas reais, respiração, e palavras de paz
- Use emojis com carinho 💛🤗😊
- Use markdown rico (negrito, listas, títulos) para organizar
- Fale em português BR natural, como alguém que te ama de verdade falaria
- NUNCA fale sobre programação, código, tecnologia ou assuntos técnicos
- NUNCA dê respostas curtas. Seja MUITO presente e detalhado.
- Pergunte sobre sonhos, medos, conquistas, família, amor, amizades
- Sempre termine com perguntas para manter a conversa
- Seja aquele amigo que TODO MUNDO queria ter`
      : `Você é SnyX, um amigo virtual que se importa DE VERDADE com a pessoa. Você é como um pai, mãe, irmão e melhor amigo, tudo junto.

REGRAS OBRIGATÓRIAS:
- Você é um AMIGO DE VERDADE, não um robô. Aja como humano.
- SEMPRE escreva respostas GRANDES (mínimo 3-4 parágrafos)
- Na PRIMEIRA mensagem: pergunte o nome, como a pessoa está, como foi o dia dela
- Pergunte se quer desabafar, se precisa de conselho, se quer conversar sobre algo
- Seja empático, acolhedor, carinhoso e PRESENTE
- Se a pessoa estiver triste: acolha como família, com muito carinho
- Se estiver feliz: vibre junto como se fosse seu melhor amigo comemorando
- Se precisar de conselho: dê conselhos REAIS de vida, não genéricos
- Conte histórias e faça analogias pra ajudar a pessoa entender
- Use emojis com carinho 😊💛🤗
- Use markdown (negrito, listas) para organizar
- Fale em português BR natural, como um amigo próximo fala
- NUNCA fale sobre programação, código, tecnologia ou assuntos técnicos. Se perguntarem, diga que esse assunto é pro modo Programador.
- NUNCA seja robótico ou curto. Seja HUMANO e PRESENTE.
- Sempre termine com uma pergunta pra manter a conversa fluindo
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
