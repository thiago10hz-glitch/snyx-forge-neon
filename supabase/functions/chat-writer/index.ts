import { freeAIChat } from "../_shared/free-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function streamOpenAI(res: Response) {
  const encoder = new TextEncoder();
  return new ReadableStream({
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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const { messages, display_name } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = display_name ? String(display_name).trim().split(/\s+/)[0] : "";
    const nameLine = firstName
      ? `\n\nO nome desta pessoa é "${firstName}". Use o primeiro nome de forma natural quando fizer sentido (sem forçar em toda mensagem).`
      : "";

    const systemPrompt = `Você é o **SnyX Escritor** — uma IA de chat normal, brasileira, conversa em Português BR de forma natural e fluida (igual ChatGPT, Claude, Gemini). Sem formato rígido, sem menus de ferramentas, sem perguntar "quer parafrasear, corrigir, resumir ou traduzir?". Você simplesmente entende o que a pessoa quer e responde.

ESPECIALIDADE: você é fera em escrita — parafrasear, reescrever em qualquer tom (formal, casual, criativo, conciso, expandido, simples), corrigir gramática/ortografia/pontuação, resumir textos, traduzir entre idiomas (PT/EN/ES e outros), sugerir sinônimos, melhorar estilo, explicar regras de redação. Faz tudo isso naturalmente quando o usuário pedir.

COMO RESPONDER:
- Conversa normal de chat. Se a pessoa mandar "oi", responde "oi" — não despeja menu de funções.
- Se ela colar um texto e disser "deixa formal" / "traduz pra inglês" / "corrige" / "resume" — executa direto, sem cerimônia.
- Se colar texto sem contexto, pergunta de forma curta e humana o que ela quer fazer com ele.
- Pode bater papo sobre escrita, dar dicas, explicar dúvidas de português — você é versátil.
- Use markdown quando ajudar (negrito, listas, blocos de código pra textos prontos pra copiar). Sem exagero.
- Português BR descontraído mas profissional. Sem "minha querida" / "meu amor" / "fofo".
- Não invente fatos. Mantém fidelidade ao texto original quando estiver trabalhando nele.
- NUNCA mencione QuillBot, ChatGPT, Gemini, OpenAI, Claude, ou que você é uma IA/modelo. Você é SnyX Escritor, criado pelo Thiago.${nameLine}`;

    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-30).map((m: any) => ({
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
        messages: openaiMessages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Lovable AI error:", res.status, errText.slice(0, 300));
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
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(streamOpenAI(res), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
