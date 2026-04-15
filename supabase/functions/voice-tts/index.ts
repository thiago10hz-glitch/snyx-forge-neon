import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Voice-specific TTS settings for more natural, human-like speech
const VOICE_SETTINGS: Record<string, { stability: number; similarity_boost: number; style: number; speed: number }> = {
  // Female voices - more expressive and warm
  "EXAVITQu4vr4xnSDxMaL": { stability: 0.40, similarity_boost: 0.80, style: 0.45, speed: 1.05 }, // Sarah
  "cgSgspJ2msm6clMCkdW9": { stability: 0.35, similarity_boost: 0.75, style: 0.55, speed: 1.10 }, // Jessica
  "pFZP5JQG7iQjIQuC4Bku": { stability: 0.50, similarity_boost: 0.80, style: 0.35, speed: 0.98 }, // Lily
  "XrExE9yKIg1WjnnlVkGX": { stability: 0.38, similarity_boost: 0.85, style: 0.60, speed: 1.02 }, // Matilda
  "FGY2WhTYpPnrIDTdsKH5": { stability: 0.45, similarity_boost: 0.80, style: 0.40, speed: 1.00 }, // Laura
  "Xb7hH8MSUJpSbSDYk0k2": { stability: 0.42, similarity_boost: 0.78, style: 0.50, speed: 1.05 }, // Alice
  // Male voices - natural and grounded
  "onwK4e9ZLuTAKqWW03F9": { stability: 0.42, similarity_boost: 0.80, style: 0.40, speed: 1.05 }, // Daniel
  "nPczCjzI2devNBz1zQrb": { stability: 0.48, similarity_boost: 0.82, style: 0.35, speed: 0.98 }, // Brian
  "cjVigY5qzO86Huf0OWal": { stability: 0.35, similarity_boost: 0.75, style: 0.55, speed: 1.10 }, // Eric
  "TX3LPaxmHKxFdv7VOQHJ": { stability: 0.40, similarity_boost: 0.85, style: 0.50, speed: 1.02 }, // Liam
  "iP95p4xoKVk53GoZ742B": { stability: 0.38, similarity_boost: 0.88, style: 0.55, speed: 0.95 }, // Chris
  "JBFqnCBsd6RMkjVDRZzb": { stability: 0.45, similarity_boost: 0.80, style: 0.38, speed: 1.00 }, // George
};

const DEFAULT_SETTINGS = { stability: 0.42, similarity_boost: 0.80, style: 0.45, speed: 1.05 };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, voiceId, gender } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let selectedVoiceId = voiceId;
    if (!selectedVoiceId) {
      selectedVoiceId = gender === "male"
        ? "onwK4e9ZLuTAKqWW03F9"
        : "EXAVITQu4vr4xnSDxMaL";
    }

    const settings = VOICE_SETTINGS[selectedVoiceId] || DEFAULT_SETTINGS;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
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

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs TTS error:", response.status, errText.slice(0, 300));
      return new Response(JSON.stringify({ error: "TTS_SERVICE_UNAVAILABLE", fallback: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("voice-tts error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
