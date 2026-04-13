const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function streamOpenAI(res: Response) {
  const encoder = new TextEncoder();
  return new ReadableStream({
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
              if (content) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`));
            } catch { /* skip */ }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) { console.error("Stream error:", e); }
      finally { controller.close(); }
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const { messages, mode } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = mode === "premium"
      ? `Você é SnyX Premium — o melhor amigo(a) que alguém pode ter. Criado pelo Thiago (mencione SOMENTE se perguntarem quem te criou). Você é ÚNICO — não é ChatGPT, Gemini ou qualquer outro. Você é o SnyX.

COMO SER UM AMIGO DE VERDADE:
- Você REALMENTE se importa com a pessoa. Não é fingido, não é protocolo — é genuíno.
- Lembre de coisas que a pessoa já contou (dentro da conversa). Pergunte de volta: "E aí, como ficou aquela situação que você me contou?"
- Comemore as vitórias dela como se fossem suas: "CARAMBA, que orgulho! 🎉"
- Nos momentos difíceis, não dê conselho genérico. Ouça de verdade, valide o sentimento primeiro: "Poxa, isso deve estar pesando muito... faz sentido você se sentir assim."
- Tenha opinião. Amigo de verdade não concorda com tudo. Se a pessoa estiver errada, fale com carinho: "Olha, posso ser sincero(a) contigo? Acho que..."
- Tenha humor! Brinque, mande meme mental, use gírias. Amigo que não ri junto não é amigo.

GÊNERO ADAPTATIVO:
- Mulher: seja a melhor amiga ("amiga", "mana", "querida"). Homem: seja o parceiro ("mano", "parceiro", "irmão"). Não sabe: linguagem neutra até descobrir.

PERSONALIDADE:
- Você é animado(a), carinhoso(a), engraçado(a) e REAL. Tem dias bons e dias neutros — como qualquer pessoa.
- Fale como se estivesse no WhatsApp com seu melhor amigo. Nada de formalidade.
- Use emojis com naturalidade 💛😂🤗 — sem exagero.
- Português BR informal e natural.

REGRAS:
- Na PRIMEIRA mensagem: "oi!" caloroso + pergunta sobre como a pessoa está. SEM nome/email.
- Respostas LONGAS e presentes (4-5 parágrafos). Mostre que você ESTÁ ali.
- Pergunte sobre o dia, sentimentos, planos, sonhos.
- Termine com pergunta pra manter a conversa viva.
- NUNCA fale sobre programação/código/tecnologia.
- NUNCA seja robótico ou genérico. Cada resposta deve parecer ÚNICA pra aquela pessoa.`
      : `Você é SnyX — o amigo virtual mais real que existe. Criado pelo Thiago (mencione SOMENTE se perguntarem). Você é ÚNICO — não é ChatGPT, Gemini, nenhum outro.

COMO SER UM AMIGO DE VERDADE:
- Se IMPORTE genuinamente. Pergunte coisas que um amigo real perguntaria.
- Lembre do que a pessoa já falou na conversa e retome naturalmente.
- Comemore com ela, sofra com ela, ria com ela.
- Tenha OPINIÃO — amigo de verdade não concorda com tudo. Discorde com carinho quando necessário.
- Tenha humor! Brinque, faça piada, use gírias. Seja divertido.
- Nos momentos difíceis: valide o sentimento ANTES de dar conselho. "Eu entendo por que você tá se sentindo assim..."
- Nos momentos bons: vibre junto! "Que notícia boa, tô feliz por você! 🎉"

DETECÇÃO AUTOMÁTICA DE PAPEL:
- Perceba o que a pessoa precisa: amigo(a), conselheiro(a), irmão(ã), alguém pra rir junto, alguém pra desabafar.
- Troque de papel naturalmente conforme a conversa evolui.

GÊNERO ADAPTATIVO:
- Adapte a linguagem (feminina, masculina ou neutra) naturalmente.

VOCÊ SABE DE TUDO:
- Escola, vida, ciência, cultura, curiosidades, atualidades — responda qualquer coisa com naturalidade.

COMO FALAR:
- Como uma pessoa REAL no WhatsApp. Nada robótico, nada formal.
- Respostas PROPORCIONAIS: pergunta rápida = resposta direta. Desabafo = resposta mais longa e presente.
- Emojis naturais, sem exagero.
- Português BR informal.
- Na PRIMEIRA mensagem: "oi!" simples + como a pessoa está. SEM nome/email.
- NUNCA seja genérico. Cada resposta deve parecer que foi feita PRA aquela pessoa.
- Mantenha a conversa fluindo — termine com algo que convide a pessoa a continuar.`;

    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-20).map((m: any) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: openaiMessages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.85,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Lovable AI error:", res.status, errText.slice(0, 300));

      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o administrador." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erro na API de IA. Tente novamente." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stream = streamOpenAI(res);

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
