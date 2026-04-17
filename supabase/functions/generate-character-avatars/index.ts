import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STYLE_BY_CATEGORY: Record<string, string> = {
  anime:
    "premium seinen/josei anime portrait of an adult character aged 23 to 35, mature facial proportions, elegant hair, cinematic close-up, polished character art, not school themed",
  romance:
    "romance chat character portrait of an adult character aged 23 to 35, beautiful mature face, attractive styling, intimate cinematic lighting, premium cover art aesthetic",
  drama:
    "dramatic close portrait of a mature adult character aged 25 to 40, expressive eyes, refined face, moody cinematic light, premium digital painting",
  fantasia:
    "epic fantasy portrait of an adult character aged 25 to 40, beautiful mature face, ornate fantasy styling, immersive magical atmosphere, premium fantasy cover art",
  aventura:
    "cinematic adventure portrait of an adult character aged 25 to 40, explorer styling, detailed mature face, premium story-driven key art",
  sombrio:
    "dark fantasy portrait of an adult character aged 25 to 40, mature features, gothic mood, cinematic shadow work, premium dark romance art",
  geral:
    "premium roleplay chat portrait of an adult character aged 23 to 35, mature face, expressive eyes, stylish look, cinematic close-up",
};

const BLOCKED_TERMS = [
  /conselho estudantil/gi,
  /estudantil/gi,
  /escola/gi,
  /colegio/gi,
  /colégio/gi,
  /school/gi,
  /teen/gi,
  /adolescente/gi,
  /menina/gi,
  /garotinha/gi,
  /garota jovem/gi,
  /jovem demais/gi,
  /loli/gi,
  /chibi/gi,
];

function sanitizePromptText(value?: string | null) {
  if (!value) return "";
  return BLOCKED_TERMS.reduce((text, pattern) => text.replace(pattern, " "), value)
    .replace(/\s+/g, " ")
    .trim();
}

async function generateAvatar(
  name: string,
  description: string,
  personality: string,
  scenario: string,
  category: string,
  isNsfw: boolean,
) {
  const style = STYLE_BY_CATEGORY[category] ?? STYLE_BY_CATEGORY.geral;
  const cleanDescription = sanitizePromptText(description);
  const cleanPersonality = sanitizePromptText(personality);
  const cleanScenario = sanitizePromptText(scenario);
  const details = [cleanDescription, cleanPersonality, cleanScenario].filter(Boolean).join(". ");
  const safety = isNsfw
    ? "adult sensual energy only, tasteful, fully clothed portrait, no nudity"
    : "safe-for-work adult portrait";

  const prompt = [
    `Create a single avatar portrait for the roleplay character named \"${name}\".`,
    "This must be a clearly adult character, around 23-35 years old, with mature bone structure and adult proportions.",
    details || "Charismatic roleplay character with strong presence and attractive mature expression.",
    style,
    safety,
    "Head-and-shoulders composition only, centered face, visible shoulders, premium quality, highly detailed, beautiful lighting.",
    "This is for a normal romance/chat RPG character app, not tabletop battle art, not cartoon kids art.",
    "STRICT NEGATIVE: child, kid, minor, underage, teen, teenager, baby face, schoolgirl, schoolboy, school uniform, toddler, child proportions, childish face, loli, chibi, oversized eyes, nursery, playground, toy look, low detail, blurry, text, watermark, logo.",
  ].join(" ");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const url: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url || !url.startsWith("data:")) throw new Error("No image returned");

  const b64 = url.split(",")[1];
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 8, 16);
    const onlyMissing = body.onlyMissing !== false;
    const force = body.force === true;

    let q = admin
      .from("ai_characters")
      .select("id,name,description,personality,scenario,category,is_nsfw,avatar_url")
      .order("created_at", { ascending: true });

    if (onlyMissing && !force) {
      q = q.or("avatar_url.is.null,avatar_url.eq.,avatar_url.like.https://api.dicebear.com/%");
    }

    const { data: chars, error } = await q.limit(limit);
    if (error) throw error;

    const results: any[] = [];

    for (const c of chars || []) {
      try {
        const bytes = await generateAvatar(
          c.name,
          c.description || "",
          c.personality || "",
          c.scenario || "",
          c.category || "geral",
          !!c.is_nsfw,
        );
        const path = `ai_characters/${c.id}.png`;
        const { error: upErr } = await admin.storage.from("avatars").upload(path, bytes, {
          contentType: "image/png",
          upsert: true,
        });
        if (upErr) throw upErr;

        const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
        const finalUrl = `${pub.publicUrl}?v=${Date.now()}`;
        const { error: updateErr } = await admin.from("ai_characters").update({ avatar_url: finalUrl }).eq("id", c.id);
        if (updateErr) throw updateErr;

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
