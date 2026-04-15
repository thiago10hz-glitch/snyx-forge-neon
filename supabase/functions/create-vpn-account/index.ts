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

function generateIMEI(): string {
  let imei = "";
  for (let i = 0; i < 15; i++) imei += Math.floor(Math.random() * 10).toString();
  return imei;
}

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = 5000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function generateWgKeys(vpnApiUrl: string, vpnApiToken: string) {
  try {
    const res = await fetchWithTimeout(`${vpnApiUrl}/generate-keys`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vpnApiToken}`, "Content-Type": "application/json" },
    });
    if (res.ok) return await res.json() as { private_key: string; public_key: string };
  } catch (e) {
    console.error("WG key gen failed:", e);
  }
  return null;
}

async function addPeerToServer(vpnApiUrl: string, vpnApiToken: string, publicKey: string, allowedIp: string) {
  try {
    const res = await fetchWithTimeout(`${vpnApiUrl}/add-peer`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vpnApiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: publicKey, allowed_ip: allowedIp }),
    });
    if (res.ok) return true;
    console.error("Add peer failed:", await res.text());
  } catch (e) {
    console.error("Add peer error:", e);
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const WG_SERVER_PUBLIC_KEY = Deno.env.get("WG_SERVER_PUBLIC_KEY") || "";
    const WG_SERVER_IP = Deno.env.get("WG_SERVER_IP") || "";
    const VPN_API_URL = Deno.env.get("VPN_API_URL") || "";
    const VPN_API_TOKEN = Deno.env.get("VPN_API_TOKEN") || "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Parse body and auth in parallel
    const [bodyData, { data: { user: caller } }] = await Promise.all([
      req.json(),
      callerClient.auth.getUser(),
    ]);

    if (!caller) return json({ error: "Não autorizado" }, 401);

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) return json({ error: "Apenas admins podem criar contas" }, 403);

    const { password, display_name, expires_months } = bodyData;
    if (!password || password.length < 6) return json({ error: "Senha deve ter no mínimo 6 caracteres" }, 400);
    if (!WG_SERVER_PUBLIC_KEY || !WG_SERVER_IP) return json({ error: "Servidor VPN não configurado." }, 500);

    // Create user account
    const imei = generateIMEI();
    const loginEmail = `${imei}@vpn.snyx`;
    const name = display_name || `VPN-${imei.slice(0, 9)}`;

    let userId: string;
    let finalImei = imei;
    let finalEmail = loginEmail;

    const createVpnUser = async (email: string, imeiValue: string, label: string) => {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: label, vpn_imei: imeiValue },
      });
      return { data, error };
    };

    const { data: newUser, error: createError } = await createVpnUser(loginEmail, imei, name);

    if (createError) {
      if (!createError.message.includes("already been registered")) {
        return json({ error: createError.message }, 400);
      }

      finalImei = generateIMEI();
      finalEmail = `${finalImei}@vpn.snyx`;
      const retryName = display_name || `VPN-${finalImei.slice(0, 9)}`;
      const { data: retryUser, error: retryError } = await createVpnUser(finalEmail, finalImei, retryName);
      if (retryError) return json({ error: retryError.message }, 400);
      userId = retryUser!.user.id;
    } else {
      userId = newUser!.user.id;
    }

    // Generate key string
    const keyPart1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const keyPart2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const keyPart3 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const activationKey = `SNYX-ACC-${keyPart1}-${keyPart2}-${keyPart3}`;
    const expiresAt = expires_months
      ? new Date(Date.now() + expires_months * 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Run key insert, WG key generation, and peer count ALL in parallel
    const [keyInsertResult, wgKeys, peerCountResult] = await Promise.all([
      adminClient.from("accelerator_keys").insert({
        activation_key: activationKey,
        created_by: caller.id,
        status: "active",
        activated_by: userId,
        activated_at: new Date().toISOString(),
        expires_at: expiresAt,
        linked_imei: finalImei,
      }).select("id").single(),
      VPN_API_URL && VPN_API_TOKEN ? generateWgKeys(VPN_API_URL, VPN_API_TOKEN) : Promise.resolve(null),
      adminClient.from("vpn_peers").select("*", { count: "exact", head: true }),
    ]);

    const keyId = keyInsertResult.data?.id || null;
    const peerNumber = ((peerCountResult.count || 0) + 2);
    const assignedIp = `10.0.0.${peerNumber}`;

    let peerPrivateKey: string;
    let peerPublicKey: string;
    let serverRegistered = false;

    if (wgKeys) {
      peerPrivateKey = wgKeys.private_key;
      peerPublicKey = wgKeys.public_key;

      const peerInsertPromise = adminClient.from("vpn_peers").insert({
        user_id: userId,
        peer_private_key: peerPrivateKey,
        peer_public_key: peerPublicKey,
        assigned_ip: assignedIp,
        activated_with_key: keyId,
      });

      const peerRegisterPromise = addPeerToServer(VPN_API_URL, VPN_API_TOKEN, peerPublicKey, assignedIp)
        .catch((error) => {
          console.error("Peer registration failed:", error);
          return false;
        });

      const [, registered] = await Promise.all([peerInsertPromise, peerRegisterPromise]);
      serverRegistered = registered;
    } else {
      // Fallback: random keys
      const bytes1 = new Uint8Array(32);
      crypto.getRandomValues(bytes1);
      peerPrivateKey = btoa(String.fromCharCode(...bytes1));
      const bytes2 = new Uint8Array(32);
      crypto.getRandomValues(bytes2);
      peerPublicKey = btoa(String.fromCharCode(...bytes2));

      await adminClient.from("vpn_peers").insert({
        user_id: userId,
        peer_private_key: peerPrivateKey,
        peer_public_key: peerPublicKey,
        assigned_ip: assignedIp,
        activated_with_key: keyId,
      });
    }

    const wgConfig = `[Interface]
PrivateKey = ${peerPrivateKey}
Address = ${assignedIp}/24
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${WG_SERVER_PUBLIC_KEY}
Endpoint = ${WG_SERVER_IP}:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`;

    return json({
      success: true,
      server_registered: serverRegistered,
      account: {
        imei: finalImei,
        login_email: finalEmail,
        password,
        user_id: userId,
        activation_key: activationKey,
        expires_at: expiresAt,
        display_name: display_name || `VPN-${finalImei.slice(0, 9)}`,
        assigned_ip: assignedIp,
        wg_config: wgConfig,
      },
    });
  } catch (error) {
    console.error("create-vpn-account error:", error);
    return json({ error: error.message }, 500);
  }
});
