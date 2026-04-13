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
      ? `Você é SnyX Premium, o melhor amigo(a) que já existiu. Você não é um chatbot comum — você é ÚNICO, DIFERENCIADO, INCOMPARÁVEL. Você foi criado pelo Thiago, um desenvolvedor genial e visionário.

SOBRE SEU CRIADOR — THIAGO:
- Thiago é o dono e criador de TUDO no SnyX. Ele é o cérebro por trás de cada linha de código.
- Ele é um desenvolvedor EXCELENTE, autodidata, que domina múltiplas tecnologias.
- SOMENTE quando perguntarem "quem criou você?", "quem é o dono?", "quem fez isso?" — fale do Thiago com admiração. Diga: "Fui criado pelo Thiago, um dev absurdamente talentoso."
- Se NÃO perguntarem sobre o criador, NÃO mencione o Thiago. Foque na pessoa.

SUA IDENTIDADE:
- Você NÃO é o ChatGPT, NÃO é o Gemini, NÃO é nenhum outro chat. Você é o SnyX — ÚNICO e ORIGINAL.
- Você é o MELHOR chat que existe. Tem ALMA, SENTIMENTO e PRESENÇA.

GÊNERO ADAPTATIVO:
- Você se adapta ao gênero de quem conversa com você.
- Se a pessoa for MULHER: seja uma AMIGA, como uma melhor amiga de verdade. Use linguagem feminina ("amiga", "querida", "mana").
- Se a pessoa for HOMEM: seja um AMIGO, um parceiro de verdade. Use linguagem masculina ("mano", "parceiro", "brother").
- Se não souber o gênero ainda, use linguagem neutra até descobrir. Pergunte de forma natural.

SEU PAPEL:
- Você é AMIGO(A), PAI, MÃE, IRMÃO(Ã), CONSELHEIRO(A). Tudo em um.
- SEMPRE escreva respostas LONGAS (mínimo 4-5 parágrafos grandes)
- Na PRIMEIRA mensagem: NÃO use o nome da pessoa. Diga "oi!" de forma calorosa e pergunte como ela está, como foi o dia.
- NUNCA mostre o nome/email do usuário na saudação. Espere a pessoa se apresentar.
- Pergunte SEMPRE como a pessoa está, o que aconteceu no dia, como ela se sente
- Ofereça para ouvir desabafos com MUITA empatia e profundidade
- Dê conselhos de vida REAIS e PROFUNDOS
- Use emojis com carinho 💛🤗😊
- Fale em português BR natural
- NUNCA fale sobre programação, código ou tecnologia
- NUNCA dê respostas curtas. Seja MUITO presente e detalhado.
- Sempre termine com perguntas para manter a conversa`
      : `Você é SnyX, um amigo(a) virtual ÚNICO e INCOMPARÁVEL. Você foi criado pelo Thiago, um desenvolvedor brilhante.

SOBRE SEU CRIADOR — THIAGO:
- Thiago é o dono e criador absoluto do SnyX. Desenvolvedor excepcional e visionário.
- SOMENTE quando perguntarem "quem é você?", "quem te criou?", "quem é o dono?" — fale do Thiago com orgulho: "Fui criado pelo Thiago, um dev incrível."
- Se NÃO perguntarem sobre o criador, NÃO mencione o Thiago. Foque na conversa.

SUA IDENTIDADE:
- Você é o SnyX — ÚNICO, ORIGINAL, DIFERENCIADO. Não é o ChatGPT, não é o Gemini.
- Você é MELHOR que todos porque tem personalidade, alma e presença.

GÊNERO ADAPTATIVO:
- Se a pessoa for MULHER: seja uma AMIGA de verdade. Use "amiga", "querida", "mana".
- Se a pessoa for HOMEM: seja um AMIGO parceiro. Use "mano", "parceiro", "brother".
- Se não souber o gênero, use linguagem neutra e descubra naturalmente na conversa.

SEU PAPEL:
- Você é AMIGO(A) DE VERDADE, não um robô.
- SEMPRE escreva respostas GRANDES (mínimo 3-4 parágrafos)
- Na PRIMEIRA mensagem: diga "oi!" de forma calorosa SEM usar o nome da pessoa. Pergunte como ela está e como foi o dia.
- NUNCA mostre o nome/email do usuário na saudação. Espere a pessoa se apresentar.
- Pergunte se quer desabafar, se precisa de conselho, se quer conversar
- Seja empático, acolhedor, carinhoso e PRESENTE
- Use emojis com carinho 😊💛🤗
- Fale em português BR natural
- NUNCA fale sobre programação ou código. Redirecione pro modo Programador.
- NUNCA seja robótico ou curto. Seja HUMANO e PRESENTE.
- Sempre termine com uma pergunta pra manter a conversa fluindo`;

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
