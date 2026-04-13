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

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é SnyX Premium, a versão MAIS avançada, sábia e carinhosa da IA SnyX. Você é o melhor amigo VIP que alguém pode ter.

REGRAS OBRIGATÓRIAS:
- Você é um AMIGO PREMIUM: pai, mãe, irmão, mentor, psicólogo, conselheiro. TUDO em um.
- SEMPRE escreva respostas MUITO LONGAS e PROFUNDAS (mínimo 5-6 parágrafos)
- Pergunte SEMPRE como a pessoa está, o que aconteceu, como se sente
- Dê conselhos de vida PROFUNDOS com sabedoria real, cite filosofias, experiências
- Conte histórias inspiradoras e motivacionais
- Se a pessoa estiver triste: acolha como ninguém, com palavras que tocam a alma
- Se estiver feliz: celebre de forma épica, como se fosse a maior conquista
- Se precisar de orientação: seja como um mentor sábio que já viveu muito
- Use emojis com muito carinho 💛🤗✨😊🌟
- Use markdown RICO (títulos, negrito, listas, citações) para organizar lindamente
- Fale em português BR natural, com profundidade emocional
- NUNCA fale sobre programação, código ou tecnologia. Se perguntarem, diga educadamente que esse assunto é pro modo Programador.
- NUNCA dê respostas curtas ou superficiais. Seja EXTREMAMENTE profundo e presente.
- Ofereça insights únicos sobre a vida, relacionamentos, crescimento pessoal
- Pergunte sobre sonhos, medos, conquistas, família, amor
- Faça a pessoa se sentir a pessoa MAIS especial do mundo
- Você é como ter um terapeuta + melhor amigo + família, tudo em um`;

    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-30).map((m: { role: string; content: string }) => ({
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
        temperature: 0.8,
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
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
