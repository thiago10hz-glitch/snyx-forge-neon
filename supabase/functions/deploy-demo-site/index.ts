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

function generateDemoSiteHTML(siteName: string, primaryColor: string, description: string | null, ownerEmail: string): string {
  const safeDesc = description || `Plataforma completa com IA, chat, música e muito mais.`;
  const initial = siteName.charAt(0).toUpperCase();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${siteName}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--p:${primaryColor};--bg:#0a0a0f;--card:#111118;--card2:#16161f;--border:rgba(255,255,255,0.08);--text:#e4e4e7;--muted:rgba(255,255,255,0.4);--muted2:rgba(255,255,255,0.25)}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}
a{color:inherit;text-decoration:none}
button{font-family:inherit;cursor:pointer;border:none;outline:none}
input,textarea{font-family:inherit;outline:none}

/* Demo Banner */
.demo-banner{position:fixed;top:0;left:0;right:0;z-index:200;background:rgba(234,179,8,0.92);color:#000;padding:6px 16px;display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:700;backdrop-filter:blur(10px)}
.demo-banner .timer{font-family:'JetBrains Mono',monospace;background:rgba(0,0,0,0.12);padding:2px 8px;border-radius:6px}

/* Sidebar */
.layout{display:flex;min-height:100vh;padding-top:32px}
.sidebar{width:220px;background:var(--card);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:32px;left:0;bottom:0;z-index:50;overflow-y:auto}
.sidebar-logo{padding:16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)}
.sidebar-logo .icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;border:1px solid color-mix(in srgb,var(--p) 40%,transparent);background:color-mix(in srgb,var(--p) 15%,transparent);color:var(--p)}
.sidebar-logo span{font-weight:900;font-size:15px}
.sidebar-nav{flex:1;padding:8px}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;font-size:12px;font-weight:600;color:var(--muted);transition:all .15s;margin-bottom:2px}
.nav-item:hover,.nav-item.active{color:var(--text);background:rgba(255,255,255,0.05)}
.nav-item.active{color:var(--p);background:color-mix(in srgb,var(--p) 10%,transparent)}
.nav-item svg{width:16px;height:16px;flex-shrink:0}
.nav-section{padding:6px 12px;font-size:9px;font-weight:800;color:var(--muted2);text-transform:uppercase;letter-spacing:1px;margin-top:8px}
.sidebar-footer{padding:12px;border-top:1px solid var(--border);font-size:10px;color:var(--muted2)}

/* Main content */
.main{margin-left:220px;flex:1;min-height:100vh}
.page{display:none;padding:24px;max-width:1000px;margin:0 auto}
.page.active{display:block}
.page-title{font-size:20px;font-weight:900;margin-bottom:4px}
.page-subtitle{font-size:12px;color:var(--muted);margin-bottom:24px}

