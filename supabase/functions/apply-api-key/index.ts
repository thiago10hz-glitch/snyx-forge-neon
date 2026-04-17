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

interface AppForm {
  plan_slug: string;
  full_name: string;
  company_or_project: string;
  project_url?: string;
  use_case: string;
  estimated_volume?: string;
  category?: string;
}

function basicValidate(f: Partial<AppForm>): string | null {
  if (!f.plan_slug) return "plan_slug obrigatório";
  if (!f.full_name || f.full_name.trim().length < 3) return "Informe o nome completo";
  if (!f.company_or_project || f.company_or_project.trim().length < 2) return "Informe a empresa/projeto";
  if (!f.use_case || f.use_case.trim().length < 60) return "Descreva o caso de uso com mais detalhes (mín. 60 caracteres)";
  if (f.full_name.length > 200 || f.company_or_project.length > 200) return "Campos muito longos";
  if (f.use_case.length > 2000) return "Caso de uso muito longo";
  return null;
}

async function evaluateWithAI(form: AppForm): Promise<{ score: number; verdict: "approve" | "reject"; reasoning: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    // Fallback: aprovar com nota neutra se a IA estiver indisponível
    return { score: 50, verdict: "approve", reasoning: "IA indisponível — aprovação automática neutra." };
  }

  const systemPrompt = `Você é um analista anti-fraude da plataforma SnyX. Avalia solicitações de API key gratuita.
Sua missão: identificar cadastros REAIS (devs, estudantes, projetos legítimos) vs FAKES (spam, lixo, "asdfasdf", abuso, intenção maliciosa).

Critérios:
- Nome completo plausível (não "aaa", "teste", "admin", caracteres aleatórios)
- Empresa/projeto faz sentido (não vazio, não genérico tipo "abc")
- Caso de uso é coerente, descreve ALGO real (não copy-paste óbvio, não nonsense)
- URL (se houver) tem formato plausível
- Sem sinais de abuso: scraping em massa, atividade ilegal, revenda de chaves

Retorne JSON estrito:
{"score": 0-100, "verdict": "approve"|"reject", "reasoning": "1-2 frases em PT-BR"}
- score >= 60 e verdict "approve" libera a chave
- score < 60 e verdict "reject" bloqueia e marca como suspeito`;

  const userPayload = JSON.stringify({
    full_name: form.full_name,
    company_or_project: form.company_or_project,
    project_url: form.project_url || "(não informado)",
    use_case: form.use_case,
    estimated_volume: form.estimated_volume || "(não informado)",
    category: form.category || "(não informado)",
  });

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Avalie esta solicitação:\n${userPayload}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_evaluation",
              description: "Submeter avaliação anti-fraude.",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "integer", minimum: 0, maximum: 100 },
                  verdict: { type: "string", enum: ["approve", "reject"] },
                  reasoning: { type: "string" },
                },
                required: ["score", "verdict", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_evaluation" } },
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("AI gateway error", r.status, t);
      return { score: 50, verdict: "approve", reasoning: "Falha na IA, aprovação neutra." };
    }

    const data = await r.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
    if (!args) return { score: 50, verdict: "approve", reasoning: "IA não retornou avaliação." };
    const score = Math.max(0, Math.min(100, Number(args.score) || 0));
    const verdict = args.verdict === "reject" ? "reject" : "approve";
    return { score, verdict, reasoning: String(args.reasoning || "").slice(0, 600) };
  } catch (e) {
    console.error("evaluateWithAI exception", e);
    return { score: 50, verdict: "approve", reasoning: "Erro ao chamar IA, aprovação neutra." };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "no_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "invalid_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const form = body as AppForm;
    const validationError = basicValidate(form);
    if (validationError) {
      return new Response(JSON.stringify({ error: "validation", message: validationError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Find plan
    const { data: plan, error: planErr } = await admin
      .from("api_plans")
      .select("id, slug, price_brl, name")
      .eq("slug", form.plan_slug)
      .eq("is_active", true)
      .maybeSingle();
    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "plan_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (Number(plan.price_brl) > 0) {
      return new Response(JSON.stringify({ error: "paid_plan_requires_checkout" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Já tem chave ativa nesse plano? devolve a mesma.
    const { data: existing } = await admin
      .from("api_clients")
      .select("api_key, api_key_prefix")
      .eq("user_id", user.id)
      .eq("plan_id", plan.id)
      .eq("status", "active")
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ status: "approved", api_key: existing.api_key, existed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Limite anti-spam: máx. 1 application aberta a cada 24h
    const { data: recent } = await admin
      .from("api_key_applications")
      .select("id, created_at, status")
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (recent && recent.length > 0 && (recent[0] as any).status === "rejected") {
      return new Response(
        JSON.stringify({
          status: "rejected",
          message: "Sua solicitação anterior foi recusada. Aguarde 24h e tente novamente com informações reais.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
    const ua = req.headers.get("user-agent") || null;

    // Avaliação IA
    const evalResult = await evaluateWithAI(form);
    const approved = evalResult.verdict === "approve" && evalResult.score >= 60;
    const status = approved ? "approved" : "suspicious";

    // Insere application
    const { data: appRow, error: appErr } = await admin
      .from("api_key_applications")
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        full_name: form.full_name,
        company_or_project: form.company_or_project,
        project_url: form.project_url || null,
        use_case: form.use_case,
        estimated_volume: form.estimated_volume || null,
        category: form.category || null,
        status,
        ai_score: evalResult.score,
        ai_verdict: evalResult.verdict,
        ai_reasoning: evalResult.reasoning,
        ip_address: ip,
        user_agent: ua,
        reviewed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (appErr) {
      console.error("application insert error", appErr);
      return new Response(JSON.stringify({ error: "insert_failed", detail: appErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!approved) {
      // Marca tentativa suspeita no log de fraude
      await admin.from("fraud_attempts").insert({
        user_id: user.id,
        attempt_type: "api_key_application_suspicious",
        details: `score=${evalResult.score} reason=${evalResult.reasoning}`,
      });

      return new Response(
        JSON.stringify({
          status: "rejected",
          message:
            "Não conseguimos aprovar sua solicitação automaticamente. Se você é um dev legítimo, revise as informações e tente novamente em 24h com mais detalhes reais sobre seu projeto.",
          ai_reasoning: evalResult.reasoning,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Aprovado: gera a chave
    const { key, prefix } = generateApiKey();
    const { error: insertErr } = await admin.from("api_clients").insert({
      user_id: user.id,
      plan_id: plan.id,
      name: `Chave ${plan.name} — ${form.company_or_project}`.slice(0, 100),
      api_key: key,
      api_key_prefix: prefix,
      status: "active",
    });
    if (insertErr) {
      console.error("api_clients insert error", insertErr);
      return new Response(JSON.stringify({ error: "key_insert_failed", detail: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        status: "approved",
        api_key: key,
        ai_score: evalResult.score,
        ai_reasoning: evalResult.reasoning,
        application_id: appRow.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("apply-api-key error", e);
    return new Response(JSON.stringify({ error: "internal", detail: e?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
