import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { UniversalEdgeTTS } from "https://esm.sh/edge-tts-universal@1.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VOICE_MAP: Record<string, string> = {
  "EXAVITQu4vr4xnSDxMaL": "pt-BR-FranciscaNeural",
  "cgSgspJ2msm6clMCkdW9": "pt-BR-FranciscaNeural",
  "pFZP5JQG7iQjIQuC4Bku": "pt-BR-FranciscaNeural",
  "XrExE9yKIg1WjnnlVkGX": "pt-BR-FranciscaNeural",
  "FGY2WhTYpPnrIDTdsKH5": "pt-BR-FranciscaNeural",
  "Xb7hH8MSUJpSbSDYk0k2": "pt-BR-FranciscaNeural",
  "onwK4e9ZLuTAKqWW03F9": "pt-BR-AntonioNeural",
  "nPczCjzI2devNBz1zQrb": "pt-BR-AntonioNeural",
  "cjVigY5qzO86Huf0OWal": "pt-BR-AntonioNeural",
  "TX3LPaxmHKxFdv7VOQHJ": "pt-BR-AntonioNeural",
  "iP95p4xoKVk53GoZ742B": "pt-BR-AntonioNeural",
  "JBFqnCBsd6RMkjVDRZzb": "pt-BR-AntonioNeural",
  "nova": "pt-BR-FranciscaNeural",
  "shimmer": "pt-BR-FranciscaNeural",
  "alloy": "pt-BR-FranciscaNeural",
  "onyx": "pt-BR-AntonioNeural",
  "echo": "pt-BR-AntonioNeural",
  "fable": "pt-BR-AntonioNeural",
};

function cleanText(text: string): string {
  return text.replace(/\*+/g, "").replace(/#{1,6}\s/g, "").replace(/`[^`]*`/g, "").replace(/\.{3,}/g, "...").replace(/!{2,}/g, "!").replace(/\?{2,}/g, "?").replace(/\s+/g, " ").trim();
}

function resolveVoice(voiceId: string | undefined, gender: string | undefined): string {
  if (voiceId && VOICE_MAP[voiceId]) return VOICE_MAP[voiceId];
  if (voiceId && voiceId.includes("Neural")) return voiceId;
  return gender === "male" ? "pt-BR-AntonioNeural" : "pt-BR-FranciscaNeural";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, voiceId, gender } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const voice = resolveVoice(voiceId, gender);
    const processed = cleanText(text).slice(0, 5000);

    console.log("Edge TTS Universal:", voice, processed.slice(0, 80));

    const tts = new UniversalEdgeTTS(processed, voice);
    const result = await tts.synthesize();
    const audioBuffer = await result.audio.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    return new Response(audioBytes, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("voice-tts error:", e);
    return new Response(JSON.stringify({ error: "TTS_UNAVAILABLE", fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
