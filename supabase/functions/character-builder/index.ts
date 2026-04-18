// Edge function: gera personagem completo a partir de uma descrição curta.
// Usa Lovable AI Gateway (gemini-2.5-flash) — gratuito.
// Recebe: { idea: string, language?: string, nsfw?: boolean }
// Retorna: { name, description, personality, scenario, first_message, tags[], category, avatar_prompt }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um especialista em criar personagens de RPG/roleplay para uma plataforma estilo c.ai/Emochi.
A partir de uma ideia curta do usuário, você gera um personagem COMPLETO em português brasileiro (a menos que o usuário peça outro idioma).

REGRAS:
- Personagens devem ser ADULTOS (18+), nunca crianças/adolescentes.
- Personality deve ter 2-4 frases ricas, com traços, falar, hábitos.
- Scenario é a cena/contexto inicial onde o user encontra o personagem (1-2 frases).
- First message deve ser uma fala IMERSIVA do personagem em primeira pessoa, com ações entre *asteriscos*, 60-150 palavras, abrindo gancho pra interação.
- Tags: 3-6 palavras curtas (ex: "possessivo", "drama", "romance", "vampiro", "chefe", "professor").
- Category: 1 de [romance, drama, fantasia, terror, escola, trabalho, fanfic, vida, aventura, comedia].
- avatar_prompt: descrição visual em INGLÊS pra gerar avatar (estilo: "anime portrait of...", "photorealistic portrait of...", inclui idade aparente >=20 anos, roupa, vibe, fundo).

Responda APENAS JSON válido sem markdown, sem \`\`\`.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const idea = (body.idea || "").toString().trim();
    const language = (body.language || "pt-BR").toString();
    const nsfw = !!body.nsfw;

    if (!idea || idea.length < 5) {
      return new Response(JSON.stringify({ error: "Descreva sua ideia (mín. 5 caracteres)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (idea.length > 600) {
      return new Response(JSON.stringify({ error: "Ideia muito longa (máx 600 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Idioma de saída: ${language}
NSFW permitido: ${nsfw ? "SIM (pode ser sensual/adulto, mas SEM menores)" : "NÃO (mantenha SFW)"}

Ideia do usuário:
"""${idea}"""

Gere o JSON do personagem.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, txt);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente em 30s." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos do AI esgotados. Avise o admin." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Falha ao gerar personagem" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      // Tenta extrair JSON de markdown
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    // Normaliza
    const result = {
      name: (parsed.name || "Personagem Sem Nome").toString().slice(0, 80),
      description: (parsed.description || "").toString().slice(0, 500),
      personality: (parsed.personality || "").toString().slice(0, 1500),
      scenario: (parsed.scenario || "").toString().slice(0, 800),
      first_message: (parsed.first_message || parsed.firstMessage || "").toString().slice(0, 2000),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8).map((t: any) => String(t).slice(0, 30)) : [],
      category: (parsed.category || "drama").toString().toLowerCase().slice(0, 30),
      avatar_prompt: (parsed.avatar_prompt || parsed.avatarPrompt || "").toString().slice(0, 400),
      language,
      is_nsfw: nsfw,
    };

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("character-builder error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
