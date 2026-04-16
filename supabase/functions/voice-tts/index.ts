import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map ElevenLabs voice IDs to OpenAI voices for backwards compatibility
const VOICE_MAP: Record<string, string> = {
  // Female voices
  "EXAVITQu4vr4xnSDxMaL": "nova",
  "cgSgspJ2msm6clMCkdW9": "shimmer",
  "pFZP5JQG7iQjIQuC4Bku": "nova",
  "XrExE9yKIg1WjnnlVkGX": "shimmer",
  "FGY2WhTYpPnrIDTdsKH5": "nova",
  "Xb7hH8MSUJpSbSDYk0k2": "shimmer",
  // Male voices
  "onwK4e9ZLuTAKqWW03F9": "onyx",
  "nPczCjzI2devNBz1zQrb": "echo",
  "cjVigY5qzO86Huf0OWal": "fable",
  "TX3LPaxmHKxFdv7VOQHJ": "onyx",
  "iP95p4xoKVk53GoZ742B": "echo",
  "JBFqnCBsd6RMkjVDRZzb": "onyx",
};

// Valid OpenAI TTS voices
const VALID_OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

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

function resolveVoice(voiceId: string | undefined, gender: string | undefined): string {
  if (voiceId) {
    // If it's already a valid OpenAI voice name, use it directly
    if (VALID_OPENAI_VOICES.includes(voiceId)) return voiceId;
    // Map old ElevenLabs IDs to OpenAI voices
    if (VOICE_MAP[voiceId]) return VOICE_MAP[voiceId];
  }
  // Default by gender
  return gender === "male" ? "onyx" : "nova";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, voiceId, gender } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TTS_UNAVAILABLE", fallback: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const voice = resolveVoice(voiceId, gender);
    const processed = cleanText(text);

    console.log("OpenAI TTS:", voice, processed.slice(0, 80));

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        input: processed.slice(0, 4096),
        voice,
        response_format: "mp3",
        speed: 1.0,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI TTS error:", res.status, err.slice(0, 300));

      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit atingido. Tente novamente em instantes." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fallback to browser TTS
      return new Response(JSON.stringify({ error: "TTS_UNAVAILABLE", fallback: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(res.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("voice-tts error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
