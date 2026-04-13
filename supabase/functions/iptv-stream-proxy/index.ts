const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-length, content-type, content-range",
};

const ALLOWED_HOSTS = new Set([
  "dns.acesse.digital",
  "tvzplay.win",
  "tvzplay.xyz",
  "gestorx.uk",
  "e.dns.acesse.digital",
  "xgood.fun",
]);

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    // Allow the known IPTV hosts and any IP-based hosts (CDN servers)
    if (ALLOWED_HOSTS.has(parsed.hostname)) return true;
    // Allow numeric IPs (IPTV CDN servers)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(parsed.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

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

    if (!isAllowedUrl(streamUrl)) {
      return new Response(JSON.stringify({ error: "URL não permitida" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forward range headers for seeking
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (compatible; SnyXTV/1.0)",
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
      return new Response(JSON.stringify({ error: "Não foi possível conectar ao stream" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(timeout);

    if (!upstream.ok && upstream.status !== 206) {
      return new Response(JSON.stringify({ error: `Stream respondeu ${upstream.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine content type
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

    // If the response is an m3u8 manifest, rewrite internal URLs to also go through proxy
    if (contentType.includes("mpegurl") || contentType.includes("m3u") || streamUrl.endsWith(".m3u8") || streamUrl.includes(".m3u8?")) {
      const body = await upstream.text();
      const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf("/") + 1);
      const proxyBase = url.origin + url.pathname;

      // Rewrite relative URLs in the manifest to go through proxy
      const rewritten = body.split("\n").map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          // Check for URI= in EXT-X-KEY etc
          if (trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/g, (_match, uri) => {
              const fullUrl = uri.startsWith("http") ? uri : baseUrl + uri;
              return `URI="${proxyBase}?url=${encodeURIComponent(fullUrl)}"`;
            });
          }
          return line;
        }
        // This is a URL line (segment or sub-manifest)
        const fullUrl = trimmed.startsWith("http") ? trimmed : baseUrl + trimmed;
        return `${proxyBase}?url=${encodeURIComponent(fullUrl)}`;
      }).join("\n");

      return new Response(rewritten, {
        status: upstream.status,
        headers: { ...responseHeaders, "Content-Type": "application/vnd.apple.mpegurl" },
      });
    }

    // For .ts segments and other binary content, stream directly
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Erro interno no proxy" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
