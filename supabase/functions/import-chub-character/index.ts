// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUB_BASE = "https://api.chub.ai/api";
// Public images CDN for Chub
const CHUB_IMG = (path: string) => path.startsWith("http") ? path : `https://avatars.charhub.io/avatars/${path}`;

interface ChubNode {
  id?: number;
  fullPath?: string;
  name?: string;
  tagline?: string;
  description?: string;
  topics?: string[];
  starCount?: number;
  nChats?: number;
  avatar_url?: string;
  max_res_url?: string;
  nsfw_image?: boolean;
  tags?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "search";

    // ==== SEARCH ====
    if (action === "search") {
      const search = (body.search || "").trim();
      const nsfw = body.nsfw === true;
      const page = Math.max(1, parseInt(body.page || "1"));
      const params = new URLSearchParams({
        search,
        first: "24",
        page: String(page),
        namespace: "*",
        sort: "star_count",
        venus: "true",
        nsfw: nsfw ? "true" : "false",
        nsfw_only: "false",
        asc: "false",
        require_images: "true",
        require_example_dialogues: "false",
        require_alternate_greetings: "false",
        require_custom_prompt: "false",
      });

      const r = await fetch(`${CHUB_BASE}/characters/search?${params}`);
      if (!r.ok) {
        return new Response(JSON.stringify({ error: `Chub search failed: ${r.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await r.json();
      const nodes: ChubNode[] = data?.nodes || data?.data?.nodes || [];
      const results = nodes.map((n) => ({
        id: n.fullPath || String(n.id || ""),
        name: n.name || "Sem nome",
        description: n.tagline || n.description || "",
        avatar_url: n.max_res_url || n.avatar_url || "",
        tags: n.topics || n.tags || [],
        chat_count: n.nChats || 0,
        likes: n.starCount || 0,
        nsfw: !!n.nsfw_image,
      })).filter((n) => n.avatar_url);

      return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==== IMPORT ====
    if (action === "import") {
      const fullPath = String(body.fullPath || "").trim();
      if (!fullPath) {
        return new Response(JSON.stringify({ error: "fullPath required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch full character details
      const r = await fetch(`${CHUB_BASE}/characters/${encodeURIComponent(fullPath)}?full=true`);
      if (!r.ok) {
        return new Response(JSON.stringify({ error: `Chub fetch failed: ${r.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const detail = await r.json();
      const node = detail?.node || detail;
      const def = node?.definition || {};

      const name = node?.name || def?.name || "Personagem";
      const description = node?.tagline || def?.description?.slice(0, 280) || "";
      const personality = def?.personality || "";
      const scenario = def?.scenario || "";
      const first_message = def?.first_message || def?.greeting || "";
      const example_dialog = def?.example_dialogs || def?.mes_example || "";
      const system_prompt = def?.system_prompt || def?.description || "";
      const avatar_url = node?.max_res_url || node?.avatar_url || "";
      const tags = (node?.topics || []).slice(0, 8);
      const nsfw = !!node?.nsfw_image || tags.some((t: string) => /nsfw|adult|+18/i.test(t));

      // Detect category from tags
      const tagStr = tags.join(" ").toLowerCase();
      let category = "geral";
      if (/anime|manga/.test(tagStr)) category = "anime";
      else if (/romance|love/.test(tagStr)) category = "romance";
      else if (/fantasy|magic|elf|dragon/.test(tagStr)) category = "fantasia";
      else if (/dark|horror|gothic/.test(tagStr)) category = "sombrio";
      else if (/adventure|quest/.test(tagStr)) category = "aventura";
      else if (/drama/.test(tagStr)) category = "drama";

      const { data: inserted, error } = await supabase
        .from("ai_characters")
        .insert({
          creator_id: user.id,
          name,
          description,
          personality,
          scenario,
          first_message,
          example_dialog,
          system_prompt: system_prompt || `Você é ${name}. ${personality}`,
          avatar_url,
          category,
          tags,
          is_nsfw: nsfw,
          is_public: true,
          language: "pt-BR",
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true, character: inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("import-chub-character error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
