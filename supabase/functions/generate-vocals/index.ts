import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { UniversalEdgeTTS } from "https://esm.sh/edge-tts-universal@1.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: canSend } = await supabase.rpc("can_send_message");
    if (!canSend?.is_vip) {
      return new Response(JSON.stringify({ success: false, error: "Recurso exclusivo VIP/DEV" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { text, voiceId = "pt-BR-FranciscaNeural" } = body;

    if (!text || typeof text !== "string" || text.length < 3) {
      return new Response(JSON.stringify({ success: false, error: "Texto inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve voice - accept Neural names directly or map defaults
    const voice = voiceId.includes("Neural") ? voiceId : "pt-BR-FranciscaNeural";

    console.log("Generating vocal with Edge TTS Universal:", voice, text.slice(0, 100));

    const tts = new UniversalEdgeTTS(text.slice(0, 5000), voice);
    const result = await tts.synthesize();
    const audioBuffer = await result.audio.arrayBuffer();
    const base64Audio = base64Encode(new Uint8Array(audioBuffer));

    return new Response(JSON.stringify({ success: true, audioBase64: base64Audio, title: "SnyX Vocal" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Generate vocal error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message || "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
