import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Cloud TTS voice mapping - Neural2 voices sound very natural in pt-BR
const GOOGLE_VOICES: Record<string, { name: string; ssmlGender: string }> = {
  // Female voices
  "EXAVITQu4vr4xnSDxMaL": { name: "pt-BR-Neural2-A", ssmlGender: "FEMALE" }, // Sarah
  "cgSgspJ2msm6clMCkdW9": { name: "pt-BR-Neural2-C", ssmlGender: "FEMALE" }, // Jessica
  "pFZP5JQG7iQjIQuC4Bku": { name: "pt-BR-Neural2-A", ssmlGender: "FEMALE" }, // Lily
  "XrExE9yKIg1WjnnlVkGX": { name: "pt-BR-Neural2-C", ssmlGender: "FEMALE" }, // Matilda
  "FGY2WhTYpPnrIDTdsKH5": { name: "pt-BR-Neural2-A", ssmlGender: "FEMALE" }, // Laura
  "Xb7hH8MSUJpSbSDYk0k2": { name: "pt-BR-Neural2-C", ssmlGender: "FEMALE" }, // Alice
  // Male voices
  "onwK4e9ZLuTAKqWW03F9": { name: "pt-BR-Neural2-B", ssmlGender: "MALE" }, // Daniel
  "nPczCjzI2devNBz1zQrb": { name: "pt-BR-Neural2-B", ssmlGender: "MALE" }, // Brian
  "cjVigY5qzO86Huf0OWal": { name: "pt-BR-Neural2-B", ssmlGender: "MALE" }, // Eric
  "TX3LPaxmHKxFdv7VOQHJ": { name: "pt-BR-Neural2-B", ssmlGender: "MALE" }, // Liam
  "iP95p4xoKVk53GoZ742B": { name: "pt-BR-Neural2-B", ssmlGender: "MALE" }, // Chris
  "JBFqnCBsd6RMkjVDRZzb": { name: "pt-BR-Neural2-B", ssmlGender: "MALE" }, // George
};

const DEFAULT_FEMALE = { name: "pt-BR-Neural2-A", ssmlGender: "FEMALE" };
const DEFAULT_MALE = { name: "pt-BR-Neural2-B", ssmlGender: "MALE" };

// ElevenLabs voice settings (kept as fallback if credits are restored)
const VOICE_SETTINGS: Record<string, { stability: number; similarity_boost: number; style: number; speed: number }> = {
  "EXAVITQu4vr4xnSDxMaL": { stability: 0.30, similarity_boost: 0.65, style: 0.55, speed: 1.08 },
  "cgSgspJ2msm6clMCkdW9": { stability: 0.25, similarity_boost: 0.60, style: 0.65, speed: 1.12 },
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

function preprocessText(text: string): string {
  let processed = text;
  processed = processed.replace(/\*+/g, "");
  processed = processed.replace(/#{1,6}\s/g, "");
  processed = processed.replace(/`[^`]*`/g, "");
  processed = processed.replace(/\.{3,}/g, "...");
  processed = processed.replace(/!{2,}/g, "!");
  processed = processed.replace(/\?{2,}/g, "?");
  processed = processed.replace(/\s+/g, " ").trim();
  return processed;
}

// Google Cloud TTS
async function googleTTS(text: string, voiceId: string, gender: string): Promise<Response | null> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!GOOGLE_API_KEY) return null;

  const voiceConfig = GOOGLE_VOICES[voiceId] || (gender === "male" ? DEFAULT_MALE : DEFAULT_FEMALE);
  const processedText = preprocessText(text);

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: processedText },
          voice: {
            languageCode: "pt-BR",
            name: voiceConfig.name,
            ssmlGender: voiceConfig.ssmlGender,
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.05,
            pitch: 0,
            effectsProfileId: ["headphone-class-device"],
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google TTS error:", response.status, errText.slice(0, 300));
      return null;
    }

    const data = await response.json();
    if (!data.audioContent) return null;

    // Decode base64 audio
    const binaryString = atob(data.audioContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Response(bytes, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Google TTS exception:", err);
    return null;
  }
}

// ElevenLabs TTS
async function elevenLabsTTS(text: string, voiceId: string, gender: string): Promise<Response | null> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) return null;

  let selectedVoiceId = voiceId || (gender === "male" ? "onwK4e9ZLuTAKqWW03F9" : "EXAVITQu4vr4xnSDxMaL");
  const settings = VOICE_SETTINGS[selectedVoiceId] || DEFAULT_SETTINGS;
  const processedText = preprocessText(text);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: processedText,
          model_id: "eleven_turbo_v2_5",
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
      return null;
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("ElevenLabs TTS exception:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, gender } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try Google Cloud TTS first (has credits), then ElevenLabs as fallback
    const googleResult = await googleTTS(text, voiceId, gender);
    if (googleResult) {
      // Add CORS headers
      const headers = new Headers(googleResult.headers);
      for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
      return new Response(googleResult.body, { headers });
    }

    // Fallback to ElevenLabs
    const elevenResult = await elevenLabsTTS(text, voiceId, gender);
    if (elevenResult) {
      const headers = new Headers(elevenResult.headers);
      for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
      return new Response(elevenResult.body, { headers });
    }

    // Both failed - signal browser fallback
    return new Response(JSON.stringify({ error: "TTS_SERVICE_UNAVAILABLE", fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("voice-tts error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
