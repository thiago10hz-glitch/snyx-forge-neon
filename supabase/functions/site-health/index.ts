import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { freeAIChat } from "../_shared/free-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (!user) throw new Error("Não autorizado");
    
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").single();
    if (!roleData) throw new Error("Não autorizado");

    const { action } = await req.json();

    if (action === "scan") {
      const issues: any[] = [];
      const fixes: any[] = [];

      // 1. Check expired VIP/DEV/Pack Steam users still marked active
      const { data: expiredVip } = await supabase.from("profiles")
        .select("user_id, display_name, vip_expires_at")
        .eq("is_vip", true)
        .lt("vip_expires_at", new Date().toISOString())
        .not("vip_expires_at", "is", null);
      
      if (expiredVip && expiredVip.length > 0) {
        issues.push({ type: "expired_vip", severity: "high", count: expiredVip.length, message: `${expiredVip.length} usuário(s) VIP expirados ainda marcados como ativos`, users: expiredVip.map(u => u.display_name || u.user_id) });
      }

      const { data: expiredDev } = await supabase.from("profiles")
        .select("user_id, display_name, dev_expires_at")
        .eq("is_dev", true)
        .lt("dev_expires_at", new Date().toISOString())
        .not("dev_expires_at", "is", null);

      if (expiredDev && expiredDev.length > 0) {
        issues.push({ type: "expired_dev", severity: "high", count: expiredDev.length, message: `${expiredDev.length} usuário(s) DEV expirados ainda marcados como ativos`, users: expiredDev.map(u => u.display_name || u.user_id) });
      }

      const { data: expiredPack } = await supabase.from("profiles")
        .select("user_id, display_name, pack_steam_expires_at")
        .eq("is_pack_steam", true)
        .lt("pack_steam_expires_at", new Date().toISOString())
        .not("pack_steam_expires_at", "is", null);

      if (expiredPack && expiredPack.length > 0) {
        issues.push({ type: "expired_pack", severity: "high", count: expiredPack.length, message: `${expiredPack.length} usuário(s) Pack Steam expirados`, users: expiredPack.map(u => u.display_name || u.user_id) });
      }

      const { data: expiredRpg } = await supabase.from("profiles")
        .select("user_id, display_name, rpg_premium_expires_at")
        .eq("is_rpg_premium", true)
        .lt("rpg_premium_expires_at", new Date().toISOString())
        .not("rpg_premium_expires_at", "is", null);

      if (expiredRpg && expiredRpg.length > 0) {
        issues.push({ type: "expired_rpg", severity: "high", count: expiredRpg.length, message: `${expiredRpg.length} usuário(s) RPG Premium expirados`, users: expiredRpg.map(u => u.display_name || u.user_id) });
      }

      // 2. Check expired accelerator keys still active
      const { data: expiredKeys } = await supabase.from("accelerator_keys")
        .select("id, activation_key, expires_at")
        .eq("status", "active")
        .lt("expires_at", new Date().toISOString())
        .not("expires_at", "is", null);

      if (expiredKeys && expiredKeys.length > 0) {
        issues.push({ type: "expired_keys", severity: "high", count: expiredKeys.length, message: `${expiredKeys.length} chave(s) Accelerator expiradas mas ainda ativas` });
      }

      // 3. Check profiles without display_name
      const { data: noName, count: noNameCount } = await supabase.from("profiles")
        .select("user_id", { count: "exact" })
        .is("display_name", null);

      if (noNameCount && noNameCount > 0) {
        issues.push({ type: "missing_names", severity: "low", count: noNameCount, message: `${noNameCount} perfil(s) sem nome de exibição` });
      }

      // 5. Check stale support tickets (open for > 7 days)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: staleTickets, count: staleCount } = await supabase.from("support_tickets")
        .select("id, subject", { count: "exact" })
        .eq("status", "open")
        .lt("created_at", weekAgo);

      if (staleCount && staleCount > 0) {
        issues.push({ type: "stale_tickets", severity: "medium", count: staleCount, message: `${staleCount} ticket(s) de suporte abertos há mais de 7 dias` });
      }

      // 6. Database size check
      const { count: totalProfiles } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      const { count: totalMessages } = await supabase.from("chat_messages").select("id", { count: "exact", head: true });
      const { count: totalConvos } = await supabase.from("chat_conversations").select("id", { count: "exact", head: true });

      // Use AI to analyze
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      let aiAnalysis = "";
      
      if (LOVABLE_API_KEY && issues.length > 0) {
        try {
          const aiRes = await freeAIChat("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: "Você é um assistente de manutenção do SnyX. Analise os problemas encontrados e dê um resumo em português BR. Seja direto e técnico. Máximo 3 frases." },
                { role: "user", content: `Problemas encontrados no site:\n${JSON.stringify(issues, null, 2)}\n\nEstatísticas: ${totalProfiles} perfis, ${totalMessages} mensagens, ${totalConvos} conversas.` }
              ]
            })
          });
          const aiData = await aiRes.json();
          aiAnalysis = aiData.choices?.[0]?.message?.content || "";
        } catch { /* AI analysis optional */ }
      }

      return new Response(JSON.stringify({ 
        issues, 
        stats: { totalProfiles, totalMessages, totalConvos },
        aiAnalysis,
        scannedAt: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "autofix") {
      const fixed: string[] = [];

      // Fix 1: Deactivate expired VIPs
      const { data: fixedVip, count: vipCount } = await supabase.from("profiles")
        .update({ is_vip: false })
        .eq("is_vip", true)
        .lt("vip_expires_at", new Date().toISOString())
        .not("vip_expires_at", "is", null)
        .select("user_id", { count: "exact" });
      if (vipCount && vipCount > 0) fixed.push(`${vipCount} VIP(s) expirados desativados`);

      // Fix 2: Deactivate expired DEVs
      const { count: devCount } = await supabase.from("profiles")
        .update({ is_dev: false })
        .eq("is_dev", true)
        .lt("dev_expires_at", new Date().toISOString())
        .not("dev_expires_at", "is", null)
        .select("user_id", { count: "exact" });
      if (devCount && devCount > 0) fixed.push(`${devCount} DEV(s) expirados desativados`);

      // Fix 3: Deactivate expired Pack Steam
      const { count: packCount } = await supabase.from("profiles")
        .update({ is_pack_steam: false })
        .eq("is_pack_steam", true)
        .lt("pack_steam_expires_at", new Date().toISOString())
        .not("pack_steam_expires_at", "is", null)
        .select("user_id", { count: "exact" });
      if (packCount && packCount > 0) fixed.push(`${packCount} Pack Steam expirado(s) desativados`);

      // Fix 4: Deactivate expired RPG Premium
      const { count: rpgCount } = await supabase.from("profiles")
        .update({ is_rpg_premium: false })
        .eq("is_rpg_premium", true)
        .lt("rpg_premium_expires_at", new Date().toISOString())
        .not("rpg_premium_expires_at", "is", null)
        .select("user_id", { count: "exact" });
      if (rpgCount && rpgCount > 0) fixed.push(`${rpgCount} RPG Premium expirado(s) desativados`);

      // Fix 5: Revoke expired accelerator keys
      const { count: keyCount } = await supabase.from("accelerator_keys")
        .update({ status: "expired" })
        .eq("status", "active")
        .lt("expires_at", new Date().toISOString())
        .not("expires_at", "is", null)
        .select("id", { count: "exact" });
      if (keyCount && keyCount > 0) fixed.push(`${keyCount} chave(s) Accelerator expiradas revogadas`);

      // Fix 6: Close stale support tickets
      const weekAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { count: ticketCount } = await supabase.from("support_tickets")
        .update({ status: "closed" })
        .eq("status", "open")
        .lt("created_at", weekAgo)
        .select("id", { count: "exact" });
      if (ticketCount && ticketCount > 0) fixed.push(`${ticketCount} ticket(s) antigos fechados`);

      if (fixed.length === 0) fixed.push("Nenhum problema encontrado para corrigir!");

      return new Response(JSON.stringify({ fixed, fixedAt: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
