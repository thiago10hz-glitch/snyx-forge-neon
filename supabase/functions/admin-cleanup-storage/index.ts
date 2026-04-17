import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden - admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, unknown> = {};

    // 1) app-downloads: remover tudo (instaladores antigos do Electron/SnyX)
    const { data: appFiles, error: appListErr } = await admin.storage
      .from("app-downloads")
      .list("releases", { limit: 1000 });

    if (appListErr) {
      results["app-downloads_list_error"] = appListErr.message;
    } else if (appFiles && appFiles.length > 0) {
      const paths = appFiles.map((f) => `releases/${f.name}`);
      const { error: rmErr } = await admin.storage.from("app-downloads").remove(paths);
      results["app-downloads_removed"] = rmErr ? `error: ${rmErr.message}` : paths;
    } else {
      results["app-downloads_removed"] = [];
    }

    // 2) Listar root do app-downloads também (pode ter arquivos fora de releases/)
    const { data: rootFiles } = await admin.storage
      .from("app-downloads")
      .list("", { limit: 1000 });
    if (rootFiles && rootFiles.length > 0) {
      const rootPaths = rootFiles
        .filter((f) => f.name && !f.id?.endsWith("/")) // skip folders
        .map((f) => f.name);
      if (rootPaths.length > 0) {
        const { error: rmErr } = await admin.storage.from("app-downloads").remove(rootPaths);
        results["app-downloads_root_removed"] = rmErr ? `error: ${rmErr.message}` : rootPaths;
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
