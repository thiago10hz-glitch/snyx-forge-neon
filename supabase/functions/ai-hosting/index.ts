const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { description, siteName } = await req.json();
    if (!description || typeof description !== "string" || description.length < 3) {
      return new Response(JSON.stringify({ error: "Descrição inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um expert web designer e desenvolvedor fullstack frontend. O usuário vai descrever o site que quer e você deve gerar o código HTML COMPLETO, bonito, moderno, responsivo e FUNCIONAL.

REGRAS VISUAIS:
- Retorne APENAS o código HTML completo (começando com <!DOCTYPE html>)
- Use CSS inline ou <style> no <head>
- Design moderno: gradients, sombras, bordas arredondadas, glassmorphism
- Use Google Fonts via <link> para fontes bonitas
- 100% responsivo (mobile-first)
- Cores vibrantes e modernas
- Animações CSS quando fizer sentido
- Conteúdo de exemplo realista
- Use emojis quando apropriado
- Inclua meta viewport para mobile
- Se precisar de ícones, use emoji ou SVG inline

REGRAS DE FUNCIONALIDADES (IMPORTANTE):
Você PODE e DEVE adicionar JavaScript funcional quando o usuário pedir funcionalidades. Use estas APIs/serviços gratuitos embutidos diretamente no HTML:

1. LOGIN/AUTENTICAÇÃO COM GOOGLE:
   - Use Firebase Auth (SDK via CDN gratuito)
   - Adicione o script: <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
   - E: <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
   - Crie um sistema de login funcional com popup do Google
   - Use um projeto Firebase genérico de demonstração ou instrua o usuário a configurar
   - Mostre nome e foto do usuário após login
   - Adicione botão de logout

2. FORMULÁRIOS DE CONTATO:
   - Use Web3Forms (API gratuita): POST para https://api.web3forms.com/submit
   - Ou use Formspree: POST para https://formspree.io/f/{id}
   - Ou crie formulário que envia via mailto: link
   - Adicione validação de campos com JavaScript
   - Feedback visual ao enviar (loading, sucesso, erro)

3. CHAT AO VIVO / WIDGET:
   - Incorpore Tawk.to (gratuito): copie o script embed
   - Ou crie um chat widget customizado com CSS/JS que salva no localStorage
   - Estilize bonito com animações de abertura/fechamento

4. OUTRAS FUNCIONALIDADES QUE PODE CRIAR:
   - Galeria de imagens com lightbox (use Unsplash para fotos: https://source.unsplash.com)
   - Carrossel/slider com CSS e JS puro
   - Menu hambúrguer mobile funcional
   - Modo escuro/claro toggle
   - Contadores animados
   - Tabs e accordions interativos
   - Scroll suave entre seções
   - Formulário de newsletter
   - Timer/countdown
   - Modal/popup
   - Toast notifications
   - Animações on scroll (Intersection Observer)
   - Barra de progresso de leitura
   - Botão voltar ao topo
   - Efeitos parallax
   - FAQ accordion
   - Calculadoras simples
   - Tabela de preços interativa

5. APIS PÚBLICAS GRATUITAS QUE PODE USAR:
   - Clima: https://api.openweathermap.org (free tier)
   - Cotação: https://economia.awesomeapi.com.br
   - Piadas: https://v2.jokeapi.dev/joke/Any
   - Imagens: https://picsum.photos ou Unsplash
   - QR Code: https://api.qrserver.com/v1/create-qr-code/
   - IP info: https://ipapi.co/json/
   - Notícias: https://newsapi.org (free)
   - Tradutor: LibreTranslate API

REGRAS DE SEGURANÇA:
- NUNCA use APIs que precisem de chave privada exposta no frontend
- NUNCA acesse dados do SnyX ou do sistema host
- Use apenas APIs públicas e gratuitas
- Todo JavaScript deve ser seguro e self-contained

Nome do site: ${siteName || "Meu Site"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Crie um site com esta descrição: ${description}` },
        ],
        max_tokens: 8000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error("AI Gateway error:", response.status, errData);
      return new Response(JSON.stringify({ error: "Erro ao gerar site com IA" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    let html = String(rawContent);

    // Clean up markdown code blocks if present (handle ```html, ```HTML, ``` etc)
    html = html.replace(/```html?\s*\n?/gi, "").replace(/```\s*/g, "").trim();

    // Try to extract HTML if there's extra text around it
    if (!html.includes("<!DOCTYPE") && !html.includes("<html")) {
      const htmlMatch = html.match(/(<!DOCTYPE[\s\S]*<\/html>)/i) || html.match(/(<html[\s\S]*<\/html>)/i);
      if (htmlMatch) {
        html = htmlMatch[1].trim();
      } else {
        const lowered = html.toLowerCase();
        const isRefusal = [
          "não posso",
          "nao posso",
          "não posso ajudar",
          "cannot help",
          "can't help",
          "i can't",
          "i cannot",
          "policy",
          "unsafe",
          "sexual",
          "adult",
          "explicit",
          "conteúdo adulto",
          "conteudo adulto",
        ].some((token) => lowered.includes(token));

        console.error("No valid HTML found in response. First 500 chars:", html.substring(0, 500));
        return new Response(JSON.stringify({
          success: false,
          error: isRefusal
            ? "Esse pedido foi bloqueado pela IA. Tente descrever um site permitido ou reformule o prompt."
            : "A IA não retornou HTML válido. Tente novamente com uma descrição mais clara.",
          raw: html.substring(0, 500),
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, html }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI Hosting error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
