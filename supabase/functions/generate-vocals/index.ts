import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

function generateRequestId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function buildSSMLPayload(requestId: string, text: string, voice: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escaped}</prosody></voice></speak>`;
}

function findHeaderEnd(data: Uint8Array): number {
  if (data.length < 2) return -1;
  const headerLen = (data[0] << 8) | data[1];
  const audioStart = 2 + headerLen;
  return audioStart >= data.length ? -1 : audioStart;
}

async function synthesizeWithEdgeTTS(text: string, voice: string): Promise<Uint8Array> {
  const requestId = generateRequestId();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { try { ws.close(); } catch (_) {} reject(new Error("Edge TTS timeout")); }, 30000);
    const audioChunks: Uint8Array[] = [];
    const ws = new WebSocket(WSS_URL);
    ws.onopen = () => {
      ws.send(`X-Timestamp:${new Date().toISOString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-96kbitrate-mono-mp3"}}}}`);
      ws.send(buildSSMLPayload(requestId, text, voice));
    };
    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === "string") {
        if (event.data.includes("Path:turn.end")) { clearTimeout(timeout); ws.close(); const totalLen = audioChunks.reduce((s, c) => s + c.length, 0); const result = new Uint8Array(totalLen); let off = 0; for (const c of audioChunks) { result.set(c, off); off += c.length; } resolve(result); }
      } else if (event.data instanceof ArrayBuffer) {
        const view = new Uint8Array(event.data);
        const h = findHeaderEnd(view);
        if (h >= 0) audioChunks.push(view.slice(h));
      } else if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((ab: ArrayBuffer) => { const view = new Uint8Array(ab); const h = findHeaderEnd(view); if (h >= 0) audioChunks.push(view.slice(h)); });
      }
    };
    ws.onerror = () => { clearTimeout(timeout); reject(new Error("Edge TTS WebSocket error")); };
    ws.onclose = () => { clearTimeout(timeout); if (audioChunks.length === 0) reject(new Error("No audio")); };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: canSend } = await supabase.rpc("can_send_message");
    if (!canSend?.is_vip) {
      return new Response(JSON.stringify({ success: false, error: "Recurso exclusivo VIP/DEV" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { text, voiceId = "pt-BR-FranciscaNeural" } = body;

    if (!text || typeof text !== "string" || text.length < 3) {
      return new Response(JSON.stringify({ success: false, error: "Texto inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const voice = voiceId.includes("Neural") ? voiceId : "pt-BR-FranciscaNeural";

    console.log("Generating vocal with Edge TTS:", voice, text.slice(0, 100));

    const audioData = await synthesizeWithEdgeTTS(text.slice(0, 5000), voice);
    const base64Audio = base64Encode(audioData);

    return new Response(JSON.stringify({ success: true, audioBase64: base64Audio, title: "SnyX Vocal" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Generate vocal error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message || "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
