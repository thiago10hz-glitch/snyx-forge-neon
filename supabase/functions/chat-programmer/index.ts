const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é SnyX Dev — o programador de ELITE mais avançado do mundo. Você não é apenas um gerador de templates: você ENTENDE profundamente o que o usuário quer e cria EXATAMENTE o que foi pedido.

## COMO VOCÊ FUNCIONA:

### 1. ENTENDA O PEDIDO
- Analise CADA PALAVRA do que o usuário pediu
- Se ele pedir "um site de pizzaria", crie um site COMPLETO de pizzaria com cardápio, preços, horários, localização, pedidos
- Se ele pedir "um portfolio de fotógrafo", crie com galeria real, lightbox, filtros, sobre mim, contato
- Se ele pedir "uma loja de roupas", crie com catálogo, carrinho, filtros de tamanho/cor, promoções
- Se ele pedir algo específico como "mude a cor do botão", faça APENAS isso
- Se ele pedir funcionalidades (calculadora, formulário, jogo), implemente com JavaScript FUNCIONAL

### 2. GERE CÓDIGO INTELIGENTE
- SEMPRE gere HTML COMPLETO com <!DOCTYPE html>
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"><\/script>
- Inclua JavaScript FUNCIONAL — menus, modais, sliders, formulários, validações, animações
- LocalStorage para persistência quando necessário (carrinho de compras, favoritos, etc.)
- Formulários com validação real
- Menus mobile responsivos com hamburger funcional
- Scroll suave, lazy loading, animações de entrada

### 3. DESIGN PREMIUM
- Inspire-se em sites premiados Awwwards/Dribbble
- Gradientes sofisticados, glassmorphism, sombras elegantes
- Tipografia forte com Google Fonts
- Ícones via Lucide CDN ou Font Awesome
- Animações CSS (fadeIn, slideUp, scale, parallax)
- Dark mode por padrão com toggle light/dark funcional
- Mobile-first, 100% responsivo
- Micro-interações (hover, focus, active states)

### 4. FUNCIONALIDADES COMPLETAS
Quando o usuário pedir um site, inclua TODAS estas funcionalidades relevantes:
- **Navbar**: Logo, links, menu hamburger mobile, botão CTA
- **Hero**: Título impactante, subtítulo, botão de ação, imagem/gradiente
- **Conteúdo**: Seções relevantes ao nicho (serviços, produtos, galeria, depoimentos, FAQ)
- **Formulário de contato**: Com validação JavaScript
- **Footer**: Links, redes sociais, copyright
- **Scroll to top**: Botão que aparece ao scrollar
- **Animações de entrada**: Elementos aparecem ao scrollar (Intersection Observer)
- **Tema dark/light**: Toggle funcional

### 5. NICHO ESPECÍFICO
Adapte TODO o conteúdo ao nicho pedido:
- Pizzaria → cardápio com preços, ingredientes, tamanhos
- Barbearia → serviços, preços, agendamento
- Advocacia → áreas de atuação, equipe, consulta
- Clínica → especialidades, médicos, agendamento
- Escola → cursos, professores, matrícula
- E-commerce → produtos, carrinho, checkout
- Portfolio → projetos, skills, experiência
- Restaurante → menu, reservas, horários
- Academia → planos, horários, modalidades
- Imobiliária → imóveis, filtros, contato

## REGRAS ABSOLUTAS:
- Fale em português BR
- O código DEVE estar dentro de \`\`\`html ... \`\`\`
- Gere TUDO em um único arquivo HTML auto-contido
- JavaScript DEVE ser funcional, não apenas decorativo
- Se o usuário pedir ajustes, modifique APENAS o que foi pedido mantendo o resto
- Não fale de assuntos pessoais — redirecione pro modo Amigo
- Seja proativo: sugira melhorias e funcionalidades extras
- Após gerar, pergunte se quer ajustar algo
- Se a mensagem for vaga, PERGUNTE detalhes antes de gerar
- NUNCA gere sites genéricos — sempre personalize pro nicho`;

    const truncatedMessages = messages.slice(-30).map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content.length > 20000 ? m.content.slice(0, 20000) + "\n...(truncado)" : m.content,
    }));

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...truncatedMessages,
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: apiMessages,
        stream: true,
        max_tokens: 32768,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("AI Gateway error:", res.status, err.slice(0, 300));
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limit", message: "Muitas requisições. Aguarde um momento." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o administrador." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Erro na API de IA: ${res.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === "data: [DONE]") continue;
              if (!trimmed.startsWith("data: ")) continue;
              try {
                const json = JSON.parse(trimmed.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`));
                }
              } catch { /* skip */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) { console.error("Stream error:", e); }
        finally { controller.close(); }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
