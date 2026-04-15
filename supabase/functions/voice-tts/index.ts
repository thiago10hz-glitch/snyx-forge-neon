import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ElevenLabs voice settings per voice - tuned for natural Brazilian Portuguese
const VOICE_SETTINGS: Record<string, { stability: number; similarity_boost: number; style: number; speed: number }> = {
  "EXAVITQu4vr4xnSDxMaL": { stability: 0.30, similarity_boost: 0.65, style: 0.55, speed: 1.05 },
  "cgSgspJ2msm6clMCkdW9": { stability: 0.25, similarity_boost: 0.60, style: 0.65, speed: 1.10 },
  "pFZP5JQG7iQjIQuC4Bku": { stability: 0.35, similarity_boost: 0.70, style: 0.45, speed: 1.00 },
  "XrExE9yKIg1WjnnlVkGX": { stability: 0.28, similarity_boost: 0.72, style: 0.70, speed: 1.03 },
  "FGY2WhTYpPnrIDTdsKH5": { stability: 0.32, similarity_boost: 0.68, style: 0.50, speed: 1.02 },
  "Xb7hH8MSUJpSbSDYk0k2": { stability: 0.30, similarity_boost: 0.65, style: 0.60, speed: 1.06 },
  "onwK4e9ZLuTAKqWW03F9": { stability: 0.30, similarity_boost: 0.65, style: 0.50, speed: 1.06 },
  "nPczCjzI2devNBz1zQrb": { stability: 0.35, similarity_boost: 0.70, style: 0.40, speed: 0.98 },
  "cjVigY5qzO86Huf0OWal": { stability: 0.25, similarity_boost: 0.60, style: 0.60, speed: 1.10 },
  "TX3LPaxmHKxFdv7VOQHJ": { stability: 0.28, similarity_boost: 0.72, style: 0.58, speed: 1.03 },
  "iP95p4xoKVk53GoZ742B": { stability: 0.30, similarity_boost: 0.75, style: 0.62, speed: 0.96 },
  "JBFqnCBsd6RMkjVDRZzb": { stability: 0.33, similarity_boost: 0.68, style: 0.45, speed: 1.00 },
};
const DEFAULT_SETTINGS = { stability: 0.30, similarity_boost: 0.65, style: 0.55, speed: 1.05 };

// Google Cloud TTS fallback voices
const GOOGLE_VOICES: Record<string, { name: string; ssmlGender: string }> = {
  "EXAVITQu4vr4xnSDxMaL": { name: "pt-BR-Neural2-A", ssmlGender: "FEMALE" },
  "cgSgspJ2msm6clMCkdW9": { name: "pt-BR-Neural2-C", ssmlGender: "FEMALE" },
  "pFZP5JQG7iQjIQuC4Bku": { name: "pt-BR-Neural2-A", ssmlGender: "FEMALE" },
  "XrExE9yKIg1WjnnlVkGX": { name: "pt-BR-Neural2-C", ssmlGender: "FEMALE" },
  "FGY2WhTYpPnrIDTdsKH5": { name: "pt-BR-Neural2-A", ssmlGender: "FEMALE" },
  "Xb7hH8MSUJpSbSDYk0k2": { name: "pt-BR-Neural2-C", ssmlGender: "FEMALE" },
  "onwK4e9ZLuTAKqWW03F9": { name: "pt-BR-Neural2-B", ssmlGender: "MALE" },
  "nPczCjzI2devNBz1zQrb": { name: "pt-BR-Neural2-B", ssmlGender: "MALE" },
  "cjVigY5qzO86Huf0OWal": { name: "pt-BR-Neural2-B", ssmlGender: "MALE" },
  "TX3LPaxmHKxFdv7VOQHJ": { name: "pt-BR-Neural2-B", ssmlGender: "MALE" },
  "iP95p4xoKVk53GoZ742B": { name: "pt-BR-Neural2-B", ssmlGender: "MALE" },
  "JBFqnCBsd6RMkjVDRZzb": { name: "pt-BR-Neural2-B", ssmlGender: "MALE" },
};

function cleanText(text: string): string {
  return text
    .replace(/\*+/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\.{3,}/g, "...")
    .replace(/!{2,}/g, "!")
    .replace(/\?{2,}/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

async function tryElevenLabs(text: string, voiceId: string, gender: string): Promise<Response | null> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return null;

  const vid = voiceId || (gender === "male" ? "onwK4e9ZLuTAKqWW03F9" : "EXAVITQu4vr4xnSDxMaL");
  const settings = VOICE_SETTINGS[vid] || DEFAULT_SETTINGS;
  const processed = cleanText(text);

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: processed,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity_boost,
            style: settings.style,
            use_speaker_boost: true,
            speed: settings.speed,
          },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error("ElevenLabs error:", res.status, err.slice(0, 200));
      return null;
    }
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("ElevenLabs exception:", e);
    return null;
  }
}

async function tryGoogleTTS(text: string, voiceId: string, gender: string): Promise<Response | null> {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) return null;

  const vc = GOOGLE_VOICES[voiceId] || (gender === "male" ? { name: "pt-BR-Neural2-B", ssmlGender: "MALE" } : { name: "pt-BR-Neural2-A", ssmlGender: "FEMALE" });
  const processed = cleanText(text);

  try {
    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: processed },
        voice: { languageCode: "pt-BR", name: vc.name, ssmlGender: vc.ssmlGender },
        audioConfig: { audioEncoding: "MP3", speakingRate: 1.05, pitch: 0, effectsProfileId: ["headphone-class-device"] },
      }),
    });
    if (!res.ok) { console.error("Google TTS error:", res.status); return null; }
    const data = await res.json();
    if (!data.audioContent) return null;
    const bin = atob(data.audioContent);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("Google TTS exception:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, voiceId, gender } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1) ElevenLabs first (best quality, real voices)
    const el = await tryElevenLabs(text, voiceId, gender);
    if (el) {
      const h = new Headers(el.headers);
      for (const [k, v] of Object.entries(corsHeaders)) h.set(k, v);
      return new Response(el.body, { headers: h });
    }

    // 2) Google Cloud TTS fallback
    const gc = await tryGoogleTTS(text, voiceId, gender);
    if (gc) {
      const h = new Headers(gc.headers);
      for (const [k, v] of Object.entries(corsHeaders)) h.set(k, v);
      return new Response(gc.body, { headers: h });
    }

    // 3) Signal browser fallback
    return new Response(JSON.stringify({ error: "TTS_UNAVAILABLE", fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-tts error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