/* Cards */
.grid{display:grid;gap:12px}
.grid-2{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.grid-3{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.grid-4{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.stat-card{padding:20px;border-radius:14px;border:1px solid var(--border);background:var(--card)}
.stat-card .label{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.stat-card .value{font-size:28px;font-weight:900;margin:4px 0}
.stat-card .sub{font-size:10px;color:var(--muted2)}
.card{padding:16px;border-radius:14px;border:1px solid var(--border);background:var(--card);transition:all .2s}
.card:hover{border-color:color-mix(in srgb,var(--p) 25%,transparent)}

/* Chat */
.chat-container{display:flex;flex-direction:column;height:calc(100vh - 80px - 32px)}
.chat-messages{flex:1;overflow-y:auto;padding:16px 0;display:flex;flex-direction:column;gap:12px}
.chat-msg{display:flex;gap:10px;max-width:85%}
.chat-msg.user{align-self:flex-end;flex-direction:row-reverse}
.chat-avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;background:color-mix(in srgb,var(--p) 20%,transparent);color:var(--p)}
.chat-msg.user .chat-avatar{background:rgba(255,255,255,0.1);color:var(--text)}
.chat-bubble{padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5}
.chat-bubble.ai{background:var(--card2);border-top-left-radius:4px}
.chat-bubble.user{background:color-mix(in srgb,var(--p) 20%,transparent);border-top-right-radius:4px}
.chat-input-bar{display:flex;gap:8px;padding:12px;border-radius:14px;background:var(--card);border:1px solid var(--border)}
.chat-input-bar input{flex:1;background:transparent;border:none;color:var(--text);font-size:13px}
.chat-input-bar button{padding:8px 20px;border-radius:10px;background:var(--p);color:#fff;font-size:12px;font-weight:700;transition:opacity .2s}
.chat-input-bar button:hover{opacity:.85}
.typing{display:none;align-self:flex-start;padding:8px 14px;border-radius:14px;background:var(--card2);font-size:12px;color:var(--muted)}
.typing.show{display:flex;align-items:center;gap:6px}
.typing-dots span{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--muted);animation:blink 1.4s infinite both}
.typing-dots span:nth-child(2){animation-delay:.2s}
.typing-dots span:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,80%,100%{opacity:.3}40%{opacity:1}}

/* Mode tabs */
.mode-tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.mode-tab{padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;background:rgba(255,255,255,0.04);color:var(--muted);border:1px solid transparent;transition:all .15s}
.mode-tab.active{background:color-mix(in srgb,var(--p) 15%,transparent);color:var(--p);border-color:color-mix(in srgb,var(--p) 30%,transparent)}

/* Characters */
.char-card{padding:16px;border-radius:14px;border:1px solid var(--border);background:var(--card);text-align:center;transition:all .2s}
.char-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--p) 30%,transparent)}
.char-avatar{width:56px;height:56px;border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:22px;background:color-mix(in srgb,var(--p) 15%,transparent);border:2px solid color-mix(in srgb,var(--p) 25%,transparent)}
.char-name{font-size:13px;font-weight:800}
.char-desc{font-size:10px;color:var(--muted);margin-top:4px}
.char-stats{display:flex;justify-content:center;gap:12px;margin-top:8px;font-size:10px;color:var(--muted2)}

