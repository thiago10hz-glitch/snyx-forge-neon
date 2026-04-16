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
    { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice", color: "#34d399", persona: "Você se chama Alice. Você é super fofa, meiga e acolhedora. Fala com carinho, usa diminutivos. É tímida mas muito querida." },
  ],
  male: [
    { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", color: "#60a5fa", persona: "Você se chama Daniel. Você é amigável, simpático e gente boa. Parceiro pra tudo, sempre de bom humor." },
  ],
};

function VoiceOrb({
  accent,
  label,
  levels,
  active,
  large = false,
}: {
  accent: string;
  label: string;
  levels: number[];
  active: boolean;
  large?: boolean;
}) {
  const size = large ? "h-[200px] w-[200px] sm:h-[240px] sm:w-[240px]" : "h-24 w-24 sm:h-28 sm:w-28";
  const innerSize = large ? "h-24 w-24 sm:h-28 sm:w-28 text-3xl sm:text-4xl" : "h-14 w-14 sm:h-16 sm:w-16 text-xl sm:text-2xl";
  const ringBase = large ? 38 : 40;
  const ringStep = large ? 16 : 16;
  const ringScale = large ? 22 : 14;

  return (
    <div className={`relative ${size}`}>
      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-full blur-3xl transition-all duration-500"
        style={{
          background: `radial-gradient(circle, ${accent}55 0%, ${accent}15 50%, transparent 75%)`,
          opacity: active ? 1 : 0.6,
          transform: active ? "scale(1.1)" : "scale(0.95)",
        }}
      />

      {/* Animated rings */}
      {levels.map((level, index) => {
        const alpha = Math.max(0.12, 0.5 - index * 0.09);
        return (
          <div key={index} className="absolute inset-0 flex items-center justify-center">
            <div
              className="rounded-full transition-all duration-200 ease-out"
              style={{
                width: `${ringBase + index * ringStep + level * ringScale}%`,
                height: `${ringBase + index * ringStep + level * ringScale}%`,
                border: `1.5px solid ${accent}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`,
                boxShadow: active ? `0 0 ${8 + level * 14}px ${accent}44` : "none",
              }}
            />
          </div>
        );
      })}

      {/* Center avatar circle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`flex items-center justify-center rounded-full font-bold text-white shadow-2xl ${innerSize}`}
          style={{
            background: `linear-gradient(145deg, ${accent}, ${accent}bb)`,
            boxShadow: `0 8px 32px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.15)`,
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
        // Retry once with ElevenLabs before falling back
        try {
          browserSpeak(text, onEnd);
        } catch {
          onEnd?.();
        }
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
      : phase === "ringing"
        ? "Chamando..."
        : speaking
          ? "Falando..."
          : listening
            ? "Ouvindo você..."
            : processing
              ? "Pensando..."
              : "Conectado";

  const overlay = (
    <div className="fixed inset-0 z-[1000] flex flex-col" style={{
      background: `radial-gradient(ellipse at 50% 30%, ${accent}12 0%, transparent 60%), linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.97) 100%)`,
    }}>
      {/* Decorative top blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full blur-[120px] opacity-30" style={{ background: accent }} />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Close button */}
      {phase === "pick" && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-muted/15 text-muted-foreground/70 backdrop-blur-md transition-all hover:bg-muted/30 hover:text-foreground"
          aria-label="Fechar"
        >
          ✕
        </button>
      )}

      {/* Main content - centered */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
        {phase === "pick" ? (
          /* === PICK PHASE === */
          <div className="flex w-full max-w-xs flex-col items-center gap-6">
            <div className="space-y-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40 font-medium">SnyX Voice</p>
              <h2 className="text-xl font-semibold text-foreground">Quem você quer chamar?</h2>
            </div>

            {/* Voice cards */}
            <div className="flex w-full gap-4">
              {([VOICES.female[0], VOICES.male[0]]).map((item) => {
                const selected = voice.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setVoice(item);
                      setGender(item.id === VOICES.female[0].id ? "female" : "male");
                    }}
                    className={`flex flex-1 flex-col items-center gap-3 rounded-3xl border p-5 transition-all duration-300 ${
                      selected ? "scale-[1.02] -translate-y-1" : "hover:scale-[1.01] hover:-translate-y-0.5"
                    }`}
                    style={
                      selected
                        ? {
                            borderColor: `${item.color}66`,
                            background: `linear-gradient(180deg, ${item.color}18 0%, ${item.color}08 100%)`,
                            boxShadow: `0 8px 32px ${item.color}20, 0 0 0 1px ${item.color}22`,
                          }
                        : {
                            borderColor: "hsl(var(--border) / 0.12)",
                            background: "hsl(var(--card) / 0.3)",
                          }
                    }
                  >
                    <div className="relative">
                      <div
                        className="h-16 w-16 rounded-full shadow-lg"
                        style={{
                          background: `linear-gradient(145deg, ${item.color}, ${item.color}aa)`,
                          boxShadow: selected ? `0 4px 20px ${item.color}44` : `0 2px 10px ${item.color}22`,
                        }}
                      />
                      {selected && (
                        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background flex items-center justify-center">
                          <div className="h-3.5 w-3.5 rounded-full" style={{ background: item.color }} />
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold text-foreground">{item.label}</span>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {item.id === VOICES.female[0].id ? "Feminino" : "Masculino"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* +18 toggle */}
            <button
              onClick={() => setAdultMode((prev) => !prev)}
              className="rounded-full px-4 py-1.5 text-[11px] font-medium transition-all border"
              style={
                adultMode
                  ? {
                      background: "hsl(var(--destructive) / 0.12)",
                      borderColor: "hsl(var(--destructive) / 0.35)",
                      color: "hsl(var(--destructive))",
                    }
                  : {
                      background: "transparent",
                      borderColor: "hsl(var(--border) / 0.15)",
                      color: "hsl(var(--muted-foreground) / 0.6)",
                    }
              }
            >
              🔥 +18 {adultMode ? "ON" : "OFF"}
            </button>

            {/* Call button */}
            <button
              onClick={startCall}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-white shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
              style={{
                background: `linear-gradient(145deg, ${accent}, ${accent}cc)`,
                boxShadow: `0 8px 40px ${accent}55, 0 0 0 4px ${accent}15`,
              }}
              aria-label="Iniciar ligação"
            >
              <Phone size={28} />
            </button>
          </div>
        ) : phase === "ringing" ? (
          /* === RINGING PHASE === */
          <div className="flex flex-col items-center gap-6">
            <div className="space-y-1 text-center">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40 font-medium">Chamando</p>
              <h2 className="text-2xl font-semibold text-foreground">{voice.label}</h2>
            </div>

            <VoiceOrb accent={accent} label={voice.label} levels={orbLevels} active large />

            <p className="animate-pulse text-xs text-muted-foreground/60">Aguarde...</p>

            <button
              onClick={() => { endCall(); onClose(); }}
              className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(135deg, hsl(var(--destructive)), hsl(var(--destructive) / 0.82))",
                boxShadow: "0 8px 32px hsl(var(--destructive) / 0.4)",
              }}
              aria-label="Cancelar"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        ) : (
          /* === IN-CALL PHASE === */
          <div className="flex flex-col items-center gap-5">
            <div className="space-y-1 text-center">
              <h2 className="text-2xl font-semibold text-foreground">{voice.label}</h2>
              <p className="text-xs font-medium" style={{ color: `${accent}cc` }}>{statusText}</p>
              <p className="text-xs font-mono tabular-nums text-muted-foreground/40 mt-1">{formatDuration(duration)}</p>
            </div>

            <VoiceOrb accent={accent} label={voice.label} levels={orbLevels} active={speaking || listening || processing} large />

            <div className="flex items-center gap-6 pt-2">
              <button
                onClick={() => setMuted((prev) => !prev)}
                className={`flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-200 ${
                  muted ? "bg-muted/30 border-border/30 text-destructive" : "bg-card/30 border-border/15 text-foreground"
                }`}
                aria-label={muted ? "Ativar áudio" : "Silenciar"}
              >
                {muted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <button
                onClick={() => { endCall(); onClose(); }}
                className="flex h-[68px] w-[68px] items-center justify-center rounded-full text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--destructive)), hsl(var(--destructive) / 0.82))",
                  boxShadow: "0 8px 32px hsl(var(--destructive) / 0.4)",
                }}
                aria-label="Encerrar"
              >
                <PhoneOff size={26} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
