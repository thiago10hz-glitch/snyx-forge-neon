import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.sub || (payload.exp && payload.exp * 1000 < Date.now())) return null;
    return payload;
  } catch {
    return null;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_HOSTS = new Set([
  "dns.acesse.digital",
  "tvzplay.win",
  "tvzplay.xyz",
  "gestorx.uk",
  "e.dns.acesse.digital",
]);

function validatePlaylistUrl(input: unknown) {
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("URL da playlist inválida");
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("URL da playlist inválida");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Protocolo não permitido");
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error("Host da playlist não permitido");
  }

  return parsed.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método não permitido" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = decodeJwtPayload(token);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = payload.sub as string;
    const { url } = await req.json();
    const playlistUrl = validatePlaylistUrl(url);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      supabase.from("profiles").select("is_dev").eq("user_id", userId).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }) as Promise<{ data: boolean }>,
    ]);

    if (!profile?.is_dev && !isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso restrito ao plano DEV" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AbortController with timeout to avoid hanging
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let upstream: Response;
    try {
      upstream = await fetch(playlistUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SnyXTV/1.0)",
          "Accept": "application/x-mpegURL, application/vnd.apple.mpegurl, text/plain, */*",
        },
      });
    } catch (e) {
      clearTimeout(timeout);
      const msg = e instanceof Error && e.name === "AbortError" 
        ? "Servidor IPTV demorou demais para responder" 
        : "Não foi possível conectar ao servidor IPTV";
      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(timeout);

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `Servidor IPTV respondeu ${upstream.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response directly instead of buffering in memory
    if (upstream.body) {
      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    // Fallback: if no body stream available
    const body = await upstream.text();
    if (!body.trim().startsWith("#EXTM3U")) {
      return new Response(JSON.stringify({ error: "Playlist inválida ou vazia" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
