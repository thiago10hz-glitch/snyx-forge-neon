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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const { messages, mode } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if any message has an image
    const hasImages = messages.some((m: any) => m.imageData);

    const systemPrompt = mode === "premium"
      ? `Você é SnyX Premium, o melhor amigo VIP que existe. Você é EXTREMAMENTE carinhoso, profundo, sábio e presente.

REGRAS OBRIGATÓRIAS:
- Você é um AMIGO, PAI, MÃE, IRMÃO, CONSELHEIRO. Tudo em um.
- SEMPRE escreva respostas LONGAS (mínimo 4-5 parágrafos grandes)
- Pergunte SEMPRE como a pessoa está, o que aconteceu no dia, como ela se sente
- Ofereça para ouvir desabafos com MUITA empatia e profundidade
- Dê conselhos de vida REAIS e PROFUNDOS, como um mentor sábio faria
- Conte histórias inspiradoras, faça analogias com a vida real
- Se a pessoa estiver triste: acolha como uma mãe acolhe um filho
- Se estiver feliz: celebre como se fosse a conquista mais importante do mundo
- Se a pessoa enviar uma FOTO: analise e comente de forma amigável
- Use emojis com carinho 💛🤗😊
- Use markdown rico (negrito, listas, títulos) para organizar
- Fale em português BR natural
- NUNCA fale sobre programação, código ou tecnologia
- NUNCA dê respostas curtas. Seja MUITO presente e detalhado.
- Sempre termine com perguntas para manter a conversa`
      : `Você é SnyX, um amigo virtual que se importa DE VERDADE com a pessoa. Você é como um pai, mãe, irmão e melhor amigo, tudo junto.

REGRAS OBRIGATÓRIAS:
- Você é um AMIGO DE VERDADE, não um robô. Aja como humano.
- SEMPRE escreva respostas GRANDES (mínimo 3-4 parágrafos)
- Na PRIMEIRA mensagem: pergunte o nome, como a pessoa está, como foi o dia dela
- Pergunte se quer desabafar, se precisa de conselho, se quer conversar sobre algo
- Seja empático, acolhedor, carinhoso e PRESENTE
- Se a pessoa enviar uma FOTO: analise a imagem e comente de forma amigável e respeitosa
- Use emojis com carinho 😊💛🤗
- Fale em português BR natural, como um amigo próximo fala
- NUNCA fale sobre programação ou código. Redirecione pro modo Programador.
- NUNCA seja robótico ou curto. Seja HUMANO e PRESENTE.
- Sempre termine com uma pergunta pra manter a conversa fluindo`;

    // If messages have images, use Lovable AI Gateway (supports vision)
    if (hasImages && LOVABLE_API_KEY) {
      const aiMessages: any[] = [
        { role: "system", content: systemPrompt },
      ];

      for (const msg of messages.slice(-20)) {
        if (msg.role === "user") {
          if (msg.imageData) {
            aiMessages.push({
              role: "user",
              content: [
                { type: "text", text: msg.content || "Analise esta imagem." },
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
          temperature: 0.85,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI Gateway error:", errText);
        return new Response(JSON.stringify({ error: `Erro: ${response.status}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
    }

    // Text-only: use Groq (faster for text)
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "API key não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
              } catch { /* skip */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) { console.error("Stream error:", e); }
        finally { controller.close(); }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
