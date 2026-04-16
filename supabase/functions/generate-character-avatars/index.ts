import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STYLE_BY_CATEGORY: Record<string, string> = {
  anime: "high-quality detailed anime portrait, vibrant colors, studio-grade illustration, expressive eyes, cinematic lighting, character art",
  romance: "romantic cinematic portrait photo, soft warm lighting, shallow depth of field, photorealistic, magazine editorial quality, 85mm",
  drama: "dramatic cinematic portrait photo, moody chiaroscuro lighting, photorealistic, intense expression, film grain, 50mm",
  fantasia: "epic fantasy character portrait, intricate armor or robes, magical atmosphere, painterly digital art, ArtStation trending, ultra detailed",
  aventura: "rugged adventurer portrait, dynamic pose, dramatic environment lighting, photorealistic cinematic style, 35mm",
  sombrio: "dark gothic portrait, candlelight, deep shadows, mysterious atmosphere, photorealistic cinematic, oil painting feel",
  geral: "high quality detailed character portrait, balanced lighting, photorealistic cinematic style, 50mm",
};

async function generateAvatar(name: string, description: string, category: string, isNsfw: boolean) {
  const style = STYLE_BY_CATEGORY[category] ?? STYLE_BY_CATEGORY.geral;
  const safety = isNsfw ? "tasteful suggestive portrait, no nudity, fully clothed" : "";
  const prompt = `Portrait of "${name}". ${description}. ${style}. ${safety} Centered head-and-shoulders composition, sharp focus on face, clean background, no text, no watermark, no logo.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const url: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url || !url.startsWith("data:")) throw new Error("No image returned");
  const b64 = url.split(",")[1];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const limit: number = Math.min(Number(body.limit) || 8, 12);
    const onlyMissing: boolean = body.onlyMissing !== false;
    const force: boolean = body.force === true;

    let q = admin.from("ai_characters").select("id,name,description,category,is_nsfw,avatar_url").order("created_at", { ascending: true });
    if (onlyMissing && !force) {
      q = q.or("avatar_url.is.null,avatar_url.eq.,avatar_url.like.https://api.dicebear.com/%");
    }
    const { data: chars, error } = await q.limit(limit);
    if (error) throw error;

    const results: any[] = [];
    for (const c of chars || []) {
      try {
        const bytes = await generateAvatar(c.name, c.description || "", c.category || "geral", !!c.is_nsfw);
        const path = `ai_characters/${c.id}.png`;
        const { error: upErr } = await admin.storage.from("avatars").upload(path, bytes, {
          contentType: "image/png",
          upsert: true,
        });
        if (upErr) throw upErr;
        const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
        const finalUrl = `${pub.publicUrl}?v=${Date.now()}`;
        await admin.from("ai_characters").update({ avatar_url: finalUrl }).eq("id", c.id);
        results.push({ id: c.id, name: c.name, ok: true, url: finalUrl });
      } catch (e: any) {
        results.push({ id: c.id, name: c.name, ok: false, error: String(e?.message ?? e) });
      }
    }

    const { count: remaining } = await admin
      .from("ai_characters")
      .select("id", { count: "exact", head: true })
      .or("avatar_url.is.null,avatar_url.eq.,avatar_url.like.https://api.dicebear.com/%");

    return new Response(JSON.stringify({ processed: results.length, remaining: remaining ?? 0, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
