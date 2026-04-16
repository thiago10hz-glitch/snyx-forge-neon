import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check - must be admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await createClient(supabaseUrl, anonKey).auth.getUser(token);
    if (!user) throw new Error("Não autorizado");

    const { data: roleData } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").single();
    if (!roleData) throw new Error("Acesso restrito ao Dono");

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) throw new Error("Mensagens inválidas");

    // Gather current platform context
    const now = new Date().toISOString();
    const [
      { count: totalUsers },
      { data: expiredVip },
      { data: expiredDev },
      { data: expiredPack },
      { data: expiredRpg },
      { count: openTickets },
      { data: expiredKeys },
      { count: totalMessages },
      { count: totalSites },
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("user_id, display_name").eq("is_vip", true).lt("vip_expires_at", now).not("vip_expires_at", "is", null),
      supabase.from("profiles").select("user_id, display_name").eq("is_dev", true).lt("dev_expires_at", now).not("dev_expires_at", "is", null),
      supabase.from("profiles").select("user_id, display_name").eq("is_pack_steam", true).lt("pack_steam_expires_at", now).not("pack_steam_expires_at", "is", null),
      supabase.from("profiles").select("user_id, display_name").eq("is_rpg_premium", true).lt("rpg_premium_expires_at", now).not("rpg_premium_expires_at", "is", null),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("accelerator_keys").select("id, activation_key").eq("status", "active").lt("expires_at", now).not("expires_at", "is", null),
      supabase.from("chat_messages").select("id", { count: "exact", head: true }),
      supabase.from("hosted_sites").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);

    const problems: string[] = [];
    if (expiredVip?.length) problems.push(`${expiredVip.length} VIP(s) expirado(s): ${expiredVip.map(u => u.display_name || u.user_id).join(", ")}`);
    if (expiredDev?.length) problems.push(`${expiredDev.length} DEV(s) expirado(s): ${expiredDev.map(u => u.display_name || u.user_id).join(", ")}`);
    if (expiredPack?.length) problems.push(`${expiredPack.length} Pack Steam expirado(s)`);
    if (expiredRpg?.length) problems.push(`${expiredRpg.length} RPG Premium expirado(s)`);
    if (expiredKeys?.length) problems.push(`${expiredKeys.length} chave(s) Accelerator expirada(s)`);

    const systemPrompt = `Você é o SnyX Admin AI — o assistente inteligente do painel do Dono da plataforma SnyX.

CONTEXTO ATUAL DA PLATAFORMA:
- Total de usuários: ${totalUsers || 0}
- Mensagens totais: ${totalMessages || 0}
- Sites hospedados ativos: ${totalSites || 0}
- Tickets abertos: ${openTickets || 0}
- Problemas detectados: ${problems.length > 0 ? problems.join(" | ") : "Nenhum problema encontrado"}

SUAS CAPACIDADES:
Você pode executar ações no banco de dados usando COMANDOS ESPECIAIS. Quando o usuário pedir para corrigir algo, inclua o comando na sua resposta.

COMANDOS DISPONÍVEIS (inclua exatamente como mostrado):
- [CMD:FIX_EXPIRED_VIP] — Desativa VIPs expirados
- [CMD:FIX_EXPIRED_DEV] — Desativa DEVs expirados
- [CMD:FIX_EXPIRED_PACK] — Desativa Pack Steam expirados
- [CMD:FIX_EXPIRED_RPG] — Desativa RPG Premium expirados
- [CMD:FIX_EXPIRED_KEYS] — Revoga chaves Accelerator expiradas
- [CMD:CLOSE_OLD_TICKETS] — Fecha tickets abertos há mais de 14 dias
- [CMD:FIX_ALL] — Executa TODAS as correções acima

REGRAS:
1. Responda SEMPRE em português BR
2. Seja direto, técnico e objetivo
3. Quando o usuário pedir para corrigir algo, execute o comando E explique o que foi feito
4. Se não houver problemas, diga que está tudo OK
5. Use markdown para formatar respostas
6. Nunca invente dados — use apenas o contexto fornecido
7. Você NÃO pode editar código-fonte, apenas dados do banco de dados`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    // Call AI with streaming
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit atingido. Aguarde um momento." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("Erro na IA");
    }

    // We need to intercept the stream to detect commands and execute them
    // But for simplicity, we'll stream directly and handle commands client-side
    // Actually, let's collect the full response, execute commands, then stream back

    // Collect full AI response to check for commands
    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nlIdx: number;
      while ((nlIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nlIdx);
        buffer = buffer.slice(nlIdx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) fullContent += content;
        } catch { /* skip */ }
      }
    }

    // Execute any commands found in the response
    const executedActions: string[] = [];

    const executeCmd = async (cmd: string) => {
      switch (cmd) {
        case "FIX_EXPIRED_VIP": {
          const { count } = await supabase.from("profiles")
            .update({ is_vip: false })
            .eq("is_vip", true).lt("vip_expires_at", now).not("vip_expires_at", "is", null)
            .select("user_id", { count: "exact" });
          if (count && count > 0) executedActions.push(`✅ ${count} VIP(s) expirados desativados`);
          else executedActions.push("ℹ️ Nenhum VIP expirado encontrado");
          break;
        }
        case "FIX_EXPIRED_DEV": {
          const { count } = await supabase.from("profiles")
            .update({ is_dev: false })
            .eq("is_dev", true).lt("dev_expires_at", now).not("dev_expires_at", "is", null)
            .select("user_id", { count: "exact" });
          if (count && count > 0) executedActions.push(`✅ ${count} DEV(s) expirados desativados`);
          else executedActions.push("ℹ️ Nenhum DEV expirado encontrado");
          break;
        }
        case "FIX_EXPIRED_PACK": {
          const { count } = await supabase.from("profiles")
            .update({ is_pack_steam: false })
            .eq("is_pack_steam", true).lt("pack_steam_expires_at", now).not("pack_steam_expires_at", "is", null)
            .select("user_id", { count: "exact" });
          if (count && count > 0) executedActions.push(`✅ ${count} Pack Steam expirado(s) desativados`);
          else executedActions.push("ℹ️ Nenhum Pack Steam expirado encontrado");
          break;
        }
        case "FIX_EXPIRED_RPG": {
          const { count } = await supabase.from("profiles")
            .update({ is_rpg_premium: false })
            .eq("is_rpg_premium", true).lt("rpg_premium_expires_at", now).not("rpg_premium_expires_at", "is", null)
            .select("user_id", { count: "exact" });
          if (count && count > 0) executedActions.push(`✅ ${count} RPG Premium expirado(s) desativados`);
          else executedActions.push("ℹ️ Nenhum RPG Premium expirado encontrado");
          break;
        }
        case "FIX_EXPIRED_KEYS": {
          const { count } = await supabase.from("accelerator_keys")
            .update({ status: "expired" })
            .eq("status", "active").lt("expires_at", now).not("expires_at", "is", null)
            .select("id", { count: "exact" });
          if (count && count > 0) executedActions.push(`✅ ${count} chave(s) expirada(s) revogadas`);
          else executedActions.push("ℹ️ Nenhuma chave expirada encontrada");
          break;
        }
        case "CLOSE_OLD_TICKETS": {
          const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
          const { count } = await supabase.from("support_tickets")
            .update({ status: "closed" })
            .eq("status", "open").lt("created_at", twoWeeksAgo)
            .select("id", { count: "exact" });
          if (count && count > 0) executedActions.push(`✅ ${count} ticket(s) antigos fechados`);
          else executedActions.push("ℹ️ Nenhum ticket antigo encontrado");
          break;
        }
        case "FIX_ALL": {
          await executeCmd("FIX_EXPIRED_VIP");
          await executeCmd("FIX_EXPIRED_DEV");
          await executeCmd("FIX_EXPIRED_PACK");
          await executeCmd("FIX_EXPIRED_RPG");
          await executeCmd("FIX_EXPIRED_KEYS");
          await executeCmd("CLOSE_OLD_TICKETS");
          break;
        }
      }
    };

    // Find and execute commands
    const cmdRegex = /\[CMD:([A-Z_]+)\]/g;
    let match;
    while ((match = cmdRegex.exec(fullContent)) !== null) {
      await executeCmd(match[1]);
    }

    // Clean commands from the displayed message
    let cleanContent = fullContent.replace(/\[CMD:[A-Z_]+\]/g, "").trim();

    // Append execution results if any
    if (executedActions.length > 0) {
      cleanContent += "\n\n---\n**Ações Executadas:**\n" + executedActions.join("\n");
    }

    return new Response(JSON.stringify({ content: cleanContent, actions: executedActions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("owner-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});