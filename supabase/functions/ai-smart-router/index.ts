// SnyX AI Smart Router - OpenAI-compatible endpoint para a API pública.
// Aceita modelos "snyx-*" e roteia para múltiplos providers em race paralelo.
// Branding total: headers X-SnyX-*, captura IP/geo/referer/origin pra rastreamento.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getRoutesForModel, isSnyxModel, SNYX_MODELS, type ProviderRoute } from "../_shared/snyx-models.ts";

const SNYX_REGIONS = ["snyx-br-sp", "snyx-br-rj", "snyx-us-east", "snyx-eu-west"];

function pickRegion(ip: string | null): string {
  // Determinístico baseado no IP pra parecer "região fixa do cliente"
  if (!ip) return SNYX_REGIONS[0];
  let hash = 0;
  for (const c of ip) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return SNYX_REGIONS[Math.abs(hash) % SNYX_REGIONS.length];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-SnyX-Request-ID, X-SnyX-Region, X-SnyX-Latency, X-SnyX-Model, X-SnyX-Node, X-RateLimit-Remaining, X-RateLimit-Reset",
};

const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

interface ChatMessage { role: string; content: string }
interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// ===== GeoIP via ipapi.co (grátis ~1k/dia) =====
async function lookupGeo(ip: string | null): Promise<{ country?: string; city?: string; region?: string }> {
  if (!ip || ip === "127.0.0.1" || ip.startsWith("10.") || ip.startsWith("192.168.")) return {};
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(2000),
      headers: { "User-Agent": "SnyX-API/1.0" },
    });
    if (!res.ok) return {};
    const data = await res.json();
    return {
      country: data.country_name || data.country,
      city: data.city,
      region: data.region,
    };
  } catch {
    return {};
  }
}

// ===== Provider callers =====
function openAIToGemini(messages: any[]) {
  let systemInstruction: any | undefined;
  const contents: any[] = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      systemInstruction = { parts: [{ text }] };
      continue;
    }
    const role = msg.role === "assistant" ? "model" : "user";
    const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    contents.push({ role, parts: [{ text }] });
  }
  return { systemInstruction, contents };
}

