import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: canSend } = await supabase.rpc("can_send_message");
    if (!canSend?.is_vip) {
      return new Response(
        JSON.stringify({ success: false, error: "Recurso exclusivo VIP/DEV" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "API de música não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string" || prompt.length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Use Lovable AI to enhance the music prompt (optional, if key available)
    let enhancedPrompt = prompt;
    if (LOVABLE_API_KEY) {
      try {
        const aiRes = await freeAIChat("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: "You are a music producer AI. The user will describe a song they want. Transform their description into a detailed, rich music prompt in English optimized for AI music generation. Include genre, mood, instruments, tempo, and style details. Keep it under 200 characters. Output ONLY the enhanced prompt, nothing else."
              },
              { role: "user", content: prompt }
            ],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content?.trim();
          if (content) {
            enhancedPrompt = content;
            console.log("Enhanced prompt:", enhancedPrompt);
          }
        }
      } catch (e) {
        console.log("AI enhancement failed, using original prompt:", e);
      }
    }

    console.log("Generating music with ElevenLabs:", enhancedPrompt.slice(0, 100));

    // Step 2: Generate music with ElevenLabs Music API
    const musicRes = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: enhancedPrompt.slice(0, 500),
        duration_seconds: 30,
      }),
    });

    if (!musicRes.ok) {
      const errText = await musicRes.text();
      console.error("ElevenLabs music error:", musicRes.status, errText);
      
      if (musicRes.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "⚠️ Limite de requisições atingido. Tente novamente em alguns minutos." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (musicRes.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "⚠️ Créditos da API de música esgotados." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao gerar música. Tente novamente." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ElevenLabs returns raw audio bytes
    const audioBuffer = await musicRes.arrayBuffer();
    const base64Audio = base64Encode(audioBuffer);

    // Create a title from the original prompt
    const title = prompt.slice(0, 50);

    return new Response(
      JSON.stringify({
        success: true,
        audioBase64: base64Audio,
        title,
        enhancedPrompt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Generate music error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
