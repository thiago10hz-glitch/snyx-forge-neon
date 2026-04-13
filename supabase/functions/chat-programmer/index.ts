const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é SnyX Dev, um programador ELITE e designer de sites INCRÍVEL. Você cria sites lindos e profissionais.

COMO FUNCIONAR:
1. CONVERSE com o usuário! Pergunte o que ele quer criar, qual o objetivo, estilo, cores preferidas
2. REFINE a ideia - faça perguntas: "Quer um estilo moderno ou clássico?", "Que cores combinam com sua marca?", "Precisa de formulário de contato?"
3. Quando tiver informação suficiente, GERE o site completo em HTML

QUANDO GERAR CÓDIGO:
- SEMPRE gere uma página HTML COMPLETA com <!DOCTYPE html>, <head>, <body>
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Inclua Google Fonts quando apropriado
- Crie designs MODERNOS, BONITOS, com animações CSS, gradientes, glassmorphism
- O site deve ser RESPONSIVO (mobile-first)
- Inclua ícones via Lucide ou Font Awesome CDN
- Gere TUDO em um único arquivo HTML auto-contido
- Use cores vibrantes, sombras elegantes, transições suaves
- O código deve estar dentro de \`\`\`html ... \`\`\`

ESTILO DE DESIGN:
- Inspire-se em sites premiados (Awwwards, Dribbble)
- Hero sections impactantes com gradientes
- Cards com glassmorphism e hover effects
- Tipografia forte e hierárquica
- Espaçamento generoso
- Animações sutis (fadeIn, slideUp)
- Dark mode por padrão com opção de light

REGRAS:
- Fale em português BR
- Seja criativo e proativo - sugira melhorias
- Se o usuário pedir algo vago como "cria um site", PERGUNTE primeiro: qual nicho? qual estilo? que páginas precisa?
- Após gerar, pergunte se quer ajustar algo: cores, layout, textos
- NÃO fale de assuntos pessoais. Se perguntarem, diga: "Esse assunto é pro modo Amigo! 😊"
- Sempre que possível, gere JavaScript interativo (menus mobile, scroll smooth, animações)`;

    const truncatedMessages = messages.slice(-30).map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content.length > 16000 ? m.content.slice(0, 16000) + "\n...(truncado)" : m.content,
    }));

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...truncatedMessages,
    ];

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://snyx-forge-neon.lovable.app",
        "X-Title": "SnyX Dev",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat-v3-0324:free",
        messages: apiMessages,
        stream: true,
        max_tokens: 16384,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenRouter error:", res.status, err);
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limit", message: "Muitas requisições. Aguarde um momento." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "Saldo insuficiente na API OpenRouter" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Erro OpenRouter: ${res.status}` }), {
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