async function callGoogle(model: string, body: ChatRequest, signal: AbortSignal): Promise<{ text: string; usage: any }> {
  if (!GOOGLE_KEY) throw new Error("no_google_key");
  const { systemInstruction, contents } = openAIToGemini(body.messages);
  const reqBody: any = { contents, generationConfig: {} };
  if (systemInstruction) reqBody.systemInstruction = systemInstruction;
  if (body.temperature !== undefined) reqBody.generationConfig.temperature = body.temperature;
  if (body.max_tokens !== undefined) reqBody.generationConfig.maxOutputTokens = body.max_tokens;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
    signal,
  });
  if (!res.ok) throw new Error(`google_${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  if (!text) throw new Error("google_empty");
  return {
    text,
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

async function callGroq(model: string, body: ChatRequest, signal: AbortSignal): Promise<{ text: string; usage: any }> {
  if (!GROQ_KEY) throw new Error("no_groq_key");
  const cleanMessages = body.messages.map(m => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: cleanMessages, temperature: body.temperature, max_tokens: body.max_tokens }),
    signal,
  });
  if (!res.ok) throw new Error(`groq_${res.status}`);
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content || "",
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
  };
}

async function callPollinations(model: string, body: ChatRequest, signal: AbortSignal): Promise<{ text: string; usage: any }> {
  const res = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: body.messages, private: true }),
    signal,
  });
  if (!res.ok) throw new Error(`pollinations_${model}_${res.status}`);
  const ct = res.headers.get("content-type") || "";
  let text = "";
  if (ct.includes("application/json")) {
    const data = await res.json();
    text = data?.choices?.[0]?.message?.content || "";
  }
  if (!text) text = await res.text();
  if (!text) throw new Error(`pollinations_${model}_empty`);
  return { text, usage: { prompt_tokens: 0, completion_tokens: 0 } };
}

async function callRoute(route: ProviderRoute, body: ChatRequest, signal: AbortSignal) {
  if (route.provider === "google") return await callGoogle(route.model, body, signal);
  if (route.provider === "groq") return await callGroq(route.model, body, signal);
  if (route.provider === "pollinations") return await callPollinations(route.model, body, signal);
  throw new Error(`unknown_provider_${route.provider}`);
}

async function raceProviders(routes: ProviderRoute[], body: ChatRequest) {
  const usable = routes.filter(r => {
    if (r.provider === "google" && !GOOGLE_KEY) return false;
    if (r.provider === "groq" && !GROQ_KEY) return false;
    return true;
  });
  if (usable.length === 0) throw new Error("no_usable_providers");
  const controller = new AbortController();
  const errors: string[] = [];
  const promises = usable.map(route =>
    callRoute(route, body, controller.signal).then(r => ({ ...r, route })).catch(e => {
      errors.push(`${route.provider}/${route.model}:${(e as Error).message}`);
      throw e;
    })
  );
  try {
    const winner = await Promise.any(promises);
    controller.abort();
    return winner;
  } catch {
    throw new Error(`race_failed: ${errors.join(" | ")}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();
  const requestId = `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || null;
  const userAgent = req.headers.get("user-agent") || null;
  const referer = req.headers.get("referer") || req.headers.get("referrer") || null;
  const origin = req.headers.get("origin") || null;
  const region = pickRegion(ip);
  const node = `snyx-node-${Math.abs((ip || "x").charCodeAt(0)) % 12 + 1}`;

  const brandHeaders: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": "application/json",
    "X-SnyX-Request-ID": requestId,
    "X-SnyX-Region": region,
    "X-SnyX-Node": node,
    "Server": "SnyX-Edge/1.0",
  };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Validar API key do cliente
    const authHeader = req.headers.get("Authorization") || "";
    const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!apiKey || !apiKey.startsWith("snyx_sk_")) {
      brandHeaders["X-SnyX-Latency"] = `${Date.now() - startTime}ms`;
      return new Response(JSON.stringify({ error: { message: "Invalid API key. Use 'Authorization: Bearer snyx_sk_...'", type: "auth_error" } }), { status: 401, headers: brandHeaders });
    }

    const { data: validation, error: vErr } = await supabase.rpc("validate_api_client", { p_api_key: apiKey });
    if (vErr || !validation?.valid) {
      brandHeaders["X-SnyX-Latency"] = `${Date.now() - startTime}ms`;
      return new Response(JSON.stringify({ error: { message: validation?.reason || "invalid_key", type: "auth_error" } }), { status: 401, headers: brandHeaders });
    }

    // 2. Parse body
    const body = (await req.json()) as ChatRequest;
    if (!body?.messages?.length) {
      return new Response(JSON.stringify({ error: { message: "messages array required", type: "invalid_request" } }), { status: 400, headers: brandHeaders });
    }

    // 3. Validar modelo
    let requestedModel = body.model || "snyx-fast";
    if (!isSnyxModel(requestedModel)) {
      const m = requestedModel.toLowerCase();
      if (m.includes("reason") || m.includes("o1") || m.includes("r1")) requestedModel = "snyx-reasoning";
      else if (m.includes("cod") || m.includes("qwen")) requestedModel = "snyx-coder";
      else if (m.includes("vision") || m.includes("image")) requestedModel = "snyx-vision";
      else if (m.includes("search") || m.includes("web")) requestedModel = "snyx-search";
      else if (m.includes("nano") || m.includes("lite") || m.includes("flash") || m.includes("mini") || m.includes("fast"))
        requestedModel = "snyx-fast";
      else requestedModel = "snyx-pro";
    }

    const allowedModels = (validation.models_allowed || []) as string[];
    if (allowedModels.length > 0 && !allowedModels.includes(requestedModel) && !allowedModels.includes("*")) {
      return new Response(JSON.stringify({
        error: {
          message: `Modelo '${requestedModel}' não está incluído no seu plano. Modelos disponíveis: ${allowedModels.join(", ")}`,
          type: "model_not_allowed",
        },
      }), { status: 403, headers: brandHeaders });
    }

    brandHeaders["X-SnyX-Model"] = requestedModel;

    const routes = getRoutesForModel(requestedModel);

    // 4. Race paralelo
    let winner: { text: string; usage: any; route: ProviderRoute } | null = null;
    let lastError = "race_failed";
    try {
      winner = await raceProviders(routes, body);
    } catch (e) {
      lastError = (e as Error).message;
    }

    // 5. Fallback Lovable
    if (!winner && LOVABLE_KEY) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, model: "google/gemini-3-flash-preview", stream: false }),
        });
        if (res.ok) {
          const data = await res.json();
          winner = {
            text: data.choices?.[0]?.message?.content || "",
            usage: data.usage || {},
            route: { provider: "lovable" as any, model: "google/gemini-3-flash-preview" },
          };
        }
      } catch (e) {
        lastError = `lovable_fallback: ${(e as Error).message}`;
      }
    }

    // GeoIP em paralelo (não bloqueia resposta)
    const geoPromise = lookupGeo(ip);

    if (!winner) {
      const geo = await geoPromise;
      const latency = Date.now() - startTime;
      await supabase.from("api_usage_logs").insert({
        api_client_id: validation.client_id,
        user_id: validation.user_id,
        provider: "snyx",
        model: requestedModel,
        latency_ms: latency,
        status_code: 503,
        error_message: lastError,
        ip_address: ip,
        user_agent: userAgent,
        referer,
        origin,
        request_id: requestId,
        country: geo.country,
        city: geo.city,
        region: geo.region,
      });
      brandHeaders["X-SnyX-Latency"] = `${latency}ms`;
      return new Response(JSON.stringify({ error: { message: `All providers failed: ${lastError}`, type: "upstream_error" } }), { status: 503, headers: brandHeaders });
    }

    // 6. Sucesso
    const latency = Date.now() - startTime;
    await supabase.rpc("increment_api_client_usage", { p_client_id: validation.client_id });

    const geo = await geoPromise;
    await supabase.from("api_usage_logs").insert({
      api_client_id: validation.client_id,
      user_id: validation.user_id,
      provider: "snyx",
      model: requestedModel,
      tokens_in: winner.usage?.prompt_tokens || 0,
      tokens_out: winner.usage?.completion_tokens || 0,
      latency_ms: latency,
      status_code: 200,
      ip_address: ip,
      user_agent: userAgent,
      referer,
      origin,
      request_id: requestId,
      country: geo.country,
      city: geo.city,
      region: geo.region,
    });

    brandHeaders["X-SnyX-Latency"] = `${latency}ms`;
    brandHeaders["X-RateLimit-Remaining"] = String(validation.daily_remaining ?? 0);
    brandHeaders["X-RateLimit-Reset"] = String(Math.floor(Date.now() / 1000) + 86400);

    const response = {
      id: `chatcmpl-${crypto.randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: requestedModel,
      system_fingerprint: `snyx_${region}_${node}`,
      choices: [{
        index: 0,
        message: { role: "assistant", content: winner.text },
        finish_reason: "stop",
      }],
      usage: {
        prompt_tokens: winner.usage?.prompt_tokens || 0,
        completion_tokens: winner.usage?.completion_tokens || 0,
        total_tokens: (winner.usage?.prompt_tokens || 0) + (winner.usage?.completion_tokens || 0),
      },
    };

    return new Response(JSON.stringify(response), { status: 200, headers: brandHeaders });
  } catch (err) {
    console.error("Smart router error:", err);
    brandHeaders["X-SnyX-Latency"] = `${Date.now() - startTime}ms`;
    return new Response(JSON.stringify({ error: { message: String(err), type: "internal_error" } }), { status: 500, headers: brandHeaders });
  }
});

export const AVAILABLE_MODELS = SNYX_MODELS;
