import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, MessageCircle, Heart, Plus, Trash2, Sparkles, Crown, Loader2 } from "lucide-react";
import { resolveCharacterAvatar } from "@/lib/characterAvatars";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Character = {
  id: string;
  name: string;
  description: string;
  personality: string | null;
  scenario: string | null;
  first_message: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  category: string;
  tags: string[] | null;
  likes_count: number;
  chat_count: number;
  is_nsfw: boolean;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

const CharacterProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [char, setChar] = useState<Character | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const hasAccess = profile?.is_rpg_premium || profile?.is_vip || profile?.is_dev || isAdmin;

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const [cRes, convRes] = await Promise.all([
        supabase.from("ai_characters").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("chat_conversations")
          .select("id, title, created_at, updated_at")
          .eq("user_id", user.id)
          .eq("character_id", id)
          .order("updated_at", { ascending: false }),
      ]);
      setChar(cRes.data as Character | null);
      setConversations((convRes.data || []) as Conversation[]);
      setLoading(false);
    })();
  }, [id, user]);

  const openConversation = (convId: string) => {
    navigate(`/?character=${id}&conv=${convId}`);
  };

  const startNewConversation = async () => {
    if (!user || !char || !hasAccess) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ user_id: user.id, mode: "rpg", title: char.name, character_id: char.id })
      .select("id")
      .maybeSingle();
    if (error || !data) {
      toast.error("Erro ao criar conversa");
      setCreating(false);
      return;
    }
    if (char.first_message?.trim()) {
      await supabase.from("chat_messages").insert({
        conversation_id: data.id,
        role: "assistant",
        content: char.first_message.trim(),
      });
    }
    await supabase.rpc("increment_character_chat_count", { p_character_id: char.id });
    navigate(`/?character=${char.id}&conv=${data.id}`);
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Apagar essa conversa?")) return;
    await supabase.from("chat_conversations").delete().eq("id", convId);
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    toast.success("Conversa apagada");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0014] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!char) {
    return (
      <div className="min-h-screen bg-[#0a0014] flex flex-col items-center justify-center text-amber-400 gap-4">
        <p>Personagem não encontrado</p>
        <Link to="/characters" className="underline">Voltar</Link>
      </div>
    );
  }

  const img = resolveCharacterAvatar(char.name, char.avatar_url);
  const banner = char.banner_url || img;

  return (
    <div className="min-h-screen bg-[#0a0014] text-white">
      {/* Banner */}
      <div className="relative h-64 md:h-80 overflow-hidden">
        {banner ? (
          <img src={banner} alt={char.name} className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm opacity-60" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-purple-700 to-amber-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0014]/40 via-[#0a0014]/60 to-[#0a0014]" />
        <button
          onClick={() => navigate("/characters")}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-xl bg-purple-950/60 backdrop-blur border border-amber-500/20 flex items-center justify-center text-amber-300 hover:bg-purple-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Avatar + nome */}
      <div className="max-w-3xl mx-auto px-4 -mt-24 relative z-10">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl overflow-hidden border-4 border-amber-400/40 shadow-[0_0_40px_rgba(245,158,11,0.3)] bg-purple-950">
            {img ? (
              <img src={img} alt={char.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl font-black text-amber-300">{char.name[0]}</div>
            )}
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">
              {char.name}
            </h1>
            {char.is_nsfw && (
              <span className="inline-block text-[10px] font-black px-2 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">+18</span>
            )}
            <div className="flex items-center justify-center gap-4 text-xs text-amber-200/70">
              <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {char.chat_count}</span>
              <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {char.likes_count}</span>
              <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> {char.category}</span>
            </div>
          </div>
        </div>

        {/* Seções */}
        <div className="mt-8 space-y-6">
          {char.description && (
            <section className="rounded-2xl bg-purple-950/30 border border-amber-500/15 p-4">
              <h3 className="text-xs font-black tracking-widest uppercase text-amber-400 mb-2">Características</h3>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{char.description}</p>
            </section>
          )}
          {char.personality && (
            <section className="rounded-2xl bg-purple-950/30 border border-amber-500/15 p-4">
              <h3 className="text-xs font-black tracking-widest uppercase text-amber-400 mb-2">Personalidade</h3>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{char.personality}</p>
            </section>
          )}
          {char.scenario && (
            <section className="rounded-2xl bg-purple-950/30 border border-amber-500/15 p-4">
              <h3 className="text-xs font-black tracking-widest uppercase text-amber-400 mb-2">Aparência física</h3>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{char.scenario}</p>
            </section>
          )}
          {char.first_message && (
            <section className="rounded-2xl bg-gradient-to-br from-amber-900/20 to-purple-950/30 border border-amber-500/30 p-4">
              <h3 className="text-xs font-black tracking-widest uppercase text-amber-400 mb-2">Fala inicial</h3>
              <p className="text-sm text-white/90 italic leading-relaxed">"{char.first_message}"</p>
            </section>
          )}
        </div>

        {/* Ação principal */}
        <div className="mt-8 sticky bottom-4 z-20">
          <Button
            onClick={startNewConversation}
            disabled={creating || !hasAccess}
            className="w-full h-14 text-base font-black bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-purple-950 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.4)]"
          >
            {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Iniciar nova conversa</>}
          </Button>
        </div>

        {/* Histórico */}
        <div className="mt-8 mb-12">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-black tracking-widest uppercase text-amber-300">Histórico de conversas</h2>
            <span className="text-xs text-amber-500/50">({conversations.length})</span>
          </div>
          {conversations.length === 0 ? (
            <p className="text-sm text-amber-500/40 text-center py-8 italic">
              Nenhuma conversa ainda. Inicie a primeira aventura!
            </p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv.id)}
                  className="group w-full flex items-center gap-3 p-3 rounded-xl bg-purple-950/30 border border-amber-500/10 hover:border-amber-400/40 hover:bg-purple-900/40 transition text-left"
                >
                  <MessageCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate font-medium">{conv.title}</p>
                    <p className="text-[10px] text-amber-500/50">
                      {new Date(conv.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterProfile;
