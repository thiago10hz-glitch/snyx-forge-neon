import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-snyx-integrity, x-snyx-timestamp, x-snyx-fingerprint",
};

function getIntegritySecret(): string {
  return Deno.env.get("SNYX_INTEGRITY_SECRET") || "SNYX-FALLBACK-SEC";
}

// HMAC-SHA256 integrity check
async function generateHMAC(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// AES-GCM encryption for download tokens
async function encryptToken(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(secret.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" }, false, ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, keyMaterial, encoder.encode(data)
  );
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return base64Encode(combined);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const INTEGRITY_SECRET = getIntegritySecret();

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "SnyX-SEC: Acesso negado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "SnyX-SEC: Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, release_id, file_path } = body;

    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const integrityHeader = req.headers.get("x-snyx-integrity") || "";
    const timestampHeader = req.headers.get("x-snyx-timestamp") || "";
    const fingerprintHeader = req.headers.get("x-snyx-fingerprint") || "";

    // ===== SECURITY CHECKS =====

    // 1. Ban check
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("banned_until, is_pack_steam")
      .eq("user_id", user.id)
      .single();

    if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
      await logAudit(supabaseAdmin, user.id, "blocked_banned_user", file_path, clientIP, userAgent, "error");
      return new Response(JSON.stringify({ error: "SnyX-SEC: Conta suspensa permanentemente" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Pack Steam check
    if (!profile?.is_pack_steam) {
      await logAudit(supabaseAdmin, user.id, "unauthorized_access_attempt", file_path, clientIP, userAgent, "warn");
      const { count } = await supabaseAdmin
        .from("security_audit_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("event_type", "unauthorized_access_attempt")
        .gte("created_at", new Date(Date.now() - 3600000).toISOString());

      if ((count || 0) >= 5) {
        await supabaseAdmin.rpc("handle_security_violation", {
          p_user_id: user.id,
          p_reason: "repeated_unauthorized_access_attempts"
        });
        return new Response(JSON.stringify({ error: "SnyX-SEC: Violação detectada. Conta bloqueada." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "SnyX-SEC: Acesso Pack Steam necessário" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Integrity headers check
    if (!integrityHeader || !timestampHeader) {
      await logAudit(supabaseAdmin, user.id, "missing_integrity_headers", file_path, clientIP, userAgent, "warn");
      const { count } = await supabaseAdmin
        .from("security_audit_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("event_type", ["missing_integrity_headers", "invalid_integrity", "replay_attack"])
        .gte("created_at", new Date(Date.now() - 3600000).toISOString());

      if ((count || 0) >= 3) {
        await supabaseAdmin.rpc("handle_security_violation", {
          p_user_id: user.id,
          p_reason: "integrity_tampering"
        });
        return new Response(JSON.stringify({ error: "SnyX-SEC: Tamper detectado. Conta e arquivos removidos." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "SnyX-SEC: Integridade comprometida" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Replay protection (5 min window)
    const timestamp = parseInt(timestampHeader);
    const now = Date.now();
    if (isNaN(timestamp) || Math.abs(now - timestamp) > 300000) {
      await logAudit(supabaseAdmin, user.id, "replay_attack", file_path, clientIP, userAgent, "error");
      return new Response(JSON.stringify({ error: "SnyX-SEC: Requisição expirada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Signature verification
    const expectedSig = await generateHMAC(`${user.id}:${timestampHeader}:${file_path}`, INTEGRITY_SECRET);
    if (integrityHeader !== expectedSig) {
      await logAudit(supabaseAdmin, user.id, "invalid_integrity", file_path, clientIP, userAgent, "error");
      return new Response(JSON.stringify({ error: "SnyX-SEC: Assinatura inválida" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Rate limit
    const { count: dlCount } = await supabaseAdmin
      .from("security_audit_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", "download_success")
      .gte("created_at", new Date(Date.now() - 3600000).toISOString());

    if ((dlCount || 0) >= 10) {
      await logAudit(supabaseAdmin, user.id, "rate_limit_exceeded", file_path, clientIP, userAgent, "warn");
      return new Response(JSON.stringify({ error: "SnyX-SEC: Limite de downloads atingido." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== ACTIONS =====

    if (action === "get_secure_url") {
      const ext = file_path.split('.').pop() || "exe";
      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from("app-downloads")
        .createSignedUrl(file_path, 30, {
          download: `SnyX-Optimizer-v7.${ext}`,
        });

      if (signedError) {
        await logAudit(supabaseAdmin, user.id, "download_error", file_path, clientIP, userAgent, "error", {
          error: signedError.message,
        });
        throw signedError;
      }

      await logAudit(supabaseAdmin, user.id, "download_success", file_path, clientIP, userAgent, "info", {
        release_id, fingerprint: fingerprintHeader, ip: clientIP,
      });

      // Encrypt the download URL with AES-GCM before sending
      const encryptedUrl = await encryptToken(
        JSON.stringify({ url: signedData.signedUrl, ts: now, uid: user.id }),
        INTEGRITY_SECRET
      );

      const responseChecksum = await generateHMAC(signedData.signedUrl, INTEGRITY_SECRET);

      return new Response(JSON.stringify({
        url: signedData.signedUrl,
        encrypted_token: encryptedUrl,
        token: await generateHMAC(`${user.id}:${now}:success`, INTEGRITY_SECRET),
        expires_in: 30,
        checksum: responseChecksum,
        security: {
          encryption: "AES-256-GCM",
          integrity: "HMAC-SHA256",
          anti_replay: true,
          anti_tamper: true,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify_integrity") {
      const expectedCheck = await generateHMAC(`${user.id}:snyx:integrity`, INTEGRITY_SECRET);
      const encryptedSession = await encryptToken(
        JSON.stringify({ uid: user.id, verified: true, ts: now }),
        INTEGRITY_SECRET
      );
      return new Response(JSON.stringify({
        valid: true,
        check: expectedCheck,
        session_token: encryptedSession,
        ts: now,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("secure-download error:", err);
    return new Response(JSON.stringify({ error: "Erro interno de segurança" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function logAudit(
  supabase: any, userId: string, eventType: string, resource: string | null,
  ip: string, userAgent: string, severity: string, details: any = {}
) {
  await supabase.from("security_audit_log").insert({
    user_id: userId,
    event_type: eventType,
    resource: resource,
    ip_address: ip,
    user_agent: userAgent,
    severity: severity,
    details: details,
  });
}
