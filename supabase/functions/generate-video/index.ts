const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "npm:@supabase/supabase-js@2";

const FREE_DAILY_LIMIT = 2;
const HEYGEN_API = "https://api.heygen.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const HEYGEN_API_KEY = Deno.env.get("HEYGEN_API_KEY");
    if (!HEYGEN_API_KEY) return json({ error: "HeyGen API não configurada" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Não autorizado" }, 401);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_vip, is_dev, banned_until")
      .eq("user_id", user.id)
      .single();

    if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
      return json({ error: "Conta suspensa" }, 403);
    }

    // Check admin
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isPrivileged = profile?.is_vip || profile?.is_dev || !!roleData;

    const body = await req.json();
    const { action } = body;

    // ===== ACTION: check_status =====
    if (action === "check_status") {
      const { video_id } = body;
      if (!video_id) return json({ error: "video_id necessário" }, 400);

      const statusRes = await fetch(`${HEYGEN_API}/v1/video_status.get?video_id=${video_id}`, {
        headers: { accept: "application/json", "x-api-key": HEYGEN_API_KEY },
      });

      const statusData = await statusRes.json();
      if (!statusRes.ok) return json({ error: "Erro ao verificar status" }, 500);

      const videoData = statusData.data;
      const status = videoData?.status;
      const heygenError = videoData?.error;

      // Friendly error message
      let errorMessage: string | null = null;
      if (status === "failed" && heygenError) {
        if (heygenError.code === "MOVIO_PAYMENT_INSUFFICIENT_CREDIT") {
          errorMessage = "⚠️ A conta HeyGen está sem créditos de API. O administrador precisa recarregar em heygen.com.";
        } else {
          errorMessage = `Falha no HeyGen: ${heygenError.message || heygenError.detail || heygenError.code}`;
        }
      }

      // If completed, update DB
      if (status === "completed" && videoData?.video_url) {
        await adminClient
          .from("video_generations")
          .update({ status: "completed", result_url: videoData.video_url })
          .eq("user_id", user.id)
          .eq("result_url", video_id);
      } else if (status === "failed") {
        await adminClient
          .from("video_generations")
          .update({ status: "failed" })
          .eq("user_id", user.id)
          .eq("result_url", video_id);
      }

      return json({
        status,
        video_url: videoData?.video_url || null,
        thumbnail_url: videoData?.thumbnail_url || null,
        duration: videoData?.duration || null,
        error_message: errorMessage,
      });
    }

    // ===== ACTION: list_avatars =====
    if (action === "list_avatars") {
      const avatarRes = await fetch(`${HEYGEN_API}/v2/avatars`, {
        headers: { accept: "application/json", "x-api-key": HEYGEN_API_KEY },
      });
      const avatarData = await avatarRes.json();
      console.log("HeyGen avatars response status:", avatarRes.status, "keys:", JSON.stringify(Object.keys(avatarData)));
      if (!avatarRes.ok) {
        console.error("HeyGen avatars error:", JSON.stringify(avatarData));
        return json({ error: "Erro ao buscar avatares", details: avatarData }, 500);
      }
      // Handle different response structures
      const avatarList = avatarData.data?.avatars || avatarData.avatars || avatarData.data || [];
      console.log("Avatar list length:", Array.isArray(avatarList) ? avatarList.length : "not array", "sample:", JSON.stringify(avatarList[0] || {}).substring(0, 200));
      return json({ avatars: Array.isArray(avatarList) ? avatarList : [] });
    }

    // ===== ACTION: list_voices =====
    if (action === "list_voices") {
      const voiceRes = await fetch(`${HEYGEN_API}/v2/voices`, {
        headers: { accept: "application/json", "x-api-key": HEYGEN_API_KEY },
      });
      const voiceData = await voiceRes.json();
      console.log("HeyGen voices response status:", voiceRes.status, "keys:", JSON.stringify(Object.keys(voiceData)));
      if (!voiceRes.ok) {
        console.error("HeyGen voices error:", JSON.stringify(voiceData));
        return json({ error: "Erro ao buscar vozes", details: voiceData }, 500);
      }
      // Handle different response structures
      const voiceList = voiceData.data?.voices || voiceData.voices || voiceData.data || [];
      console.log("Voice list length:", Array.isArray(voiceList) ? voiceList.length : "not array");
      return json({ voices: Array.isArray(voiceList) ? voiceList : [] });
    }

    // ===== ACTION: generate (default) =====
    // Rate limit for free users
    if (!isPrivileged) {
      const today = new Date().toISOString().split("T")[0];
      const { count } = await adminClient
        .from("video_generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", today + "T00:00:00Z");

      if ((count || 0) >= FREE_DAILY_LIMIT) {
        return json({
          error: `Limite diário atingido (${FREE_DAILY_LIMIT} vídeos/dia). Seja VIP para gerar ilimitado!`,
          limit_reached: true,
        }, 429);
      }
    }

    const { prompt, avatar_id, voice_id } = body;

    if (!prompt || prompt.trim().length < 3) {
      return json({ error: "Descreva o que o avatar deve falar" }, 400);
    }

    // Build HeyGen video request
    const videoInput: any = {
      character: {
        type: "avatar",
        avatar_id: avatar_id || "Daisy-inskirt-20220818",
        avatar_style: "normal",
      },
      voice: {
        type: "text",
        input_text: prompt.substring(0, 5000),
        voice_id: voice_id || "pt_br_female_1",
      },
    };

    const heygenRes = await fetch(`${HEYGEN_API}/v2/video/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": HEYGEN_API_KEY,
        accept: "application/json",
      },
      body: JSON.stringify({
        video_inputs: [videoInput],
        dimension: { width: 1280, height: 720 },
        title: `SnyX - ${prompt.substring(0, 50)}`,
      }),
    });

    const heygenData = await heygenRes.json();

    if (!heygenRes.ok || heygenData.error) {
      console.error("HeyGen error:", JSON.stringify(heygenData));
      const errCode = heygenData.error?.code || "";
      const errMsg = heygenData.error?.message || heygenData.error?.detail || "";
      if (errCode.includes("PAYMENT") || errCode.includes("CREDIT") || errMsg.toLowerCase().includes("credit")) {
        return json({ error: "⚠️ A conta HeyGen está sem créditos de API. Avise o administrador para recarregar em heygen.com." }, 402);
      }
      return json({ error: errMsg || "Erro ao gerar vídeo no HeyGen" }, 500);
    }

    const videoId = heygenData.data?.video_id;
    if (!videoId) {
      return json({ error: "HeyGen não retornou ID do vídeo" }, 500);
    }

    // Log generation (store video_id in result_url for polling)
    await adminClient.from("video_generations").insert({
      user_id: user.id,
      prompt: prompt.substring(0, 500),
      mode: "heygen_avatar",
      status: "processing",
      result_url: videoId,
    });

    return json({
      success: true,
      video_id: videoId,
      message: "Vídeo sendo gerado! Acompanhe o status abaixo.",
    });

  } catch (err) {
    console.error("Error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
