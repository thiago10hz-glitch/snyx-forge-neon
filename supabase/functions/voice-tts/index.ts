import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Voice-specific TTS settings tuned for natural, human-like conversational speech
// Lower stability = more expressive/natural variation (less robotic)
// Higher style = more emotional/personality
// similarity_boost kept moderate so it doesn't over-constrain
const VOICE_SETTINGS: Record<string, { stability: number; similarity_boost: number; style: number; speed: number }> = {
  // Female voices - warm, expressive, conversational
  "EXAVITQu4vr4xnSDxMaL": { stability: 0.30, similarity_boost: 0.65, style: 0.55, speed: 1.08 }, // Sarah
  "cgSgspJ2msm6clMCkdW9": { stability: 0.25, similarity_boost: 0.60, style: 0.65, speed: 1.12 }, // Jessica
  "pFZP5JQG7iQjIQuC4Bku": { stability: 0.35, similarity_boost: 0.70, style: 0.45, speed: 1.00 }, // Lily
  "XrExE9yKIg1WjnnlVkGX": { stability: 0.28, similarity_boost: 0.72, style: 0.70, speed: 1.03 }, // Matilda
  "FGY2WhTYpPnrIDTdsKH5": { stability: 0.32, similarity_boost: 0.68, style: 0.50, speed: 1.02 }, // Laura
  "Xb7hH8MSUJpSbSDYk0k2": { stability: 0.30, similarity_boost: 0.65, style: 0.60, speed: 1.06 }, // Alice
  // Male voices - natural, grounded, real
  "onwK4e9ZLuTAKqWW03F9": { stability: 0.30, similarity_boost: 0.65, style: 0.50, speed: 1.06 }, // Daniel
  "nPczCjzI2devNBz1zQrb": { stability: 0.35, similarity_boost: 0.70, style: 0.40, speed: 0.98 }, // Brian
  "cjVigY5qzO86Huf0OWal": { stability: 0.25, similarity_boost: 0.60, style: 0.60, speed: 1.10 }, // Eric
  "TX3LPaxmHKxFdv7VOQHJ": { stability: 0.28, similarity_boost: 0.72, style: 0.58, speed: 1.03 }, // Liam
  "iP95p4xoKVk53GoZ742B": { stability: 0.30, similarity_boost: 0.75, style: 0.62, speed: 0.96 }, // Chris
  "JBFqnCBsd6RMkjVDRZzb": { stability: 0.33, similarity_boost: 0.68, style: 0.45, speed: 1.00 }, // George
};

const DEFAULT_SETTINGS = { stability: 0.30, similarity_boost: 0.65, style: 0.55, speed: 1.05 };

// Preprocess text to sound more natural in TTS
function preprocessText(text: string): string {
  let processed = text;
  // Remove markdown artifacts
  processed = processed.replace(/\*+/g, "");
  processed = processed.replace(/#{1,6}\s/g, "");
  processed = processed.replace(/`[^`]*`/g, "");
  // Convert "..." to a natural pause
  processed = processed.replace(/\.{3,}/g, "...");
  // Remove excessive exclamation/question marks
  processed = processed.replace(/!{2,}/g, "!");
  processed = processed.replace(/\?{2,}/g, "?");
  // Add slight pauses at commas for natural rhythm (ElevenLabs handles this)
  // Clean up whitespace
  processed = processed.replace(/\s+/g, " ").trim();
  return processed;
}

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
    const processedText = preprocessText(text);

    // Use eleven_turbo_v2_5 for more natural conversational speech with lower latency
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
      
      // Fallback to multilingual_v2 if turbo fails
      const fallbackResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: processedText,
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

      if (!fallbackResponse.ok) {
        return new Response(JSON.stringify({ error: "TTS_SERVICE_UNAVAILABLE", fallback: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(fallbackResponse.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-cache",
        },
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
