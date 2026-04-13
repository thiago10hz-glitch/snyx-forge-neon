import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

interface Channel {
  n: string; // name
  u: string; // url
  l: string; // logo
  g: string; // group
}

function parseM3U(content: string): Channel[] {
  const lines = content.split("\n");
  const channels: Channel[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#EXTINF:")) {
      const nameMatch = line.match(/,(.+)$/);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const url = lines[i + 1]?.trim();
      if (nameMatch && url && !url.startsWith("#")) {
        const g = (groupMatch?.[1] || "Outros").toLowerCase();
        // Skip adult content
        if (g.includes("xxx") || g.includes("adulto")) continue;
        channels.push({
          n: nameMatch[1].trim(),
          u: url,
          l: logoMatch?.[1] || "",
          g: groupMatch?.[1] || "Outros",
        });
      }
    }
  }
  return channels;
}

const PLAYLIST_URL = "http://dns.acesse.digital/get.php?username=59176152&password=77525563&type=m3u_plus&output=mpegts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check - must be admin or dev
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const payload = decodeJwtPayload(token);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = payload.sub as string;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      supabase.from("profiles").select("is_dev").eq("user_id", userId).maybeSingle(),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }) as Promise<{ data: boolean }>,
    ]);

    if (!profile?.is_dev && !isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso restrito" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch playlist
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    const upstream = await fetch(PLAYLIST_URL, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SnyXTV/1.0)" },
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `IPTV respondeu ${upstream.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = await upstream.text();
    if (!text.trim().startsWith("#EXTM3U")) {
      return new Response(JSON.stringify({ error: "Playlist inválida" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse
    const channels = parseM3U(text);

    // Upload to storage as JSON
    const jsonData = JSON.stringify(channels);
    const { error: uploadError } = await supabase.storage
      .from("iptv-cache")
      .upload("channels.json", new Blob([jsonData], { type: "application/json" }), {
        upsert: true,
        contentType: "application/json",
        cacheControl: "300",
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Upload falhou: ${uploadError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      channels: channels.length,
      size: `${(jsonData.length / 1024 / 1024).toFixed(1)}MB`,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
