import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type StorageEntry = {
  name: string;
  id?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function collectBucketFiles(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix = "",
): Promise<{ files: string[]; errors: string[] }> {
  const files: string[] = [];
  const errors: string[] = [];
  const queue = [prefix];

  while (queue.length > 0) {
    const currentPrefix = queue.shift() ?? "";
    const { data, error } = await admin.storage.from(bucket).list(currentPrefix, { limit: 1000 });

    if (error) {
      errors.push(`${currentPrefix || "/"}: ${error.message}`);
      continue;
    }

    for (const entry of (data ?? []) as StorageEntry[]) {
      const entryPath = currentPrefix ? `${currentPrefix}/${entry.name}` : entry.name;
      const isFolder = !entry.metadata;

      if (isFolder) {
        queue.push(entryPath);
      } else {
        files.push(entryPath);
      }
    }
  }

  return { files, errors };
}

async function removeInChunks(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  files: string[],
) {
  const removed: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i += 100) {
    const chunk = files.slice(i, i + 100);
    const { error } = await admin.storage.from(bucket).remove(chunk);

    if (error) {
      errors.push(`${chunk[0]}: ${error.message}`);
    } else {
      removed.push(...chunk);
    }
  }

  return { removed, errors };
}

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

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
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

    const { files, errors: listErrors } = await collectBucketFiles(admin, "app-downloads");
    results["app-downloads_found"] = files.length;

    if (listErrors.length > 0) {
      results["app-downloads_list_errors"] = listErrors;
    }

    if (files.length > 0) {
      const { removed, errors: removeErrors } = await removeInChunks(admin, "app-downloads", files);
      results["app-downloads_removed"] = removed;

      if (removeErrors.length > 0) {
        results["app-downloads_remove_errors"] = removeErrors;
      }
    } else {
      results["app-downloads_removed"] = [];
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