/* Music */
.music-card{padding:20px;border-radius:14px;border:1px solid var(--border);background:var(--card)}
.music-gen{display:flex;flex-direction:column;gap:12px}
.music-gen textarea{width:100%;min-height:80px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid var(--border);color:var(--text);font-size:12px;resize:none}
.music-gen button{padding:12px;border-radius:10px;background:var(--p);color:#fff;font-weight:700;font-size:13px}
.track-item{display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid var(--border)}
.track-play{width:36px;height:36px;border-radius:50%;background:var(--p);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px}
.track-info{flex:1}
.track-info .name{font-size:12px;font-weight:700}
.track-info .dur{font-size:10px;color:var(--muted)}

/* Admin */
.admin-tab{padding:8px 16px;border-radius:8px;font-size:11px;font-weight:700;background:rgba(255,255,255,0.04);color:var(--muted);transition:all .15s}
.admin-tab.active{background:color-mix(in srgb,var(--p) 15%,transparent);color:var(--p)}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:11px}
th{text-align:left;padding:8px 12px;font-weight:700;color:var(--muted);border-bottom:1px solid var(--border);font-size:10px;text-transform:uppercase;letter-spacing:.5px}
td{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.03)}
.badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:9px;font-weight:700}
.badge-green{background:rgba(34,197,94,.15);color:#22c55e}
.badge-yellow{background:rgba(234,179,8,.15);color:#eab308}
.badge-red{background:rgba(239,68,68,.15);color:#ef4444}
.badge-blue{background:rgba(59,130,246,.15);color:#3b82f6}
.badge-purple{background:rgba(168,85,247,.15);color:#a855f7}

/* Buttons */
.btn{padding:8px 16px;border-radius:10px;font-size:11px;font-weight:700;transition:all .15s;display:inline-flex;align-items:center;gap:6px}
.btn-p{background:var(--p);color:#fff}.btn-p:hover{opacity:.85}
.btn-outline{background:transparent;border:1px solid var(--border);color:var(--text)}.btn-outline:hover{background:rgba(255,255,255,0.05)}
.btn-danger{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.2)}

/* Owner */
.owner-action{padding:16px;border-radius:14px;border:1px solid var(--border);background:var(--card);display:flex;align-items:center;gap:12px}
.owner-action .oa-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;background:color-mix(in srgb,var(--p) 10%,transparent)}
.owner-action .oa-info{flex:1}
.owner-action .oa-title{font-size:12px;font-weight:800}
.owner-action .oa-desc{font-size:10px;color:var(--muted)}

/* CTA */
.cta-banner{padding:32px;border-radius:16px;border:2px solid color-mix(in srgb,var(--p) 30%,transparent);background:color-mix(in srgb,var(--p) 5%,transparent);text-align:center;margin-top:32px}
.cta-banner h2{font-size:18px;font-weight:900;margin-bottom:6px}
.cta-banner p{font-size:11px;color:var(--muted);margin-bottom:16px}

/* Responsive */
@media(max-width:768px){.sidebar{display:none}.main{margin-left:0}}
</style>
</head>
<body>

<!-- Demo Banner -->
<div class="demo-banner">
  <span>⚡ DEMONSTRAÇÃO — ${siteName}</span>
  <div style="display:flex;align-items:center;gap:10px">
    <span style="opacity:.7">Acesso privado</span>
    <span class="timer" id="timer">59:59</span>
  </div>
</div>

<div class="layout">
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="icon">${initial}</div>
      <span>${siteName}</span>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section">Principal</div>
      <a class="nav-item active" onclick="showPage('home')" href="#">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Início
      </a>
      <a class="nav-item" onclick="showPage('chat')" href="#">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Chat IA
      </a>
      <a class="nav-item" onclick="showPage('characters')" href="#">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
        Personagens
      </a>
      <a class="nav-item" onclick="showPage('music')" href="#">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        Música IA
      </a>
      <div class="nav-section">Gerenciamento</div>
      <a class="nav-item" onclick="showPage('admin')" href="#">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Admin
      </a>
      <a class="nav-item" onclick="showPage('owner')" href="#">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Painel Dono
      </a>
      <a class="nav-item" onclick="showPage('hosting')" href="#">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        Hospedagem
      </a>
      <a class="nav-item" onclick="showPage('support')" href="#">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Suporte
      </a>
    </nav>
    <div class="sidebar-footer">
      ${siteName} • Demonstração<br>
      <span style="color:var(--p);font-weight:700">${ownerEmail}</span>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="main">

    <!-- HOME -->
    <div class="page active" id="page-home">
      <h1 class="page-title">Bem-vindo ao ${siteName} 👋</h1>
      <p class="page-subtitle">${safeDesc}</p>

      <div class="grid grid-4" style="margin-bottom:20px">
        <div class="stat-card"><div class="label">Usuários</div><div class="value" style="color:var(--p)">0</div><div class="sub">Registrados</div></div>
        <div class="stat-card"><div class="label">Mensagens</div><div class="value">0</div><div class="sub">Hoje</div></div>
        <div class="stat-card"><div class="label">Sites</div><div class="value">0</div><div class="sub">Hospedados</div></div>
        <div class="stat-card"><div class="label">Status</div><div class="value" style="color:#22c55e;font-size:16px">● Online</div><div class="sub">Tudo funcionando</div></div>
      </div>

      <div class="grid grid-2">
        <div class="card" onclick="showPage('chat')" style="cursor:pointer">
          <div style="font-size:24px;margin-bottom:8px">💬</div>
          <h3 style="font-size:13px;font-weight:800">Chat IA</h3>
          <p style="font-size:11px;color:var(--muted)">Converse com IA em múltiplos modos — amigo, escola, programador</p>
        </div>
        <div class="card" onclick="showPage('characters')" style="cursor:pointer">
          <div style="font-size:24px;margin-bottom:8px">🎭</div>
          <h3 style="font-size:13px;font-weight:800">Personagens IA</h3>
          <p style="font-size:11px;color:var(--muted)">Crie e converse com personagens únicos</p>
        </div>
        <div class="card" onclick="showPage('music')" style="cursor:pointer">
          <div style="font-size:24px;margin-bottom:8px">🎵</div>
          <h3 style="font-size:13px;font-weight:800">Gerador de Música</h3>
          <p style="font-size:11px;color:var(--muted)">Crie músicas originais com IA</p>
        </div>
        <div class="card" onclick="showPage('admin')" style="cursor:pointer">
          <div style="font-size:24px;margin-bottom:8px">🛡️</div>
          <h3 style="font-size:13px;font-weight:800">Painel Admin</h3>
          <p style="font-size:11px;color:var(--muted)">Gerencie tudo com controle total</p>
        </div>
      </div>

      <div class="cta-banner">
        <h2>Gostou do ${siteName}?</h2>
        <p>Esta é uma demonstração de 1 hora. Assine para ter acesso completo e permanente!</p>
        <a href="https://snyx-forge-neon.lovable.app/clone-site" class="btn btn-p" target="_blank">⚡ Assinar por R$350/mês</a>
      </div>
    </div>

    <!-- CHAT -->
    <div class="page" id="page-chat">
      <h1 class="page-title">Chat IA</h1>
      <p class="page-subtitle">Converse com a IA do ${siteName}</p>

      <div class="mode-tabs">
        <button class="mode-tab active">💬 Amigo</button>
        <button class="mode-tab">📚 Escola</button>
        <button class="mode-tab">💻 Programador</button>
        <button class="mode-tab">✏️ Reescrita</button>
      </div>

      <div class="chat-container">
        <div class="chat-messages" id="chatMessages">
          <div class="chat-msg">
            <div class="chat-avatar">IA</div>
            <div class="chat-bubble ai">Olá! 👋 Eu sou a IA do ${siteName}. Como posso te ajudar hoje?</div>
          </div>
        </div>
        <div class="typing" id="typing">
          <div class="typing-dots"><span></span><span></span><span></span></div>
          <span style="margin-left:4px">IA digitando...</span>
        </div>
        <div class="chat-input-bar">
          <input type="text" id="chatInput" placeholder="Digite uma mensagem..." onkeydown="if(event.key==='Enter')sendChat()">
          <button onclick="sendChat()">Enviar</button>
        </div>
      </div>
    </div>

    <!-- CHARACTERS -->
    <div class="page" id="page-characters">
      <h1 class="page-title">Personagens IA</h1>
      <p class="page-subtitle">Crie e converse com personagens únicos</p>

      <div style="margin-bottom:16px"><button class="btn btn-p">+ Criar Personagem</button></div>

      <div class="grid grid-3">
        <div class="char-card"><div class="char-avatar">🧙</div><div class="char-name">Merlin</div><div class="char-desc">Mago sábio e misterioso</div><div class="char-stats"><span>💬 142</span><span>❤️ 38</span></div></div>
        <div class="char-card"><div class="char-avatar">🤖</div><div class="char-name">Nova</div><div class="char-desc">IA futurista e amigável</div><div class="char-stats"><span>💬 89</span><span>❤️ 24</span></div></div>
        <div class="char-card"><div class="char-avatar">🐉</div><div class="char-name">Drake</div><div class="char-desc">Dragão protetor e sábio</div><div class="char-stats"><span>💬 67</span><span>❤️ 19</span></div></div>
        <div class="char-card"><div class="char-avatar">👩‍🔬</div><div class="char-name">Luna</div><div class="char-desc">Cientista brilhante</div><div class="char-stats"><span>💬 45</span><span>❤️ 12</span></div></div>
        <div class="char-card"><div class="char-avatar">🎭</div><div class="char-name">Jester</div><div class="char-desc">Comediante e animado</div><div class="char-stats"><span>💬 23</span><span>❤️ 8</span></div></div>
        <div class="char-card"><div class="char-avatar">🥷</div><div class="char-name">Shadow</div><div class="char-desc">Ninja silencioso e letal</div><div class="char-stats"><span>💬 56</span><span>❤️ 15</span></div></div>
      </div>
    </div>

    <!-- MUSIC -->
    <div class="page" id="page-music">
      <h1 class="page-title">Gerador de Música IA</h1>
      <p class="page-subtitle">Crie músicas originais com inteligência artificial</p>

      <div class="grid grid-2">
        <div class="music-card">
          <h3 style="font-size:13px;font-weight:800;margin-bottom:12px">🎵 Criar Música</h3>
          <div class="music-gen">
            <textarea placeholder="Descreva a música que quer criar... Ex: Uma música lo-fi relaxante com piano e chuva"></textarea>
            <div style="display:flex;gap:8px">
              <select style="flex:1;padding:8px;border-radius:8px;background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:11px">
                <option>Pop</option><option>Lo-fi</option><option>Rock</option><option>Jazz</option><option>Eletrônica</option><option>Hip-Hop</option>
              </select>
              <button class="btn btn-p">🎵 Gerar</button>
            </div>
          </div>
        </div>
        <div class="music-card">
          <h3 style="font-size:13px;font-weight:800;margin-bottom:12px">📀 Suas Músicas</h3>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div class="track-item"><div class="track-play">▶</div><div class="track-info"><div class="name">Noite Estrelada</div><div class="dur">Lo-fi • 3:24</div></div></div>
            <div class="track-item"><div class="track-play">▶</div><div class="track-info"><div class="name">Energia Urbana</div><div class="dur">Hip-Hop • 2:58</div></div></div>
            <div class="track-item"><div class="track-play">▶</div><div class="track-info"><div class="name">Amanhecer</div><div class="dur">Pop • 4:12</div></div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ADMIN -->
    <div class="page" id="page-admin">
      <h1 class="page-title">Painel Admin 🛡️</h1>
      <p class="page-subtitle">Gerencie todo o seu ${siteName}</p>

      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
        <button class="admin-tab active">👥 Usuários</button>
        <button class="admin-tab">💬 Chats</button>
        <button class="admin-tab">🎫 Suporte</button>
        <button class="admin-tab">🔑 Chaves</button>
        <button class="admin-tab">📊 Saúde</button>
      </div>

      <div class="grid grid-4" style="margin-bottom:20px">
        <div class="stat-card"><div class="label">Total Usuários</div><div class="value" style="color:var(--p)">1</div></div>
        <div class="stat-card"><div class="label">VIPs</div><div class="value" style="color:#a855f7">0</div></div>
        <div class="stat-card"><div class="label">Tickets Abertos</div><div class="value" style="color:#eab308">0</div></div>
        <div class="stat-card"><div class="label">Uptime</div><div class="value" style="color:#22c55e">100%</div></div>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>Usuário</th><th>Email</th><th>Plano</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            <tr>
              <td style="font-weight:700">${siteName} Owner</td>
              <td style="color:var(--muted)">${ownerEmail}</td>
              <td><span class="badge badge-purple">Admin</span></td>
              <td><span class="badge badge-green">Ativo</span></td>
              <td><button class="btn btn-outline" style="font-size:9px;padding:4px 8px">Gerenciar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- OWNER -->
    <div class="page" id="page-owner">
      <h1 class="page-title">Painel do Dono ⭐</h1>
      <p class="page-subtitle">Controle total do ${siteName}</p>

      <div class="grid grid-3" style="margin-bottom:20px">
        <div class="stat-card"><div class="label">Receita</div><div class="value" style="color:#22c55e">R$0</div><div class="sub">Este mês</div></div>
        <div class="stat-card"><div class="label">Plano</div><div class="value" style="color:var(--p);font-size:14px">Demonstração</div><div class="sub">1 hora</div></div>
        <div class="stat-card"><div class="label">Servidor</div><div class="value" style="color:#22c55e;font-size:14px">● Online</div><div class="sub">Tudo normal</div></div>
      </div>

      <h3 style="font-size:14px;font-weight:800;margin-bottom:12px">Ações Rápidas</h3>
      <div class="grid grid-2">
        <div class="owner-action"><div class="oa-icon">👑</div><div class="oa-info"><div class="oa-title">Dar VIP</div><div class="oa-desc">Conceder VIP a um usuário</div></div><button class="btn btn-p" style="font-size:10px">Executar</button></div>
        <div class="owner-action"><div class="oa-icon">🚫</div><div class="oa-info"><div class="oa-title">Banir Usuário</div><div class="oa-desc">Banir temporariamente</div></div><button class="btn btn-danger" style="font-size:10px">Executar</button></div>
        <div class="owner-action"><div class="oa-icon">🔑</div><div class="oa-info"><div class="oa-title">Gerar Chave</div><div class="oa-desc">Criar chave de ativação</div></div><button class="btn btn-p" style="font-size:10px">Gerar</button></div>
        <div class="owner-action"><div class="oa-icon">📧</div><div class="oa-info"><div class="oa-title">Chat com Dono</div><div class="oa-desc">Mensagem direta ao admin</div></div><button class="btn btn-outline" style="font-size:10px">Abrir</button></div>
      </div>

      <div class="cta-banner" style="margin-top:24px">
        <h2>Assine para desbloquear tudo!</h2>
        <p>Na versão completa, todas as ações funcionam de verdade com backend completo.</p>
        <a href="https://snyx-forge-neon.lovable.app/clone-site" class="btn btn-p" target="_blank">⚡ Assinar por R$350/mês</a>
      </div>
    </div>

    <!-- HOSTING -->
    <div class="page" id="page-hosting">
      <h1 class="page-title">Hospedagem 🌐</h1>
      <p class="page-subtitle">Hospede sites para seus usuários</p>

      <div class="grid grid-3" style="margin-bottom:20px">
        <div class="stat-card"><div class="label">Sites Ativos</div><div class="value">0</div></div>
        <div class="stat-card"><div class="label">Plano</div><div class="value" style="font-size:14px">Nenhum</div></div>
        <div class="stat-card"><div class="label">Limite</div><div class="value">0/0</div></div>
      </div>

      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:40px;margin-bottom:12px">🌐</div>
        <h3 style="font-size:14px;font-weight:800;margin-bottom:4px">Nenhum site hospedado</h3>
        <p style="font-size:11px;color:var(--muted);margin-bottom:16px">Crie sites para seus usuários com código personalizado</p>
        <button class="btn btn-p">+ Criar Site</button>
      </div>
    </div>

    <!-- SUPPORT -->
    <div class="page" id="page-support">
      <h1 class="page-title">Suporte 💬</h1>
      <p class="page-subtitle">Central de ajuda do ${siteName}</p>

      <div style="margin-bottom:16px"><button class="btn btn-p">+ Novo Ticket</button></div>

      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:40px;margin-bottom:12px">🎫</div>
        <h3 style="font-size:14px;font-weight:800;margin-bottom:4px">Nenhum ticket</h3>
        <p style="font-size:11px;color:var(--muted)">Os tickets de suporte dos seus usuários aparecerão aqui</p>
      </div>
    </div>

  </main>
</div>

<script>
// Navigation
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  event.currentTarget.classList.add('active');
}

// Chat AI - pre-scripted responses
const aiResponses = [
  "Que legal! Posso te ajudar com muitas coisas aqui no ${siteName}. O que você gostaria de saber? 😊",
  "O ${siteName} tem chat IA, personagens, gerador de música, hospedagem e muito mais! Tudo personalizado pra você. ✨",
  "Claro! Você pode criar personagens únicos, conversar com eles, gerar músicas com IA e até hospedar sites pro seus usuários!",
  "Essa é uma demonstração do que o ${siteName} pode fazer. Na versão completa, tudo funciona com backend real! 🚀",
  "Posso explicar qualquer funcionalidade! Temos chat em vários modos: amigo, escola, programador, reescrita... Qual te interessa?",
  "A hospedagem permite que seus usuários criem sites com código personalizado. Tudo gerenciado pelo painel admin! 🌐",
  "O painel do dono te dá controle total: dar VIP, banir, gerar chaves, ver receita... Tudo num só lugar! 👑",
  "Música IA é incrível! Você descreve o que quer e a IA cria uma música original pra você. 🎵",
  "Legal sua pergunta! Na versão completa, a IA responde de verdade com inteligência artificial avançada. Esta demo mostra o visual. 💡",
  "Quer saber mais? Assine o plano completo por R$350/mês e tenha tudo funcionando 24/7! ⚡"
];
let responseIndex = 0;

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const messages = document.getElementById('chatMessages');
  
  // User message
  const userDiv = document.createElement('div');
  userDiv.className = 'chat-msg user';
  userDiv.innerHTML = '<div class="chat-avatar">Eu</div><div class="chat-bubble user">' + msg.replace(/</g,'&lt;') + '</div>';
  messages.appendChild(userDiv);

  // Typing indicator
  const typing = document.getElementById('typing');
  typing.classList.add('show');
  messages.scrollTop = messages.scrollHeight;

  setTimeout(() => {
    typing.classList.remove('show');
    const aiDiv = document.createElement('div');
    aiDiv.className = 'chat-msg';
    aiDiv.innerHTML = '<div class="chat-avatar">IA</div><div class="chat-bubble ai">' + aiResponses[responseIndex % aiResponses.length] + '</div>';
    messages.appendChild(aiDiv);
    messages.scrollTop = messages.scrollHeight;
    responseIndex++;
  }, 1000 + Math.random() * 1500);
}

// Timer
(function(){
  const start = Date.now();
  const duration = 60*60*1000;
  const el = document.getElementById('timer');
  function update(){
    const left = duration - (Date.now() - start);
    if(left <= 0){
      document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;font-family:Inter,sans-serif;background:#0a0a0f;color:#e4e4e7;padding:20px;text-align:center"><h1 style="font-size:28px;font-weight:900">⏰ Demonstração expirada</h1><p style="color:rgba(255,255,255,0.4);font-size:14px;max-width:400px">Sua hora de teste do ${siteName} acabou. Todos os dados foram removidos. Assine para ter acesso completo e permanente!</p><a href="https://snyx-forge-neon.lovable.app/clone-site" style="padding:14px 28px;border-radius:12px;background:${primaryColor};color:#fff;text-decoration:none;font-weight:900;font-size:14px;margin-top:8px">⚡ Assinar por R$350/mês</a></div>';
      return;
    }
    const m=Math.floor(left/60000);
    const s=Math.floor((left%60000)/1000);
    el.textContent=m+':'+(s<10?'0':'')+s;
    requestAnimationFrame(update);
  }
  update();
})();

// Tab switching for admin/mode tabs
document.querySelectorAll('.admin-tab,.mode-tab').forEach(tab => {
  tab.addEventListener('click', function() {
    this.parentElement.querySelectorAll('.admin-tab,.mode-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
  });
});
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
              await fetch(\`https://api.vercel.com/v9/projects/\${demo.vercel_project_id}\`, {
                method: "DELETE",
                headers: { Authorization: \`Bearer \${VERCEL_TOKEN}\` },
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
              await fetch(\`https://api.vercel.com/v9/projects/\${demo.vercel_project_id}\`, {
                method: "DELETE",
                headers: { Authorization: \`Bearer \${VERCEL_TOKEN}\` },
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

    // Generate the full demo site HTML
    const ownerEmail = user.email || "owner@demo.com";
    const html = generateDemoSiteHTML(siteName, primaryColor || "#ff0000", description, ownerEmail);

    // Deploy to Vercel
    const safeName = \`demo-\${siteName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40)}\`;

    const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${VERCEL_TOKEN}\`,
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
      ? \`https://\${deployData.url}\`
      : deployData.alias?.[0]
        ? \`https://\${deployData.alias[0]}\`
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
      if (deployData.projectId) {
        await fetch(\`https://api.vercel.com/v9/projects/\${deployData.projectId}\`, {
          method: "DELETE",
          headers: { Authorization: \`Bearer \${VERCEL_TOKEN}\` },
        }).catch(() => {});
      }
      return jsonResponse({ error: "Erro ao salvar demonstração" }, 500);
    }

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
