import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { Search, Home, Sparkles, Wallet, Gamepad2, User, ChevronDown, MessageCircle, Crown } from "lucide-react";
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
};

const TAGS = [
  "Explorar","Vídeo","Hoje","Drama","Leal","Fictícia","Aluna","Romance","Brincalhão",
  "Fatia de vida","Possessiva","Anime","Aventura","Sombrio","Fantasia","Geral"
];

const BANNERS = [
  { title: "Uma Nova Geração Começa", subtitle: "Evoluiu. Não foi apenas substituída.", grad: "from-indigo-900 via-purple-900 to-slate-900" },
  { title: "SnyX Sempre Ativo", subtitle: "Receba os recursos mais recentes e atualizações.", grad: "from-rose-900 via-pink-900 to-slate-900" },
  { title: "Junte-se ao VIP", subtitle: "Poder profissional sem limites.", grad: "from-amber-900 via-orange-900 to-slate-900" },
];

const formatCount = (n: number) => n >= 1_000_000 ? (n/1_000_000).toFixed(1)+"M" : n >= 1000 ? (n/1000).toFixed(1)+"K" : String(n);

const Explore = () => {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("Explorar");
  const [bannerIdx, setBannerIdx] = useState(0);
  const [showVip, setShowVip] = useState(false);
  const tagsRef = useRef<HTMLDivElement>(null);

  const hasAccess = profile?.is_rpg_premium || profile?.is_vip || profile?.is_dev || isAdmin;

  useEffect(() => {
    fetchCharacters();
    const t = setInterval(() => setBannerIdx(i => (i+1) % BANNERS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const fetchCharacters = async () => {
    const { data } = await supabase
      .from("ai_characters")
      .select("id,name,description,avatar_url,category,tags,likes_count,chat_count")
      .eq("is_public", true)
      .order("chat_count", { ascending: false })
      .limit(100);
    setCharacters(data || []);
    setLoading(false);
  };

  const filtered = characters.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    if (activeTag === "Explorar" || activeTag === "Hoje") return matchSearch;
    const tagLower = activeTag.toLowerCase();
    const matchTag = c.category?.toLowerCase().includes(tagLower) || c.tags?.some(t => t.toLowerCase().includes(tagLower));
    return matchSearch && matchTag;
  });

  const startChat = (id: string) => {
    if (!hasAccess) { setShowVip(true); return; }
    navigate("/?character=" + id);
  };

  const sidebarItems = [
    { icon: Home, label: "Explorar", to: "/explore", active: true },
    { icon: Crown, label: "SnyX+", to: "/pack-steam" },
    { icon: Wallet, label: "Carteira", to: "/" },
    { icon: Gamepad2, label: "Playground", to: "/characters" },
    { icon: User, label: "Eu", to: "/" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-foreground flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-[#0a0a0a] border-r border-white/5 sticky top-0 h-screen p-3 gap-1">
        <Link to="/" className="flex items-center gap-2 px-3 py-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-base">😊</div>
          <span className="text-xl font-bold">SnyX</span>
        </Link>
        {sidebarItems.map(item => (
          <Link
            key={item.label}
            to={item.to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              item.active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </Link>
        ))}
        <div className="mt-6 px-3 text-xs text-white/30 flex items-center gap-1 cursor-pointer hover:text-white/60">
          Chats <ChevronDown className="w-3 h-3" />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Banner carousel */}
        <div className="relative h-56 md:h-72 overflow-hidden">
          {BANNERS.map((b, i) => (
            <div
              key={i}
              className={`absolute inset-0 bg-gradient-to-br ${b.grad} transition-opacity duration-1000 ${i === bannerIdx ? "opacity-100" : "opacity-0"}`}
            >
              <div className="absolute inset-0 flex items-center px-8 md:px-16">
                <div className="space-y-2 max-w-md">
                  <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">{b.title}</h2>
                  <p className="text-sm md:text-base text-white/70">{b.subtitle}</p>
                </div>
              </div>
              {/* Decorative orbs */}
              <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden md:flex gap-2">
                {["bg-emerald-400","bg-yellow-400","bg-orange-400","bg-rose-400","bg-purple-400","bg-amber-300"].map((c, k) => (
                  <div key={k} className={`w-10 h-10 rounded-full ${c} opacity-90 shadow-2xl`} style={{ animationDelay: `${k*0.2}s` }} />
                ))}
              </div>
            </div>
          ))}
          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {BANNERS.map((_, i) => (
              <button
                key={i}
                onClick={() => setBannerIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === bannerIdx ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
              />
            ))}
          </div>
        </div>

        {/* Tags + search */}
        <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/5">
          <div className="flex items-center gap-3 px-4 md:px-8 py-3">
            <div ref={tagsRef} className="flex-1 flex gap-1 overflow-x-auto scrollbar-hide">
              {TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                    activeTag === tag ? "text-white font-semibold" : "text-white/50 hover:text-white/80"
                  }`}
                >
                  {tag}
                  {activeTag === tag && <div className="h-0.5 bg-white rounded-full mt-0.5" />}
                </button>
              ))}
            </div>
            <div className="relative w-44 md:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar bot..."
                className="pl-9 h-9 bg-white/5 border-white/10 text-sm rounded-full text-white placeholder:text-white/40"
              />
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="px-4 md:px-8 py-6">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({length: 10}).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-white/40">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum personagem encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map(char => {
                const img = resolveCharacterAvatar(char.name, char.avatar_url);
                return (
                  <button
                    key={char.id}
                    onClick={() => startChat(char.id)}
                    className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-white/5 hover:ring-2 hover:ring-white/30 transition-all text-left"
                  >
                    {img ? (
                      <img src={img} alt={char.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500/30 to-pink-500/10 flex items-center justify-center text-5xl font-black text-white/30">
                        {char.name[0]}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                    {/* Chat count chip */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur text-[11px] text-white font-medium">
                      <MessageCircle className="w-3 h-3" />
                      {formatCount(char.chat_count || 0)}
                    </div>

                    {/* Bottom info */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
                      <h3 className="text-sm font-bold text-white truncate">{char.name}</h3>
                      <p className="text-[11px] text-white/60 line-clamp-2 leading-snug">{char.description}</p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {(char.tags || [char.category]).filter(Boolean).slice(0, 3).map((tag, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/70 capitalize">
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
      </main>

      <VipModal open={showVip} onClose={() => setShowVip(false)} />
    </div>
  );
};

export default Explore;
