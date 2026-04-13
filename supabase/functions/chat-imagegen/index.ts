import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user auth and VIP status
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check profile for VIP/DEV status
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_vip, is_dev")
      .eq("user_id", user.id)
      .single();

    // Check admin role
    const { data: adminRole } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    const isPrivileged = profile?.is_vip || profile?.is_dev || adminRole;

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Prompt inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the image generation prompt based on privilege level
    let finalPrompt: string;
    if (isPrivileged) {
      // VIP/DEV/Admin: no restrictions - generate exactly what was requested
      finalPrompt = prompt.trim();
    } else {
      // Free users: safe content only
      finalPrompt = `Generate a safe, family-friendly image: ${prompt.trim()}. The image must be appropriate for all ages, no violence, no nudity, no explicit content.`;
    }

    // Use Lovable AI Gateway for image generation
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: finalPrompt,
          },
        ],
        modalities: ["text", "image"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", errText);
      return new Response(JSON.stringify({ error: `Erro ao gerar imagem: ${response.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    // Extract image from response
    const choice = data.choices?.[0];
    const message = choice?.message;
    
    if (message?.content && Array.isArray(message.content)) {
      // Multi-part response with image
      for (const part of message.content) {
        if (part.type === "image_url" && part.image_url?.url) {
          return new Response(JSON.stringify({
            type: "image",
            image_url: part.image_url.url,
            text: isPrivileged ? "🎨 Imagem gerada sem restrições! ✨" : "🎨 Imagem gerada! ✨",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      // If no image found, return text
      const textParts = message.content
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("\n");
      return new Response(JSON.stringify({
        text: textParts || "Não foi possível gerar a imagem. Tente descrever de outra forma.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single text response (no image generated)
    return new Response(JSON.stringify({
      text: typeof message?.content === "string" 
        ? message.content 
        : "Não foi possível gerar a imagem. Tente descrever de outra forma.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno ao gerar imagem" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
