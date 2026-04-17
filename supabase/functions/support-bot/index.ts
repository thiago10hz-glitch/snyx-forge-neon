import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { freeAIChat } from "../_shared/free-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, ticketId, imageUrl, display_name } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userContent = imageUrl 
      ? `${message || "O usuário enviou uma imagem."}\n\n[Imagem anexada: ${imageUrl}]`
      : message;

    const firstName = display_name ? String(display_name).trim().split(/\s+/)[0] : "";
    const nameBlock = firstName
      ? `\n\n=== IDENTIDADE DO USUÁRIO (OBRIGATÓRIO) ===\nO nome desta pessoa é "${display_name}". O primeiro nome é "${firstName}".\nREGRA: Você DEVE chamar a pessoa pelo primeiro nome "${firstName}" na primeira resposta (saudação) e usar o nome de forma natural durante a conversa quando fizer sentido.`
      : "";

    const response = await freeAIChat("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é o assistente de suporte do SnyX, uma plataforma de IA com chat, IPTV, hosting e programação.

Responda de forma útil, rápida e amigável em português do Brasil.
- Se o problema for simples (dúvida sobre funcionalidade, como usar algo), resolva diretamente.
- Se for um bug ou problema técnico complexo, diga que um admin será notificado e vai analisar.
- Se for sobre VIP/DEV/pagamento, explique que eles devem entrar em contato via WhatsApp para adquirir.
- Mantenha respostas curtas (máximo 3 parágrafos).
- Não invente informações que você não sabe.
- Sempre seja educado e profissional.${nameBlock}`
          },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limit", text: "Sistema ocupado, tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "ai_error", text: "Não consegui processar sua pergunta agora. Um admin será notificado." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const botReply = data.choices?.[0]?.message?.content || "Não consegui gerar uma resposta. Um admin será notificado.";

    return new Response(JSON.stringify({ text: botReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("support-bot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", text: "Erro interno. Um admin será notificado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
