import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Microsoft Edge TTS - Free neural voices in PT-BR
const VOICE_MAP: Record<string, string> = {
  // Female voices
  "EXAVITQu4vr4xnSDxMaL": "pt-BR-FranciscaNeural",
  "cgSgspJ2msm6clMCkdW9": "pt-BR-FranciscaNeural",
  "pFZP5JQG7iQjIQuC4Bku": "pt-BR-FranciscaNeural",
  "XrExE9yKIg1WjnnlVkGX": "pt-BR-FranciscaNeural",
  "FGY2WhTYpPnrIDTdsKH5": "pt-BR-FranciscaNeural",
  "Xb7hH8MSUJpSbSDYk0k2": "pt-BR-FranciscaNeural",
  // Male voices
  "onwK4e9ZLuTAKqWW03F9": "pt-BR-AntonioNeural",
  "nPczCjzI2devNBz1zQrb": "pt-BR-AntonioNeural",
  "cjVigY5qzO86Huf0OWal": "pt-BR-AntonioNeural",
  "TX3LPaxmHKxFdv7VOQHJ": "pt-BR-AntonioNeural",
  "iP95p4xoKVk53GoZ742B": "pt-BR-AntonioNeural",
  "JBFqnCBsd6RMkjVDRZzb": "pt-BR-AntonioNeural",
  // OpenAI voice names mapped too
  "nova": "pt-BR-FranciscaNeural",
  "shimmer": "pt-BR-FranciscaNeural",
  "alloy": "pt-BR-FranciscaNeural",
  "onyx": "pt-BR-AntonioNeural",
  "echo": "pt-BR-AntonioNeural",
  "fable": "pt-BR-AntonioNeural",
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

function resolveVoice(voiceId: string | undefined, gender: string | undefined): string {
  if (voiceId && VOICE_MAP[voiceId]) return VOICE_MAP[voiceId];
  if (voiceId && voiceId.includes("Neural")) return voiceId; // already a MS voice
  return gender === "male" ? "pt-BR-AntonioNeural" : "pt-BR-FranciscaNeural";
}

// Edge TTS WebSocket protocol implementation
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

function generateRequestId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function buildSSMLPayload(requestId: string, text: string, voice: string, rate: string = "+0%", pitch: string = "+0Hz"): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${escaped}</prosody></voice></speak>`;
}

async function synthesizeWithEdgeTTS(text: string, voice: string): Promise<Uint8Array> {
  const requestId = generateRequestId();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      try { ws.close(); } catch (_) {}
      reject(new Error("Edge TTS timeout"));
    }, 30000);

    const audioChunks: Uint8Array[] = [];
    const ws = new WebSocket(WSS_URL);

    ws.onopen = () => {
      // Send config
      ws.send(`X-Timestamp:${new Date().toISOString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-96kbitrate-mono-mp3"}}}}`);
      // Send SSML
      ws.send(buildSSMLPayload(requestId, text, voice));
    };

    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === "string") {
        if (event.data.includes("Path:turn.end")) {
          clearTimeout(timeout);
          ws.close();
          // Concatenate all audio chunks
          const totalLen = audioChunks.reduce((sum, c) => sum + c.length, 0);
          const result = new Uint8Array(totalLen);
          let offset = 0;
          for (const chunk of audioChunks) {
            result.set(chunk, offset);
            offset += chunk.length;
          }
          resolve(result);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary message - extract audio after the header
        const view = new Uint8Array(event.data);
        // The header is separated by "Path:audio\r\n"
        const headerEnd = findHeaderEnd(view);
        if (headerEnd >= 0) {
          audioChunks.push(view.slice(headerEnd));
        }
      } else if (event.data instanceof Blob) {
        // Handle Blob data
        event.data.arrayBuffer().then((ab: ArrayBuffer) => {
          const view = new Uint8Array(ab);
          const headerEnd = findHeaderEnd(view);
          if (headerEnd >= 0) {
            audioChunks.push(view.slice(headerEnd));
          }
        });
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      reject(new Error("Edge TTS WebSocket error"));
    };

    ws.onclose = () => {
      clearTimeout(timeout);
      if (audioChunks.length === 0) {
        reject(new Error("Edge TTS closed without audio"));
      }
    };
  });
}

function findHeaderEnd(data: Uint8Array): number {
  // Binary messages have a 2-byte header length prefix
  // First 2 bytes = header length (big-endian)
  if (data.length < 2) return -1;
  const headerLen = (data[0] << 8) | data[1];
  const audioStart = 2 + headerLen;
  if (audioStart >= data.length) return -1;
  return audioStart;
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

    const voice = resolveVoice(voiceId, gender);
    const processed = cleanText(text).slice(0, 5000);

    console.log("Edge TTS:", voice, processed.slice(0, 80));

    try {
      const audioData = await synthesizeWithEdgeTTS(processed, voice);
      
      return new Response(audioData, {
        headers: {
          ...corsHeaders,
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-cache",
        },
      });
    } catch (ttsError) {
      console.error("Edge TTS failed:", ttsError);
      // Signal browser fallback
      return new Response(JSON.stringify({ error: "TTS_UNAVAILABLE", fallback: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("voice-tts error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
