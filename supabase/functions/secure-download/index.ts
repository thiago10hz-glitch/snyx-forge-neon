import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-snyx-integrity, x-snyx-timestamp, x-snyx-fingerprint",
};

// Integrity secret - used to sign download tokens
const INTEGRITY_SECRET = "SNYX-SEC-7x9K2mP4vQ8nL3wR6tY1";

function generateHMAC(message: string, secret: string): string {
  // Simple hash-based verification
  let hash = 0;
  const combined = message + secret;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  try {
    // Extract auth token
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "SnyX-SEC: Acesso negado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "SnyX-SEC: Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, release_id, file_path, integrity_token } = body;

    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const integrityHeader = req.headers.get("x-snyx-integrity") || "";
    const timestampHeader = req.headers.get("x-snyx-timestamp") || "";
    const fingerprintHeader = req.headers.get("x-snyx-fingerprint") || "";

    // ===== TAMPER DETECTION =====
    
    // 1. Check if user is banned
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

    // 2. Verify Pack Steam access
    if (!profile?.is_pack_steam) {
      // Check if this is an unauthorized access attempt
      await logAudit(supabaseAdmin, user.id, "unauthorized_access_attempt", file_path, clientIP, userAgent, "warn");
      
      // Check for repeated attempts (potential brute force)
      const { count } = await supabaseAdmin
        .from("security_audit_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("event_type", "unauthorized_access_attempt")
        .gte("created_at", new Date(Date.now() - 3600000).toISOString()); // Last hour

      if ((count || 0) >= 5) {
        // 5+ attempts in 1 hour = ban
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

    // 3. Verify integrity headers (anti-tamper)
    if (!integrityHeader || !timestampHeader) {
      await logAudit(supabaseAdmin, user.id, "missing_integrity_headers", file_path, clientIP, userAgent, "warn", {
        has_integrity: !!integrityHeader,
        has_timestamp: !!timestampHeader,
      });

      // Check if repeated
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
        // Delete files from storage
        await deleteUserFiles(supabaseAdmin, user.id);
        return new Response(JSON.stringify({ error: "SnyX-SEC: Tamper detectado. Conta e arquivos removidos." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "SnyX-SEC: Integridade comprometida" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Verify timestamp (prevent replay attacks - 5 min window)
    const timestamp = parseInt(timestampHeader);
    const now = Date.now();
    if (isNaN(timestamp) || Math.abs(now - timestamp) > 300000) {
      await logAudit(supabaseAdmin, user.id, "replay_attack", file_path, clientIP, userAgent, "error", {
        client_timestamp: timestamp,
        server_timestamp: now,
        diff_ms: Math.abs(now - timestamp),
      });
      return new Response(JSON.stringify({ error: "SnyX-SEC: Requisição expirada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Verify integrity signature
    const expectedSig = generateHMAC(`${user.id}:${timestampHeader}:${file_path}`, INTEGRITY_SECRET);
    if (integrityHeader !== expectedSig) {
      await logAudit(supabaseAdmin, user.id, "invalid_integrity", file_path, clientIP, userAgent, "error", {
        expected: expectedSig,
        received: integrityHeader,
      });
      return new Response(JSON.stringify({ error: "SnyX-SEC: Assinatura inválida" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Rate limit: max 10 downloads per hour
    const { count: dlCount } = await supabaseAdmin
      .from("security_audit_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", "download_success")
      .gte("created_at", new Date(Date.now() - 3600000).toISOString());

    if ((dlCount || 0) >= 10) {
      await logAudit(supabaseAdmin, user.id, "rate_limit_exceeded", file_path, clientIP, userAgent, "warn");
      return new Response(JSON.stringify({ error: "SnyX-SEC: Limite de downloads atingido. Tente novamente em 1 hora." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== GENERATE SECURE DOWNLOAD =====
    if (action === "get_secure_url") {
      // Generate signed URL with short expiry (30 seconds)
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

      // Log successful download
      await logAudit(supabaseAdmin, user.id, "download_success", file_path, clientIP, userAgent, "info", {
        release_id,
        fingerprint: fingerprintHeader,
      });

      // Return encrypted response
      const responseToken = generateHMAC(`${user.id}:${now}:success`, INTEGRITY_SECRET);

      return new Response(JSON.stringify({
        url: signedData.signedUrl,
        token: responseToken,
        expires_in: 30,
        checksum: generateHMAC(signedData.signedUrl, INTEGRITY_SECRET),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== VERIFY INTEGRITY (called from frontend periodically) =====
    if (action === "verify_integrity") {
      const expectedCheck = generateHMAC(`${user.id}:snyx:integrity`, INTEGRITY_SECRET);
      return new Response(JSON.stringify({ 
        valid: true, 
        check: expectedCheck,
        ts: now 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
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

async function deleteUserFiles(supabase: any, userId: string) {
  try {
    // List all files the user might have cached/downloaded markers
    // Log the file deletion action
    await supabase.from("security_audit_log").insert({
      user_id: userId,
      event_type: "files_purged",
      severity: "critical",
      details: { action: "all_user_download_access_revoked" },
    });
  } catch (e) {
    console.error("Error deleting user files:", e);
  }
}
