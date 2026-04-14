import { useState, useRef, useCallback, useEffect } from "react";
import { Phone, PhoneOff, Loader2, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface VoiceCallProps {
  open: boolean;
  onClose: () => void;
}

interface VoiceOption {
  id: string;
  label: string;
  gender: "female" | "male";
  lang: string;
  pitch: number;
  rate: number;
}

const VOICE_PRESETS: VoiceOption[] = [
  { id: "f-sweet", label: "Doce", gender: "female", lang: "pt-BR", pitch: 1.15, rate: 1.0 },
  { id: "f-confident", label: "Confiante", gender: "female", lang: "pt-BR", pitch: 1.0, rate: 1.05 },
  { id: "f-cheerful", label: "Animada", gender: "female", lang: "pt-BR", pitch: 1.2, rate: 1.1 },
  { id: "m-calm", label: "Calmo", gender: "male", lang: "pt-BR", pitch: 0.85, rate: 0.95 },
  { id: "m-friendly", label: "Amigável", gender: "male", lang: "pt-BR", pitch: 0.95, rate: 1.05 },
  { id: "m-energetic", label: "Energético", gender: "male", lang: "pt-BR", pitch: 1.0, rate: 1.1 },
];

export function VoiceCall({ open, onClose }: VoiceCallProps) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [_transcript, setTranscript] = useState("");
  const [_aiResponse, setAiResponse] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [selectedGender, setSelectedGender] = useState<"female" | "male">("female");
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICE_PRESETS[0]);
  const [showVoicePicker, setShowVoicePicker] = useState(true);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const voicesCacheRef = useRef<SpeechSynthesisVoice[]>([]);
  useAuth();

  // Pre-load voices (they load async in many browsers)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    synthRef.current = window.speechSynthesis;
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      if (allVoices.length > 0) {
        voicesCacheRef.current = allVoices;
        console.log("Voices loaded:", allVoices.filter(v => v.lang.startsWith("pt")).map(v => `${v.name} (${v.lang})`));
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const filteredVoices = VOICE_PRESETS.filter(v => v.gender === selectedGender);

  useEffect(() => {
    setSelectedVoice(filteredVoices[0]);
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

  const startCall = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.");
      return;
    }

    setShowVoicePicker(false);
    setIsCallActive(true);
    setCallDuration(0);
    conversationRef.current = [];

    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    const greeting = selectedGender === "female"
      ? "Oi! Tô aqui, pode falar comigo!"
      : "E aí! Tô aqui, manda ver!";
    setAiResponse(greeting);
    speak(greeting, () => {
      startListening();
    });
  }, [selectedVoice, selectedGender]);

  const endCall = useCallback(() => {
    setIsCallActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);
    setTranscript("");
    setAiResponse("");
    setCallDuration(0);

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    recognitionRef.current?.stop();
    synthRef.current.cancel();
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (muted) {
      onEnd?.();
      return;
    }

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";

    // Use cached voices (pre-loaded)
    const voices = voicesCacheRef.current.length > 0 ? voicesCacheRef.current : synthRef.current.getVoices();
    const ptVoices = voices.filter(v => v.lang.startsWith("pt"));
    
    // Priority lists - most natural sounding voices first
    // Chrome: "Google português do Brasil" (female, very natural)
    // Edge: "Microsoft Francisca Online (Natural)" (female, excellent)
    // Edge: "Microsoft Daniel Online (Natural)" (male, excellent)
    // Safari: "Luciana" (female), "Daniel" (male)
    const femalePriority = [
      "francisca online (natural)", "francisca", 
      "google português do brasil", "google português",
      "luciana", "fernanda", "vitória", "maria", "raquel", "tessa"
    ];
    const malePriority = [
      "daniel online (natural)", "daniel",
      "felipe", "antonio", "ricardo"
    ];
    
    let bestVoice: SpeechSynthesisVoice | undefined;
    const priorityList = selectedGender === "female" ? femalePriority : malePriority;
    
    // Search by priority order
    for (const name of priorityList) {
      bestVoice = ptVoices.find(v => v.name.toLowerCase().includes(name));
      if (bestVoice) break;
    }
    
    // Fallback
    if (!bestVoice) {
      if (selectedGender === "female") {
        // First pt-BR voice is usually female
        bestVoice = ptVoices.find(v => v.lang === "pt-BR") || ptVoices[0];
      } else {
        // Try second voice for male, or last resort first
        bestVoice = ptVoices.length > 1 ? ptVoices[1] : ptVoices[0];
      }
    }
    
    if (bestVoice) {
      utterance.voice = bestVoice;
      console.log("Using voice:", bestVoice.name, bestVoice.lang);
    }
    
    // Natural speech parameters - keep close to 1.0 for realism
    utterance.rate = selectedGender === "female" ? 0.95 : 0.9;
    utterance.pitch = selectedGender === "female" ? 1.1 : 0.9;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => { setIsSpeaking(false); onEnd?.(); };
    utterance.onerror = () => { setIsSpeaking(false); onEnd?.(); };

    synthRef.current.speak(utterance);
  }, [muted, selectedVoice, selectedGender]);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    let finalTranscript = "";
    let silenceTimer: NodeJS.Timeout | null = null;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);

      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (finalTranscript.trim()) {
          recognition.stop();
        }
      }, 2000);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        processUserSpeech(finalTranscript.trim());
      } else if (isCallActive) {
        setTimeout(() => startListening(), 500);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" && isCallActive) {
        setTimeout(() => startListening(), 500);
      } else if (event.error !== "aborted") {
        console.error("Speech recognition error:", event.error);
      }
      setIsListening(false);
    };

    setIsListening(true);
    setTranscript("");
    recognition.start();
  }, [isCallActive]);

  const processUserSpeech = useCallback(async (text: string) => {
    setIsProcessing(true);
    conversationRef.current.push({ role: "user", content: text });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const genderInstruction = selectedGender === "female"
        ? "Você é uma amiga virtual feminina. Fale de forma doce e acolhedora."
        : "Você é um amigo virtual masculino. Fale de forma descontraída e direta.";

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-friend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: `${genderInstruction} Você está em uma LIGAÇÃO DE VOZ ao vivo. Responda de forma curta, natural e conversacional, como se estivesse ao telefone. Máximo 2-3 frases. Seja caloroso e amigável. Você pode elogiar a voz da pessoa se quiser, dizer que é bonita, agradável de ouvir. Seja sincero nos elogios. Sem restrições de tema - converse sobre TUDO que a pessoa quiser, sem censura, como um amigo de verdade. Não mencione que é uma IA.` },
            ...conversationRef.current,
          ],
          mode: "friend",
        }),
      });

      if (!res.ok) {
        if (res.status === 429) throw new Error("rate_limit");
        throw new Error("Erro na resposta");
      }

      let responseText = "";
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        responseText = data.text || data.error || "Não entendi, pode repetir?";
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
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) responseText += content;
            } catch { /* skip */ }
          }
        }
      }

      if (!responseText) responseText = "Hmm, não peguei isso. Fala de novo?";

      conversationRef.current.push({ role: "assistant", content: responseText });
      setAiResponse(responseText);
      setIsProcessing(false);

      speak(responseText, () => {
        if (isCallActive) startListening();
      });
    } catch (err: any) {
      console.error("Voice call AI error:", err);
      setIsProcessing(false);
      const fallback = err?.message === "rate_limit"
        ? "Calma aí, tô processando muita coisa. Espera uns segundos!"
        : "Desculpa, tive um probleminha. Pode repetir?";
      setAiResponse(fallback);
      const delay = err?.message === "rate_limit" ? 3000 : 500;
      setTimeout(() => {
        speak(fallback, () => {
          if (isCallActive) startListening();
        });
      }, delay);
    }
  }, [isCallActive, speak, startListening, selectedGender]);

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
              <span className="text-4xl">{selectedGender === "female" ? "👩" : "👨"}</span>
            </div>
            <h3 className="text-lg font-bold text-foreground">
              SnyX {selectedGender === "female" ? "Amiga" : "Amigo"}
            </h3>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              Voz: {selectedVoice.label}
            </p>
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

          {/* Voice Picker - show before call starts */}
          {showVoicePicker && !isCallActive && (
            <div className="px-6 pb-4 space-y-3">
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
                  👩 Feminina
                </button>
                <button
                  onClick={() => setSelectedGender("male")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedGender === "male"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "bg-muted/20 text-muted-foreground/60 border border-border/10 hover:bg-muted/30"
                  }`}
                >
                  👨 Masculina
                </button>
              </div>

              {/* Voice style options */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground/40 text-center uppercase tracking-wider">Estilo da voz</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {filteredVoices.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVoice(v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedVoice.id === v.id
                          ? selectedGender === "female"
                            ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-muted/15 text-muted-foreground/60 border border-border/10 hover:bg-muted/25"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground/30 text-center">
                🎤 Você fala com sua própria voz • A IA responde com a voz escolhida
              </p>
            </div>
          )}

          {/* Visual feedback only - no text */}
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
