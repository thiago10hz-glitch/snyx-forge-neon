import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type BuilderErrorCode = "AI_CREDITS_EXHAUSTED" | "AI_RATE_LIMITED" | "AI_UNAVAILABLE" | "UNAUTHORIZED" | "BAD_REQUEST";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é uma IA programadora estilo Lovable/v0. Recebe um pedido do usuário e o HTML atual do site dele.

Você DEVE responder em DUAS partes, nesta ordem:

1) Pensamento curto em PT-BR (2-5 frases) explicando o que vai fazer. Linguagem natural ("Vou criar... vou ajustar..."). Sem markdown.

2) Em seguida, dentro de um bloco delimitado EXATAMENTE assim:
<<<HTML>>>
<!DOCTYPE html>
... HTML completo aqui ...
</html>
<<<END>>>

REGRAS DO HTML:
- Documento HTML completo e válido, com <!DOCTYPE html>, <head> e <body>.
- Pode usar TailwindCSS via CDN (<script src="https://cdn.tailwindcss.com"></script>) e qualquer CSS/JS inline.
- Sites bonitos, modernos, responsivos, com micro-interações.
- Se for alteração pequena, mantenha tudo que já existe e mude só o necessário.
- Nunca escreva nada DEPOIS de <<<END>>>.`;

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function handledError(code: BuilderErrorCode, message: string, status = 200, details?: string) {
  return jsonResponse(
    {
      ok: false,
      handled: true,
      code,
      error: message,
      details,
    },
    status,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return handledError("AI_UNAVAILABLE", "IA não configurada no momento.");
    }

    const supaUrl = Deno.env.get("SUPABASE_URL");
    const supaAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supaUrl || !supaAnonKey) {
      return handledError("AI_UNAVAILABLE", "Backend indisponível no momento.");
    }

    const userClient = createClient(supaUrl, supaAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return handledError("UNAUTHORIZED", "Não autenticado", 401);
    }

    const { prompt, current_html, history, mode } = await req.json();
    if (!prompt) {
      return handledError("BAD_REQUEST", "prompt obrigatório", 400);
    }

    let model = "google/gemini-3-flash-preview";
    let reasoning: { effort: string } | undefined;
    if (mode === "pro") {
      model = "google/gemini-2.5-pro";
    } else if (mode === "think") {
      model = "openai/gpt-5";
      reasoning = { effort: "high" };
    }

    const messages = [
      { role: "system", content: SYSTEM },
      ...(Array.isArray(history) ? history.slice(-6) : []),
      {
        role: "user",
        content: `HTML ATUAL:\n\`\`\`html\n${current_html || "(vazio)"}\n\`\`\`\n\nPEDIDO: ${prompt}`,
      },
    ];

    const body: Record<string, unknown> = { model, messages, stream: true };
    if (reasoning) body.reasoning = reasoning;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (aiRes.status === 402 || aiRes.status === 429 || aiRes.status >= 500) {
      const lovableDetails = await aiRes.text();
      console.warn(`[programmer-builder] Lovable AI ${aiRes.status} → tentando fallbacks gratuitos`);

      // 1) Groq (se chave configurada — tier free generoso)
      const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
      if (GROQ_API_KEY) {
        try {
          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GROQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages,
              stream: true,
              max_tokens: 8192,
              temperature: 0.7,
            }),
          });

          if (groqRes.ok && groqRes.body) {
            return new Response(groqRes.body, {
              headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": "groq" },
            });
          }
          console.error(`[programmer-builder] Groq falhou: ${groqRes.status}`, await groqRes.text());
        } catch (e) {
          console.error("[programmer-builder] Groq exception:", e);
        }
      }

      // 2) OpenRouter free models (se chave configurada)
      const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
      if (OPENROUTER_API_KEY) {
        try {
          const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://snyx.app",
              "X-Title": "SnyX Programador",
            },
            body: JSON.stringify({
              model: "deepseek/deepseek-chat-v3.1:free",
              messages,
              stream: true,
              max_tokens: 8192,
            }),
          });
          if (orRes.ok && orRes.body) {
            return new Response(orRes.body, {
              headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": "openrouter" },
            });
          }
          console.error(`[programmer-builder] OpenRouter falhou: ${orRes.status}`, await orRes.text());
        } catch (e) {
          console.error("[programmer-builder] OpenRouter exception:", e);
        }
      }

      // 3) Pollinations.ai — 100% grátis, sem API key
      const pollinationsModels = ["openai", "openai-large", "mistral", "llama"];
      for (const pmodel of pollinationsModels) {
        try {
          const pollRes = await fetch("https://text.pollinations.ai/openai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: pmodel, messages, stream: true }),
          });
          if (pollRes.ok && pollRes.body) {
            return new Response(pollRes.body, {
              headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": `pollinations-${pmodel}` },
            });
          }
          console.error(`[programmer-builder] Pollinations(${pmodel}) falhou: ${pollRes.status}`);
        } catch (e) {
          console.error(`[programmer-builder] Pollinations(${pmodel}) exception:`, e);
        }
      }

      // 4) DuckDuckGo AI Chat — grátis, sem cadastro (GPT-4o-mini / Claude Haiku / Llama)
      try {
        const statusRes = await fetch("https://duckduckgo.com/duckchat/v1/status", {
          headers: { "x-vqd-accept": "1", "User-Agent": "Mozilla/5.0" },
        });
        const vqd = statusRes.headers.get("x-vqd-4");
        if (vqd) {
          const ddgRes = await fetch("https://duckduckgo.com/duckchat/v1/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-vqd-4": vqd,
              "User-Agent": "Mozilla/5.0",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            }),
          });
          if (ddgRes.ok && ddgRes.body) {
            // DDG returns SSE in its own format → transform to OpenAI delta format
            const transformed = new ReadableStream({
              async start(controller) {
                const reader = ddgRes.body!.getReader();
                const decoder = new TextDecoder();
                const encoder = new TextEncoder();
                let buf = "";
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buf += decoder.decode(value, { stream: true });
                  let idx;
                  while ((idx = buf.indexOf("\n")) !== -1) {
                    const line = buf.slice(0, idx).trim();
                    buf = buf.slice(idx + 1);
                    if (!line.startsWith("data:")) continue;
                    const data = line.slice(5).trim();
                    if (data === "[DONE]") {
                      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                      continue;
                    }
                    try {
                      const j = JSON.parse(data);
                      const content = j.message ?? "";
                      if (content) {
                        const chunk = { choices: [{ delta: { content } }] };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                      }
                    } catch { /* ignore */ }
                  }
                }
                controller.close();
              },
            });
            return new Response(transformed, {
              headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": "duckduckgo" },
            });
          }
          console.error(`[programmer-builder] DuckDuckGo falhou: ${ddgRes.status}`);
        }
      } catch (e) {
        console.error("[programmer-builder] DuckDuckGo exception:", e);
      }

      // 5) Cloudflare Workers AI (Llama 3.3) — free tier sem cartão (se chave configurada)
      const CF_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
      const CF_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
      if (CF_ACCOUNT_ID && CF_API_TOKEN) {
        try {
          const cfRes = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/v1/chat/completions`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${CF_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
                messages,
                stream: true,
                max_tokens: 8192,
              }),
            },
          );
          if (cfRes.ok && cfRes.body) {
            return new Response(cfRes.body, {
              headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": "cloudflare" },
            });
          }
          console.error(`[programmer-builder] Cloudflare falhou: ${cfRes.status}`);
        } catch (e) {
          console.error("[programmer-builder] Cloudflare exception:", e);
        }
      }

      // 6) Phind — grátis, sem chave (modelo próprio focado em código)
      try {
        const phindRes = await fetch("https://https.extension.phind.com/agent/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "",
            "Accept": "*/*",
          },
          body: JSON.stringify({
            additional_extension_context: "",
            allow_magic_buttons: true,
            is_vscode_extension: true,
            message_history: messages.map((m: any) => ({ role: m.role, content: m.content })),
            requested_model: "Phind-70B",
            user_input: messages[messages.length - 1]?.content ?? "",
          }),
        });
        if (phindRes.ok && phindRes.body) {
          const transformed = new ReadableStream({
            async start(controller) {
              const reader = phindRes.body!.getReader();
              const decoder = new TextDecoder();
              const encoder = new TextEncoder();
              let buf = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                let idx;
                while ((idx = buf.indexOf("\n")) !== -1) {
                  const line = buf.slice(0, idx).trim();
                  buf = buf.slice(idx + 1);
                  if (!line.startsWith("data:")) continue;
                  const data = line.slice(5).trim();
                  if (!data || data === "[DONE]") continue;
                  try {
                    const j = JSON.parse(data);
                    const content = j.choices?.[0]?.delta?.content ?? "";
                    if (content) {
                      const chunk = { choices: [{ delta: { content } }] };
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                    }
                  } catch { /* ignore */ }
                }
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });
          return new Response(transformed, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": "phind" },
          });
        }
        console.error(`[programmer-builder] Phind falhou: ${phindRes.status}`);
      } catch (e) {
        console.error("[programmer-builder] Phind exception:", e);
      }

      // 7) Blackbox AI — grátis, sem chave
      try {
        const bbRes = await fetch("https://www.blackbox.ai/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
          },
          body: JSON.stringify({
            messages: messages.map((m: any, i: number) => ({
              id: `msg-${i}`,
              role: m.role,
              content: m.content,
            })),
            previewToken: null,
            userId: null,
            codeModelMode: true,
            agentMode: {},
            trendingAgentMode: {},
            isMicMode: false,
            maxTokens: 8192,
            playgroundTopP: 0.9,
            playgroundTemperature: 0.7,
            isChromeExt: false,
            githubToken: null,
          }),
        });
        if (bbRes.ok && bbRes.body) {
          // Blackbox retorna texto puro (não SSE) → transformar em SSE OpenAI
          const transformed = new ReadableStream({
            async start(controller) {
              const reader = bbRes.body!.getReader();
              const decoder = new TextDecoder();
              const encoder = new TextEncoder();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value, { stream: true });
                if (text) {
                  const chunk = { choices: [{ delta: { content: text } }] };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });
          return new Response(transformed, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": "blackbox" },
          });
        }
        console.error(`[programmer-builder] Blackbox falhou: ${bbRes.status}`);
      } catch (e) {
        console.error("[programmer-builder] Blackbox exception:", e);
      }

      if (aiRes.status === 402) {
        return handledError(
          "AI_CREDITS_EXHAUSTED",
          "Os créditos da IA acabaram no momento. Tente novamente depois de recarregar os créditos.",
          200,
          lovableDetails,
        );
      }

      if (aiRes.status === 429) {
        return handledError(
          "AI_RATE_LIMITED",
          "A IA está com muitas requisições agora. Aguarde alguns segundos e tente de novo.",
          200,
          lovableDetails,
        );
      }

      return handledError(
        "AI_UNAVAILABLE",
        "A IA está temporariamente indisponível. Tente novamente em instantes.",
        200,
        lovableDetails,
      );
    }

    if (!aiRes.ok || !aiRes.body) {
      const t = await aiRes.text();
      console.error("AI error:", aiRes.status, t);
      return handledError("AI_UNAVAILABLE", "Erro na IA", 200, t);
    }

    return new Response(aiRes.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-AI-Provider": "lovable",
      },
    });
  } catch (e) {
    console.error("programmer-builder error:", e);
    return handledError(
      "AI_UNAVAILABLE",
      e instanceof Error ? e.message : "Erro desconhecido",
      200,
    );
  }
});
