import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, MessageCircle, Search, Sparkles, Crown, TrendingUp, Star, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Character = {
  id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  category: string;
  tags: string[] | null;
  likes_count: number;
  chat_count: number;
  creator_id: string;
  is_public: boolean;
};

const CATEGORIES = [
  { key: "all", label: "Todos", icon: Sparkles },
  { key: "anime", label: "Anime", icon: Star },
  { key: "romance", label: "Romance", icon: Heart },
  { key: "aventura", label: "Aventura", icon: TrendingUp },
  { key: "geral", label: "Geral", icon: Filter },
];

const Characters = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCharacters();
    if (user) fetchLikes();
  }, [user]);

  const fetchCharacters = async () => {
    const { data } = await supabase
      .from("ai_characters")
      .select("*")
      .eq("is_public", true)
      .order("likes_count", { ascending: false })
      .limit(100);
    setCharacters(data || []);
    setLoading(false);
  };

  const fetchLikes = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("character_likes")
      .select("character_id")
      .eq("user_id", user.id);
    setLikedIds(new Set((data || []).map((l) => l.character_id)));
  };

  const toggleLike = async (charId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (likedIds.has(charId)) {
      await supabase.from("character_likes").delete().eq("character_id", charId).eq("user_id", user.id);
      setLikedIds((prev) => { const s = new Set(prev); s.delete(charId); return s; });
      setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, likes_count: c.likes_count - 1 } : c));
    } else {
      await supabase.from("character_likes").insert({ character_id: charId, user_id: user.id });
      setLikedIds((prev) => new Set(prev).add(charId));
      setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, likes_count: c.likes_count + 1 } : c));
    }
  };

  const startChat = (charId: string) => {
    navigate("/?character=" + charId);
  };

  const filtered = characters.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || c.category === category;
    return matchSearch && matchCat;
  });

  const topRanking = [...characters].sort((a, b) => b.chat_count - a.chat_count).slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 glass border-b border-border/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted/15 transition-all text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold gradient-text-subtle">Personagens AI</h1>
              <p className="text-[10px] text-muted-foreground/40 tracking-widest uppercase">Explore & Chat</p>
            </div>
          </div>
          <div className="relative w-64 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar personagem..."
              className="pl-9 bg-muted/10 border-border/10 h-9 text-sm"
            />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Mobile search */}
        <div className="md:hidden relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar personagem..."
            className="pl-9 bg-muted/10 border-border/10"
          />
        </div>

        {/* Ranking Section */}
        {topRanking.length > 0 && (
          <div className="glass-elevated rounded-2xl border border-border/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-yellow-500" />
              <h2 className="text-base font-bold text-foreground">Ranking</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {topRanking.map((char, i) => (
                <button
                  key={char.id}
                  onClick={() => startChat(char.id)}
                  className="flex flex-col items-center gap-2 min-w-[80px] group"
                >
                  <div className="relative">
                    <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${i === 0 ? "border-yellow-500" : i === 1 ? "border-gray-400" : i === 2 ? "border-amber-700" : "border-border/20"} group-hover:scale-105 transition-transform`}>
                      {char.avatar_url ? (
                        <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                          {char.name[0]}
                        </div>
                      )}
                    </div>
                    <span className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? "bg-yellow-500 text-black" : i === 1 ? "bg-gray-400 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[80px]">{char.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                category === key
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground border border-border/10"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Characters Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-muted/10 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground/50">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum personagem encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((char) => (
              <button
                key={char.id}
                onClick={() => startChat(char.id)}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-border/10 hover:border-primary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
              >
                {/* Image */}
                {char.avatar_url ? (
                  <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/5 to-background flex items-center justify-center">
                    <span className="text-4xl font-black text-primary/30">{char.name[0]}</span>
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Like button */}
                <button
                  onClick={(e) => toggleLike(char.id, e)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-all"
                >
                  <Heart className={`w-4 h-4 ${likedIds.has(char.id) ? "fill-red-500 text-red-500" : "text-white/70"}`} />
                </button>

                {/* Likes badge */}
                {char.likes_count > 0 && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-[10px] text-white/80">
                    <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                    {char.likes_count >= 1000 ? (char.likes_count / 1000).toFixed(1) + "k" : char.likes_count}
                  </div>
                )}

                {/* Info */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-sm font-bold text-white truncate">{char.name}</h3>
                  <p className="text-[10px] text-white/50 truncate mt-0.5">{char.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] text-white/40">
                      <MessageCircle className="w-3 h-3" />
                      {char.chat_count >= 1000 ? (char.chat_count / 1000).toFixed(1) + "k" : char.chat_count}
                    </span>
                    {char.tags && char.tags.length > 0 && (
                      <span className="text-[10px] text-white/30 truncate">
                        {char.tags[0]}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Characters;
