// Free AI gateway: race paralelo entre múltiplos providers grátis.
// Mantém formato OpenAI-compatible para drop-in replacement do gateway Lovable.
// Estratégia: dispara N providers ao mesmo tempo, usa o primeiro que responder
// com sucesso. Cancela os demais via AbortController.

import { getRoutesForModel, isSnyxModel, type ProviderRoute } from "./snyx-models.ts";

const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

// ===== Helpers =====
function encodeSSE(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

function messagesToFlatPrompt(messages: any[]): string {
  const parts: string[] = [];
  for (const m of messages) {
    const text = typeof m.content === "string"
      ? m.content
      : (Array.isArray(m.content) ? m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ") : "");
    if (!text) continue;
    if (m.role === "system") parts.push(`[SYSTEM]\n${text}`);
    else if (m.role === "assistant") parts.push(`[ASSISTANT]\n${text}`);
    else parts.push(`[USER]\n${text}`);
  }
  parts.push("[ASSISTANT]");
  return parts.join("\n\n");
}

// Mapeia modelos legados (não-snyx) para provider Google
function mapToGoogleModel(model?: string): string {
  if (!model) return "gemini-2.0-flash";
  if (model.includes("pro")) return "gemini-2.5-pro";
  if (model.includes("flash-lite") || model.includes("nano")) return "gemini-2.0-flash-lite";
  if (model.includes("2.5-flash") || model.includes("flash-image")) return "gemini-2.5-flash";
  return "gemini-2.0-flash";
}

// Converte messages OpenAI -> formato Gemini
function openAIToGemini(messages: any[]): { systemInstruction?: any; contents: any[] } {
  let systemInstruction: any | undefined;
  const contents: any[] = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      systemInstruction = systemInstruction
        ? { parts: [{ text: systemInstruction.parts[0].text + "\n\n" + text }] }
        : { parts: [{ text }] };
      continue;
    }
    const role = msg.role === "assistant" ? "model" : "user";
    const parts: any[] = [];
    if (typeof msg.content === "string") {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const c of msg.content) {
        if (c.type === "text") parts.push({ text: c.text });
        else if (c.type === "image_url" && c.image_url?.url) {
          const url = c.image_url.url;
          if (url.startsWith("data:")) {
            const m = url.match(/^data:([^;]+);base64,(.+)$/);
            if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
          }
        }
      }
    }
    if (parts.length === 0) parts.push({ text: "" });
    contents.push({ role, parts });
  }
  return { systemInstruction, contents };
}

// ===== Provider callers (non-stream, retornam string ou throw) =====

