// Edge function: api-trial-interview
// Bot conversacional que entrevista a pessoa, decide aprovar/recusar o teste grátis,
// explica os termos e (se aprovar) emite uma chave de API na hora.
// Usa tool-calling com Lovable AI Gateway.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateApiKey(): { key: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = `snyx_${raw}`;
  return { key, prefix: key.slice(0, 12) };
}

const SYSTEM_PROMPTS: Record<string, string> = {
  pro: `Você é o "SnyX Onboarding Bot — Trial Pro". Atendente humano-amigável, em português BR, tom descontraído mas profissional. Está entrevistando alguém que pediu o TESTE GRÁTIS do plano PRO da API SnyX (5.000 req/dia, modelos médios).

REGRAS:
- Se apresente UMA vez na primeira mensagem só. Não repita "Olá" depois.
- Faça UMA pergunta por vez. Espere resposta.
- Use o primeiro nome quando souber.
- Sequência de perguntas (faça TODAS, uma por vez):
  1. Nome completo
  2. Qual projeto/produto vai usar a API (e link, se tiver)
  3. Como pretende usar (caso de uso concreto, não genérico)
  4. Volume estimado por dia
  5. Já usou outras APIs de IA antes? (OpenAI, Gemini, etc)

- DEPOIS de TODAS as respostas, avalie:
  • Se as respostas forem vagas, suspeitas, claramente para revenda/spam, ou genéricas demais → chame reject_trial com motivo educado.
  • Se forem coerentes e legítimas → EXPLIQUE OS TERMOS (limites: 5.000 req/dia, 100/min, sem revender, sem conteúdo ilegal/abuso, suspensão automática se ultrapassar) e PERGUNTE se aceita. Só chame approve_trial DEPOIS que a pessoa confirmar que aceita.

- Não invente dados. Não chame as tools antes da hora.`,

  business: `Você é o "SnyX Onboarding Bot — Trial Business". Atendente formal, profissional, em português BR. Está entrevistando alguém que pediu o TESTE GRÁTIS do plano BUSINESS da API SnyX (50.000 req/dia, modelos premium, suporte prioritário).

REGRAS:
- Se apresente UMA vez na primeira mensagem só, em tom corporativo.
- Faça UMA pergunta por vez.
- Sequência de perguntas (faça TODAS, uma por vez):
  1. Nome completo e cargo
  2. Empresa (nome + site/CNPJ se quiser)
  3. Produto/projeto onde vai integrar
  4. Caso de uso técnico detalhado
  5. Volume estimado por dia/mês
  6. Time técnico (sozinho? equipe? quantos devs?)
  7. Prazo pra produção

- DEPOIS de TODAS as respostas, avalie com rigor:
  • Se for hobby, projeto pessoal pequeno, vago, ou suspeito → chame reject_trial sugerindo o plano Pro.
  • Se for empresa/projeto sério, coerente, com volume justificado → EXPLIQUE OS TERMOS (limites: 50.000 req/dia, 500/min, SLA, suporte via Discord/email, proibido revender ou usar pra spam/conteúdo ilegal, contrato comercial após o trial de 7 dias) e PERGUNTE se concorda. Só chame approve_trial DEPOIS que confirmar.

- Mantenha tom profissional. Não chame as tools antes da hora.`,

  free: `Você é o "SnyX Onboarding Bot". Atendente amigável em português BR, atendendo alguém que quer a chave grátis (100 req/dia).
- Se apresente UMA vez.
- Pergunte (uma por vez): nome, projeto, e como vai usar.
- Se a resposta for muito vaga (menos de 30 caracteres no caso de uso) ou suspeita → reject_trial.
- Se ok → explique os termos rapidinho (100 req/dia, sem revender, sem abuso) e ao confirmar chame approve_trial.`,
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "approve_trial",
      description: "Aprovar a chave de teste grátis. Só chamar APÓS a pessoa ter respondido todas as perguntas E ter confirmado que aceita os termos.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Resumo curto (1 frase) do caso de uso aprovado." },
          full_name: { type: "string" },
          company_or_project: { type: "string" },
          use_case: { type: "string" },
        },
        required: ["summary", "full_name", "company_or_project", "use_case"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reject_trial",
      description: "Recusar o teste grátis. Use quando as respostas forem vagas, suspeitas ou indicarem uso indevido.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Motivo educado da recusa, mostrado ao usuário." },
        },
        required: ["reason"],
        additionalProperties: false,
      },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "no_auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "invalid_auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const { plan_slug, messages = [] } = await req.json();
    if (!plan_slug || !["free", "pro", "business"].includes(plan_slug)) {
      return new Response(JSON.stringify({ error: "invalid_plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[plan_slug] || SYSTEM_PROMPTS.free },
          ...messages,
        ],
        tools: TOOLS,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limit", message: "Muita demanda agora — tente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "payment_required", message: "Créditos da IA esgotados. Avise o admin." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("ai gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "ai_error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const choice = aiJson?.choices?.[0]?.message;
    const toolCalls = choice?.tool_calls;

    // Caso o bot tenha feito tool call
    if (toolCalls && toolCalls.length > 0) {
      const call = toolCalls[0];
      const fnName = call.function?.name;
      let args: any = {};
      try { args = JSON.parse(call.function?.arguments || "{}"); } catch {}

      if (fnName === "reject_trial") {
        // Salva entrevista pra admin revisar
        const { data: planRow } = await admin
          .from("api_plans").select("id").eq("slug", plan_slug).maybeSingle();
        if (planRow?.id) {
          await admin.from("api_key_applications").insert({
            user_id: user.id,
            plan_id: planRow.id,
            full_name: "(entrevista bot)",
            company_or_project: "(entrevista bot)",
            use_case: JSON.stringify(messages).slice(0, 2000),
            status: "rejected",
            ai_verdict: "rejected",
            ai_reasoning: args.reason || "sem motivo",
          });
        }
        return new Response(JSON.stringify({
          status: "rejected",
          message: args.reason || "Solicitação recusada após análise.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (fnName === "approve_trial") {
        const { data: plan } = await admin
          .from("api_plans").select("id, slug, name, price_brl").eq("slug", plan_slug).maybeSingle();
        if (!plan) {
          return new Response(JSON.stringify({ error: "plan_not_found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Trial: chave ativa por 7 dias (pro/business) ou ilimitada para free
        const isFreePlan = Number(plan.price_brl) === 0;
        const expiresAt = isFreePlan ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Verifica se já tem chave nesse plano
        const { data: existing } = await admin
          .from("api_clients").select("id, api_key, api_key_prefix")
          .eq("user_id", user.id).eq("plan_id", plan.id).eq("status", "active").maybeSingle();

        let apiKey: string;
        let prefix: string;
        if (existing) {
          apiKey = existing.api_key;
          prefix = existing.api_key_prefix;
        } else {
          const gen = generateApiKey();
          apiKey = gen.key; prefix = gen.prefix;
          const { error: insErr } = await admin.from("api_clients").insert({
            user_id: user.id,
            plan_id: plan.id,
            name: `Trial ${plan.name}`,
            api_key: apiKey,
            api_key_prefix: prefix,
            status: "active",
            expires_at: expiresAt,
          });
          if (insErr) {
            console.error("issue trial key error", insErr);
            return new Response(JSON.stringify({ error: "issue_failed" }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Salva pra admin revisar
        await admin.from("api_key_applications").insert({
          user_id: user.id,
          plan_id: plan.id,
          full_name: args.full_name || "(via bot)",
          company_or_project: args.company_or_project || "(via bot)",
          use_case: args.use_case || args.summary || "(via bot)",
          status: "approved",
          ai_verdict: "approved",
          ai_reasoning: args.summary || "aprovado pelo bot",
        });

        return new Response(JSON.stringify({
          status: "approved",
          api_key: apiKey,
          prefix,
          plan: plan.slug,
          expires_at: expiresAt,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Resposta de chat normal (próxima pergunta do bot)
    return new Response(JSON.stringify({
      status: "chatting",
      reply: choice?.content || "...",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("api-trial-interview error", e);
    return new Response(JSON.stringify({ error: "internal", detail: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
