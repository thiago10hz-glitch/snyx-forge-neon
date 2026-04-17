// SnyX AI Smart Router - OpenAI-compatible endpoint with automatic failover
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatMessage { role: string; content: string }
interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

const PROVIDER_ENDPOINTS: Record<string, { url: string; auth: (k: string) => Record<string, string>; defaultModel: string }> = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    auth: (k) => ({ Authorization: `Bearer ${k}` }),
    defaultModel: "llama-3.3-70b-versatile",
  },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    auth: (k) => ({ Authorization: `Bearer ${k}` }),
    defaultModel: "gemini-2.0-flash-exp",
  },
  lovable: {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    auth: (k) => ({ Authorization: `Bearer ${k}` }),
    defaultModel: "google/gemini-2.5-flash",
  },
  cerebras: {
    url: "https://api.cerebras.ai/v1/chat/completions",
    auth: (k) => ({ Authorization: `Bearer ${k}` }),
    defaultModel: "llama-3.3-70b",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    auth: (k) => ({ Authorization: `Bearer ${k}` }),
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
  },
  mistral: {
    url: "https://api.mistral.ai/v1/chat/completions",
    auth: (k) => ({ Authorization: `Bearer ${k}` }),
    defaultModel: "mistral-small-latest",
  },
  github: {
    url: "https://models.inference.ai.azure.com/chat/completions",
    auth: (k) => ({ Authorization: `Bearer ${k}` }),
    defaultModel: "gpt-4o-mini",
  },
  together: {
    url: "https://api.together.xyz/v1/chat/completions",
    auth: (k) => ({ Authorization: `Bearer ${k}` }),
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
  },
  // Cloudflare: api_key armazenada como "ACCOUNT_ID:API_TOKEN"
  cloudflare: {
    url: "", // dinâmica — montada com base no account_id
    auth: (k) => {
      const token = k.split(":")[1] || k;
      return { Authorization: `Bearer ${token}` };
    },
    defaultModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  },
};

function getProviderUrl(provider: string, apiKey: string, model: string): string {
  if (provider === "cloudflare") {
    const accountId = apiKey.split(":")[0];
    return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
  }
  return PROVIDER_ENDPOINTS[provider].url;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Validar API key do cliente
    const authHeader = req.headers.get("Authorization") || "";
    const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!apiKey || !apiKey.startsWith("snyx_sk_")) {
      return jsonResponse({ error: { message: "Invalid API key. Use 'Authorization: Bearer snyx_sk_...'", type: "auth_error" } }, 401);
    }

    const { data: validation, error: vErr } = await supabase.rpc("validate_api_client", { p_api_key: apiKey });
    if (vErr || !validation?.valid) {
      return jsonResponse({ error: { message: validation?.reason || "invalid_key", type: "auth_error" } }, 401);
    }

    // 2. Parse body
    const body = (await req.json()) as ChatRequest;
    if (!body?.messages?.length) {
      return jsonResponse({ error: { message: "messages array required", type: "invalid_request" } }, 400);
    }

    // 3. Tentar até 5 chaves diferentes (failover)
    let lastError = "no_keys_available";
    let lastStatus = 503;
    const attemptedKeys: string[] = [];

    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: keyRows } = await supabase.rpc("get_next_ai_key", { p_provider: null });
      const keyRow = Array.isArray(keyRows) ? keyRows[0] : keyRows;

      if (!keyRow || attemptedKeys.includes(keyRow.id)) {
        break;
      }
      attemptedKeys.push(keyRow.id);

      const provider = PROVIDER_ENDPOINTS[keyRow.provider];
      if (!provider) {
        await supabase.rpc("mark_ai_key_error", { p_key_id: keyRow.id, p_error: "unsupported_provider" });
        continue;
      }

      const model = body.model || keyRow.model_default || provider.defaultModel;
      const upstreamBody = { ...body, model, stream: false };

      try {
        const upstreamRes = await fetch(getProviderUrl(keyRow.provider, keyRow.api_key, model), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...provider.auth(keyRow.api_key) },
          body: JSON.stringify(upstreamBody),
        });

        if (upstreamRes.status === 429 || upstreamRes.status === 402) {
          const errText = await upstreamRes.text();
          await supabase.rpc("mark_ai_key_error", { p_key_id: keyRow.id, p_error: `${upstreamRes.status}: ${errText.slice(0, 200)}` });
          lastError = `rate_limit_${keyRow.provider}`;
          lastStatus = upstreamRes.status;
          continue;
        }

        if (!upstreamRes.ok) {
          const errText = await upstreamRes.text();
          lastError = errText.slice(0, 200);
          lastStatus = upstreamRes.status;
          continue;
        }

        const data = await upstreamRes.json();

        // Sucesso: incrementar contadores e logar
        await supabase.rpc("increment_ai_key_usage", { p_key_id: keyRow.id });
        await supabase.rpc("increment_api_client_usage", { p_client_id: validation.client_id });

        await supabase.from("api_usage_logs").insert({
          api_client_id: validation.client_id,
          user_id: validation.user_id,
          provider_key_id: keyRow.id,
          provider: keyRow.provider,
          model,
          tokens_in: data?.usage?.prompt_tokens || 0,
          tokens_out: data?.usage?.completion_tokens || 0,
          latency_ms: Date.now() - startTime,
          status_code: 200,
          ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        });

        return jsonResponse(data, 200);
      } catch (err) {
        lastError = String(err).slice(0, 200);
        await supabase.rpc("mark_ai_key_error", { p_key_id: keyRow.id, p_error: lastError });
        continue;
      }
    }

    // Todos falharam
    await supabase.from("api_usage_logs").insert({
      api_client_id: validation.client_id,
      user_id: validation.user_id,
      provider: "none",
      latency_ms: Date.now() - startTime,
      status_code: lastStatus,
      error_message: lastError,
    });

    return jsonResponse({ error: { message: `All providers failed: ${lastError}`, type: "upstream_error" } }, lastStatus);
  } catch (err) {
    console.error("Smart router error:", err);
    return jsonResponse({ error: { message: String(err), type: "internal_error" } }, 500);
  }
});

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
