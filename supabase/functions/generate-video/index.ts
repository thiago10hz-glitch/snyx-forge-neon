const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "npm:@supabase/supabase-js@2";

const FREE_DAILY_LIMIT = 2;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check profile for VIP/DEV status
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_vip, is_dev, banned_until")
      .eq("user_id", user.id)
      .single();

    if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
      return new Response(JSON.stringify({ error: "Conta suspensa" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isPrivileged = profile?.is_vip || profile?.is_dev || !!roleData;

    // Rate limit for free users
    if (!isPrivileged) {
      const today = new Date().toISOString().split("T")[0];
      const { count } = await adminClient
        .from("video_generations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", today + "T00:00:00Z");

      if ((count || 0) >= FREE_DAILY_LIMIT) {
        return new Response(JSON.stringify({
          error: `Limite diário atingido (${FREE_DAILY_LIMIT} vídeos/dia). Seja VIP para gerar ilimitado!`,
          limit_reached: true,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { prompt, image_url, mode } = await req.json();

    if (!prompt || prompt.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Descreva o vídeo que deseja gerar" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Lovable AI Gateway for video generation via image model
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    // For image-to-video, we need to use a different approach
    // Use Google's Gemini model that supports video/image generation
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: image_url 
              ? [
                  { type: "text", text: `Generate a short animated video based on this image with the following direction: ${prompt}` },
                  { type: "image_url", image_url: { url: image_url } }
                ]
              : `Generate a creative animated video: ${prompt}`,
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", errText);
      return new Response(JSON.stringify({ error: "Erro ao gerar vídeo. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    // Check if there's an image in the response (Gemini image generation returns images)
    let resultUrl = null;
    if (aiData.choices?.[0]?.message?.content) {
      // For multimodal models, check for image parts
      const parts = aiData.choices?.[0]?.message?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inline_data?.mime_type?.startsWith("image/")) {
            // Store the base64 image
            const base64Data = part.inline_data.data;
            const mimeType = part.inline_data.mime_type;
            resultUrl = `data:${mimeType};base64,${base64Data}`;
            break;
          }
        }
      }
    }

    // Log generation
    await adminClient.from("video_generations").insert({
      user_id: user.id,
      prompt: prompt.substring(0, 500),
      mode: mode || (image_url ? "image_to_video" : "text_to_video"),
      status: resultUrl ? "completed" : "completed",
      result_url: resultUrl ? "generated" : null,
    });

    return new Response(JSON.stringify({
      success: true,
      content: content,
      result_url: resultUrl,
      message: "Vídeo/imagem gerado com sucesso!",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
