import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get("url");

    if (!streamUrl) {
      return new Response(JSON.stringify({ error: "URL não fornecida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate URL protocol
    let parsed: URL;
    try {
      parsed = new URL(streamUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forward range headers for seeking
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Referer": `${parsed.protocol}//${parsed.host}/`,
      "Origin": `${parsed.protocol}//${parsed.host}`,
    };
    const range = req.headers.get("range");
    if (range) headers["Range"] = range;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let upstream: Response;
    try {
      upstream = await fetch(streamUrl, {
        method: "GET",
        headers,
        redirect: "follow",
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeout);
      console.error("Fetch error:", streamUrl, e);
      return new Response(JSON.stringify({ error: "Não foi possível conectar ao stream" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(timeout);

    if (!upstream.ok && upstream.status !== 206) {
      console.error("Upstream error:", streamUrl, upstream.status);
      return new Response(JSON.stringify({ error: `Stream respondeu ${upstream.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    };
    if (contentLength) responseHeaders["Content-Length"] = contentLength;
    if (contentRange) responseHeaders["Content-Range"] = contentRange;

    // If m3u8 manifest, rewrite internal URLs to go through proxy
    const isManifest = contentType.includes("mpegurl") || contentType.includes("m3u") || 
                       streamUrl.endsWith(".m3u8") || streamUrl.includes(".m3u8?") || streamUrl.includes(".m3u8&");
    
    if (isManifest) {
      const body = await upstream.text();
      const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf("/") + 1);
      const proxyBase = url.origin + url.pathname;

      const rewritten = body.split("\n").map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        
        if (trimmed.startsWith("#")) {
          // Rewrite URI= in EXT-X-KEY, EXT-X-MAP etc
          if (trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/g, (_match, uri) => {
              const fullUrl = uri.startsWith("http") ? uri : baseUrl + uri;
              return `URI="${proxyBase}?url=${encodeURIComponent(fullUrl)}"`;
            });
          }
          return line;
        }
        // URL line (segment or sub-manifest)
        const fullUrl = trimmed.startsWith("http") ? trimmed : baseUrl + trimmed;
        return `${proxyBase}?url=${encodeURIComponent(fullUrl)}`;
      }).join("\n");

      return new Response(rewritten, {
        status: upstream.status,
        headers: { ...responseHeaders, "Content-Type": "application/vnd.apple.mpegurl" },
      });
    }

    // Binary content - stream directly
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(JSON.stringify({ error: "Erro interno no proxy" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
