import { useState, useRef, useEffect, useCallback } from "react";
import { Send, ArrowLeft, Loader2, Heart } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CharacterChatProps {
  character: {
    id: string;
    name: string;
    avatar_url: string | null;
    description: string;
    personality: string;
  };
  onBack: () => void;
}

export function CharacterChat({ character, onBack }: CharacterChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();

  // Load or create conversation
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("character_id", character.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setConversationId(data.id);
        // Load messages
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("role, content")
          .eq("conversation_id", data.id)
          .order("created_at", { ascending: true });
        if (msgs) setMessages(msgs as Message[]);
      }
    })();
  }, [user, character.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || isLoading || !user) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Ensure conversation exists
    let convId = conversationId;
    if (!convId) {
      const { data: newConv } = await supabase
        .from("chat_conversations")
        .insert({ user_id: user.id, title: `Chat com ${character.name}`, mode: "character", character_id: character.id })
        .select("id")
        .single();
      if (newConv) {
        convId = newConv.id;
        setConversationId(newConv.id);
      }
    }

    // Save user message
    if (convId) {
      await supabase.from("chat_messages").insert({
        conversation_id: convId,
        role: "user",
        content: userMsg.content,
      });
    }

    // Stream AI response
    let assistantText = "";
    try {
      const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-character`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, characterId: character.id }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        throw new Error(err.error || "Erro ao conectar");
      }

      if (!resp.body) throw new Error("No stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                }
                return [...prev, { role: "assistant", content: assistantText }];
              });
            }
          } catch {}
        }
      }

      // Save assistant message
      if (convId && assistantText) {
        await supabase.from("chat_messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantText,
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar mensagem");
      if (!assistantText) {
        setMessages(prev => prev.filter((_, i) => i !== prev.length));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-border/10 glass shrink-0">
        <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/20 transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-muted/20 border border-border/20 shrink-0">
          {character.avatar_url ? (
            <img src={character.avatar_url} alt={character.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">🤖</div>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{character.name}</h3>
          <p className="text-[10px] text-muted-foreground/60 truncate">{character.description}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-muted/20 border border-border/20 mb-4">
              {character.avatar_url ? (
                <img src={character.avatar_url} alt={character.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">🤖</div>
              )}
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">{character.name}</h2>
            <p className="text-sm text-muted-foreground/60 max-w-xs">{character.description || "Comece uma conversa!"}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full overflow-hidden bg-muted/20 border border-border/20 shrink-0 mt-1">
                {character.avatar_url ? (
                  <img src={character.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs">🤖</div>
                )}
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
              msg.role === "user"
                ? "bg-primary/15 text-foreground rounded-br-md"
                : "bg-muted/30 text-foreground rounded-bl-md"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-muted/20 border border-border/20 flex items-center justify-center">
              {character.avatar_url ? (
                <img src={character.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
              ) : <span className="text-xs">🤖</span>}
            </div>
            <div className="bg-muted/30 rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/10 shrink-0">
        <div className="flex items-end gap-2 bg-muted/10 rounded-2xl border border-border/15 px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Fale com ${character.name}...`}
            className="flex-1 bg-transparent text-sm resize-none outline-none max-h-24 text-foreground placeholder:text-muted-foreground/40"
            rows={1}
          />
          <button
            onClick={send}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-xl bg-primary/15 hover:bg-primary/25 flex items-center justify-center transition-colors disabled:opacity-30"
          >
            <Send className="w-3.5 h-3.5 text-primary" />
          </button>
        </div>
      </div>
    </div>
  );
}
