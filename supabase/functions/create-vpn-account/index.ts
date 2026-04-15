import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateIMEI(): string {
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

    const WG_SERVER_PUBLIC_KEY = Deno.env.get("WG_SERVER_PUBLIC_KEY") || "";
    const WG_SERVER_PRIVATE_KEY = Deno.env.get("WG_SERVER_PRIVATE_KEY") || "";
    const WG_SERVER_IP = Deno.env.get("WG_SERVER_IP") || "";

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

    // Ensure server config exists
    if (!WG_SERVER_PUBLIC_KEY || !WG_SERVER_IP) {
      return new Response(JSON.stringify({ error: "Servidor VPN não configurado. Configure WG_SERVER_PUBLIC_KEY e WG_SERVER_IP nos secrets." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync server config to DB
    const { data: existingConfig } = await adminClient.from("vpn_server_config").select("id").limit(1).single();
    if (existingConfig) {
      await adminClient.from("vpn_server_config").update({
        server_ip: WG_SERVER_IP,
        server_public_key: WG_SERVER_PUBLIC_KEY,
        server_private_key: WG_SERVER_PRIVATE_KEY,
        listen_port: 51820,
        is_setup: true,
      }).eq("id", existingConfig.id);
    } else {
      await adminClient.from("vpn_server_config").insert({
        server_ip: WG_SERVER_IP,
        server_public_key: WG_SERVER_PUBLIC_KEY,
        server_private_key: WG_SERVER_PRIVATE_KEY,
        listen_port: 51820,
        is_setup: true,
      });
    }

    const imei = generateIMEI();
    const loginEmail = `${imei}@vpn.snyx`;

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: display_name || `VPN-${imei.slice(0, 9)}`,
        vpn_imei: imei,
      },
    });

    if (createError) {
      if (createError.message.includes("already been registered")) {
        const imei2 = generateIMEI();
        const loginEmail2 = `${imei2}@vpn.snyx`;
        const { data: retryUser, error: retryError } = await adminClient.auth.admin.createUser({
          email: loginEmail2,
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

        return buildResponse(adminClient, caller.id, imei2, password, display_name, expires_months, retryUser!.user.id, WG_SERVER_PUBLIC_KEY, WG_SERVER_IP);
      }

      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return buildResponse(adminClient, caller.id, imei, password, display_name, expires_months, newUser!.user.id, WG_SERVER_PUBLIC_KEY, WG_SERVER_IP);
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
  serverPublicKey: string,
  serverIp: string,
) {
  const keyPart1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const keyPart2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const keyPart3 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const activationKey = `SNYX-ACC-${keyPart1}-${keyPart2}-${keyPart3}`;

  const expiresAt = expiresMonths
    ? new Date(Date.now() + expiresMonths * 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Insert activation key
  const { data: keyRow } = await adminClient.from("accelerator_keys").insert({
    activation_key: activationKey,
    created_by: callerId,
    status: "active",
    activated_by: userId,
    activated_at: new Date().toISOString(),
    expires_at: expiresAt,
    linked_imei: imei,
  }).select("id").single();

  // Generate WireGuard peer keys
  const peerKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(peerKeyBytes);
  const peerPrivateKey = btoa(String.fromCharCode(...peerKeyBytes));

  const peerPubBytes = new Uint8Array(32);
  crypto.getRandomValues(peerPubBytes);
  const peerPublicKey = btoa(String.fromCharCode(...peerPubBytes));

  // Count existing peers to assign next IP
  const { count } = await adminClient
    .from("vpn_peers")
    .select("*", { count: "exact", head: true });

  const peerNumber = (count || 0) + 2; // Start from 10.0.0.2
  const assignedIp = `10.0.0.${peerNumber}`;

  // Create VPN peer
  await adminClient.from("vpn_peers").insert({
    user_id: userId,
    peer_private_key: peerPrivateKey,
    peer_public_key: peerPublicKey,
    assigned_ip: assignedIp,
    activated_with_key: keyRow?.id || null,
  });

  // Generate WireGuard config for the client
  const wgConfig = `[Interface]
PrivateKey = ${peerPrivateKey}
Address = ${assignedIp}/24
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${serverIp}:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`;

  const name = displayName || `VPN-${imei.slice(0, 9)}`;
  const loginEmail = `${imei}@vpn.snyx`;

  return new Response(
    JSON.stringify({
      success: true,
      account: {
        imei,
        login_email: loginEmail,
        password,
        user_id: userId,
        activation_key: activationKey,
        expires_at: expiresAt,
        display_name: name,
        assigned_ip: assignedIp,
        wg_config: wgConfig,
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
