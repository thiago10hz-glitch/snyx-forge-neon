import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Loader2, Sparkles, Heart } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface Character {
  id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  banner_url: string | null;
  first_message: string;
  is_nsfw: boolean;
  tags: string[] | null;
  chat_count: number;
}

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function RpgChat() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load character + setup conversation
  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: char, error } = await supabase
        .from("ai_characters")
        .select("id, name, description, avatar_url, banner_url, first_message, is_nsfw, tags, chat_count")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !char) {
        toast.error("Personagem não encontrado ou bloqueado");
        navigate("/rpg");
        return;
      }
      setCharacter(char as Character);

      // Buscar/criar conversa
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("character_id", id)
        .eq("mode", "rpg")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let convId = existing?.id;
      if (!convId) {
        const { data: created, error: cErr } = await supabase
          .from("chat_conversations")
          .insert({
            user_id: user.id,
            character_id: id,
            mode: "rpg",
            title: char.name,
          })
          .select("id")
          .single();
        if (cErr || !created) {
          toast.error("Falha ao criar conversa");
          return;
        }
        convId = created.id;
        // Inserir first_message
        if (char.first_message) {
          await supabase.from("chat_messages").insert({
            conversation_id: convId,
            role: "assistant",
            content: char.first_message,
          });
        }
        // Increment chat count
        await supabase.rpc("increment_character_chat_count", { p_character_id: id });
      }
      setConversationId(convId);

      // Carregar mensagens
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      setMessages((msgs || []) as Msg[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, user, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const handleSend = async () => {
    if (!input.trim() || streaming || !conversationId || !character) return;
    const userMsg = input.trim();
    setInput("");

    const tempUserId = crypto.randomUUID();
    const tempAssistantId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: tempUserId, role: "user", content: userMsg },
      { id: tempAssistantId, role: "assistant", content: "" },
    ]);
    setStreaming(true);

    // Persistir user msg
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userMsg,
    });

    try {
      const aiMessages = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));
      aiMessages.push({ role: "user", content: userMsg });

      // Conversation summary (se existir)
      const { data: sumRow } = await supabase
        .from("conversation_summaries")
        .select("summary")
        .eq("conversation_id", conversationId)
        .maybeSingle();

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-rpg`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          character_id: character.id,
          messages: aiMessages,
          conversation_summary: sumRow?.summary || "",
          user_display_name: profile?.display_name || "você",
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t || !t.startsWith("data: ")) continue;
          if (t === "data: [DONE]") continue;
          try {
            const json = JSON.parse(t.slice(6));
            if (json.text) {
              assistantContent += json.text;
              setMessages((prev) =>
                prev.map((m) => (m.id === tempAssistantId ? { ...m, content: assistantContent } : m))
              );
            }
          } catch { /* skip */ }
        }
      }

      // Persistir assistant msg
      if (assistantContent) {
        await supabase.from("chat_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: assistantContent,
        });
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha no chat");
      setMessages((m) => m.filter((msg) => msg.id !== tempAssistantId));
    } finally {
      setStreaming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!character) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border/40 bg-background/85 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/rpg" className="p-2 rounded-lg hover:bg-muted/50 transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0 border border-border/50">
            {character.avatar_url ? (
              <img src={character.avatar_url} alt={character.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-fuchsia-500/20">
                <Sparkles className="h-4 w-4 text-foreground/50" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sm truncate flex items-center gap-1.5">
              {character.name}
              {character.is_nsfw && (
                <span className="text-[8px] font-black px-1 py-0.5 rounded bg-destructive/85 text-destructive-foreground">+18</span>
              )}
            </h2>
            <p className="text-[11px] text-muted-foreground truncate">{character.description}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-16">
              Mande a primeira mensagem pra começar a história ✨
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
              {m.role === "assistant" && (
                <div className="h-8 w-8 rounded-full overflow-hidden bg-muted shrink-0 border border-border/40 mt-1">
                  {character.avatar_url ? (
                    <img src={character.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/30 to-fuchsia-500/20" />
                  )}
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted/60 text-foreground rounded-tl-sm border border-border/40"
                }`}
              >
                {m.content ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-em:text-muted-foreground prose-em:not-italic prose-em:opacity-80">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/40 bg-background/85 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Responder pra ${character.name}...`}
            rows={1}
            className="min-h-[44px] max-h-32 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={streaming}
          />
          <Button onClick={handleSend} disabled={streaming || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
