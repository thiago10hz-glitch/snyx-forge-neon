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
  n: string;
  u: string;
  l: string;
  g: string;
}

const IPTV_USERNAME = Deno.env.get("IPTV_USERNAME") || "";
const IPTV_PASSWORD = Deno.env.get("IPTV_PASSWORD") || "";
const rawHost = Deno.env.get("IPTV_HOST") || "megga.tv.br";
// Strip protocol and path if user pasted full URL
const IPTV_HOST = rawHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const PLAYLIST_URL = `http://${IPTV_HOST}/get.php?username=${IPTV_USERNAME}&password=${IPTV_PASSWORD}&type=m3u_plus&output=mpegts`;

const MAX_CHANNELS = 5000;

async function streamParseM3U(response: Response): Promise<Channel[]> {
  const channels: Channel[] = [];
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastExtinf = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith("#EXTINF:")) {
          lastExtinf = line;
        } else if (lastExtinf && line && !line.startsWith("#")) {
          const nameMatch = lastExtinf.match(/,(.+)$/);
          const groupMatch = lastExtinf.match(/group-title="([^"]*)"/);
          if (nameMatch) {
            const g = (groupMatch?.[1] || "").toLowerCase();
            if (!g.includes("xxx") && !g.includes("adulto")) {
              const logoMatch = lastExtinf.match(/tvg-logo="([^"]*)"/);
              channels.push({
                n: nameMatch[1].trim(),
                u: line,
                l: logoMatch?.[1] || "",
                g: groupMatch?.[1] || "Outros",
              });
              if (channels.length >= MAX_CHANNELS) {
                reader.cancel();
                return channels;
              }
            }
          }
          lastExtinf = "";
        }
      }
      if (buffer.length > 500000) buffer = "";
    }
  } catch {
    // Stream cancelled - return what we have
  }

  return channels;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const payload = decodeJwtPayload(token);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const upstream = await fetch(PLAYLIST_URL, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SnyXTV/1.0)" },
    });
    clearTimeout(timeout);

    if (!upstream.ok || !upstream.body) {
      return new Response(JSON.stringify({ error: `IPTV respondeu ${upstream.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream parse - never holds entire M3U in memory
    const channels = await streamParseM3U(upstream);

    // Upload parsed JSON to storage
    const jsonData = JSON.stringify(channels);
    const { error: uploadError } = await supabase.storage
      .from("iptv-cache")
      .upload("channels.json", new Blob([jsonData], { type: "application/json" }), {
        upsert: true,
        contentType: "application/json",
        cacheControl: "300",
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Upload: ${uploadError.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      channels: channels.length,
      size: `${(jsonData.length / 1024 / 1024).toFixed(1)}MB`,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error && error.name === "AbortError"
      ? "Timeout ao baixar playlist"
      : (error instanceof Error ? error.message : "Erro interno");
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
