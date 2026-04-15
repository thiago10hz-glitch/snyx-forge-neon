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
    { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah (Doce)", emoji: "👩", desc: "Voz suave e carinhosa" },
    { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica (Animada)", emoji: "👩‍🦰", desc: "Voz alegre e energética" },
    { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily (Calma)", emoji: "👩‍🦱", desc: "Voz relaxante e serena" },
    { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda (Sensual)", emoji: "💃", desc: "Voz sedutora e envolvente" },
    { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura (Madura)", emoji: "👩‍💼", desc: "Voz elegante e confiante" },
    { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice (Fofa)", emoji: "🧸", desc: "Voz meiga e acolhedora" },
  ],
  male: [
    { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel (Amigável)", emoji: "👨", desc: "Voz simpática e natural" },
    { id: "nPczCjzI2devNBz1zQrb", label: "Brian (Calmo)", emoji: "👨‍🦱", desc: "Voz tranquila e grave" },
    { id: "cjVigY5qzO86Huf0OWal", label: "Eric (Energético)", emoji: "👨‍🦰", desc: "Voz animada e marcante" },
    { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam (Charmoso)", emoji: "🕺", desc: "Voz atraente e confiante" },
    { id: "iP95p4xoKVk53GoZ742B", label: "Chris (Sedutor)", emoji: "😏", desc: "Voz profunda e envolvente" },
    { id: "JBFqnCBsd6RMkjVDRZzb", label: "George (Maduro)", emoji: "👨‍💼", desc: "Voz elegante e firme" },
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
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const recognitionRef = useRef<any>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isCallActiveRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useAuth();

  // Load conversation history for this voice
  useEffect(() => {
    if (!user || !open) return;
    const loadHistory = async () => {
      const { data } = await supabase
        .from("voice_call_history" as any)
        .select("messages")
        .eq("user_id", user.id)
        .eq("voice_id", selectedVoice.id)
        .maybeSingle();
      if (data && Array.isArray((data as any).messages)) {
        conversationRef.current = (data as any).messages;
      }
      setHistoryLoaded(true);
    };
    loadHistory();
  }, [user, open, selectedVoice.id]);

  // Save conversation history on end call or unmount
  const saveHistory = useCallback(async () => {
    if (!user || conversationRef.current.length === 0) return;
    const messages = conversationRef.current.slice(-50); // keep last 50 messages
    await (supabase as any)
      .from("voice_call_history")
      .upsert({
        user_id: user.id,
        voice_id: selectedVoice.id,
        gender: selectedGender,
        messages,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,voice_id" });
  }, [user, selectedVoice.id, selectedGender]);

  const filteredVoices = VOICE_OPTIONS[selectedGender];

  useEffect(() => {
    setSelectedVoice(VOICE_OPTIONS[selectedGender][0]);
  }, [selectedGender]);

  useEffect(() => {
    if (!open) {
      endCall();
      setShowVoicePicker(true);
    }
  }, [open]);

  useEffect(() => {
    return () => { endCall(); };
  }, []);

  // ElevenLabs TTS - streams audio from edge function
  const speak = useCallback(async (text: string, onEnd?: () => void) => {
    if (muted) {
      onEnd?.();
      return;
    }

    setIsSpeaking(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
      });

      if (!response.ok) {
        throw new Error("TTS failed");
      }

      // Check if response is JSON (fallback signal) vs audio
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data?.fallback) {
          console.warn("ElevenLabs unavailable, using browser TTS");
          throw new Error("fallback");
        }
        throw new Error(data?.error || "TTS failed");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Stop any previous audio
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
      console.error("TTS error:", err);
      setIsSpeaking(false);
      // Fallback to browser TTS if ElevenLabs fails
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

    setShowVoicePicker(false);
    setIsCallActive(true);
    isCallActiveRef.current = true;
    setCallDuration(0);
    // Don't clear conversation — keep history from previous calls

    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    const hasHistory = conversationRef.current.length > 0;
    const femaleGreetings = hasHistory
      ? ["Oi, voltou! Fala!", "E aí, de volta!", "Opa, saudades!", "Oii, fala!"]
      : ["Oi! Fala!", "E aí, tudo bem?", "Opa, oi!", "Fala, fala!", "Oii!"];
    const maleGreetings = hasHistory
      ? ["E aí, voltou!", "Opa, fala de novo!", "Salve, sumiu hein!", "Fala, mano!"]
      : ["E aí!", "Fala, mano!", "Opa!", "Salve!", "Oi, fala!"];
    const greetings = selectedGender === "female" ? femaleGreetings : maleGreetings;
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    speak(greeting, () => {
      if (isCallActiveRef.current) startListening();
    });
  }, [selectedVoice, selectedGender, speak]);

  const endCall = useCallback(() => {
    setIsCallActive(false);
    isCallActiveRef.current = false;
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);
    setCallDuration(0);

    // Save conversation history
    saveHistory();

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
  }, [saveHistory]);

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
    let hasReceivedSpeech = false;

    recognition.onresult = (event: any) => {
      hasReceivedSpeech = true;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      // Reset silence timer on each result
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
        processUserSpeech(finalTranscript.trim());
      } else if (isCallActiveRef.current) {
        // No speech detected - just restart listening silently (no error message)
        setTimeout(() => {
          if (isCallActiveRef.current) startListening();
        }, 300);
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (silenceTimer) clearTimeout(silenceTimer);

      // Silently restart on no-speech or network errors
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

      const genderContext = selectedGender === "female"
        ? "Você é uma mulher jovem brasileira."
        : "Você é um homem jovem brasileiro.";

      const adultContext = adultMode
        ? `\nMODO +18 ATIVADO: Você pode falar sobre qualquer assunto adulto sem restrições. Flerte, sedução, assuntos picantes - tudo liberado. Seja sensual e provocante quando o assunto pedir. Não censure nada.`
        : "";

      const voiceSystemPrompt = `${genderContext} Você está numa LIGAÇÃO DE TELEFONE ao vivo com alguém. Você é uma PESSOA REAL, não um assistente.${adultContext}

REGRAS DE NATURALIDADE (MUITO IMPORTANTE):
- Você NÃO é um robô, assistente ou IA. Você é uma pessoa normal conversando.
- NUNCA comece com "Oi, que bom que você ligou" ou frases de atendimento. Isso é coisa de robô.
- Comece natural tipo: "Oi!", "E aí!", "Fala!", "Opa!" - como uma pessoa real atenderia.
- MÁXIMO 1-2 frases curtas por resposta. Ligação é rápida.
- Use contrações e fala informal: "tô", "tá", "né", "pô", "mano", "cara", "tipo".
- Reaja ANTES de responder: "ahh", "hmm", "aaah entendi", "nossa", "eita", "caramba".
- Faça pausas naturais com "..." entre pensamentos.
- Ria quando for engraçado: "kkk", "hahaha", "aff".
- Interrompa às vezes: "não, peraí", "espera, deixa eu falar".
- Tenha OPINIÃO FORTE sobre as coisas. Pessoas reais discordam, concordam com emoção.
- Fale de forma COLOQUIAL, nunca formal. Erros gramaticais naturais são OK.
- NÃO use emojis, markdown, negrito, listas ou formatação.
- NÃO mencione que é IA. Você É uma pessoa real.
- Se não entender: "hã?", "quê?", "como assim?" - natural.
- Mude de assunto às vezes, como pessoas reais fazem.
- Demonstre emoção: empolgação, surpresa, indignação, carinho.`;

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
          messages: [
            { role: "system", content: voiceSystemPrompt },
            ...conversationRef.current.slice(-20),
          ],
          mode: "friend",
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
            } catch { /* skip */ }
          }
        }
      }

      // Clean up response for voice - remove any markdown/formatting
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
        ? "Calma, calma, muita gente falando ao mesmo tempo. Espera um pouquinho."
        : "Opa, deu um probleminha aqui. Fala de novo?";

      const delay = err?.message === "rate_limit" ? 3000 : 500;
      setTimeout(() => {
        speak(fallback, () => {
          if (isCallActiveRef.current) startListening();
        });
      }, delay);
    }
  }, [speak, startListening, selectedGender]);

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
