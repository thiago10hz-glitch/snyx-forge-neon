import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    // Verify user auth
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

    // Check if user can use (VIP/DEV)
    const { data: canSend } = await supabase.rpc("can_send_message");
    if (!canSend?.is_vip) {
      return new Response(
        JSON.stringify({ success: false, error: "Recurso exclusivo VIP/DEV" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const HF_API_TOKEN = Deno.env.get("HF_API_TOKEN");
    if (!HF_API_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: "HF_API_TOKEN não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string" || prompt.length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating music with HuggingFace MusicGen:", prompt.slice(0, 100));

    // Call HuggingFace Inference API with MusicGen
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/facebook/musicgen-small",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt.slice(0, 400),
        }),
      }
    );

    // Handle model loading (503)
    if (hfRes.status === 503) {
      const errData = await hfRes.json().catch(() => null);
      const estimatedTime = errData?.estimated_time || 30;
      console.log("Model loading, estimated time:", estimatedTime);
      
      // Wait and retry once
      await new Promise(r => setTimeout(r, Math.min(estimatedTime * 1000, 60000)));
      
      const retryRes = await fetch(
        "https://api-inference.huggingface.co/models/facebook/musicgen-small",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${HF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: prompt.slice(0, 400) }),
        }
      );

      if (!retryRes.ok) {
        const retryErr = await retryRes.text();
        console.error("HF retry failed:", retryRes.status, retryErr);
        return new Response(
          JSON.stringify({ success: false, error: "Modelo carregando, tente novamente em 30 segundos." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Return audio as base64
      const audioBuffer = await retryRes.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          audioBase64: base64Audio,
          mimeType: "audio/flac",
          title: prompt.slice(0, 40),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!hfRes.ok) {
      const errText = await hfRes.text();
      console.error("HF API error:", hfRes.status, errText);
      
      if (hfRes.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Limite de requisições atingido. Tente novamente em alguns minutos." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "Erro ao gerar música. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // HF returns audio binary directly
    const audioBuffer = await hfRes.arrayBuffer();
    
    // Convert to base64 in chunks to avoid stack overflow
    const uint8 = new Uint8Array(audioBuffer);
    let base64Audio = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      const chunk = uint8.subarray(i, i + chunkSize);
      base64Audio += String.fromCharCode(...chunk);
    }
    base64Audio = btoa(base64Audio);

    console.log("Music generated successfully, size:", audioBuffer.byteLength);

    return new Response(
      JSON.stringify({ 
        success: true, 
        audioBase64: base64Audio,
        mimeType: "audio/flac",
        title: prompt.slice(0, 40),
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
