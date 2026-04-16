import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json({ error: "Configuração de autenticação incompleta." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const rawPassword = typeof body?.password === "string" ? body.password : "";
    const machineId = typeof body?.machine_id === "string" ? body.machine_id.trim() : "";
    const displayName = typeof body?.display_name === "string" && body.display_name.trim()
      ? body.display_name.trim()
      : `device-${machineId || rawEmail.split("@")[0].replace(/^device-/, "")}`;

    if (!rawEmail || !rawPassword) {
      return json({ error: "E-mail e senha do dispositivo são obrigatórios." }, 400);
    }

    if (!rawEmail.endsWith("@snyx-optimizer.local")) {
      return json({ error: "Conta do dispositivo inválida." }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const publicClient = createClient(supabaseUrl, anonKey);

    const { data: existingUserId, error: lookupError } = await adminClient.rpc("find_user_by_email", {
      p_email: rawEmail,
    });

    if (lookupError) {
      console.error("optimizer-device-auth lookup failed:", lookupError);
      return json({ error: "Não foi possível validar a conta do dispositivo." }, 500);
    }

    const userMetadata = {
      full_name: displayName,
      optimizer_device: true,
      machine_id: machineId || null,
    };

    if (existingUserId) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUserId, {
        password: rawPassword,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (updateError) {
        console.error("optimizer-device-auth update failed:", updateError);
        return json({ error: updateError.message }, 400);
      }
    } else {
      const { error: createError } = await adminClient.auth.admin.createUser({
        email: rawEmail,
        password: rawPassword,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (createError) {
        console.error("optimizer-device-auth create failed:", createError);
        return json({ error: createError.message }, 400);
      }
    }

    const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({
      email: rawEmail,
      password: rawPassword,
    });

    if (signInError || !signInData.session) {
      console.error("optimizer-device-auth sign-in failed:", signInError);
      return json({ error: signInError?.message || "Não foi possível iniciar a sessão do dispositivo." }, 400);
    }

    return json({
      success: true,
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      user: signInData.user,
    });
  } catch (error) {
    console.error("optimizer-device-auth error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});