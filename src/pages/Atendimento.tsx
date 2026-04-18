import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mic, MicOff, PhoneOff, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

// Web Speech API typings
interface SpeechRecognitionEventLike { results: { [k: number]: { [k: number]: { transcript: string }; isFinal: boolean }; length: number } }

const SpeechRecognitionCtor: any =
  typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

export default function Atendimento() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [callActive, setCallActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [partial, setPartial] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [callTime, setCallTime] = useState(0);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  const callActiveRef = useRef(false);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { callActiveRef.current = callActive; }, [callActive]);

  // Call timer
  useEffect(() => {
    if (!callActive) { setCallTime(0); return; }
    const t = setInterval(() => setCallTime((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callActive]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptScrollRef.current?.scrollTo({ top: transcriptScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, partial]);

  const speak = useCallback(async (text: string) => {
    setSpeaking(true);
    try {
      const { data, error } = await supabase.functions.invoke("tts-gemini", {
        body: { text, voice: "Aoede" },
      });
      if (error || !data?.audioContent) throw new Error(error?.message || "no_audio");
      const audio = new Audio(`data:audio/wav;base64,${data.audioContent}`);
      audioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
    } catch (e) {
      console.error("TTS fail", e);
    } finally {
      setSpeaking(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) {
      toast.error("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.");
      return;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    const rec = new SpeechRecognitionCtor();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = "";

    rec.onresult = (ev: SpeechRecognitionEventLike) => {
      let interim = "";
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setPartial(finalText + interim);
    };

    rec.onerror = (e: any) => {
      console.warn("rec error", e?.error);
      setListening(false);
      if (e?.error === "no-speech" && callActiveRef.current) {
        // restart silently
        setTimeout(() => callActiveRef.current && !speaking && startListening(), 300);
      }
    };

    rec.onend = async () => {
      setListening(false);
      const userText = finalText.trim();
      setPartial("");
      if (!userText) {
        if (callActiveRef.current && !speaking) setTimeout(() => startListening(), 300);
        return;
      }
      const newUserMsg: Msg = { role: "user", content: userText };
      const updated = [...messagesRef.current, newUserMsg];
      setMessages(updated);
      setThinking(true);
      try {
        const { data, error } = await supabase.functions.invoke("support-voice", {
          body: {
            messages: updated.slice(-10),
            display_name: profile?.display_name,
          },
        });
        if (error) throw error;
        const reply = data?.text || "Desculpa, não entendi.";
        const replyMsg: Msg = { role: "assistant", content: reply };
        setMessages((m) => [...m, replyMsg]);
        setThinking(false);
        await speak(reply);
        if (callActiveRef.current) setTimeout(() => startListening(), 200);
      } catch (e: any) {
        console.error(e);
        setThinking(false);
        toast.error("Erro ao processar resposta");
        if (callActiveRef.current) setTimeout(() => startListening(), 500);
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch (e) {
      console.warn("start fail", e);
    }
  }, [speak, profile?.display_name, speaking]);

  const startCall = useCallback(async () => {
    if (!SpeechRecognitionCtor) {
      toast.error("Use Chrome ou Edge — seu navegador não suporta voz.");
      return;
    }
    try {
      // Pedir permissão ao mic
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Preciso da permissão do microfone.");
      return;
    }
    setCallActive(true);
    setMessages([]);
    callActiveRef.current = true;
    const firstName = profile?.display_name?.split(/\s+/)[0] || "";
    const greeting = firstName
      ? `Oi ${firstName}, aqui é a atendente do SnyX. Como posso ajudar?`
      : `Oi, aqui é a atendente do SnyX. Como posso ajudar?`;
    const greetMsg: Msg = { role: "assistant", content: greeting };
    setMessages([greetMsg]);
    await speak(greeting);
    if (callActiveRef.current) startListening();
  }, [profile?.display_name, speak, startListening]);

  const endCall = useCallback(() => {
    setCallActive(false);
    callActiveRef.current = false;
    try { recognitionRef.current?.stop(); } catch {}
    try { audioRef.current?.pause(); } catch {}
    setListening(false);
    setSpeaking(false);
    setThinking(false);
    setPartial("");
    toast.success("Ligação encerrada");
  }, []);

  useEffect(() => () => endCall(), [endCall]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Atendente IA por voz</h1>
            <p className="text-xs text-muted-foreground">Fale com a SnyX em tempo real</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Card className="overflow-hidden border-border bg-card/60 backdrop-blur">
          {/* Avatar / Status */}
          <div className="flex flex-col items-center gap-4 border-b border-border bg-gradient-to-b from-primary/10 to-transparent px-6 py-10">
            <div
              className={`relative flex h-32 w-32 items-center justify-center rounded-full bg-primary/20 transition-all ${
                speaking ? "scale-110 shadow-[0_0_60px_hsl(var(--primary)/0.6)]" :
                listening ? "scale-105 shadow-[0_0_40px_hsl(var(--primary)/0.4)]" : ""
              }`}
            >
              {speaking && (
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
              )}
              {listening ? (
                <Mic className="h-14 w-14 text-primary" />
              ) : speaking ? (
                <Volume2 className="h-14 w-14 text-primary" />
              ) : thinking ? (
                <Loader2 className="h-14 w-14 animate-spin text-primary" />
              ) : (
                <MicOff className="h-14 w-14 text-muted-foreground" />
              )}
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">
                {!callActive
                  ? "Atendente offline"
                  : speaking
                  ? "Atendente falando..."
                  : thinking
                  ? "Pensando..."
                  : listening
                  ? "Te escutando..."
                  : "Ligação ativa"}
              </p>
              {callActive && (
                <p className="mt-1 font-mono text-sm text-muted-foreground">{formatTime(callTime)}</p>
              )}
            </div>
          </div>

          {/* Transcript */}
          <div
            ref={transcriptScrollRef}
            className="max-h-[40vh] min-h-[200px] space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 && !callActive && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Clique em "Iniciar ligação" para falar com a atendente.
                <br />
                100% gratuito. Use Chrome ou Edge para melhor qualidade.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {partial && (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-primary/40 px-4 py-2 text-sm italic text-primary-foreground">
                  {partial}…
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-3 border-t border-border bg-card/40 px-4 py-4">
            {!callActive ? (
              <Button size="lg" onClick={startCall} className="gap-2 px-8">
                <Mic className="h-5 w-5" />
                Iniciar ligação
              </Button>
            ) : (
              <Button size="lg" variant="destructive" onClick={endCall} className="gap-2 px-8">
                <PhoneOff className="h-5 w-5" />
                Encerrar
              </Button>
            )}
          </div>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          A atendente fala em português, com voz feminina. Tudo grátis e sem custo extra.
        </p>
      </main>
    </div>
  );
}
