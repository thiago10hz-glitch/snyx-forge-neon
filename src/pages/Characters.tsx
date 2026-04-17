import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, MessageCircle, Search, Sparkles, Crown, Flame, Lock, Swords, Wand2, ShieldCheck, Scroll, Gem, Skull, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { resolveCharacterAvatar } from "@/lib/characterAvatars";
import { VipModal } from "@/components/VipModal";

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
  { key: "fantasia", label: "Fantasia", icon: Wand2 },
  { key: "anime", label: "Anime", icon: Star },
  { key: "romance", label: "Romance", icon: Heart },
  { key: "aventura", label: "Aventura", icon: Swords },
  { key: "sombrio", label: "Sombrio", icon: Skull },
  { key: "drama", label: "Drama", icon: Scroll },
  { key: "geral", label: "Geral", icon: Gem },
];

const formatCount = (n: number) => n >= 1_000_000 ? (n/1_000_000).toFixed(1)+"M" : n >= 1000 ? (n/1000).toFixed(1)+"K" : String(n);

const Characters = () => {
  const { user, profile, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [showVipModal, setShowVipModal] = useState(false);

  const hasAccess = profile?.is_rpg_premium || profile?.is_vip || profile?.is_dev || isAdmin;
  const accessReady = !authLoading && profile !== null;

  useEffect(() => {
    if (user) {
      fetchCharacters();
      fetchLikes();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchCharacters = async () => {
    const { data } = await supabase
      .from("ai_characters")
      .select("*")
      .eq("is_public", true)
      .order("chat_count", { ascending: false })
      .limit(120);
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
    if (!hasAccess) { setShowVipModal(true); return; }
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
    if (!hasAccess) { setShowVipModal(true); return; }
    navigate("/?character=" + charId);
  };

  const filtered = characters.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || c.category === category || c.tags?.some(t => t.toLowerCase() === category);
    return matchSearch && matchCat;
  });

  const podium = [...characters].sort((a, b) => b.chat_count - a.chat_count).slice(0, 3);
  const featured = characters[0];

  if (!accessReady) {
    return (
      <div className="min-h-screen bg-[#0a0014] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
          <Wand2 className="absolute inset-0 m-auto w-6 h-6 text-amber-400 animate-pulse" />
        </div>
      </div>
    );
  }

  // === PAYWALL CINEMATOGRÁFICO ===
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#0a0014] relative overflow-hidden text-white">
        {/* Aura mágica de fundo */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.25),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(245,158,11,0.15),transparent_60%)]" />
          <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-purple-600/15 blur-[140px] animate-glow-pulse" />
          <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-amber-500/10 blur-[120px] animate-glow-pulse" style={{ animationDelay: '3s' }} />
          {/* Partículas flutuantes */}
          {Array.from({length: 25}).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-amber-400/60"
              style={{
                left: `${(i * 37) % 100}%`,
                top: `${(i * 53) % 100}%`,
                animation: `breathe ${3 + (i % 4)}s ease-in-out infinite`,
                animationDelay: `${(i * 0.3) % 5}s`,
              }}
            />
          ))}
        </div>

        {/* Header */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#0a0014]/70 border-b border-amber-500/10">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link to="/" className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-amber-500/10 transition-all text-amber-400/60 hover:text-amber-300">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black bg-gradient-to-r from-amber-300 via-amber-100 to-purple-300 bg-clip-text text-transparent tracking-tight">
                Reino dos Personagens
              </h1>
              <p className="text-[10px] text-amber-500/40 tracking-[0.3em] uppercase font-mono">⚔ Premium ⚔</p>
            </div>
          </div>
        </header>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-4 py-12">
          <div className="max-w-2xl w-full text-center space-y-8 animate-fade-in-up">
            {/* Selo épico */}
            <div className="relative mx-auto w-fit">
              <div className="absolute -inset-8 rounded-full bg-gradient-conic from-amber-500/40 via-purple-500/40 to-amber-500/40 blur-2xl animate-spin" style={{ animationDuration: '20s' }} />
              <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-amber-400 via-amber-600 to-purple-900 p-[3px] shadow-[0_0_60px_rgba(245,158,11,0.4)]">
                <div className="w-full h-full rounded-full bg-[#0a0014] flex items-center justify-center relative overflow-hidden">
                  <Swords className="w-16 h-16 text-amber-300 drop-shadow-[0_0_20px_rgba(252,211,77,0.8)]" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-amber-300/10 to-transparent" />
                </div>
              </div>
              <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-purple-900 border-2 border-amber-400 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.5)]">
                <Lock className="w-5 h-5 text-amber-300" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] tracking-[0.4em] text-amber-500/60 uppercase font-mono">⟨ Acesso Restrito ⟩</p>
              <h2 className="text-5xl md:text-6xl font-black bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 bg-clip-text text-transparent leading-none tracking-tight">
                Desperte
                <br />
                <span className="bg-gradient-to-b from-purple-300 via-purple-500 to-purple-800 bg-clip-text text-transparent">a Lenda</span>
              </h2>
              <p className="text-base text-purple-100/60 leading-relaxed max-w-md mx-auto">
                Centenas de personagens AI únicos te aguardam. Forje aventuras épicas, romances arrebatadores e batalhas inesquecíveis.
              </p>
            </div>

            {/* Features grid premium */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
              {[
                { icon: Wand2, label: "Crie Personagens", color: "amber" },
                { icon: Flame, label: "Roleplay Imersivo", color: "rose" },
                { icon: Sparkles, label: "IA Avançada", color: "purple" },
                { icon: ShieldCheck, label: "Sem Limites", color: "emerald" },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="group relative rounded-2xl border border-amber-500/15 bg-gradient-to-b from-purple-950/40 to-transparent p-4 hover:border-amber-400/40 hover:from-purple-900/40 transition-all hover:-translate-y-1">
                  <Icon className={`w-6 h-6 mx-auto mb-2 text-${color}-400 drop-shadow-[0_0_8px_currentColor]`} />
                  <p className="text-[11px] font-bold text-amber-100/80 text-center">{label}</p>
                </div>
              ))}
            </div>

            {/* Preço majestoso */}
            <div className="relative inline-flex flex-col items-center gap-2 px-10 py-6 rounded-2xl bg-gradient-to-br from-purple-950/60 via-[#0a0014] to-amber-950/30 border border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.15)]">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 animate-pulse" />
              <span className="text-[10px] tracking-[0.3em] text-amber-500/60 uppercase font-mono relative">A partir de</span>
              <div className="flex items-baseline gap-1 relative">
                <span className="text-2xl text-amber-400">R$</span>
                <span className="text-6xl font-black bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">80</span>
                <span className="text-sm text-amber-500/60">/mês</span>
              </div>
              <span className="text-[11px] text-purple-300/80 font-medium relative">⚔ ou incluso no plano VIP/DEV ⚔</span>
            </div>

            <button
              onClick={() => setShowVipModal(true)}
              className="group relative w-full max-w-md mx-auto px-10 py-5 rounded-2xl overflow-hidden font-black text-base tracking-wide active:scale-[0.98] transition-all hover:-translate-y-0.5"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-amber-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-[2px] rounded-2xl bg-gradient-to-b from-amber-300 to-amber-600" />
              <span className="relative flex items-center justify-center gap-2 text-purple-950">
                <Swords className="w-5 h-5" />
                INVOCAR PODER PREMIUM
                <Sparkles className="w-5 h-5" />
              </span>
            </button>
            <p className="text-[10px] text-amber-500/30 tracking-widest uppercase">Entre em contato com o admin para ativar</p>
          </div>
        </div>

        <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
      </div>
    );
  }

  // === COM ACESSO — REINO DOS PERSONAGENS ===
  return (
    <div className="min-h-screen bg-[#0a0014] text-white relative">
      {/* Aura ambiente */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(245,158,11,0.08),transparent_50%)]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0014]/80 border-b border-amber-500/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-amber-500/10 transition-all text-amber-400/60 hover:text-amber-300">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg md:text-xl font-black bg-gradient-to-r from-amber-300 via-amber-100 to-purple-300 bg-clip-text text-transparent tracking-tight">
                Reino dos Personagens
              </h1>
              <p className="text-[9px] text-amber-500/40 tracking-[0.3em] uppercase font-mono">⚔ {characters.length} heróis ⚔</p>
            </div>
          </div>
          <div className="relative w-44 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar herói..."
              className="pl-9 h-10 bg-purple-950/30 border-amber-500/15 focus-visible:border-amber-400/40 focus-visible:ring-amber-400/20 text-sm rounded-xl placeholder:text-amber-500/30"
            />
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Hero Featured */}
        {featured && (
          <button
            onClick={() => startChat(featured.id)}
            className="group relative w-full h-56 md:h-72 rounded-3xl overflow-hidden border border-amber-500/20 hover:border-amber-400/50 transition-all text-left"
          >
            {(() => {
              const img = resolveCharacterAvatar(featured.name, featured.avatar_url);
              return img ? (
                <img src={img} alt={featured.name} className="absolute inset-0 w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-1000" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-purple-700 to-amber-900" />
              );
            })()}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0014] via-[#0a0014]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0014] to-transparent" />
            <div className="absolute inset-0 flex items-center px-6 md:px-12">
              <div className="space-y-3 max-w-md">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold tracking-widest uppercase text-amber-300">
                  <Crown className="w-3 h-3" /> Lenda Suprema
                </div>
                <h2 className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl leading-tight">
                  {featured.name}
                </h2>
                <p className="text-sm text-white/70 line-clamp-2 max-w-md">{featured.description}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-amber-300"><Flame className="w-3.5 h-3.5" /> {formatCount(featured.chat_count)} aventuras</span>
                  <span className="flex items-center gap-1 text-rose-300"><Heart className="w-3.5 h-3.5 fill-rose-400" /> {formatCount(featured.likes_count)}</span>
                </div>
              </div>
            </div>
          </button>
        )}

        {/* Pódio */}
        {podium.length === 3 && (
          <div className="rounded-3xl border border-amber-500/15 bg-gradient-to-b from-purple-950/30 to-transparent p-6 backdrop-blur">
            <div className="flex items-center gap-2 mb-6">
              <Crown className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]" />
              <h2 className="text-base font-black tracking-wider uppercase bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">Salão da Glória</h2>
            </div>
            <div className="grid grid-cols-3 gap-3 md:gap-6 items-end">
              {[podium[1], podium[0], podium[2]].map((char, idx) => {
                const realIdx = idx === 0 ? 1 : idx === 1 ? 0 : 2;
                const heights = ["h-24 md:h-32", "h-32 md:h-44", "h-20 md:h-28"];
                const colors = [
                  "from-slate-300 to-slate-500", // 2nd silver
                  "from-amber-300 to-amber-600", // 1st gold
                  "from-orange-400 to-orange-700", // 3rd bronze
                ];
                const ringColors = ["ring-slate-400/60", "ring-amber-400/80 shadow-[0_0_30px_rgba(252,211,77,0.5)]", "ring-orange-500/60"];
                const labels = ["II", "I", "III"];
                const img = resolveCharacterAvatar(char.name, char.avatar_url);
                return (
                  <button
                    key={char.id}
                    onClick={() => startChat(char.id)}
                    className="group flex flex-col items-center gap-2"
                  >
                    <div className={`relative ${idx === 1 ? "w-20 h-20 md:w-28 md:h-28" : "w-16 h-16 md:w-20 md:h-20"} rounded-full overflow-hidden ring-4 ${ringColors[idx]} group-hover:scale-105 transition-transform`}>
                      {img ? (
                        <img src={img} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-700 to-amber-900 flex items-center justify-center text-2xl font-black">{char.name[0]}</div>
                      )}
                      {idx === 1 && (
                        <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 text-amber-400 drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]" />
                      )}
                    </div>
                    <div className="text-center min-w-0 w-full">
                      <p className={`text-xs md:text-sm font-bold truncate ${idx === 1 ? "text-amber-200" : "text-white/80"}`}>{char.name}</p>
                      <p className="text-[10px] text-white/40">{formatCount(char.chat_count)} chats</p>
                    </div>
                    <div className={`w-full ${heights[idx]} rounded-t-xl bg-gradient-to-b ${colors[idx]} flex items-start justify-center pt-2 font-black text-xl md:text-2xl text-purple-950 shadow-2xl`}>
                      {labels[idx]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Categorias */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                category === key
                  ? "bg-gradient-to-r from-amber-400 to-amber-600 text-purple-950 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                  : "bg-purple-950/40 text-amber-100/60 hover:bg-purple-900/50 hover:text-amber-200 border border-amber-500/10"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Grid de cards */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-purple-950/30 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-amber-500/40">
            <Wand2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum herói encontrado neste reino</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {filtered.map((char, i) => {
              const img = resolveCharacterAvatar(char.name, char.avatar_url);
              const rank = i + 1;
              return (
                <button
                  key={char.id}
                  onClick={() => startChat(char.id)}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-amber-500/10 hover:border-amber-400/40 transition-all duration-500 hover:shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:-translate-y-1 bg-purple-950/20"
                >
                  {/* Glow ring on hover */}
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-amber-400/0 via-amber-400/0 to-purple-500/0 group-hover:from-amber-400/40 group-hover:via-amber-300/20 group-hover:to-purple-500/40 transition-all duration-500 opacity-0 group-hover:opacity-100 blur-sm -z-10" />

                  {img ? (
                    <img src={img} alt={char.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-700 via-purple-900 to-amber-900 flex items-center justify-center text-5xl font-black text-amber-300/40">
                      {char.name[0]}
                    </div>
                  )}

                  {/* Vinheta dourada inferior */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0014] via-[#0a0014]/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-900/0 to-purple-900/0 group-hover:from-amber-900/10 group-hover:to-purple-900/20 transition-all duration-500" />

                  {/* Rank top */}
                  {rank <= 10 && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/90 text-purple-950 text-[10px] font-black backdrop-blur shadow-lg">
                      <Crown className="w-2.5 h-2.5" /> #{rank}
                    </div>
                  )}

                  {/* Like button */}
                  <button
                    onClick={(e) => toggleLike(char.id, e)}
                    className="absolute top-2 right-2 w-9 h-9 rounded-full bg-purple-950/70 backdrop-blur border border-amber-500/20 flex items-center justify-center hover:bg-purple-900 hover:border-amber-400/50 transition-all"
                  >
                    <Heart className={`w-4 h-4 ${likedIds.has(char.id) ? "fill-rose-400 text-rose-400 drop-shadow-[0_0_6px_rgba(251,113,133,0.8)]" : "text-amber-200/60"}`} />
                  </button>

                  {/* Chat count chip */}
                  <div className="absolute top-12 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-purple-950/70 backdrop-blur border border-amber-500/20 text-[10px] text-amber-200 font-bold">
                    <MessageCircle className="w-3 h-3" /> {formatCount(char.chat_count)}
                  </div>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
                    <h3 className="text-sm font-black text-white truncate drop-shadow-lg group-hover:text-amber-200 transition-colors">{char.name}</h3>
                    <p className="text-[10px] text-white/60 line-clamp-2 leading-snug">{char.description}</p>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {(char.tags && char.tags.length > 0 ? char.tags : [char.category]).slice(0, 2).map((tag, k) => (
                        <span key={k} className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-200 capitalize font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} />
    </div>
  );
};

export default Characters;
