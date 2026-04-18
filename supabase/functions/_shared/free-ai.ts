// Free AI gateway: cadeia de fallback grátis.
// Ordem: Google Gemini -> Groq -> Pollinations Text (sem chave) -> Lovable AI.
// Mantém formato OpenAI-compatible para drop-in replacement do gateway Lovable.

const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

// Mapeia "modelos lovable" -> modelo Google grátis
function mapToGoogleModel(model?: string): string {
  if (!model) return "gemini-2.0-flash";
  if (model.includes("pro")) return "gemini-2.5-pro";
  if (model.includes("flash-lite") || model.includes("nano")) return "gemini-2.0-flash-lite";
  if (model.includes("2.5-flash") || model.includes("flash-image")) return "gemini-2.5-flash";
  return "gemini-2.0-flash";
}

function mapToGroqModel(_model?: string): string {
  return "llama-3.3-70b-versatile";
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

// SSE encoder helper
function encodeSSE(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

async function callGoogleStream(model: string, messages: any[], temperature?: number, maxTokens?: number): Promise<Response> {
  const { systemInstruction, contents } = openAIToGemini(messages);
  const body: any = { contents, generationConfig: {} };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (temperature !== undefined) body.generationConfig.temperature = temperature;
  if (maxTokens !== undefined) body.generationConfig.maxOutputTokens = maxTokens;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GOOGLE_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`google_stream_${res.status}:${t.slice(0, 200)}`);
  }

  // Converte stream Gemini -> stream OpenAI-compatible
  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            try {
              const json = JSON.parse(trimmed.slice(6));
              const text = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
              if (text) controller.enqueue(encoder.encode(encodeSSE(text)));
            } catch { /* skip */ }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally { controller.close(); }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

async function callGoogleNonStream(model: string, messages: any[], temperature?: number, maxTokens?: number, jsonMode?: boolean): Promise<any> {
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
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`google_${res.status}:${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  return {
    choices: [{ message: { role: "assistant", content: text } }],
  };
}

async function callGroqStream(model: string, messages: any[], temperature?: number, maxTokens?: number): Promise<Response> {
  // Groq não suporta imagens no llama 3.3 — strip
  const cleanMessages = messages.map(m => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : (Array.isArray(m.content) ? m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ") || "[imagem omitida]" : ""),
  }));
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: cleanMessages, stream: true, temperature, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`groq_${res.status}:${t.slice(0, 200)}`);
  }
  // Groq já é OpenAI-compatible, pass-through
  return new Response(res.body, { headers: { "Content-Type": "text/event-stream" } });
}

async function callGroqNonStream(model: string, messages: any[], temperature?: number, maxTokens?: number, jsonMode?: boolean): Promise<any> {
  const cleanMessages = messages.map(m => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : (Array.isArray(m.content) ? m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join(" ") || "[imagem omitida]" : ""),
  }));
  const body: any = { model, messages: cleanMessages, temperature, max_tokens: maxTokens };
  if (jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`groq_${res.status}:${t.slice(0, 200)}`);
  }
  return await res.json();
}

// ===== Pollinations Text (sem chave, grátis ilimitado) =====
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

// Lista ordenada de modelos Pollinations (todos sem API key, sem limite).
// Ordem prioriza qualidade/velocidade. Se um falhar, tenta o próximo.
const POLLINATIONS_MODELS = [
  "openai-large",       // GPT-4o
  "openai",             // GPT-4o-mini
  "deepseek",           // DeepSeek V3
  "deepseek-reasoner",  // DeepSeek R1 (raciocínio)
  "llama",              // Llama 3.3 70B
  "mistral",            // Mistral Nemo
  "qwen-coder",         // Qwen 2.5 Coder
  "gemini",             // Gemini 2.0 Flash
  "openai-reasoning",   // o1-mini
  "searchgpt",          // GPT com busca web
];

async function callPollinationsModel(model: string, messages: any[]): Promise<string> {
  // Endpoint POST OpenAI-compatible do Pollinations (suporta histórico).
  const res = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, private: true }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`pollinations_${model}_${res.status}:${t.slice(0, 200)}`);
  }
  const data = await res.json().catch(() => null);
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  // Fallback: alguns modelos retornam texto puro
  const text = typeof data === "string" ? data : await res.clone().text().catch(() => "");
  if (!text) throw new Error(`pollinations_${model}_empty`);
  return text;
}

async function callPollinationsNonStream(messages: any[]): Promise<any> {
  let lastErr: Error | null = null;
  for (const model of POLLINATIONS_MODELS) {
    try {
      const text = await callPollinationsModel(model, messages);
      console.log(`[free-ai] Pollinations OK via ${model}`);
      return { choices: [{ message: { role: "assistant", content: text } }] };
    } catch (e) {
      lastErr = e as Error;
      console.warn(`[free-ai] Pollinations ${model} falhou:`, lastErr.message);
    }
  }
  // Último recurso: GET legacy com prompt flat
  const prompt = messagesToFlatPrompt(messages);
  const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`);
  if (res.ok) {
    const text = await res.text();
    return { choices: [{ message: { role: "assistant", content: text } }] };
  }
  throw lastErr || new Error("pollinations_all_failed");
}

async function callPollinationsStream(messages: any[]): Promise<Response> {
  // Pollinations não tem SSE nativo; simula stream emitindo o texto inteiro de uma vez.
  const data = await callPollinationsNonStream(messages);
  const text = data.choices[0].message.content as string;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Emite em pedaços pra dar sensação de streaming
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

// ===== Lovable AI Gateway (último recurso, usa créditos) =====
async function callLovable(model: string | undefined, body: any): Promise<Response> {
  const finalBody = { ...body, model: model || "google/gemini-3-flash-preview" };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(finalBody),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`lovable_${res.status}:${t.slice(0, 200)}`);
  }
  if (body.stream) return new Response(res.body, { headers: { "Content-Type": "text/event-stream" } });
  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

/**
 * Drop-in replacement para `fetch("https://ai.gateway.lovable.dev/v1/chat/completions", ...)`.
 * Cadeia: Google Gemini -> Groq -> Pollinations Text -> Lovable AI.
 */
export async function freeAIChat(_url: string, init: RequestInit): Promise<Response> {
  const body = JSON.parse(init.body as string);
  const { model, messages, stream, temperature, max_tokens, response_format } = body;
  const jsonMode = response_format?.type === "json_object";
  const googleModel = mapToGoogleModel(model);
  const groqModel = mapToGroqModel(model);

  // 1. Google Gemini (grátis)
  if (GOOGLE_KEY) {
    try {
      if (stream) return await callGoogleStream(googleModel, messages, temperature, max_tokens);
      const data = await callGoogleNonStream(googleModel, messages, temperature, max_tokens, jsonMode);
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      console.warn("[free-ai] Google falhou:", (e as Error).message);
    }
  }

  // 2. Groq (grátis, rápido)
  if (GROQ_KEY) {
    try {
      if (stream) return await callGroqStream(groqModel, messages, temperature, max_tokens);
      const data = await callGroqNonStream(groqModel, messages, temperature, max_tokens, jsonMode);
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      console.warn("[free-ai] Groq falhou:", (e as Error).message);
    }
  }

  // 3. Pollinations Text (sem chave, grátis, ilimitado) — pula se jsonMode
  if (!jsonMode) {
    try {
      if (stream) return await callPollinationsStream(messages);
      const data = await callPollinationsNonStream(messages);
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      console.warn("[free-ai] Pollinations falhou:", (e as Error).message);
    }
  }

  // 4. Lovable AI (último recurso, gasta créditos)
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
