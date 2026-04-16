import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function generateDemoSiteHTML(siteName: string, primaryColor: string, description: string | null): string {
  const safeDesc = description || `Bem-vindo ao ${siteName} — sua plataforma completa com IA, chat, música e muito mais.`;
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${siteName}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:${primaryColor};--bg:#0a0a0f;--card:#111118;--border:rgba(255,255,255,0.08);--text:#e4e4e7;--muted:rgba(255,255,255,0.4)}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}
.demo-banner{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(234,179,8,0.9);color:#000;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:700;backdrop-filter:blur(10px)}
.demo-banner .timer{font-family:'JetBrains Mono',monospace;background:rgba(0,0,0,0.15);padding:2px 8px;border-radius:6px}
header{position:sticky;top:36px;z-index:50;border-bottom:1px solid var(--border);background:rgba(10,10,15,0.8);backdrop-filter:blur(20px)}
.header-inner{max-width:1200px;margin:0 auto;padding:0 16px;height:56px;display:flex;align-items:center;justify-content:space-between}
.logo{display:flex;align-items:center;gap:8px}
.logo-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;border:1px solid color-mix(in srgb,var(--primary) 40%,transparent);background:color-mix(in srgb,var(--primary) 15%,transparent);color:var(--primary)}
.logo span{font-weight:900;font-size:14px}
.nav{display:flex;gap:8px}
.nav a{padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;color:var(--muted);text-decoration:none;transition:all .2s}
.nav a:hover{color:var(--text);background:rgba(255,255,255,0.05)}
.hero{text-align:center;padding:80px 16px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-100px;right:-100px;width:400px;height:400px;border-radius:50%;background:color-mix(in srgb,var(--primary) 8%,transparent);filter:blur(120px);pointer-events:none}
.hero h1{font-size:clamp(28px,5vw,48px);font-weight:900;line-height:1.1;margin-bottom:16px}
.hero h1 .accent{color:var(--primary)}
.hero p{color:var(--muted);font-size:14px;max-width:500px;margin:0 auto 32px}
.hero-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.btn{padding:12px 24px;border-radius:12px;font-size:13px;font-weight:700;border:none;cursor:pointer;transition:all .2s;text-decoration:none;display:inline-flex;align-items:center;gap:8px}
.btn-primary{background:var(--primary);color:#fff}
.btn-primary:hover{opacity:.9;transform:translateY(-1px)}
.btn-outline{background:transparent;border:1px solid var(--border);color:var(--text)}
.btn-outline:hover{background:rgba(255,255,255,0.05)}
.section{max-width:1200px;margin:0 auto;padding:48px 16px}
.section-title{text-align:center;font-size:20px;font-weight:900;margin-bottom:32px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}
.card{padding:24px;border-radius:16px;border:1px solid var(--border);background:var(--card);transition:all .3s}
.card:hover{border-color:color-mix(in srgb,var(--primary) 30%,transparent);transform:translateY(-2px)}
.card .icon{font-size:28px;margin-bottom:12px}
.card h3{font-size:14px;font-weight:700;margin-bottom:4px}
.card p{font-size:12px;color:var(--muted)}
.chat-demo{max-width:500px;margin:0 auto;padding:24px;border-radius:16px;border:1px solid var(--border);background:var(--card)}
.chat-msg{display:flex;gap:8px;margin-bottom:12px}
.chat-msg.user{justify-content:flex-end}
.chat-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;background:color-mix(in srgb,var(--primary) 20%,transparent);color:var(--primary)}
.chat-bubble{padding:8px 12px;border-radius:12px;font-size:12px;max-width:75%;line-height:1.5}
.chat-bubble.ai{background:rgba(255,255,255,0.05);border-top-left-radius:4px}
.chat-bubble.user{background:color-mix(in srgb,var(--primary) 20%,transparent);border-top-right-radius:4px}
.chat-input{display:flex;gap:8px;margin-top:16px;padding:8px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid var(--border)}
.chat-input input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-size:12px}
.chat-input button{padding:6px 16px;border-radius:8px;border:none;background:color-mix(in srgb,var(--primary) 25%,transparent);color:var(--primary);font-size:11px;font-weight:700;cursor:pointer}
.cta-section{text-align:center;padding:64px 16px}
.cta-box{max-width:500px;margin:0 auto;padding:32px;border-radius:16px;border:2px solid color-mix(in srgb,var(--primary) 30%,transparent);background:color-mix(in srgb,var(--primary) 5%,transparent)}
.cta-box h2{font-size:20px;font-weight:900;margin-bottom:8px}
.cta-box p{font-size:12px;color:var(--muted);margin-bottom:16px}
footer{text-align:center;padding:32px 16px;border-top:1px solid var(--border);font-size:11px;color:var(--muted)}
@media(max-width:640px){.nav{display:none}.hero{padding:48px 16px}.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="demo-banner">
  <span>⚡ DEMONSTRAÇÃO — ${siteName}</span>
  <span>Acesso privado • Expira em <span class="timer" id="timer">59:59</span></span>
</div>

<header>
  <div class="header-inner">
    <div class="logo">
      <div class="logo-icon">${siteName.charAt(0).toUpperCase()}</div>
      <span>${siteName}</span>
    </div>
    <nav class="nav">
      <a href="#features">Recursos</a>
      <a href="#chat">Chat IA</a>
      <a href="#pricing">Assinar</a>
    </nav>
  </div>
</header>

<section class="hero">
  <h1>Bem-vindo ao<br><span class="accent">${siteName}</span></h1>
  <p>${safeDesc}</p>
  <div class="hero-actions">
    <a href="#chat" class="btn btn-primary">💬 Chat IA</a>
    <a href="#features" class="btn btn-outline">Ver recursos</a>
  </div>
</section>

<section class="section" id="features">
  <h2 class="section-title">Funcionalidades</h2>
  <div class="grid">
    <div class="card"><div class="icon">💬</div><h3>Chat IA</h3><p>Converse com inteligência artificial em múltiplos modos</p></div>
    <div class="card"><div class="icon">🎭</div><h3>Personagens IA</h3><p>Crie personagens únicos e converse com eles</p></div>
    <div class="card"><div class="icon">🎵</div><h3>Gerador de Música</h3><p>Crie músicas originais com inteligência artificial</p></div>
    <div class="card"><div class="icon">📞</div><h3>Chamada de Voz</h3><p>Converse por voz com a IA em tempo real</p></div>
    <div class="card"><div class="icon">🌐</div><h3>Hospedagem</h3><p>Hospede sites para seus usuários</p></div>
    <div class="card"><div class="icon">🛡️</div><h3>Painel Admin</h3><p>Gerencie tudo com controle total</p></div>
    <div class="card"><div class="icon">🎮</div><h3>RPG Interativo</h3><p>Sistema de RPG com personagens e aventuras</p></div>
    <div class="card"><div class="icon">🔗</div><h3>Conexões</h3><p>Sistema de amizades e chat compartilhado</p></div>
    <div class="card"><div class="icon">🎨</div><h3>Temas</h3><p>Personalização visual completa</p></div>
  </div>
</section>

<section class="section" id="chat">
  <h2 class="section-title">Chat IA do ${siteName}</h2>
  <div class="chat-demo">
    <div class="chat-msg">
      <div class="chat-avatar">IA</div>
      <div class="chat-bubble ai">Olá! Eu sou a IA do ${siteName}. Como posso te ajudar? 🚀</div>
    </div>
    <div class="chat-msg user">
      <div class="chat-bubble user">Quais funcionalidades esse site tem?</div>
    </div>
    <div class="chat-msg">
      <div class="chat-avatar">IA</div>
      <div class="chat-bubble ai">O ${siteName} tem chat IA, personagens, gerador de música, chamadas de voz, hospedagem, RPG e muito mais! Tudo personalizado para você. ✨</div>
    </div>
    <div class="chat-msg user">
      <div class="chat-bubble user">Incrível! Quero ter meu site completo!</div>
    </div>
    <div class="chat-msg">
      <div class="chat-avatar">IA</div>
      <div class="chat-bubble ai">Que bom que gostou! Esta é uma demonstração — assine o plano completo para ter acesso permanente com todas as funcionalidades! 🎉</div>
    </div>
    <div class="chat-input">
      <input placeholder="Digite uma mensagem..." disabled>
      <button disabled>Enviar</button>
    </div>
    <p style="text-align:center;font-size:10px;color:var(--muted);margin-top:8px">Demonstração • Na versão completa a IA responde de verdade</p>
  </div>
</section>

<section class="cta-section" id="pricing">
  <div class="cta-box">
    <h2>Gostou do ${siteName}?</h2>
    <p>Assine agora para ter acesso completo e permanente ao seu site personalizado!</p>
    <a href="https://snyx-forge-neon.lovable.app/clone-site" class="btn btn-primary" target="_blank">⚡ Assinar por R$350/mês</a>
  </div>
</section>

<footer>
  <p>© ${new Date().getFullYear()} ${siteName} — Demonstração • Powered by SnyX</p>
</footer>

<script>
(function(){
  const start = Date.now();
  const duration = 60 * 60 * 1000;
  const el = document.getElementById('timer');
  function update(){
    const left = duration - (Date.now() - start);
    if(left <= 0){
      document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;font-family:Inter,sans-serif;background:#0a0a0f;color:#e4e4e7"><h1 style="font-size:24px;font-weight:900">⏰ Demonstração expirada</h1><p style="color:rgba(255,255,255,0.4);font-size:14px">Sua hora de teste acabou. Assine para ter acesso completo!</p><a href="https://snyx-forge-neon.lovable.app/clone-site" style="padding:12px 24px;border-radius:12px;background:${primaryColor};color:#fff;text-decoration:none;font-weight:700;font-size:13px">Assinar agora</a></div>';
      return;
    }
    const m=Math.floor(left/60000);
    const s=Math.floor((left%60000)/1000);
    el.textContent=m+':'+(s<10?'0':'')+s;
    requestAnimationFrame(update);
  }
  update();
})();
</script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Sessão expirada" }, 401);
    }

    const body = await req.json();
    const { action } = body;

    // ── CLEANUP CRON: only expired demos ──
    if (action === "cleanup_cron") {
      const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");
      
      const { data: expiredDemos } = await adminClient
        .from("clone_demos")
        .select("*")
        .eq("status", "active")
        .lt("expires_at", new Date().toISOString());

      let cleaned = 0;
      if (expiredDemos) {
        for (const demo of expiredDemos) {
          if (demo.vercel_project_id && VERCEL_TOKEN) {
            try {
              await fetch(`https://api.vercel.com/v9/projects/${demo.vercel_project_id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
              });
            } catch (e) {
              console.error("Failed to delete Vercel project:", e);
            }
          }
          await adminClient
            .from("clone_demos")
            .update({ status: "expired" })
            .eq("id", demo.id);
          cleaned++;
        }
      }
      return jsonResponse({ success: true, cleaned });
    }

    // ── CLEANUP all active demos (admin revoke all) ──
    if (action === "cleanup") {
      const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");
      
      const { data: activeDemos } = await adminClient
        .from("clone_demos")
        .select("*")
        .eq("status", "active");

      let cleaned = 0;
      if (activeDemos) {
        for (const demo of activeDemos) {
          if (demo.vercel_project_id && VERCEL_TOKEN) {
            try {
              await fetch(`https://api.vercel.com/v9/projects/${demo.vercel_project_id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
              });
            } catch (e) {
              console.error("Failed to delete Vercel project:", e);
            }
          }
          await adminClient
            .from("clone_demos")
            .update({ status: "expired" })
            .eq("id", demo.id);
          cleaned++;
        }
      }
      return jsonResponse({ success: true, cleaned });
    }

    // ── CREATE demo ──
    const { siteName, primaryColor, description, fingerprint, ip } = body;

    if (!siteName || typeof siteName !== "string") {
      return jsonResponse({ error: "Nome do site obrigatório" }, 400);
    }

    // Check eligibility
    const { data: canUse } = await userClient.rpc("can_use_demo", {
      p_fingerprint: fingerprint || null,
      p_ip: ip || null,
    });

    if (!canUse || !(canUse as any).allowed) {
      return jsonResponse({ error: (canUse as any)?.message || "Demonstração não disponível" }, 403);
    }

    const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");
    if (!VERCEL_TOKEN) {
      return jsonResponse({ error: "Deploy não configurado" }, 500);
    }

    // Generate HTML
    const html = generateDemoSiteHTML(siteName, primaryColor || "#ff0000", description);

    // Deploy to Vercel
    const safeName = `demo-${siteName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40)}`;

    const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: safeName,
        files: [
          {
            file: "index.html",
            data: btoa(unescape(encodeURIComponent(html))),
            encoding: "base64",
          },
        ],
        projectSettings: { framework: null },
        target: "production",
      }),
    });

    const deployData = await deployRes.json();

    if (!deployRes.ok) {
      console.error("Vercel error:", deployRes.status, JSON.stringify(deployData));
      return jsonResponse({ error: "Erro ao criar site de demonstração" }, 502);
    }

    const hostedUrl = deployData.url
      ? `https://${deployData.url}`
      : deployData.alias?.[0]
        ? `https://${deployData.alias[0]}`
        : null;

    // Save demo record
    const { data: demo, error: insertErr } = await userClient
      .from("clone_demos")
      .insert({
        user_id: user.id,
        site_name: siteName.trim(),
        primary_color: primaryColor || "#ff0000",
        description: description || null,
        device_fingerprint: fingerprint || null,
        ip_address: ip || null,
        demo_url: safeName,
        vercel_project_id: deployData.projectId || null,
        vercel_deployment_id: deployData.id || null,
        hosted_url: hostedUrl,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      // Try to cleanup the Vercel deployment
      if (deployData.projectId) {
        await fetch(`https://api.vercel.com/v9/projects/${deployData.projectId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
        }).catch(() => {});
      }
      return jsonResponse({ error: "Erro ao salvar demonstração" }, 500);
    }

    // Schedule cleanup after 1 hour (fire and forget — call ourselves)
    setTimeout(async () => {
      try {
        // Delete Vercel project
        if (deployData.projectId) {
          await fetch(`https://api.vercel.com/v9/projects/${deployData.projectId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
          });
        }
        // Mark expired
        await adminClient
          .from("clone_demos")
          .update({ status: "expired" })
          .eq("id", demo.id);
        
        console.log(`Demo ${demo.id} cleaned up successfully`);
      } catch (e) {
        console.error("Cleanup failed for demo:", demo.id, e);
      }
    }, 60 * 60 * 1000); // 1 hour

    return jsonResponse({
      success: true,
      url: hostedUrl,
      demoId: demo.id,
      expiresAt: demo.expires_at,
    });
  } catch (err) {
    console.error("Demo deploy error:", err);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
});
