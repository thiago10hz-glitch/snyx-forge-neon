import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMAGE_SYSTEM_PROMPT = "You generate images whenever the request is allowed. If the user gives only a short title, name, or theme, infer a complete visual scene that matches the intent instead of asking for more detail.";
const SHORT_PROMPT_STYLE = "highly detailed digital illustration, strong focal subject, polished composition, vivid lighting, clean background separation";

const isShortPrompt = (value: string) => value.trim().split(/\s+/).filter(Boolean).length <= 3;

const toDataUrl = (base64: string, mimeType?: string) => {
  const safeMimeType = mimeType && mimeType.includes("/") ? mimeType : "image/png";
  return `data:${safeMimeType};base64,${base64}`;
};

function buildPrompt(prompt: string, isPrivileged: boolean, forceExpansion = false) {
  const trimmed = prompt.trim();
  const shouldExpand = forceExpansion || isShortPrompt(trimmed);

  const expandedPrompt = shouldExpand
    ? `Create a polished image based on the concept \"${trimmed}\". Treat it as the title or theme of the artwork and infer a full scene with fitting subjects, environment, mood, and details. Style: ${SHORT_PROMPT_STYLE}.`
    : trimmed;

  if (isPrivileged) return expandedPrompt;

  return `Generate a safe, family-friendly image based on this request: ${expandedPrompt}. Keep it appropriate for all ages, with no nudity, no explicit sexual content, and no graphic violence.`;
}

function extractImageUrl(payload: any): string | null {
  const roots = [
    payload?.choices?.[0]?.message,
    ...(Array.isArray(payload?.output) ? payload.output : []),
    ...(Array.isArray(payload?.data) ? payload.data : []),
  ].filter(Boolean);

  for (const root of roots) {
    if (typeof root?.image_url === "string") return root.image_url;
    if (root?.image_url?.url) return root.image_url.url;
    if (typeof root?.url === "string") return root.url;
    if (typeof root?.b64_json === "string") return toDataUrl(root.b64_json, root?.mime_type);
    if (typeof root?.image_base64 === "string") return toDataUrl(root.image_base64, root?.mime_type);

    const parts = [
      ...(Array.isArray(root?.content) ? root.content : []),
      ...(Array.isArray(root?.images) ? root.images : []),
      ...(Array.isArray(root?.results) ? root.results : []),
    ];

    for (const part of parts) {
      if (part?.image_url?.url) return part.image_url.url;
      if (typeof part?.image_url === "string") return part.image_url;
      if (typeof part?.url === "string") return part.url;
      if (typeof part?.b64_json === "string") return toDataUrl(part.b64_json, part?.mime_type);
      if (typeof part?.image_base64 === "string") return toDataUrl(part.image_base64, part?.mime_type);
    }
  }

  return null;
}

function extractText(payload: any): string {
  const message = payload?.choices?.[0]?.message;

  if (typeof message?.content === "string") return message.content;

  if (Array.isArray(message?.content)) {
    const text = message.content
      .filter((part: any) => ["text", "output_text"].includes(part?.type) && typeof part?.text === "string")
      .map((part: any) => part.text)
      .join("\n")
      .trim();

    if (text) return text;
  }

  if (typeof payload?.error?.message === "string") return payload.error.message;

  return "Não foi possível gerar a imagem agora. Tente novamente.";
}

async function generateImage(apiKey: string, prompt: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      messages: [
        {
          role: "system",
          content: IMAGE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      modalities: ["text", "image"],
    }),
  });

  const rawText = await response.text();

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      rawText,
    };
  }

  try {
    return {
      ok: true as const,
      data: rawText ? JSON.parse(rawText) : {},
    };
  } catch (error) {
    console.error("Image response parse error:", error, rawText.slice(0, 1500));
    return {
      ok: false as const,
      status: 502,
      rawText: "Resposta inválida da geração de imagem",
    };
  }
}

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

    const initialResult = await generateImage(LOVABLE_API_KEY, buildPrompt(prompt, Boolean(isPrivileged)));
    if (!initialResult.ok) {
      console.error("AI Gateway error:", initialResult.rawText);
      const status = initialResult.status;
      let message = `Erro ao gerar imagem (${status}).`;
      if (status === 402) {
        message = "Os créditos da IA acabaram. Adicione créditos no workspace para continuar gerando imagens.";
      } else if (status === 429) {
        message = "Muitas requisições agora. Espere alguns segundos e tente de novo.";
      }
      return new Response(JSON.stringify({ error: message, text: message, code: status }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imageUrl = extractImageUrl(initialResult.data);
    let text = extractText(initialResult.data);

    if (!imageUrl && (isShortPrompt(prompt) || /descrev|detail|specific|clarif|mais detalhes|mais específico/i.test(text))) {
      const retryResult = await generateImage(LOVABLE_API_KEY, buildPrompt(prompt, Boolean(isPrivileged), true));

      if (retryResult.ok) {
        imageUrl = extractImageUrl(retryResult.data);
        text = extractText(retryResult.data);
      } else {
        console.error("AI Gateway retry error:", retryResult.rawText);
      }
    }

    if (imageUrl) {
      return new Response(JSON.stringify({
        type: "image",
        image_url: imageUrl,
        text: isPrivileged ? "🎨 Imagem gerada! ✨" : "🎨 Imagem gerada com segurança! ✨",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("Image generation returned no image:", JSON.stringify(initialResult.data).slice(0, 1500));

    return new Response(JSON.stringify({
      text,
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
