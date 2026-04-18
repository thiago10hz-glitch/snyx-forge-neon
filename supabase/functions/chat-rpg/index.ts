// Edge function: chat de RPG com personagem.
// Usa Lovable AI Gateway, prioriza modelos bons pra roleplay (gemini-2.5-pro -> flash).
// Streaming SSE compatível com o ChatPanel.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
            const t = line.trim();
            if (!t || t === "data: [DONE]") continue;
            if (!t.startsWith("data: ")) continue;
            try {
              const json = JSON.parse(t.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              if (content) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`));
            } catch { /* skip */ }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) { console.error("stream:", e); }
      finally { controller.close(); }
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { messages, character_id, conversation_summary, user_display_name } = await req.json();

    if (!Array.isArray(messages) || !character_id) {
      return new Response(JSON.stringify({ error: "messages e character_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca personagem
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: char, error: cErr } = await sb
      .from("ai_characters")
      .select("name, description, personality, scenario, system_prompt, first_message, language, is_nsfw")
      .eq("id", character_id)
      .maybeSingle();

    if (cErr || !char) {
      return new Response(JSON.stringify({ error: "Personagem não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Monta system prompt
    const userName = user_display_name || "{user}";
    const systemPrompt = `Você é ${char.name}. PERMANEÇA NO PERSONAGEM em todas as respostas.

PERSONALIDADE:
${char.personality || char.description || ""}

${char.scenario ? `CENÁRIO INICIAL:\n${char.scenario}\n` : ""}

${char.system_prompt ? `INSTRUÇÕES EXTRAS:\n${char.system_prompt}\n` : ""}

REGRAS DE ROLEPLAY:
- Responda em ${char.language || "pt-BR"}.
- Use ações entre *asteriscos* e diálogos diretos.
- NUNCA quebre o personagem nem diga "como uma IA".
- O nome do usuário/protagonista é "${userName}".
- Mantenha respostas vívidas mas concisas (80-200 palavras geralmente).
- Personagens são ADULTOS (18+). Nunca retrate menores em situações sensuais/adultas.
${char.is_nsfw ? "- Conteúdo adulto/sensual é PERMITIDO entre adultos com consentimento." : "- Mantenha conteúdo apropriado (sem cenas sexuais explícitas)."}
${conversation_summary ? `\nRESUMO DA HISTÓRIA ATÉ AGORA:\n${conversation_summary}` : ""}`;

    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Tenta gemini-2.5-pro primeiro (melhor pra roleplay), fallback flash
    const tryModel = async (model: string) => {
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: fullMessages,
          stream: true,
          temperature: 0.95,
        }),
      });
    };

    let res = await tryModel("google/gemini-2.5-pro");
    if (!res.ok || !res.body) {
      console.warn("Pro falhou, tentando flash:", res.status);
      res = await tryModel("google/gemini-2.5-flash");
    }

    if (!res.ok || !res.body) {
      const txt = await res.text();
      console.error("AI gateway error:", res.status, txt);
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente em 30s." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Falha no chat" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(streamOpenAI(res), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("chat-rpg error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
