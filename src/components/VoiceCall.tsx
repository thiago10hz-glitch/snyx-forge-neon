import { useState, useRef, useCallback, useEffect } from "react";
import { Phone, PhoneOff, Loader2, Mic, MicOff } from "lucide-react";
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

export function VoiceCall({ open, onClose }: VoiceCallProps) {
  const [phase, setPhase] = useState<"pick" | "call">("pick");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [voice, setVoice] = useState(VOICES.female[0]);
  const [adultMode, setAdultMode] = useState(false);

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  // Animated orb levels
  const [orbLevels, setOrbLevels] = useState<number[]>([0.3, 0.3, 0.3, 0.3, 0.3]);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const convoRef = useRef<Array<{ role: string; content: string }>>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const processRef = useRef<((t: string) => void) | null>(null);
  const orbIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { user, profile } = useAuth();

  // Orb animation
  useEffect(() => {
    if (phase !== "call") {
      if (orbIntervalRef.current) clearInterval(orbIntervalRef.current);
      return;
    }
    orbIntervalRef.current = setInterval(() => {
      setOrbLevels(() => {
        if (speaking) return Array.from({ length: 5 }, () => 0.4 + Math.random() * 0.6);
        if (listening) return Array.from({ length: 5 }, () => 0.2 + Math.random() * 0.3);
        if (processing) return Array.from({ length: 5 }, () => 0.15 + Math.sin(Date.now() / 300) * 0.15);
        return [0.2, 0.2, 0.2, 0.2, 0.2];
      });
    }, 120);
    return () => { if (orbIntervalRef.current) clearInterval(orbIntervalRef.current); };
  }, [phase, speaking, listening, processing]);

  useEffect(() => { convoRef.current = []; }, [open, voice.id, gender]);
  useEffect(() => { setVoice(VOICES[gender][0]); }, [gender]);
  useEffect(() => { if (!open) { endCall(); setPhase("pick"); } }, [open]);
  useEffect(() => () => { endCall(); }, []);

  const speak = useCallback(async (text: string, onEnd?: () => void) => {
    if (muted) { onEnd?.(); return; }
    setSpeaking(true);
    try {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ text, voiceId: voice.id, gender }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error("fail");
      const ct = res.headers.get("Content-Type") || "";
      if (ct.includes("application/json")) { const d = await res.json(); if (d?.fallback) throw new Error("fb"); throw new Error(d?.error || "fail"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); onEnd?.(); };
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); onEnd?.(); };
      await audio.play();
    } catch {
      setSpeaking(false);
      browserSpeak(text, onEnd);
    }
  }, [muted, voice, gender]);

  const browserSpeak = useCallback((text: string, onEnd?: () => void) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = 0.95;
    const voices = synth.getVoices();
    const pt = voices.filter(v => v.lang.startsWith("pt"));
    if (pt.length > 0) {
      const chosen = gender === "female"
        ? pt.find(v => /female|femin|mulher|maria|lucia/i.test(v.name)) || pt[0]
        : pt.find(v => /\bmale\b|mascu|homem|daniel/i.test(v.name)) || pt[pt.length > 1 ? 1 : 0];
      if (chosen) u.voice = chosen;
      u.pitch = gender === "female" ? 1.1 : 0.8;
    }
    u.onend = () => { setSpeaking(false); onEnd?.(); };
    u.onerror = () => { setSpeaking(false); onEnd?.(); };
    setSpeaking(true);
    synth.speak(u);
  }, [gender]);

  const endCall = useCallback(() => {
    activeRef.current = false;
    setListening(false); setSpeaking(false); setProcessing(false); setDuration(0);
    convoRef.current = [];
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    try { recognitionRef.current?.stop(); } catch {}
    try { audioRef.current?.pause(); audioRef.current = null; } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
  }, []);

  const startListening = useCallback(() => {
    if (!activeRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "pt-BR"; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
    recognitionRef.current = rec;
    let final = "";
    let silenceT: NodeJS.Timeout | null = null;
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
      }
      if (silenceT) clearTimeout(silenceT);
      silenceT = setTimeout(() => { if (final.trim()) try { rec.stop(); } catch {} }, 1800);
    };
    rec.onend = () => {
      setListening(false);
      if (silenceT) clearTimeout(silenceT);
      if (final.trim()) processRef.current?.(final.trim());
      else if (activeRef.current) setTimeout(() => { if (activeRef.current) startListening(); }, 300);
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (silenceT) clearTimeout(silenceT);
      if (activeRef.current && ["no-speech", "network", "audio-capture"].includes(e.error)) {
        setTimeout(() => { if (activeRef.current) startListening(); }, 500);
      }
    };
    setListening(true);
    rec.start();
  }, []);

  const processUserSpeech = useCallback(async (text: string) => {
    if (!activeRef.current) return;
    setProcessing(true);
    convoRef.current.push({ role: "user", content: text });
    try {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const gCtx = gender === "female"
        ? "Você é uma mulher jovem brasileira. Responde como mulher real, com jeito feminino natural."
        : "Você é um homem jovem brasileiro. Responde como homem real, com jeito masculino natural.";
      const nameCtx = profile?.display_name ? `\nA pessoa que liga se chama "${profile.display_name}". Trate pelo nome.` : "";
      const relCtx = profile?.relationship_status ? `\nStatus de relacionamento: ${profile.relationship_status}.` : "";
      const bioCtx = profile?.bio ? `\nSobre a pessoa: ${profile.bio}.` : "";
      const adultCtx = adultMode ? `\nMODO +18 ATIVADO: Fale sobre assuntos adultos sem censura quando a conversa pedir.` : "";

      const sysPrompt = `${voice.persona}\n\n${gCtx}${nameCtx}${relCtx}${bioCtx}
Você está numa ligação de telefone ao vivo. Você é ${voice.label}, uma pessoa real.${adultCtx}

REGRAS — SOAR COMO PESSOA DE VERDADE:
- Você NÃO é assistente, robô ou IA. Você é uma pessoa real.
- Fale como brasileiro fala: "kkk", "pô", "mano", "véi", "tlgd", "tipo assim".
- Respostas CURTAS: 1-2 frases máximo.
- Reações naturais: "ah", "hmm", "eita", "nossa", "sério?", "ata".
- Hesite às vezes: "é... tipo...", "aí né...", "sei lá, acho que...".
- Contrações: "tô", "tá", "cê", "pra", "né".
- Sem emojis, markdown, listas ou formatação.
- Nunca explique o que você é. Desconverse naturalmente.
- Seja emotivo(a): ria, demonstre surpresa, interesse genuíno.`;

      abortRef.current = new AbortController();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-friend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: convoRef.current.slice(-20),
          mode: "friend",
          is_vip: !!profile?.is_vip,
          is_admin: !!profile?.is_dev,
          display_name: profile?.display_name || "",
          team_badge: profile?.team_badge || null,
          user_gender: profile?.gender || null,
          user_bio: profile?.bio || null,
          user_relationship_status: profile?.relationship_status || null,
          character_system_prompt: sysPrompt,
        }),
      });
      if (!res.ok) { if (res.status === 429) throw new Error("rate_limit"); throw new Error("err"); }

      let responseText = "";
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const d = await res.json();
        responseText = d.text || d.error || "";
      } else if (res.body) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let ni: number;
          while ((ni = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, ni); buf = buf.slice(ni + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const js = line.slice(6).trim();
            if (js === "[DONE]") break;
            try { const p = JSON.parse(js); const c = p.choices?.[0]?.delta?.content || p.text; if (c) responseText += c; } catch {}
          }
        }
      }
      responseText = responseText.replace(/[*_#`~]/g, "").replace(/\[.*?\]\(.*?\)/g, "").replace(/\n+/g, " ").trim();
      if (!responseText) responseText = "Ahn? Não peguei, fala de novo?";
      convoRef.current.push({ role: "assistant", content: responseText });
      setProcessing(false);
      speak(responseText, () => { if (activeRef.current) startListening(); });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setProcessing(false);
      const fb = err?.message === "rate_limit" ? "Calma, muita gente falando. Espera um pouquinho." : "Opa, deu um probleminha. Fala de novo?";
      const delay = err?.message === "rate_limit" ? 3000 : 500;
      setTimeout(() => { speak(fb, () => { if (activeRef.current) startListening(); }); }, delay);
    }
  }, [adultMode, gender, profile, voice, speak, startListening]);

  useEffect(() => { processRef.current = processUserSpeech; }, [processUserSpeech]);

  const startCall = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Navegador não suporta voz. Use Chrome ou Edge."); return; }
    convoRef.current = [];
    setPhase("call");
    activeRef.current = true;
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(p => p + 1), 1000);
    const name = profile?.display_name?.trim().split(/\s+/)[0];
    const greetings = gender === "female"
      ? [name ? `Oi, ${name}!` : "Oii!", name ? `E aí, ${name}!` : "E aí!", name ? `Oi ${name}, tudo bem?` : "Oi, tudo bem?"]
      : [name ? `Fala, ${name}!` : "Fala!", name ? `E aí, ${name}!` : "E aí!", name ? `Opa, ${name}!` : "Opa!"];
    const g = greetings[Math.floor(Math.random() * greetings.length)];
    speak(g, () => { if (activeRef.current) startListening(); });
  }, [gender, profile?.display_name, speak, startListening]);

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (!open) return null;

  const vc = voice.color;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.97) 100%)" }}>
      <div className="w-full max-w-md mx-auto flex flex-col items-center justify-between h-full py-8 px-6 animate-in fade-in-0 duration-500">

        {/* Top: voice name & status */}
        <div className="text-center mt-4">
          <h2 className="text-2xl font-semibold text-white tracking-tight">{voice.label}</h2>
          <p className="text-sm mt-1" style={{ color: `${vc}99` }}>
            {phase === "pick" ? "Toque para ligar" :
             speaking ? "Falando..." :
             listening ? "Ouvindo..." :
             processing ? "Pensando..." : "Conectado"}
          </p>
          {phase === "call" && (
            <p className="text-xs text-white/30 font-mono mt-2 tabular-nums">{fmt(duration)}</p>
          )}
        </div>

        {/* Center: animated orb */}
        <div className="flex-1 flex items-center justify-center">
          {phase === "pick" ? (
            <div className="space-y-6 w-full max-w-xs">
              {/* Gender tabs */}
              <div className="flex justify-center gap-2">
                {(["female", "male"] as const).map(g => (
                  <button key={g} onClick={() => setGender(g)}
                    className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 ${
                      gender === g
                        ? "text-white shadow-lg" + (g === "female" ? " bg-pink-500/30 border border-pink-500/40" : " bg-blue-500/30 border border-blue-500/40")
                        : "text-white/40 bg-white/5 border border-white/10 hover:bg-white/10"
                    }`}>
                    {g === "female" ? "♀ Feminino" : "♂ Masculino"}
                  </button>
                ))}
              </div>

              {/* Voice cards */}
              <div className="grid grid-cols-3 gap-2">
                {VOICES[gender].map(v => (
                  <button key={v.id} onClick={() => setVoice(v)}
                    className={`relative p-3 rounded-2xl text-center transition-all duration-300 ${
                      voice.id === v.id
                        ? "bg-white/15 border-2 scale-105 shadow-lg"
                        : "bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-102"
                    }`}
                    style={voice.id === v.id ? { borderColor: v.color, boxShadow: `0 0 20px ${v.color}33` } : {}}>
                    <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-lg font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${v.color}, ${v.color}88)` }}>
                      {v.label[0]}
                    </div>
                    <span className="text-xs font-medium text-white/80">{v.label}</span>
                  </button>
                ))}
              </div>

              {/* +18 */}
              <div className="flex justify-center">
                <button onClick={() => setAdultMode(!adultMode)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                    adultMode ? "bg-red-500/25 text-red-400 border border-red-500/40" : "bg-white/5 text-white/30 border border-white/10 hover:bg-white/10"
                  }`}>
                  🔥 +18 {adultMode ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          ) : (
            /* Animated orb during call */
            <div className="relative w-48 h-48">
              {/* Glow */}
              <div className="absolute inset-0 rounded-full blur-3xl opacity-30 animate-pulse" style={{ background: vc }} />
              {/* Orb rings */}
              {orbLevels.map((level, i) => (
                <div key={i} className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full border transition-all duration-150"
                    style={{
                      width: `${60 + i * 20 + level * 30}%`,
                      height: `${60 + i * 20 + level * 30}%`,
                      borderColor: `${vc}${Math.round((0.6 - i * 0.1) * 255).toString(16).padStart(2, '0')}`,
                      boxShadow: speaking ? `0 0 ${10 + level * 20}px ${vc}44` : "none",
                    }} />
                </div>
              ))}
              {/* Center circle */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-2xl"
                  style={{ background: `linear-gradient(135deg, ${vc}, ${vc}88)`, boxShadow: `0 0 40px ${vc}66` }}>
                  {voice.label[0]}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="flex items-center justify-center gap-6 pb-4">
          {phase === "call" && (
            <button onClick={() => setMuted(!muted)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all backdrop-blur-sm ${
                muted ? "bg-white/20 text-white" : "bg-white/10 text-white/60 hover:bg-white/15"
              }`}>
              {muted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}

          {phase === "pick" ? (
            <button onClick={startCall}
              className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all duration-300"
              style={{ background: `linear-gradient(135deg, ${vc}, ${vc}cc)`, boxShadow: `0 8px 32px ${vc}55` }}>
              <Phone size={28} className="text-white" />
            </button>
          ) : (
            <button onClick={() => { endCall(); onClose(); }}
              className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-2xl shadow-red-500/40 hover:scale-110 transition-all duration-300">
              <PhoneOff size={28} />
            </button>
          )}

          {phase === "pick" && (
            <button onClick={onClose}
              className="w-14 h-14 rounded-full bg-white/10 text-white/60 flex items-center justify-center hover:bg-white/20 transition-all backdrop-blur-sm">
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
