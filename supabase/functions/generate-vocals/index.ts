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

    const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY");
    if (!SUNO_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "SUNO_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { text, style = "Pop vocal" } = body;

    if (!text || typeof text !== "string" || text.length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: "Texto inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating vocal with Suno AI:", { text: text.slice(0, 100), style });

    // Use Suno custom mode with lyrics
    const createRes = await fetch("https://apibox.erweima.ai/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: text.slice(0, 1500),
        style: style,
        title: "SnyX Vocal",
        customMode: true,
        instrumental: false,
        model: "V3_5",
        callBackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-music-callback`,
      }),
    });

    const createData = await createRes.json();
    console.log("Suno vocal create response:", JSON.stringify(createData));

    if (!createRes.ok || createData.code !== 200) {
      return new Response(
        JSON.stringify({ success: false, error: createData.msg || "Erro ao criar vocal na Suno" }),
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

    // Poll for completion
    let audioUrl = "";
    let title = "";
    const maxAttempts = 40;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const checkRes = await fetch(
        `https://apibox.erweima.ai/api/v1/generate/record-info?taskId=${taskId}`,
        { headers: { "Authorization": `Bearer ${SUNO_API_KEY}` } }
      );

      const checkData = await checkRes.json();
      const status = checkData.data?.status;
      console.log(`Vocal poll ${i + 1}: ${status}`);

      if ((status === "complete" || status === "TEXT_SUCCESS" || status === "FIRST_SUCCESS" || status === "SUCCESS") && checkData.data?.response?.sunoData) {
        const tracks = checkData.data.response.sunoData;
        if (tracks.length > 0) {
          audioUrl = tracks[0].audioUrl || tracks[0].audio_url || tracks[0].sourceAudioUrl || tracks[0].streamAudioUrl || "";
          title = tracks[0].title || "SnyX Vocal";
          if (audioUrl) break;
        }
      }

      if (status === "failed" || status === "FAILED") {
        return new Response(
          JSON.stringify({ success: false, error: "Geração de vocal falhou" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!audioUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Timeout — tente novamente." }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, audioUrl, title }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Generate vocal error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});