// Gera música com HuggingFace MusicGen e salva no Storage
// Acesso restrito a VIP/DEV/Admin

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HF_MODEL = "facebook/musicgen-small";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const HF_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!HF_KEY) {
      return new Response(JSON.stringify({ error: "HuggingFace API key não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // valida usuário
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // checa se é VIP/DEV/Admin
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      admin.from("profiles").select("is_vip, is_dev, vip_expires_at, dev_expires_at").eq("user_id", user.id).maybeSingle(),
      admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);

    const now = new Date();
    const vipOk = profile?.is_vip && (!profile.vip_expires_at || new Date(profile.vip_expires_at) > now);
    const devOk = profile?.is_dev && (!profile.dev_expires_at || new Date(profile.dev_expires_at) > now);
    if (!vipOk && !devOk && !isAdmin) {
      return new Response(JSON.stringify({ error: "Recurso exclusivo VIP/DEV" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, duration = 15 } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Prompt inválido (mínimo 3 caracteres)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const dur = Math.max(5, Math.min(30, Number(duration) || 15));

    console.log(`[generate-music] user=${user.id} prompt="${prompt.slice(0, 60)}" dur=${dur}s`);

    // Chama HuggingFace MusicGen — retorna áudio WAV binário
    const hfRes = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { duration: dur },
      }),
    });

    if (!hfRes.ok) {
      const errText = await hfRes.text();
      console.error("[generate-music] HF error:", hfRes.status, errText);
      if (hfRes.status === 503) {
        return new Response(JSON.stringify({ 
          error: "Modelo está carregando, tenta de novo em ~30s 🔄",
          retry: true,
        }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Falha ao gerar: ${hfRes.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await hfRes.arrayBuffer();
    if (audioBuffer.byteLength < 1000) {
      console.error("[generate-music] áudio muito pequeno:", audioBuffer.byteLength);
      return new Response(JSON.stringify({ error: "Resposta inválida do gerador" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload pro storage
    const fileName = `${user.id}/${crypto.randomUUID()}.wav`;
    const { error: upErr } = await admin.storage
      .from("generated-music")
      .upload(fileName, audioBuffer, { contentType: "audio/wav", upsert: false });

    if (upErr) {
      console.error("[generate-music] upload err:", upErr);
      return new Response(JSON.stringify({ error: "Falha ao salvar áudio" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: urlData } = admin.storage.from("generated-music").getPublicUrl(fileName);

    // Salva no histórico
    const { data: row, error: insErr } = await admin.from("generated_music").insert({
      user_id: user.id,
      prompt: prompt.trim(),
      duration_seconds: dur,
      audio_url: urlData.publicUrl,
      model: HF_MODEL,
    }).select().single();

    if (insErr) console.error("[generate-music] db insert err:", insErr);

    return new Response(JSON.stringify({
      success: true,
      id: row?.id,
      audio_url: urlData.publicUrl,
      prompt: prompt.trim(),
      duration: dur,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-music] fatal:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
