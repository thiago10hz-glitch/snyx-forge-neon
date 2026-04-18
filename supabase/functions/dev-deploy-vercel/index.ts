import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "site";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");
    if (!VERCEL_TOKEN) throw new Error("VERCEL_TOKEN não configurado");

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supaUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) throw new Error("Não autenticado");
    const userId = userData.user.id;

    const admin = createClient(supaUrl, supaService);

    // Authorization: DEV ou Admin
    const { data: profile } = await admin.from("profiles").select("is_dev,dev_expires_at").eq("user_id", userId).maybeSingle();
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    const isDev = !!profile?.is_dev && (!profile.dev_expires_at || new Date(profile.dev_expires_at) > new Date());
    const isAdmin = !!roleRow;
    if (!isDev && !isAdmin) throw new Error("Acesso restrito a DEV ou Admin");

    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id obrigatório");

    const { data: project, error: pErr } = await admin
      .from("dev_projects")
      .select("*")
      .eq("id", project_id)
      .maybeSingle();
    if (pErr || !project) throw new Error("Projeto não encontrado");
    if (project.user_id !== userId && !isAdmin) throw new Error("Sem permissão");

    // Define o nome do projeto na Vercel
    let vercelProjectName = project.vercel_project_name;
    if (!vercelProjectName) {
      vercelProjectName = `snyx-${slugify(project.name)}-${project.id.slice(0, 6)}`;
    }

    // Cria deployment direto (Vercel cria projeto automaticamente se não existir)
    const indexHtml = project.html_content || "<!DOCTYPE html><html><body>Vazio</body></html>";

    const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: vercelProjectName,
        target: "production",
        files: [
          {
            file: "index.html",
            data: indexHtml,
          },
        ],
        projectSettings: {
          framework: null,
        },
      }),
    });

    const deployJson = await deployRes.json();
    if (!deployRes.ok) {
      console.error("Vercel deploy error:", deployJson);
      throw new Error(deployJson.error?.message || "Falha ao publicar na Vercel");
    }

    const url = deployJson.url ? `https://${deployJson.url}` : null;
    const projectIdVercel = deployJson.projectId || project.vercel_project_id;

    await admin
      .from("dev_projects")
      .update({
        vercel_project_id: projectIdVercel,
        vercel_project_name: vercelProjectName,
        vercel_url: url,
        last_deployed_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    return new Response(
      JSON.stringify({ success: true, url, deployment: deployJson.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("dev-deploy-vercel error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
