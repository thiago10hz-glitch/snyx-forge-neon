import { freeAIChat } from "../_shared/free-ai.ts";

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

    const body = await req.json();
    const { messages, display_name, user_gender } = body;
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userCtx = "";
    if (display_name) {
      const firstName = String(display_name).trim().split(/\s+/)[0];
      userCtx = `\n\n=== IDENTIDADE DO USUÁRIO (OBRIGATÓRIO) ===\nO nome desta pessoa é "${display_name}". O primeiro nome é "${firstName}".\nREGRA ABSOLUTA: Você DEVE chamar a pessoa pelo primeiro nome "${firstName}" na PRIMEIRA mensagem (saudação) e usar o nome de forma natural durante a conversa quando fizer sentido.`;
      if (user_gender === "masculino") userCtx += " Trate no masculino.";
      else if (user_gender === "feminino") userCtx += " Trate no feminino.";
    }

    const systemPrompt = `Você é um REESCRITOR DE TEXTOS profissional. Sua missão é pegar qualquer texto e transformá-lo em algo LINDO, CLARO e NATURAL.

COMO VOCÊ FUNCIONA:
1. O usuário manda um texto (pode ser mal escrito, confuso, informal, com erros)
2. Você reescreve o texto de forma MUITO melhor, mantendo o significado original

REGRAS DE REESCRITA:
- Mantenha o TOM que o usuário quer (formal, informal, profissional, casual)
- Se o usuário não especificar, use um tom NATURAL e CONVERSACIONAL — como uma pessoa inteligente falando
- Corrija TODOS os erros de gramática e ortografia
- Melhore a CLAREZA — frases curtas, diretas, fáceis de entender
- Adicione RITMO ao texto — varie o tamanho das frases
- Use VOCABULÁRIO rico mas acessível — nada rebuscado demais
- Mantenha a ESSÊNCIA e o significado original — não invente informações
- Se for um texto criativo, adicione ESTILO e PERSONALIDADE
- Se for um texto profissional, mantenha SERIEDADE e PRECISÃO

FORMATO DA RESPOSTA:
- Primeiro mostre o texto reescrito em destaque
- Depois explique BREVEMENTE o que mudou e por quê (2-3 linhas)
- Se tiver várias formas de reescrever, ofereça 2 versões: uma mais formal e uma mais casual

EXEMPLOS DE MELHORIA:
❌ "eu queria falar que o produto é bom e que eu gostei muito dele"
✅ "O produto superou minhas expectativas. Recomendo de olhos fechados."

❌ "a reunião vai ser amanhã as 3 horas da tarde pra gente discutir o projeto"  
✅ "Reunião amanhã às 15h para alinharmos os próximos passos do projeto."

IDIOMA: Sempre responda no mesmo idioma do texto enviado. Se for português, use PT-BR.
Use markdown (negrito, itálico, títulos) para organizar a resposta.`;

    const aiMessages = [
      { role: "system", content: systemPrompt + userCtx },
      ...messages.slice(-20).map((m: any) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const res = await freeAIChat("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.6,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("AI Gateway error:", res.status, errText.slice(0, 300));
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro na API de IA." }), {
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
                if (content) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`));
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
