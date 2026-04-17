const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um designer de personagens de IA. Crie um personagem completo em PORTUGUÊS BRASILEIRO baseado na descrição do usuário.

Retorne APENAS um JSON válido (sem markdown, sem explicação) com EXATAMENTE estes campos:
{
  "name": "string curto (1-3 palavras)",
  "description": "string curta de 1-2 frases descrevendo quem é",
  "personality": "string descrevendo traços de personalidade",
  "system_prompt": "instruções detalhadas em segunda pessoa para a IA encarnar o personagem (200-400 palavras). Inclua: tom de voz, vocabulário, maneirismos, valores, o que SEMPRE faz e o que NUNCA faz",
  "first_message": "primeira fala do personagem ao iniciar o chat (1-3 frases, em primeira pessoa, imersiva, fazendo o usuário se sentir presente)",
  "scenario": "cenário/contexto inicial em terceira pessoa (1-2 frases, ex: 'Você acorda numa caverna escura...')",
  "example_dialog": "1 exemplo curto de diálogo no formato 'Usuário: ...\\nPersonagem: ...'",
  "category": "uma de: anime, romance, aventura, geral, drama, fantasia, sombrio",
  "tags": ["array", "de", "3-5", "tags", "minusculas"],
  "is_nsfw": false
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const { description } = await req.json();
    if (!description || typeof description !== "string" || description.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Descrição muito curta" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Descrição: ${description.trim()}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) return new Response(JSON.stringify({ error: "Limite atingido. Tente em 1min." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!res.ok) {
      const t = await res.text();
      console.error("AI error", res.status, t);
      throw new Error("AI gateway error");
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    let character;
    try { character = JSON.parse(raw); } catch { character = JSON.parse(raw.replace(/```json|```/g, "").trim()); }

    return new Response(JSON.stringify({ success: true, character }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-character error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
