// Summarize a conversation for long-term memory
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { freeAIChat } from "../_shared/free-ai.ts";

const SYSTEM = `Resuma a conversa abaixo em PORTUGUÊS BR em até 250 palavras. Foque em: quem são os personagens, eventos importantes, decisões, sentimentos, segredos, objetos relevantes, promessas. Escreva em terceira pessoa, denso e factual. Sem listas — texto corrido.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const URL_ = Deno.env.get("SUPABASE_URL")!;
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Sem auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { conversation_id } = await req.json();
    if (!conversation_id) return new Response(JSON.stringify({ error: "conversation_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supaUser = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: convo } = await supaUser.from("chat_conversations").select("user_id").eq("id", conversation_id).maybeSingle();
    if (!convo) return new Response(JSON.stringify({ error: "Conversa não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supa = createClient(URL_, SR);
    const { data: msgs } = await supa.from("chat_messages").select("role,content,created_at").eq("conversation_id", conversation_id).order("created_at", { ascending: true });
    if (!msgs || msgs.length < 20) {
      return new Response(JSON.stringify({ success: false, reason: "poucas_mensagens" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pega resumo anterior se existir
    const { data: prev } = await supa.from("conversation_summaries").select("summary,message_count_at_summary").eq("conversation_id", conversation_id).maybeSingle();
    const startIdx = prev ? prev.message_count_at_summary : 0;
    const newMsgs = msgs.slice(startIdx);
    if (newMsgs.length < 15) {
      return new Response(JSON.stringify({ success: false, reason: "poucas_novas" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const transcript = newMsgs.map((m: any) => `${m.role === "user" ? "Usuário" : "Personagem"}: ${m.content}`).join("\n");
    const userMsg = prev?.summary
      ? `RESUMO ANTERIOR:\n${prev.summary}\n\nNOVAS MENSAGENS:\n${transcript}\n\nGere um resumo combinado atualizado.`
      : `Mensagens da conversa:\n${transcript}`;

    const r = await freeAIChat("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userMsg }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("AI error", r.status, t.slice(0, 200));
      return new Response(JSON.stringify({ error: "ai_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const summary = (await r.json()).choices?.[0]?.message?.content || "";

    await supa.from("conversation_summaries").upsert({
      conversation_id,
      summary,
      message_count_at_summary: msgs.length,
      updated_at: new Date().toISOString(),
    }, { onConflict: "conversation_id" });

    return new Response(JSON.stringify({ success: true, summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
