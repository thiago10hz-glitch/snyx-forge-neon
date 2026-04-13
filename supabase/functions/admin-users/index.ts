import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey;

    // Client with user's token to check admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    // Check if user is admin
    const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Não autorizado - apenas admins");

    // Service role client for privileged operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { action, target_user_id, vip_months, ban_hours } = await req.json();

    let result: Record<string, unknown> = {};

    switch (action) {
      case "grant_vip": {
        const months = vip_months || 1;
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + months);
        const { error } = await adminClient
          .from("profiles")
          .update({ is_vip: true, vip_expires_at: expiresAt.toISOString() })
          .eq("user_id", target_user_id);
        if (error) throw error;
        result = { success: true, vip_expires_at: expiresAt.toISOString() };
        break;
      }

      case "revoke_vip": {
        const { error } = await adminClient
          .from("profiles")
          .update({ is_vip: false, vip_expires_at: null })
          .eq("user_id", target_user_id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "grant_dev": {
        const months = vip_months || 1;
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + months);
        const { error } = await adminClient
          .from("profiles")
          .update({ is_dev: true, dev_expires_at: expiresAt.toISOString() })
          .eq("user_id", target_user_id);
        if (error) throw error;
        result = { success: true, dev_expires_at: expiresAt.toISOString() };
        break;
      }

      case "revoke_dev": {
        const { error } = await adminClient
          .from("profiles")
          .update({ is_dev: false, dev_expires_at: null })
          .eq("user_id", target_user_id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "ban": {
        const hours = ban_hours || 24;
        const bannedUntil = new Date();
        bannedUntil.setHours(bannedUntil.getHours() + hours);
        const { error } = await adminClient
          .from("profiles")
          .update({ banned_until: bannedUntil.toISOString() })
          .eq("user_id", target_user_id);
        if (error) throw error;
        result = { success: true, banned_until: bannedUntil.toISOString() };
        break;
      }

      case "unban": {
        const { error } = await adminClient
          .from("profiles")
          .update({ banned_until: null })
          .eq("user_id", target_user_id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "delete": {
        // Delete user from auth (cascades to profiles)
        const { error } = await adminClient.auth.admin.deleteUser(target_user_id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