async function callGoogle(
  model: string,
  messages: any[],
  temperature?: number,
  maxTokens?: number,
  jsonMode?: boolean,
  signal?: AbortSignal,
): Promise<string> {
  if (!GOOGLE_KEY) throw new Error("no_google_key");
  const { systemInstruction, contents } = openAIToGemini(messages);
  const body: any = { contents, generationConfig: {} };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (temperature !== undefined) body.generationConfig.temperature = temperature;
  if (maxTokens !== undefined) body.generationConfig.maxOutputTokens = maxTokens;
  if (jsonMode) body.generationConfig.responseMimeType = "application/json";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`google_${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  if (!text) throw new Error("google_empty");
  return text;
}

async function callGroq(
  model: string,
  messages: any[],
  temperature?: number,
  maxTokens?: number,
  jsonMode?: boolean,
  signal?: AbortSignal,
): Promise<string> {
  if (!GROQ_KEY) throw new Error("no_groq_key");
  const cleanMessages = messages.map(m => ({
    role: m.role,
    content: typeof m.content === "string"
      ? m.content
      : (Array.isArray(m.content)
          ? m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ") || "[imagem omitida]"
          : ""),
  }));
  const body: any = { model, messages: cleanMessages, temperature, max_tokens: maxTokens };
  if (jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`groq_${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("groq_empty");
  return text;
}

async function callPollinations(
  model: string,
  messages: any[],
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, private: true }),
    signal,
  });
  if (!res.ok) throw new Error(`pollinations_${model}_${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    if (text) return text;
  }
  const text = await res.text();
  if (!text || text.length < 2) throw new Error(`pollinations_${model}_empty`);
  return text;
}

// ===== Race paralelo =====

async function callRoute(
  route: ProviderRoute,
  messages: any[],
  temperature: number | undefined,
  maxTokens: number | undefined,
  jsonMode: boolean,
  signal: AbortSignal,
): Promise<{ text: string; route: ProviderRoute }> {
  let text: string;
  if (route.provider === "google") {
    text = await callGoogle(route.model, messages, temperature, maxTokens, jsonMode, signal);
  } else if (route.provider === "groq") {
    text = await callGroq(route.model, messages, temperature, maxTokens, jsonMode, signal);
  } else if (route.provider === "pollinations") {
    text = await callPollinations(route.model, messages, signal);
  } else {
    throw new Error(`unknown_provider_${route.provider}`);
  }
  return { text, route };
}

/**
 * Race paralelo: dispara todas as rotas válidas, retorna a primeira que vence.
 * Cancela as demais.
 */
async function raceProviders(
  routes: ProviderRoute[],
  messages: any[],
  temperature: number | undefined,
  maxTokens: number | undefined,
  jsonMode: boolean,
): Promise<{ text: string; route: ProviderRoute }> {
  // Filtra rotas que precisam de chave ausente
  const usable = routes.filter(r => {
    if (r.provider === "google" && !GOOGLE_KEY) return false;
    if (r.provider === "groq" && !GROQ_KEY) return false;
    return true;
  });
  if (usable.length === 0) throw new Error("no_usable_providers");

  const controller = new AbortController();
  const errors: string[] = [];

  // Promise.any já retorna a primeira que cumpre. Depois, cancela todas.
  const promises = usable.map(route =>
    callRoute(route, messages, temperature, maxTokens, jsonMode, controller.signal)
      .catch(e => {
        errors.push(`${route.provider}/${route.model}: ${(e as Error).message}`);
        throw e;
      })
  );

  try {
    const winner = await Promise.any(promises);
    controller.abort(); // cancela os demais
    console.log(`[free-ai] race winner: ${winner.route.provider}/${winner.route.model}`);
    return winner;
  } catch (_aggregate) {
    console.warn("[free-ai] todos providers da race falharam:", errors);
    throw new Error(`race_failed: ${errors.join(" | ")}`);
  }
}

// ===== Lovable AI Gateway (último recurso, gasta créditos) =====
async function callLovable(model: string | undefined, body: any): Promise<Response> {
  if (!LOVABLE_KEY) throw new Error("no_lovable_key");
  const finalBody = { ...body, model: model || "google/gemini-3-flash-preview" };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(finalBody),
  });
  if (!res.ok) throw new Error(`lovable_${res.status}`);
  if (body.stream) return new Response(res.body, { headers: { "Content-Type": "text/event-stream" } });
  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

// ===== Stream simulado (Pollinations/Google non-stream -> SSE) =====
function textToSSEStream(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const chunkSize = 40;
      for (let i = 0; i < text.length; i += chunkSize) {
        controller.enqueue(encoder.encode(encodeSSE(text.slice(i, i + chunkSize))));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

/**
 * Drop-in replacement para `fetch("https://ai.gateway.lovable.dev/v1/chat/completions", ...)`.
 *
 * Se model for um modelo SnyX (snyx-fast, snyx-pro, etc), usa race paralelo dos providers definidos.
 * Caso contrário, monta uma rota padrão (google + groq + pollinations).
 */
export async function freeAIChat(_url: string, init: RequestInit): Promise<Response> {
  const body = JSON.parse(init.body as string);
  const { model, messages, stream, temperature, max_tokens, response_format } = body;
  const jsonMode = response_format?.type === "json_object";

  // Decide rota
  let routes: ProviderRoute[];
  if (isSnyxModel(model)) {
    routes = getRoutesForModel(model);
  } else {
    // Modelos legados (lovable-style) -> rota padrão balanceada
    routes = [
      { provider: "groq", model: "llama-3.3-70b-versatile" },
      { provider: "google", model: mapToGoogleModel(model) },
      { provider: "pollinations", model: "openai-large" },
      { provider: "pollinations", model: "deepseek" },
    ];
  }

  // 1. Race paralelo entre os providers grátis
  try {
    const { text } = await raceProviders(routes, messages, temperature, max_tokens, jsonMode);
    if (stream) return textToSSEStream(text);
    return new Response(
      JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.warn("[free-ai] race falhou, indo pro Lovable:", (e as Error).message);
  }

  // 2. Lovable AI (último recurso, gasta créditos)
  if (LOVABLE_KEY) {
    try {
      return await callLovable(model, body);
    } catch (e) {
      console.error("[free-ai] Lovable também falhou:", (e as Error).message);
    }
  }

  return new Response(JSON.stringify({ error: "Todos os provedores de IA falharam" }), {
    status: 502, headers: { "Content-Type": "application/json" },
  });
}
