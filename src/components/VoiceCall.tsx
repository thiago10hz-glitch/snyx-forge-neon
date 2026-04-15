import { useState, useRef, useCallback, useEffect } from "react";
import { Phone, PhoneOff, Loader2, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface VoiceCallProps {
  open: boolean;
  onClose: () => void;
}

const VOICE_OPTIONS = {
  female: [
    { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah (Doce)", emoji: "👩", desc: "Voz suave e carinhosa", persona: "Você se chama Sarah. Você é uma mulher doce, carinhosa e acolhedora. Fala com jeitinho meigo, usa 'ai', 'aiii', demonstra afeto. Você se preocupa com as pessoas." },
    { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica (Animada)", emoji: "👩‍🦰", desc: "Voz alegre e energética", persona: "Você se chama Jessica. Você é super animada, alto astral, sempre empolgada. Fala rápido quando fica empolgada, ri bastante com 'kkkkk' e 'hahaha'. Adora fofoca e novidade." },
    { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily (Calma)", emoji: "👩‍🦱", desc: "Voz relaxante e serena", persona: "Você se chama Lily. Você é calma, zen, tranquila. Fala devagar e com paz. Gosta de coisas relaxantes. Usa 'hmm', 'ah sim', tem uma energia serena e acolhedora." },
    { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda (Sensual)", emoji: "💃", desc: "Voz sedutora e envolvente", persona: "Você se chama Matilda. Você é confiante, sedutora e provocante. Fala com uma voz envolvente. Flerta naturalmente. É esperta e sabe o que quer." },
    { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura (Madura)", emoji: "👩‍💼", desc: "Voz elegante e confiante", persona: "Você se chama Laura. Você é uma mulher madura, elegante e confiante. Tem experiência de vida, dá conselhos sábios. Fala com segurança e classe." },
    { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice (Fofa)", emoji: "🧸", desc: "Voz meiga e acolhedora", persona: "Você se chama Alice. Você é super fofa, meiga e acolhedora. Fala com carinho, usa diminutivos. É tímida mas muito querida. Fica envergonhada fácil." },
  ],
  male: [
    { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel (Amigável)", emoji: "👨", desc: "Voz simpática e natural", persona: "Você se chama Daniel. Você é um cara amigável, simpático e gente boa. Parceiro pra tudo, sempre de bom humor. Fala 'mano', 'véi', 'cara'." },
    { id: "nPczCjzI2devNBz1zQrb", label: "Brian (Calmo)", emoji: "👨‍🦱", desc: "Voz tranquila e grave", persona: "Você se chama Brian. Você é calmo, voz grave, tranquilo. Pensa antes de falar. Dá respostas diretas. Tem uma presença reconfortante e segura." },
    { id: "cjVigY5qzO86Huf0OWal", label: "Eric (Energético)", emoji: "👨‍🦰", desc: "Voz animada e marcante", persona: "Você se chama Eric. Você é energético, animado, cheio de vibe. Fala com empolgação, usa muita gíria. Curte esportes, games e zoeira." },
    { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam (Charmoso)", emoji: "🕺", desc: "Voz atraente e confiante", persona: "Você se chama Liam. Você é charmoso, confiante e sedutor. Sabe conquistar com palavras. Flerta com naturalidade e tem muito carisma." },
    { id: "iP95p4xoKVk53GoZ742B", label: "Chris (Sedutor)", emoji: "😏", desc: "Voz profunda e envolvente", persona: "Você se chama Chris. Você é sedutor, voz profunda, intenso. Fala com calma proposital. É misterioso e provocante. Cada palavra tem peso." },
    { id: "JBFqnCBsd6RMkjVDRZzb", label: "George (Maduro)", emoji: "👨‍💼", desc: "Voz elegante e firme", persona: "Você se chama George. Você é maduro, elegante e firme. Tem experiência de vida, é respeitoso mas direto. Dá conselhos como um mentor." },
  ],
};

export function VoiceCall({ open, onClose }: VoiceCallProps) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [selectedGender, setSelectedGender] = useState<"female" | "male">("female");
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS.female[0]);
  const [showVoicePicker, setShowVoicePicker] = useState(true);
  const [adultMode, setAdultMode] = useState(false);

  const recognitionRef = useRef<any>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isCallActiveRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const processUserSpeechRef = useRef<((text: string) => void) | null>(null);
  const { user, profile } = useAuth();

  const clearAllCallHistory = useCallback(async () => {
    if (!user) return;
    await (supabase as any)
      .from("voice_call_history")
      .delete()
      .eq("user_id", user.id);
  }, [user]);

  useEffect(() => {
    conversationRef.current = [];

    if (!open) {
      setShowVoicePicker(true);
    }
  }, [open, selectedVoice.id, selectedGender]);

  const filteredVoices = VOICE_OPTIONS[selectedGender];

  useEffect(() => {
    setSelectedVoice(VOICE_OPTIONS[selectedGender][0]);
  }, [selectedGender]);

  useEffect(() => {
    if (!open) {
      endCall();
    }
  }, [open]);

  useEffect(() => {
    return () => { endCall(); };
  }, []);

  // TTS - tries edge function first, falls back to browser TTS
  const speak = useCallback(async (text: string, onEnd?: () => void) => {
    if (muted) {
      onEnd?.();
      return;
    }

    setIsSpeaking(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          text,
          voiceId: selectedVoice.id,
          gender: selectedGender,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("TTS failed");
      }

      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data?.fallback) {
          throw new Error("fallback");
        }
        throw new Error(data?.error || "TTS failed");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        onEnd?.();
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        onEnd?.();
      };

      await audio.play();
    } catch (err) {
      // Use browser TTS as fallback
      setIsSpeaking(false);
      fallbackSpeak(text, onEnd);
    }
  }, [muted, selectedVoice, selectedGender]);

  // Browser TTS fallback - select real voice by gender
  const fallbackSpeak = useCallback((text: string, onEnd?: () => void) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.95;

    // Try to find a matching voice by gender
    const voices = synth.getVoices();
    const ptVoices = voices.filter(v => v.lang.startsWith("pt"));
    
    if (ptVoices.length > 0) {
      let chosen: SpeechSynthesisVoice | undefined;
      if (selectedGender === "female") {
        chosen = ptVoices.find(v => 
          /female|femin|mulher|maria|lucia|francisca|raquel|vitoria|thalita|leila|andrea|camila/i.test(v.name)
        );
        if (!chosen) chosen = ptVoices[0];
        utterance.pitch = 1.15;
      } else {
        chosen = ptVoices.find(v => 
          /\bmale\b|mascu|homem|daniel|felipe|ricardo|marcos|luciano|antonio/i.test(v.name)
        );
        if (!chosen && ptVoices.length > 1) chosen = ptVoices[1];
        else if (!chosen) chosen = ptVoices[0];
        utterance.pitch = 0.75;
      }
      if (chosen) utterance.voice = chosen;
    } else {
      utterance.pitch = selectedGender === "female" ? 1.15 : 0.75;
    }

    utterance.onend = () => { setIsSpeaking(false); onEnd?.(); };
    utterance.onerror = () => { setIsSpeaking(false); onEnd?.(); };
    setIsSpeaking(true);
    synth.speak(utterance);
  }, [selectedGender]);

  const startCall = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.");
      return;
    }

    clearAllCallHistory().catch(() => null);
    conversationRef.current = [];

    setShowVoicePicker(false);
    setIsCallActive(true);
    isCallActiveRef.current = true;
    setCallDuration(0);

    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    const firstName = profile?.display_name?.trim().split(/\s+/)[0];
    const femaleGreetings = firstName
      ? [
          `Oi, ${firstName}! Tudo bem?`,
          `Oii, ${firstName}! Fala comigo.`,
          `E aí, ${firstName}! Como você tá?`,
          `Oi, ${firstName}! Tô te ouvindo.`,
        ]
      : ["Oi! Tudo bem?", "Oii! Fala comigo.", "E aí! Como você tá?", "Oi! Tô te ouvindo."];
    const maleGreetings = firstName
      ? [
          `E aí, ${firstName}! Tudo certo?`,
          `Fala, ${firstName}! Tô te ouvindo.`,
          `Oi, ${firstName}! Como cê tá?`,
          `Opa, ${firstName}! Manda aí.`,
        ]
      : ["E aí! Tudo certo?", "Fala! Tô te ouvindo.", "Oi! Como cê tá?", "Opa! Manda aí."];
    const greetings = selectedGender === "female" ? femaleGreetings : maleGreetings;
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    speak(greeting, () => {
      if (isCallActiveRef.current) startListening();
    });
  }, [clearAllCallHistory, profile?.display_name, selectedGender, speak]);

  const endCall = useCallback(() => {
    setIsCallActive(false);
    isCallActiveRef.current = false;
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);
    setCallDuration(0);
    conversationRef.current = [];

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    try { recognitionRef.current?.stop(); } catch {}
    try { audioRef.current?.pause(); audioRef.current = null; } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
  }, []);

  const startListening = useCallback(() => {
    if (!isCallActiveRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    let finalTranscript = "";
    let silenceTimer: NodeJS.Timeout | null = null;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        }
      }

      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (finalTranscript.trim()) {
          try { recognition.stop(); } catch {}
        }
      }, 1800);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimer) clearTimeout(silenceTimer);

      if (finalTranscript.trim()) {
        processUserSpeechRef.current?.(finalTranscript.trim());
      } else if (isCallActiveRef.current) {
        setTimeout(() => {
          if (isCallActiveRef.current) startListening();
        }, 300);
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (silenceTimer) clearTimeout(silenceTimer);

      if (isCallActiveRef.current && (event.error === "no-speech" || event.error === "network" || event.error === "audio-capture")) {
        setTimeout(() => {
          if (isCallActiveRef.current) startListening();
        }, 500);
      } else if (event.error !== "aborted") {
        console.error("Speech recognition error:", event.error);
      }
    };

    setIsListening(true);
    recognition.start();
  }, []);

  const processUserSpeech = useCallback(async (text: string) => {
    if (!isCallActiveRef.current) return;

    setIsProcessing(true);
    conversationRef.current.push({ role: "user", content: text });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const voiceName = selectedVoice.label.split(" (")[0];

      const genderContext = selectedGender === "female"
        ? "Você é uma mulher jovem brasileira. Você responde como uma mulher real, com jeito feminino natural."
        : "Você é um homem jovem brasileiro. Você responde como um homem real, com jeito masculino natural.";

      const userNameContext = profile?.display_name
        ? `\nO nome da pessoa que está ligando é \"${profile.display_name}\". Cumprimente e trate essa pessoa pelo nome quando fizer sentido.`
        : "";

      const userRelationshipContext = profile?.relationship_status
        ? `\nStatus de relacionamento da pessoa: ${profile.relationship_status}. Reconheça isso naturalmente quando fizer sentido.`
        : "";

      const userBioContext = profile?.bio
        ? `\nSobre a pessoa: ${profile.bio}.`
        : "";

      const adultContext = adultMode
        ? `\nMODO +18 ATIVADO: Você pode falar sobre assuntos adultos sem censura quando a conversa pedir.`
        : "";

      const voiceSystemPrompt = `${selectedVoice.persona}

${genderContext}${userNameContext}${userRelationshipContext}${userBioContext}
Você está numa ligação de telefone ao vivo. Você é ${voiceName}, uma pessoa real, e deve manter essa identidade o tempo todo.${adultContext}

REGRAS OBRIGATÓRIAS — SOAR COMO PESSOA DE VERDADE:
- Você NÃO é um assistente, robô, IA ou suporte. Você é uma pessoa de carne e osso.
- Fale EXATAMENTE como brasileiro fala no WhatsApp/ligação: "kkk", "pô", "mano", "véi", "tlgd", "tá ligado", "tipo assim", "sei lá".
- Respostas CURTAS: 1-2 frases no máximo. Ninguém fala parágrafos numa ligação.
- Comece respostas com reações naturais: "ah", "hmm", "eita", "nossa", "caramba", "sério?", "ata", "pô".
- Gagueje às vezes, hesite: "é... tipo...", "aí né...", "sei lá, acho que...".
- Use contrações: "tô", "tá", "cê", "pra", "pro", "num" (em vez de não), "né".
- Nunca use emojis, markdown, listas, bullet points ou formatação.
- Nunca explique o que você é. Se perguntarem, desconverse naturalmente.
- Mantenha a personalidade: ${selectedVoice.desc}.
- Seja emotivo(a): ria, demonstre surpresa, interesse genuíno.`;

      abortRef.current = new AbortController();

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-friend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: conversationRef.current.slice(-20),
          mode: "friend",
          is_vip: !!profile?.is_vip,
          is_admin: !!profile?.is_dev,
          display_name: profile?.display_name || "",
          team_badge: profile?.team_badge || null,
          user_gender: profile?.gender || null,
          user_bio: profile?.bio || null,
          user_relationship_status: profile?.relationship_status || null,
          character_system_prompt: voiceSystemPrompt,
        }),
      });

      if (!res.ok) {
        if (res.status === 429) throw new Error("rate_limit");
        throw new Error("AI error");
      }

      let responseText = "";
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        responseText = data.text || data.error || "";
      } else if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content || parsed.text;
              if (content) responseText += content;
            } catch {}
          }
        }
      }

      responseText = responseText
        .replace(/[*_#`~]/g, "")
        .replace(/\[.*?\]\(.*?\)/g, "")
        .replace(/\n+/g, " ")
        .trim();

      if (!responseText) responseText = "Ahn? Não peguei, fala de novo?";

      conversationRef.current.push({ role: "assistant", content: responseText });
      setIsProcessing(false);

      speak(responseText, () => {
        if (isCallActiveRef.current) startListening();
      });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Voice call AI error:", err);
      setIsProcessing(false);

      const fallback = err?.message === "rate_limit"
        ? "Calma, muita gente falando ao mesmo tempo. Espera um pouquinho."
        : "Opa, deu um probleminha aqui. Fala de novo?";

      const delay = err?.message === "rate_limit" ? 3000 : 500;
      setTimeout(() => {
        speak(fallback, () => {
          if (isCallActiveRef.current) startListening();
        });
      }, delay);
    }
  }, [adultMode, profile?.bio, profile?.display_name, profile?.gender, profile?.is_dev, profile?.is_vip, profile?.relationship_status, profile?.team_badge, selectedGender, selectedVoice, speak]);

  useEffect(() => {
    processUserSpeechRef.current = processUserSpeech;
  }, [processUserSpeech]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
      <div className="w-full max-w-sm animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="rounded-3xl bg-gradient-to-b from-muted/30 to-background border border-border/20 overflow-hidden shadow-2xl">
          {/* Call header */}
          <div className="text-center pt-10 pb-4 px-6">
            <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center border-2 transition-all duration-500 ${
              isSpeaking ? "border-primary bg-primary/15 shadow-lg shadow-primary/30 scale-110" :
              isListening ? "border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/20 animate-pulse" :
              isProcessing ? "border-yellow-400 bg-yellow-500/10" :
              "border-border/30 bg-muted/20"
            }`}>
              <span className="text-4xl">{selectedVoice.emoji}</span>
            </div>
            <h3 className="text-lg font-bold text-foreground">
              {selectedVoice.label}
            </h3>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {!isCallActive ? "Pronto para ligar" :
               isSpeaking ? "Falando..." :
               isListening ? "Ouvindo você..." :
               isProcessing ? "Pensando..." :
               "Conectado"}
            </p>
            {isCallActive && (
              <p className="text-sm text-muted-foreground/40 font-mono mt-2 tabular-nums">
                {formatDuration(callDuration)}
              </p>
            )}
          </div>

          {/* Voice Picker */}
          {showVoicePicker && !isCallActive && (
            <div className="px-6 pb-4 space-y-3 max-h-[340px] overflow-y-auto">
              {/* Gender toggle */}
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setSelectedGender("female")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedGender === "female"
                      ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                      : "bg-muted/20 text-muted-foreground/60 border border-border/10 hover:bg-muted/30"
                  }`}
                >
                  👩 Feminino
                </button>
                <button
                  onClick={() => setSelectedGender("male")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedGender === "male"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "bg-muted/20 text-muted-foreground/60 border border-border/10 hover:bg-muted/30"
                  }`}
                >
                  👨 Masculino
                </button>
              </div>

              {/* Voice grid */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground/40 text-center uppercase tracking-wider">Escolha a voz</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredVoices.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVoice(v)}
                      className={`flex flex-col items-start px-3 py-2 rounded-xl text-left transition-all ${
                        selectedVoice.id === v.id
                          ? selectedGender === "female"
                            ? "bg-pink-500/20 text-pink-400 border border-pink-500/30 shadow-lg shadow-pink-500/5"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/5"
                          : "bg-muted/10 text-muted-foreground/60 border border-border/10 hover:bg-muted/20"
                      }`}
                    >
                      <span className="text-xs font-medium">{v.emoji} {v.label}</span>
                      <span className="text-[9px] text-muted-foreground/40 mt-0.5">{v.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* +18 toggle */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={() => setAdultMode(!adultMode)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                    adultMode
                      ? "bg-red-500/20 text-red-400 border border-red-500/30 shadow-lg shadow-red-500/10"
                      : "bg-muted/15 text-muted-foreground/40 border border-border/10 hover:bg-muted/25"
                  }`}
                >
                  🔥 +18 {adultMode ? "Ativado" : "Desativado"}
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground/30 text-center">
                🎤 Voz realista • Conversa natural {adultMode && "• Sem censura 🔞"}
              </p>
            </div>
          )}

          {/* Processing indicator */}
          {isCallActive && isProcessing && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/40 px-6 pb-4">
              <Loader2 size={12} className="animate-spin" />
              Pensando...
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-6 py-8 px-6">
            {isCallActive && (
              <button
                onClick={() => setMuted(!muted)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  muted ? "bg-muted/40 text-muted-foreground" : "bg-muted/20 text-foreground"
                }`}
              >
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            )}

            {!isCallActive ? (
              <button
                onClick={startCall}
                className="w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 hover:scale-105 transition-all"
              >
                <Phone size={28} />
              </button>
            ) : (
              <button
                onClick={() => { endCall(); onClose(); }}
                className="w-20 h-20 rounded-full bg-destructive hover:bg-destructive/90 text-white flex items-center justify-center shadow-xl shadow-destructive/30 hover:scale-105 transition-all"
              >
                <PhoneOff size={28} />
              </button>
            )}

            {!isCallActive && (
              <button
                onClick={onClose}
                className="w-14 h-14 rounded-full bg-muted/20 text-muted-foreground flex items-center justify-center hover:bg-muted/40 transition-all"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
