import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateIMEI(): string {
  // Generate a simple numeric IMEI-like identifier (15 digits)
  let imei = "";
  for (let i = 0; i < 15; i++) {
    imei += Math.floor(Math.random() * 10).toString();
  }
  return imei;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas admins podem criar contas" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { password, display_name, expires_months } = await req.json();

    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate unique IMEI
    const imei = generateIMEI();
    // Use IMEI as fake email for auth
    const fakeEmail = `${imei.replace(/-/g, "").toLowerCase()}@vpn.snyx`;

    // Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: fakeEmail,
      password,
      email_confirm: true,
      user_metadata: { 
        full_name: display_name || `VPN-${imei.slice(0, 9)}`,
        vpn_imei: imei,
      },
    });

    if (createError) {
      // If collision (extremely unlikely), retry once
      if (createError.message.includes("already been registered")) {
        const imei2 = generateIMEI();
        const fakeEmail2 = `${imei2.replace(/-/g, "").toLowerCase()}@vpn.snyx`;
        const { data: retryUser, error: retryError } = await adminClient.auth.admin.createUser({
          email: fakeEmail2,
          password,
          email_confirm: true,
          user_metadata: { 
            full_name: display_name || `VPN-${imei2.slice(0, 9)}`,
            vpn_imei: imei2,
          },
        });
        if (retryError) {
          return new Response(JSON.stringify({ error: retryError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Use retried values
        return buildResponse(adminClient, caller.id, imei2, password, display_name, expires_months, retryUser!.user.id);
      }
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return buildResponse(adminClient, caller.id, imei, password, display_name, expires_months, newUser!.user.id);
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function buildResponse(
  adminClient: any,
  callerId: string,
  imei: string,
  password: string,
  displayName: string | undefined,
  expiresMonths: number | null,
  userId: string,
) {
  // Generate activation key
  const keyPart1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const keyPart2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const keyPart3 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const activationKey = `SNYX-ACC-${keyPart1}-${keyPart2}-${keyPart3}`;

  const expiresAt = expiresMonths
    ? new Date(Date.now() + expiresMonths * 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Insert key as available - user will activate it themselves
  await adminClient.from("accelerator_keys").insert({
    activation_key: activationKey,
    created_by: callerId,
    status: "available",
    expires_at: expiresAt,
    linked_imei: imei,
  });

  const name = displayName || `VPN-${imei.slice(0, 9)}`;

  return new Response(
    JSON.stringify({
      success: true,
      account: {
        imei,
        password,
        user_id: userId,
        activation_key: activationKey,
        expires_at: expiresAt,
        display_name: name,
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
