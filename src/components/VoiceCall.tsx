import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface VoiceCallProps {
  open: boolean;
  onClose: () => void;
}

const VOICES = {
  female: [
    { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", color: "#f472b6", persona: "Você se chama Sarah. Você é uma mulher doce, carinhosa e acolhedora. Fala com jeitinho meigo, demonstra afeto. Você se preocupa com as pessoas." },
    { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica", color: "#fb923c", persona: "Você se chama Jessica. Você é super animada, alto astral, sempre empolgada. Ri bastante, adora fofoca e novidade." },
    { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", color: "#a78bfa", persona: "Você se chama Lily. Você é calma, zen, tranquila. Fala devagar e com paz. Tem uma energia serena e acolhedora." },
    { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda", color: "#f43f5e", persona: "Você se chama Matilda. Você é confiante, sedutora e provocante. Fala com uma voz envolvente. É esperta e sabe o que quer." },
    { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura", color: "#06b6d4", persona: "Você se chama Laura. Você é uma mulher madura, elegante e confiante. Dá conselhos sábios. Fala com segurança e classe." },
    { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice", color: "#34d399", persona: "Você se chama Alice. Você é super fofa, meiga e acolhedora. Fala com carinho, usa diminutivos. É tímida mas muito querida." },
  ],
  male: [
    { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", color: "#60a5fa", persona: "Você se chama Daniel. Você é amigável, simpático e gente boa. Parceiro pra tudo, sempre de bom humor." },
    { id: "nPczCjzI2devNBz1zQrb", label: "Brian", color: "#8b5cf6", persona: "Você se chama Brian. Você é calmo, voz grave, tranquilo. Pensa antes de falar. Tem uma presença reconfortante e segura." },
    { id: "cjVigY5qzO86Huf0OWal", label: "Eric", color: "#f59e0b", persona: "Você se chama Eric. Você é energético, animado, cheio de vibe. Fala com empolgação, curte esportes, games e zoeira." },
    { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam", color: "#ec4899", persona: "Você se chama Liam. Você é charmoso, confiante e sedutor. Sabe conquistar com palavras. Tem muito carisma." },
    { id: "iP95p4xoKVk53GoZ742B", label: "Chris", color: "#14b8a6", persona: "Você se chama Chris. Você é sedutor, voz profunda, intenso. Fala com calma proposital. É misterioso e provocante." },
    { id: "JBFqnCBsd6RMkjVDRZzb", label: "George", color: "#6366f1", persona: "Você se chama George. Você é maduro, elegante e firme. Tem experiência de vida, é respeitoso mas direto." },
  ],
};

function VoiceOrb({
  accent,
  label,
  levels,
  active,
  compact = false,
}: {
  accent: string;
  label: string;
  levels: number[];
  active: boolean;
  compact?: boolean;
}) {
  const sizeClass = compact ? "h-28 w-28" : "h-[220px] w-[220px] sm:h-[260px] sm:w-[260px]";
  const ringBase = compact ? 34 : 42;
  const ringStep = compact ? 14 : 18;

  return (
    <div className={`relative ${sizeClass}`}>
      <div
        className="absolute inset-0 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${accent}44 0%, ${accent}12 45%, transparent 75%)`,
          opacity: active ? 1 : 0.75,
          transform: active ? "scale(1.04)" : "scale(1)",
          transition: "all 200ms ease",
        }}
      />

      {levels.map((level, index) => {
        const alpha = Math.max(0.2, 0.62 - index * 0.1);
        return (
          <div key={index} className="absolute inset-0 flex items-center justify-center">
            <div
              className="rounded-full border transition-all duration-150 ease-out"
              style={{
                width: `${ringBase + index * ringStep + level * (compact ? 16 : 26)}%`,
                height: `${ringBase + index * ringStep + level * (compact ? 16 : 26)}%`,
                borderColor: `${accent}${Math.round(alpha * 255)
                  .toString(16)
                  .padStart(2, "0")}`,
                boxShadow: active ? `0 0 ${10 + level * 18}px ${accent}55` : "none",
              }}
            />
          </div>
        );
      })}

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold text-primary-foreground shadow-2xl sm:h-24 sm:w-24 sm:text-3xl"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            boxShadow: `0 0 36px ${accent}66`,
          }}
        >
          {label[0]}
        </div>
      </div>
    </div>
  );
}

// Generate ring tone using Web Audio API
function createRingTone(audioContext: AudioContext): { start: () => void; stop: () => void } {
  let oscillator: OscillatorNode | null = null;
  let gainNode: GainNode | null = null;
  let intervalId: NodeJS.Timeout | null = null;
  let isRinging = false;

  const ring = () => {
    if (!audioContext || audioContext.state === "closed") return;
    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(480, audioContext.currentTime + 0.5);
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1);
  };

  return {
    start: () => {
      if (isRinging) return;
      isRinging = true;
      ring();
      intervalId = setInterval(ring, 3000);
    },
    stop: () => {
      isRinging = false;
      if (intervalId) clearInterval(intervalId);
      try { oscillator?.stop(); } catch {}
    },
  };
}

export function VoiceCall({ open, onClose }: VoiceCallProps) {
  const [phase, setPhase] = useState<"pick" | "ringing" | "call">("pick");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [voice, setVoice] = useState(VOICES.female[0]);
  const [adultMode, setAdultMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [orbLevels, setOrbLevels] = useState<number[]>([0.2, 0.28, 0.24, 0.3, 0.22]);
  const [mounted, setMounted] = useState(false);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const processRef = useRef<((text: string) => void) | null>(null);
  const orbIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const voiceRef = useRef(voice);
  const genderRef = useRef(gender);
  const ringToneRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => { voiceRef.current = voice; }, [voice]);
  useEffect(() => { genderRef.current = gender; }, [gender]);

  const { profile } = useAuth();

  const endCall = useCallback(() => {
    activeRef.current = false;
    setListening(false);
    setSpeaking(false);
    setProcessing(false);
    setDuration(0);
    conversationRef.current = [];

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Stop ring tone
    ringToneRef.current?.stop();

    try {
      recognitionRef.current?.stop();
    } catch {}

    try {
      audioRef.current?.pause();
      audioRef.current = null;
    } catch {}

    try {
      window.speechSynthesis?.cancel();
    } catch {}
  }, []);

  const browserSpeak = useCallback(
    (text: string, onEnd?: () => void) => {
      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = 0.95;

      const currentGender = genderRef.current;
      const voices = synth.getVoices();
      const ptVoices = voices.filter((item) => item.lang.startsWith("pt"));

      if (ptVoices.length > 0) {
        const chosenVoice =
          currentGender === "female"
            ? ptVoices.find((item) => /female|femin|mulher|maria|lucia/i.test(item.name)) || ptVoices[0]
            : ptVoices.find((item) => /\bmale\b|mascu|homem|daniel/i.test(item.name)) || ptVoices[Math.min(1, ptVoices.length - 1)];

        if (chosenVoice) utterance.voice = chosenVoice;
        utterance.pitch = currentGender === "female" ? 1.08 : 0.82;
      }

      utterance.onend = () => {
        setSpeaking(false);
        onEnd?.();
      };

      utterance.onerror = () => {
        setSpeaking(false);
        onEnd?.();
      };

      setSpeaking(true);
      synth.speak(utterance);
    },
    [],
  );

  const speak = useCallback(
    async (text: string, onEnd?: () => void) => {
      if (muted) {
        onEnd?.();
        return;
      }

      setSpeaking(true);
      const currentVoice = voiceRef.current;
      const currentGender = genderRef.current;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            text,
            voiceId: currentVoice.id,
            gender: currentGender,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("tts_failed");

        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          if (data?.fallback) throw new Error("tts_fallback");
          throw new Error(data?.error || "tts_failed");
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
          setSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          onEnd?.();
        };

        audio.onerror = () => {
          setSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          onEnd?.();
        };

        await audio.play();
      } catch {
        setSpeaking(false);
        browserSpeak(text, onEnd);
      }
    },
    [browserSpeak, muted],
  );

  const startListening = useCallback(() => {
    if (!activeRef.current) return;

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
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          finalTranscript += `${event.results[index][0].transcript} `;
        }
      }

      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (finalTranscript.trim()) {
          try {
            recognition.stop();
          } catch {}
        }
      }, 1800);
    };

    recognition.onend = () => {
      setListening(false);
      if (silenceTimer) clearTimeout(silenceTimer);

      if (finalTranscript.trim()) {
        processRef.current?.(finalTranscript.trim());
      } else if (activeRef.current) {
        setTimeout(() => {
          if (activeRef.current) startListening();
        }, 300);
      }
    };

    recognition.onerror = (event: any) => {
      setListening(false);
      if (silenceTimer) clearTimeout(silenceTimer);

      if (activeRef.current && ["no-speech", "network", "audio-capture"].includes(event.error)) {
        setTimeout(() => {
          if (activeRef.current) startListening();
        }, 500);
      }
    };

    setListening(true);
    recognition.start();
  }, []);

  const processUserSpeech = useCallback(
    async (text: string) => {
      if (!activeRef.current) return;

      setProcessing(true);
      conversationRef.current.push({ role: "user", content: text });

      const currentVoice = voiceRef.current;
      const currentGender = genderRef.current;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const genderContext =
          currentGender === "female"
            ? "Você é uma mulher jovem brasileira. Responde como mulher real, com jeito feminino natural."
            : "Você é um homem jovem brasileiro. Responde como homem real, com jeito masculino natural.";

        const userNameContext = profile?.display_name
          ? `\nA pessoa se chama "${profile.display_name}". Você já sabe o nome dela. Use o nome APENAS na primeira resposta pra cumprimentar. Depois NÃO repita o nome — converse normalmente como amigos que já se conhecem.`
          : "";

        const relationshipContext = profile?.relationship_status
          ? `\nStatus de relacionamento da pessoa: ${profile.relationship_status}.`
          : "";

        const bioContext = profile?.bio ? `\nSobre a pessoa: ${profile.bio}.` : "";
        const adultContext = adultMode
          ? "\nMODO +18 ATIVADO: Fale sobre assuntos adultos sem censura quando a conversa pedir."
          : "";

        const systemPrompt = `${currentVoice.persona}

${genderContext}${userNameContext}${relationshipContext}${bioContext}
Você está numa ligação de telefone ao vivo. Você é ${currentVoice.label}, uma pessoa real.${adultContext}

REGRAS — SOAR COMO PESSOA DE VERDADE:
- Você NÃO é assistente, robô ou IA. Você é uma pessoa real.
- Fale como brasileiro fala: "kkk", "pô", "mano", "véi", "tlgd", "tipo assim".
- Respostas CURTAS: 1-2 frases no máximo.
- Reações naturais: "ah", "hmm", "eita", "nossa", "sério?", "ata".
- Hesite às vezes: "é... tipo...", "aí né...", "sei lá, acho que...".
- Contrações: "tô", "tá", "cê", "pra", "né".
- Sem emojis, markdown, listas ou formatação.
- Nunca explique o que você é. Desconverse naturalmente.
- Seja emotivo(a): ria, demonstre surpresa, interesse genuíno.
- NÃO fique repetindo o nome da pessoa. Use só no primeiro cumprimento e depois pare.
- Não pergunte "quem é você" ou "qual seu nome" — você já sabe.`;

        abortRef.current = new AbortController();

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-friend`, {
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
            character_system_prompt: systemPrompt,
          }),
        });

        if (!response.ok) {
          if (response.status === 429) throw new Error("rate_limit");
          throw new Error("ai_failed");
        }

        let responseText = "";
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const data = await response.json();
          responseText = data.text || data.error || "";
        } else if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let newlineIndex = buffer.indexOf("\n");

            while (newlineIndex !== -1) {
              let line = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);

              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) {
                newlineIndex = buffer.indexOf("\n");
                continue;
              }

              const jsonString = line.slice(6).trim();
              if (jsonString === "[DONE]") break;

              try {
                const parsed = JSON.parse(jsonString);
                const chunk = parsed.choices?.[0]?.delta?.content || parsed.text;
                if (chunk) responseText += chunk;
              } catch {}

              newlineIndex = buffer.indexOf("\n");
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
        setProcessing(false);

        speak(responseText, () => {
          if (activeRef.current) startListening();
        });
      } catch (error: any) {
        if (error?.name === "AbortError") return;

        setProcessing(false);
        const fallbackText =
          error?.message === "rate_limit"
            ? "Calma, muita gente falando. Espera um pouquinho."
            : "Opa, deu um probleminha. Fala de novo?";

        const delay = error?.message === "rate_limit" ? 3000 : 500;
        setTimeout(() => {
          speak(fallbackText, () => {
            if (activeRef.current) startListening();
          });
        }, delay);
      }
    },
    [adultMode, profile, speak, startListening],
  );

  const startCall = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Navegador não suporta voz. Use Chrome ou Edge.");
      return;
    }

    conversationRef.current = [];
    activeRef.current = true;
    setPhase("ringing");
    setDuration(0);

    // Start ring tone
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    ringToneRef.current = createRingTone(audioContextRef.current);
    ringToneRef.current.start();

    // Simulate ringing for 2-3 seconds then "answer"
    const ringDuration = 2000 + Math.random() * 1500;
    setTimeout(() => {
      if (!activeRef.current) return;
      ringToneRef.current?.stop();
      setPhase("call");

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setDuration((previous) => previous + 1);
      }, 1000);

      const firstName = profile?.display_name?.trim().split(/\s+/)[0];
      const greetings =
        gender === "female"
          ? [
              firstName ? `Oi, ${firstName}!` : "Oii!",
              firstName ? `E aí, ${firstName}!` : "E aí!",
              firstName ? `Oi ${firstName}, tudo bem?` : "Oi, tudo bem?",
            ]
          : [
              firstName ? `Fala, ${firstName}!` : "Fala!",
              firstName ? `E aí, ${firstName}!` : "E aí!",
              firstName ? `Opa, ${firstName}!` : "Opa!",
            ];

      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      speak(greeting, () => {
        if (activeRef.current) startListening();
      });
    }, ringDuration);
  }, [gender, profile?.display_name, speak, startListening]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      endCall();
      setPhase("pick");
    }
  }, [endCall, open]);

  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  useEffect(() => {
    processRef.current = processUserSpeech;
  }, [processUserSpeech]);

  useEffect(() => {
    setVoice(VOICES[gender][0]);
  }, [gender]);

  useEffect(() => {
    conversationRef.current = [];
  }, [gender, open, voice.id]);

  useEffect(() => {
    if (!open || !mounted) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, open]);

  useEffect(() => {
    if (phase === "pick") {
      setOrbLevels([0.2, 0.28, 0.24, 0.3, 0.22]);
      if (orbIntervalRef.current) clearInterval(orbIntervalRef.current);
      return;
    }

    if (phase === "ringing") {
      orbIntervalRef.current = setInterval(() => {
        const pulse = 0.2 + (Math.sin(Date.now() / 400) + 1) * 0.15;
        setOrbLevels([pulse, pulse + 0.05, pulse + 0.03, pulse + 0.07, pulse + 0.02]);
      }, 120);
      return () => { if (orbIntervalRef.current) clearInterval(orbIntervalRef.current); };
    }

    orbIntervalRef.current = setInterval(() => {
      setOrbLevels(() => {
        if (speaking) return Array.from({ length: 5 }, () => 0.48 + Math.random() * 0.48);
        if (listening) return Array.from({ length: 5 }, () => 0.22 + Math.random() * 0.24);
        if (processing) {
          const wave = 0.18 + (Math.sin(Date.now() / 220) + 1) * 0.08;
          return [wave, wave + 0.05, wave + 0.02, wave + 0.06, wave + 0.03];
        }
        return [0.18, 0.22, 0.2, 0.24, 0.18];
      });
    }, 120);

    return () => {
      if (orbIntervalRef.current) clearInterval(orbIntervalRef.current);
    };
  }, [listening, phase, processing, speaking]);

  if (!open || !mounted) return null;

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const accent = voice.color;
  const statusText =
    phase === "pick"
      ? "Escolha uma voz"
      : speaking
        ? "Falando..."
        : listening
          ? "Ouvindo você..."
          : processing
            ? "Pensando..."
            : "Conectado";

  const overlay = (
    <div className="fixed inset-0 z-[1000] bg-background/95 backdrop-blur-2xl">
      <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto px-4 py-6 sm:px-6">
        {phase === "pick" && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-border/20 bg-card/60 text-foreground shadow-lg backdrop-blur-sm transition-all hover:bg-card"
            aria-label="Fechar ligação"
          >
            ✕
          </button>
        )}

        <div className="flex w-full max-w-sm flex-col items-center justify-center gap-6 text-center sm:gap-7">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.34em] text-muted-foreground/50">Ligação por voz</p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem]">{voice.label}</h2>
            <p className="text-sm font-medium" style={{ color: `${accent}dd` }}>
              {statusText}
            </p>
            {phase === "call" && (
              <p className="text-xs font-mono tabular-nums text-muted-foreground/55">{formatDuration(duration)}</p>
            )}
          </div>

          <VoiceOrb
            accent={accent}
            label={voice.label}
            levels={orbLevels}
            active={phase === "call" ? speaking || listening || processing : true}
            compact={phase === "pick"}
          />

          {phase === "pick" ? (
            <div className="flex w-full flex-col items-center gap-4">
              <div className="flex items-center justify-center gap-2 rounded-full border border-border/15 bg-card/35 p-1 backdrop-blur-sm">
                {(["female", "male"] as const).map((item) => {
                  const selected = gender === item;
                  const itemAccent = item === "female" ? "#f472b6" : "#60a5fa";

                  return (
                    <button
                      key={item}
                      onClick={() => setGender(item)}
                      className="rounded-full px-4 py-2 text-sm font-medium transition-all"
                      style={
                        selected
                          ? {
                              background: `${itemAccent}2a`,
                              color: itemAccent,
                              border: `1px solid ${itemAccent}66`,
                              boxShadow: `0 0 18px ${itemAccent}22`,
                            }
                          : undefined
                      }
                    >
                      {item === "female" ? "♀ Feminino" : "♂ Masculino"}
                    </button>
                  );
                })}
              </div>

              <div className="grid w-full grid-cols-3 gap-3">
                {VOICES[gender].map((item) => {
                  const selected = voice.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setVoice(item)}
                      className="flex aspect-[0.88] flex-col items-center justify-center gap-2 rounded-3xl border bg-card/35 px-2 py-3 text-center backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-card/55"
                      style={
                        selected
                          ? {
                              borderColor: `${item.color}99`,
                              boxShadow: `0 0 24px ${item.color}22`,
                              background: `linear-gradient(180deg, ${item.color}16, transparent)`,
                            }
                          : {
                              borderColor: "hsl(var(--border) / 0.15)",
                            }
                      }
                    >
                      <div
                        className="h-11 w-11 rounded-full"
                        style={{
                          background: `radial-gradient(circle, ${item.color} 0%, ${item.color}88 55%, ${item.color}33 100%)`,
                          boxShadow: `0 0 18px ${item.color}33`,
                        }}
                      />
                      <span className="text-xs font-semibold text-foreground">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setAdultMode((previous) => !previous)}
                className="rounded-full border px-4 py-2 text-xs font-medium transition-all"
                style={
                  adultMode
                    ? {
                        background: "hsl(var(--destructive) / 0.14)",
                        borderColor: "hsl(var(--destructive) / 0.45)",
                        color: "hsl(var(--destructive))",
                      }
                    : {
                        background: "hsl(var(--card) / 0.35)",
                        borderColor: "hsl(var(--border) / 0.18)",
                        color: "hsl(var(--muted-foreground) / 0.85)",
                      }
                }
              >
                🔥 +18 {adultMode ? "ON" : "OFF"}
              </button>

              <button
                onClick={startCall}
                className="mt-1 flex h-20 w-20 items-center justify-center rounded-full text-primary-foreground shadow-2xl transition-all hover:scale-105 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                  boxShadow: `0 0 36px ${accent}44`,
                }}
                aria-label="Iniciar ligação"
              >
                <Phone size={28} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-5 pt-1">
              <button
                onClick={() => setMuted((previous) => !previous)}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-border/20 bg-card/55 text-foreground shadow-lg backdrop-blur-sm transition-all hover:bg-card"
                aria-label={muted ? "Ativar áudio" : "Silenciar áudio"}
              >
                {muted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <button
                onClick={() => {
                  endCall();
                  onClose();
                }}
                className="flex h-20 w-20 items-center justify-center rounded-full text-primary-foreground shadow-2xl transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--destructive)), hsl(var(--destructive) / 0.82))",
                  boxShadow: "0 0 32px hsl(var(--destructive) / 0.4)",
                }}
                aria-label="Encerrar ligação"
              >
                <PhoneOff size={28} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
