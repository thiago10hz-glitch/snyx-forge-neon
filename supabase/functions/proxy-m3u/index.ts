import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_HOSTS = new Set(["dns.acesse.digital"]);

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

  if (parsed.pathname !== "/get.php") {
    throw new Error("Caminho da playlist inválido");
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: profile, error: profileError }, { data: isAdmin, error: roleError }] = await Promise.all([
      supabase.from("profiles").select("is_dev").eq("user_id", user.id).single(),
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);

    if (profileError) {
      throw new Error("Não foi possível validar seu acesso");
    }

    if (roleError) {
      throw new Error("Não foi possível validar sua permissão");
    }

    if (!profile?.is_dev && !isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso restrito ao plano DEV" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url } = await req.json();
    const playlistUrl = validatePlaylistUrl(url);

    const upstream = await fetch(playlistUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SnyXTV/1.0)",
        "Accept": "application/x-mpegURL, application/vnd.apple.mpegurl, text/plain, */*",
      },
    });

    const body = await upstream.text();

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `Servidor IPTV respondeu ${upstream.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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