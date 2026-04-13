import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY");
    if (!SUNO_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "SUNO_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { prompt, duration = 30 } = body;

    if (!prompt || typeof prompt !== "string" || prompt.length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: "Prompt inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating music with Suno AI:", { prompt: prompt.slice(0, 100), duration });

    // Step 1: Create generation task
    const createRes = await fetch("https://apibox.erweima.ai/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: prompt.slice(0, 400),
        customMode: false,
        instrumental: false,
        model: "V3_5",
        callBackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-music-callback`,
      }),
    });

    const createData = await createRes.json();
    console.log("Suno create response:", JSON.stringify(createData));

    if (!createRes.ok || createData.code !== 200) {
      return new Response(
        JSON.stringify({ success: false, error: createData.msg || "Erro ao criar música na Suno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const taskId = createData.data?.taskId;
    if (!taskId) {
      return new Response(
        JSON.stringify({ success: false, error: "Não foi possível obter o taskId" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Poll for completion (max ~120s)
    let audioUrl = "";
    let title = "";
    const maxAttempts = 40;
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const checkRes = await fetch(
        `https://apibox.erweima.ai/api/v1/generate/record-info?taskId=${taskId}`,
        {
          headers: {
            "Authorization": `Bearer ${SUNO_API_KEY}`,
          },
        }
      );

      const checkData = await checkRes.json();
      console.log(`Poll attempt ${i + 1}:`, checkData.data?.status);

      if (checkData.data?.status === "complete" && checkData.data?.response?.sunoData) {
        const tracks = checkData.data.response.sunoData;
        if (tracks.length > 0) {
          audioUrl = tracks[0].audioUrl || tracks[0].audio_url || "";
          title = tracks[0].title || prompt.slice(0, 40);
          break;
        }
      }

      if (checkData.data?.status === "failed") {
        return new Response(
          JSON.stringify({ success: false, error: "Geração falhou na Suno" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!audioUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Timeout — a música está demorando. Tente novamente." }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, audioUrl, title }),
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
