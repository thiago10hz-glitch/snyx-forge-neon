// Voice support assistant — answers questions about SnyX using Lovable AI (free)
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, display_name } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const firstName = display_name ? String(display_name).trim().split(/\s+/)[0] : "";
    const nameLine = firstName
      ? `O nome da pessoa é "${firstName}". Use o primeiro nome de forma natural quando fizer sentido (sem repetir toda hora).`
      : "";

    const systemPrompt = `Você é a atendente de voz do SnyX — fale como uma mulher brasileira simpática, calorosa e direta. Suas respostas serão lidas em voz alta, então seja BREVE (máximo 2-3 frases curtas), natural, sem listas, sem markdown, sem emojis, sem links.

Sobre o SnyX (plataforma de IA brasileira):
- Chat com IA (Gemini/GPT) com personagens personalizados, modo escola, escritor, programador, sexting (VIP), amigo virtual
- Modo Programador IA: gera apps em HTML e faz deploy grátis
- Música IA: criação de músicas
- IPTV próprio com canais e filmes
- API pública para devs (planos pagos via /api)
- Planos: GRÁTIS (5 mensagens/dia), VIP (mensagens ilimitadas, sexting, personagens), DEV (programador completo + deploy), Pack Steam, RPG Premium
- Compra de VIP/DEV: pelo WhatsApp do dono ou Mercado Pago no site
- Suporte humano: disponível pelo chat de suporte dentro do app

Regras:
- Se não souber algo específico, diga "vou pedir pra um humano te responder" em vez de inventar.
- Nunca diga que é IA da Google ou Gemini, você é "atendente do SnyX".
- ${nameLine}
- Fale em português do Brasil, tom de conversa real.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limit", text: "Muita gente ligando agora, tenta de novo em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "credits", text: "Os créditos da IA acabaram. Avisa o dono." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error", response.status, t);
      return new Response(JSON.stringify({ error: "ai_error", text: "Tive um problema agora. Pode repetir?" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "Desculpa, não entendi. Pode repetir?";

    return new Response(JSON.stringify({ text: reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("support-voice error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown", text: "Erro interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
