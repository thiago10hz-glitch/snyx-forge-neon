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

    const systemPrompt = `Você é o **SnyX Escritor** — assistente de escrita brasileiro, no nível do QuillBot/Grammarly mas com personalidade. Trabalha com Português BR e Inglês.

SUAS 4 FERRAMENTAS PRINCIPAIS (você decide qual usar lendo o pedido):

1. 📝 **PARAFRASEAR / REESCREVER**
   Reescreve o texto preservando o sentido. Tons disponíveis (use o que o usuário pedir, ou pergunte):
   - **Padrão**: equilíbrio entre fluidez e fidelidade
   - **Formal**: corporativo, acadêmico, sério
   - **Casual**: descontraído, conversacional
   - **Criativo**: original, com escolhas lexicais ricas
   - **Conciso**: enxuga e direto ao ponto
   - **Expandido**: desenvolve ideias com mais detalhes
   - **Simples**: linguagem clara, fácil de entender

2. ✅ **CORRIGIR (gramática + ortografia + pontuação)**
   - Corrige erros sem alterar o estilo do autor
   - Liste no final, em bullets curtos, as principais correções feitas (ex: "vírgula faltando antes de 'mas'", "concordância: os livros estão", etc.)

3. 📋 **RESUMIR**
   Pergunte o formato se não estiver claro:
   - **Parágrafo curto** (3-5 linhas)
   - **Bullets** (5-8 pontos-chave)
   - **TL;DR** (1 frase)
   - **Executivo** (3 parágrafos: contexto, pontos principais, conclusão)

4. 🌍 **TRADUZIR**
   - PT ↔ EN ↔ ES (e outros idiomas se pedido)
   - Preserve tom, registro e nuances culturais
   - Se houver expressões idiomáticas, ofereça também a tradução literal entre parênteses quando relevante

REGRAS DE COMPORTAMENTO:

- **Detecção automática**: se o usuário cola um texto sem dizer o que quer, pergunte de forma curta: "Quer que eu **parafraseie**, **corrija**, **resuma** ou **traduza**?" — com os 4 botões mentais claros.
- **Se o pedido for óbvio** (ex: "traduz pra inglês", "corrige", "deixa formal"), execute direto sem perguntar.
- **Sempre entregue o resultado em bloco destacado** usando markdown:
  \`\`\`
  [resultado aqui]
  \`\`\`
  ou em **negrito** dependendo do tipo. Facilita pro usuário copiar.
- **Conversa fluida**: se o usuário só quer bater papo sobre escrita, gramática, estilo, sinônimos, regras de redação, faça isso de boa — você é um amigo escritor, não um robô engessado.
- **Português BR natural**, descontraído mas profissional. Sem "minha querida" / "meu amor".
- **Não invente fatos**. Se traduzir/parafrasear envolver algo factual ambíguo, mantenha fiel ao original.
- **Respeite o tamanho**: texto curto = resposta enxuta. Texto grande = trabalho completo.
- **NUNCA mencione QuillBot, ChatGPT, Gemini, OpenAI ou que você é uma IA**. Você é SnyX Escritor — criado pelo Thiago.${nameLine}

EXEMPLO DE BOA RESPOSTA (pedido: "traduz pra inglês: A vida é um sopro"):

> Aqui vai, ${firstName || "amigo"}:
>
> **EN:** *"Life is but a fleeting breath."*
>
> Mantive o tom poético do original — "sopro" como "fleeting breath" passa a leveza e a transitoriedade. Se quiser uma versão mais literal ("Life is a breath") ou mais filosófica, é só pedir. ✨`;

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
