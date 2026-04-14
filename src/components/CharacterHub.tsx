import { useState, useEffect } from "react";
import { Search, Plus, Heart, MessageCircle, TrendingUp, Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CharacterChat } from "./CharacterChat";
import { CreateCharacter } from "./CreateCharacter";


interface Character {
  id: string;
  creator_id: string;
  name: string;
  avatar_url: string | null;
  description: string;
  personality: string;
  category: string;
  likes_count: number;
  chat_count: number;
  is_public: boolean;
}

const CATEGORY_FILTERS = [
  { value: "all", label: "Todos", icon: "✨" },
  { value: "anime", label: "Anime", icon: "🎌" },
  { value: "assistente", label: "Assistente", icon: "🤖" },
  { value: "roleplay", label: "Roleplay", icon: "🎭" },
  { value: "amigo", label: "Amigo", icon: "💬" },
  { value: "educacao", label: "Educação", icon: "📚" },
  { value: "geral", label: "Geral", icon: "🌟" },
];

export function CharacterHub() {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"popular" | "recent" | "likes">("popular");

  const fetchCharacters = async () => {
    setLoading(true);
    let query = supabase.from("ai_characters").select("*");

    if (category !== "all") {
      query = query.eq("category", category);
    }

    if (sortBy === "popular") query = query.order("chat_count", { ascending: false });
    else if (sortBy === "likes") query = query.order("likes_count", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error(error);
    } else {
      setCharacters((data || []) as Character[]);
    }
    setLoading(false);
  };

  const fetchLikes = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("character_likes")
      .select("character_id")
      .eq("user_id", user.id);
    if (data) {
      setLikedIds(new Set(data.map(d => d.character_id)));
    }
  };

  useEffect(() => { fetchCharacters(); }, [category, sortBy]);
  useEffect(() => { fetchLikes(); }, [user]);

  const toggleLike = async (charId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const isLiked = likedIds.has(charId);
    if (isLiked) {
      await supabase.from("character_likes").delete().eq("character_id", charId).eq("user_id", user.id);
      setLikedIds(prev => { const n = new Set(prev); n.delete(charId); return n; });
      setCharacters(prev => prev.map(c => c.id === charId ? { ...c, likes_count: Math.max(0, c.likes_count - 1) } : c));
    } else {
      await supabase.from("character_likes").insert({ character_id: charId, user_id: user.id });
      setLikedIds(prev => new Set(prev).add(charId));
      setCharacters(prev => prev.map(c => c.id === charId ? { ...c, likes_count: c.likes_count + 1 } : c));
    }
  };

  const filtered = characters.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase())
  );

  // If chatting with a character
  if (selectedCharacter) {
    return <CharacterChat character={selectedCharacter} onBack={() => setSelectedCharacter(null)} />;
  }

  // If creating a character
  if (showCreate) {
    return <CreateCharacter onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchCharacters(); }} />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-black text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Personagens AI
            </h1>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Converse com personagens únicos ou crie o seu</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar personagens..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted/10 border border-border/15 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30"
          />
        </div>

        {/* Category filters */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {CATEGORY_FILTERS.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                category === cat.value
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "bg-muted/8 text-muted-foreground/50 border border-border/10 hover:bg-muted/15"
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-1 px-4 py-2 shrink-0">
        {([
          { key: "popular", label: "Popular", icon: TrendingUp },
          { key: "likes", label: "Curtidos", icon: Heart },
          { key: "recent", label: "Recentes", icon: Star },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
              sortBy === key
                ? "bg-muted/20 text-foreground"
                : "text-muted-foreground/40 hover:text-muted-foreground/60"
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Characters Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">🤖</span>
            <p className="text-sm text-muted-foreground/50">Nenhum personagem encontrado</p>
            <button onClick={() => setShowCreate(true)} className="mt-3 text-xs text-primary hover:underline">
              Criar o primeiro!
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filtered.map(char => (
              <button
                key={char.id}
                onClick={() => setSelectedCharacter(char)}
                className="group relative bg-muted/8 hover:bg-muted/15 border border-border/10 hover:border-primary/15 rounded-2xl p-3 text-left transition-all duration-300"
              >
                {/* Avatar */}
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-muted/20 border border-border/10 mb-2.5 relative">
                  {char.avatar_url ? (
                    <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">🤖</div>
                  )}
                  {/* Category badge */}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[8px] text-white/80 font-medium">
                    {CATEGORY_FILTERS.find(c => c.value === char.category)?.icon} {char.category}
                  </div>
                </div>

                {/* Info */}
                <h3 className="text-xs font-bold text-foreground truncate">{char.name}</h3>
                <p className="text-[10px] text-muted-foreground/50 line-clamp-2 mt-0.5 min-h-[24px]">{char.description}</p>

                {/* Stats */}
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={(e) => toggleLike(char.id, e)}
                    className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40 hover:text-pink-400 transition-colors"
                  >
                    <Heart className={`w-3 h-3 ${likedIds.has(char.id) ? "fill-pink-400 text-pink-400" : ""}`} />
                    {char.likes_count}
                  </button>
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40">
                    <MessageCircle className="w-3 h-3" />
                    {char.chat_count >= 1000 ? `${(char.chat_count / 1000).toFixed(1)}k` : char.chat_count}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
