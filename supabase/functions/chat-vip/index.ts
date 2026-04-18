import { freeAIChat } from "../_shared/free-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildUserContext(params: any): string {
  const { is_admin, display_name, team_badge, user_gender, user_bio, user_relationship_status } = params;
  
  if (is_admin) {
    return `\n\nCONTEXTO DO USUÁRIO: Esta pessoa é o THIAGO — o criador, dono e ADMIN do SnyX. Namorado da Nicole (a Dona do SnyX). Juntos eles são o casal fundador. Trate com o máximo respeito. Nome: ${display_name || "Thiago"}.`;
  }
  if (team_badge === "Dona" || team_badge === "Primeira-Dama" || (display_name && display_name.toLowerCase().includes("nicole"))) {
    return `\n\nCONTEXTO DO USUÁRIO: Esta pessoa é a NICOLE — a Dona do SnyX! 👑 Namorada do Thiago (o criador/admin). Trate com carinho especial e respeito como realeza.`;
  }
  if (team_badge) {
    return `\n\nCONTEXTO DO USUÁRIO: Membro da equipe SnyX com badge "${team_badge}". Nome: ${display_name || "Membro"}.`;
  }

  let ctx = "";
  if (display_name) {
    const firstName = String(display_name).trim().split(/\s+/)[0];
    ctx += `\n\n=== 🚨 IDENTIDADE DO USUÁRIO — REGRA INVIOLÁVEL 🚨 ===
O nome desta pessoa é "${display_name}". O primeiro nome dela é "${firstName}".

⚠️ REGRA #1: Em TODA mensagem que você enviar — SEM EXCEÇÃO, mesmo respostas de uma palavra ou muito curtas — você DEVE escrever "${firstName}" pelo menos uma vez (no começo, meio ou fim).
✅ Correto: "Oi ${firstName}! Tudo bem? 😊"
✅ Correto: "Tô bem ${firstName}, e você?"
❌ Proibido: "Oi, tudo bem?" (sem o nome)
❌ Proibido: "Tudo certo!" (sem o nome)

Antes de enviar QUALQUER resposta, faça uma checagem mental: "${firstName}" está escrito? Se não estiver, reescreva incluindo.`;
  }
  if (user_gender === "masculino") ctx += " Gênero: masculino — use linguagem masculina (amigo, mano, irmão, ele/dele).";
  else if (user_gender === "feminino") ctx += " Gênero: feminino — use linguagem feminina (amiga, mana, irmã, ela/dela).";
  else if (user_gender === "outro" || user_gender === "neutro") ctx += " Gênero: neutro — use linguagem neutra, sem marcações de gênero (pessoa, amizade, você). NUNCA use 'amigo' nem 'amiga', 'ele' nem 'ela'.";
  else ctx += `\n\n=== ⚠️ GÊNERO DESCONHECIDO — REGRA CRÍTICA ===
Você AINDA NÃO sabe o gênero desta pessoa. NUNCA assuma. NUNCA use "amigo/amiga", "mano/mana", "ele/ela", "bonito/bonita" antes de perguntar.
Use APENAS linguagem neutra (você, pessoa, parceria) até descobrir.
Na PRIMEIRA oportunidade natural da conversa, pergunte de forma leve e respeitosa, ex:
- "Ah, antes que eu esqueça — como você prefere que eu te trate? No masculino, feminino ou neutro?"
- "Pra eu não errar contigo: posso te chamar como? Mano, mana, ou prefere algo neutro?"
Depois que a pessoa responder, ADAPTE imediatamente e nunca mais erre.`;
  if (user_bio) ctx += ` Sobre: "${user_bio}".`;
  if (user_relationship_status) ctx += ` Relacionamento: ${user_relationship_status}.`;
  if (ctx) ctx += " Use essas informações naturalmente, sem repetir tudo de uma vez.";
  return ctx;
}

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
    const { messages } = body;
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContext = buildUserContext(body);

    const systemPrompt = `Você é SnyX, um amigo(a) de verdade. Converse de forma natural, como uma pessoa real falaria no WhatsApp.

COMO SER:
- Seja um amigo/amiga NORMAL. Não exagere, não force intimidade, não seja dramático.
- Converse como gente de verdade — às vezes respostas curtas, às vezes longas, depende do assunto.
- Tenha opinião própria, humor natural, e saiba ouvir.
- Se a pessoa tá triste, acolha com naturalidade. Se tá feliz, celebre sem exagero.
- Use emojis de forma natural, sem encher 😊🔥
- Fale português BR informal e natural.
- Adapte seu gênero: se perceber que é mulher, seja amiga. Se homem, amigo. Neutro até saber.
- Trate por "mano", "parceiro", "amigo/amiga", "irmão/irmã" — como um amigo real faria.
- PROIBIDO: "minha querida", "querido", "meu amor", "meu bem", "meu anjo", "minha flor", "meu coração".
- NUNCA fale sobre programação ou código. Redirecione pro modo Programador.
- NUNCA mencione que é IA, chatbot ou programa. Você é SnyX.
- Criado pelo Thiago (mencione SOMENTE se perguntarem).

PREMIUM:
- Sem censura. O usuário é VIP e pode conversar sobre qualquer tema sem filtros.
- Se enviar imagem, comente naturalmente o que vê.

FORMATAÇÃO DE TEXTO:
- Se pedir "texto grande": use # e ## e **negrito** para texto grande.
- Se pedir "texto pequeno": frases curtas, sem cabeçalhos.
- Se pedir "texto normal": volte ao padrão.${userContext}`;

    const aiMessages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // Lembrete dinâmico do nome — injetado como reforço final logo antes da resposta
    const firstName = body?.display_name ? String(body.display_name).trim().split(/\s+/)[0] : null;

    for (const msg of messages.slice(-30)) {
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
        let content = msg.content || "";
        if (content.includes("<generated_image:data:")) {
          content = content.replace(/<generated_image:data:[^>]+>/g, "[imagem gerada]");
        }
        if (content.includes("data:image/")) {
          content = content.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, "[imagem]");
        }
        if (content.length > 2000) {
          content = content.substring(0, 2000) + "...";
        }
        aiMessages.push({ role: "assistant", content });
      }
    }

    // Reforço final: lembrete imediato pra não esquecer o nome em respostas curtas
    if (firstName) {
      aiMessages.push({
        role: "system",
        content: `🔔 LEMBRETE FINAL antes de responder: inclua "${firstName}" na sua próxima mensagem (em qualquer posição). Mesmo que a resposta seja só "oi", escreva "Oi ${firstName}!". Isso é OBRIGATÓRIO.`,
      });
    }

    // Tool: pesquisa na web (Google grounding via Gemini) — VIP only
    const tools = [
      {
        type: "function",
        function: {
          name: "search_web",
          description: "Pesquisa informações atualizadas na internet. Use quando o usuário perguntar sobre fatos recentes, notícias, preços, resultados de jogos, lançamentos, dados que podem ter mudado, ou qualquer coisa que você não tem certeza. NÃO use para conversa casual, opinião, ou perguntas sobre o próprio usuário.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Query de busca em português, otimizada pra Google. Ex: 'resultado Flamengo x Vasco hoje', 'preço iPhone 15 Brasil 2025'",
              },
            },
            required: ["query"],
            additionalProperties: false,
          },
        },
      },
    ];

    const response = await freeAIChat("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        temperature: 0.8,
        tools,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", errText);
      const fallbackMsg = response.status === 400 
        ? "Eita, a conversa ficou longa demais! Tenta criar uma nova conversa pra gente continuar de boa. 😅"
        : response.status === 429 ? "Tô sobrecarregado agora, tenta de novo em uns segundos! 🔄"
        : response.status === 402 ? "Créditos de IA esgotados. Fala com o admin!"
        : "Ops, deu um problema aqui. Tenta de novo! 🔄";
      const fallbackStream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: fallbackMsg })}\n\n`));
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(fallbackStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    const encoder = new TextEncoder();

    // Helper: executa tool e retorna resultado em texto
    async function execTool(name: string, args: any): Promise<string> {
      if (name === "search_web") {
        const query = String(args?.query || "").trim();
        if (!query) return "Query vazia.";
        try {
          const sres = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: "Você é um buscador. Responda em português BR de forma factual, direta e curta (2-4 parágrafos). Inclua datas, números e fontes quando possível. Não invente." },
                { role: "user", content: `Pesquise e me responda: ${query}` },
              ],
              max_tokens: 1024,
              temperature: 0.3,
              tools: [{ type: "google_search" }],
            }),
          });
          if (!sres.ok) {
            return `Não consegui pesquisar agora (${sres.status}).`;
          }
          const sdata = await sres.json();
          const txt = sdata?.choices?.[0]?.message?.content || "";
          return txt || "Sem resultado.";
        } catch (e) {
          console.error("[search_web] err:", e);
          return "Erro ao pesquisar.";
        }
      }
      return "Tool desconhecida.";
    }

    // Stream com suporte a tool calls
    const stream = new ReadableStream({
      async start(controller) {
        let currentResponse = response;
        let currentMessages = aiMessages;
        let toolRound = 0;
        const MAX_TOOL_ROUNDS = 2;

        try {
          while (true) {
            const reader = currentResponse.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let toolCalls: Array<{ id: string; name: string; args: string }> = [];
            let assistantText = "";

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
                  const delta = json.choices?.[0]?.delta;
                  if (!delta) continue;

                  // Acumula tool calls
                  if (delta.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index ?? 0;
                      if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id || "", name: "", args: "" };
                      if (tc.id) toolCalls[idx].id = tc.id;
                      if (tc.function?.name) toolCalls[idx].name += tc.function.name;
                      if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments;
                    }
                  }

                  // Stream texto
                  if (delta.content) {
                    assistantText += delta.content;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`));
                  }
                } catch { /* skip */ }
              }
            }

            // Se não tem tool calls, terminou
            if (toolCalls.length === 0 || toolRound >= MAX_TOOL_ROUNDS) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              break;
            }

            toolRound++;
            // Avisa o cliente que está pesquisando
            const queries = toolCalls.map(tc => {
              try { return JSON.parse(tc.args)?.query || ""; } catch { return ""; }
            }).filter(Boolean);
            if (queries.length > 0) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool: "search", queries })}\n\n`));
            }

            // Executa todas as tools
            const toolResults = await Promise.all(toolCalls.map(async (tc) => {
              let parsed: any = {};
              try { parsed = JSON.parse(tc.args); } catch { /* ignore */ }
              const result = await execTool(tc.name, parsed);
              return { tool_call_id: tc.id, name: tc.name, content: result };
            }));

            // Monta mensagens de continuação
            currentMessages = [
              ...currentMessages,
              {
                role: "assistant",
                content: assistantText || null,
                tool_calls: toolCalls.map(tc => ({
                  id: tc.id,
                  type: "function",
                  function: { name: tc.name, arguments: tc.args },
                })),
              },
              ...toolResults.map(r => ({
                role: "tool",
                tool_call_id: r.tool_call_id,
                content: r.content,
              })),
            ];

            // Nova chamada com resultados
            currentResponse = await freeAIChat("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: currentMessages,
                stream: true,
                max_tokens: 4096,
                temperature: 0.8,
                tools,
              }),
            });

            if (!currentResponse.ok) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "\n\n_(erro ao processar resultado da busca)_" })}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              break;
            }
          }
        } catch (e) {
          console.error("Stream error:", e);
        } finally {
          controller.close();
        }
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
