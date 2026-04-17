import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Heart, MessageCircle, Search, Sparkles, Plus, Pencil, Trash2, Eye, EyeOff, Upload, Loader2, Lock, X, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { resolveCharacterAvatar } from "@/lib/characterAvatars";

function CharacterImg({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const imageSrc = resolveCharacterAvatar(alt, src);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [imageSrc]);

  if (!imageSrc || error) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/10 to-background flex items-center justify-center text-4xl font-bold text-primary/40">
        {alt?.[0]?.toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {!loaded && <div className="absolute inset-0 bg-muted/20 animate-pulse" />}
      <img
        src={imageSrc}
        alt={alt}
        className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ position: loaded ? "relative" : "absolute", inset: 0 }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
    </div>
  );
}

type Character = {
  id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  category: string;
  personality: string;
  system_prompt: string;
  first_message?: string | null;
  scenario?: string | null;
  example_dialog?: string | null;
  is_nsfw?: boolean;
  tags: string[] | null;
  likes_count: number;
  chat_count: number;
  creator_id: string;
  is_public: boolean;
};

const CATEGORIES = [
  { key: "all", label: "Todos" },
  { key: "trending", label: "🔥 Em alta" },
  { key: "anime", label: "Anime" },
  { key: "romance", label: "Romance" },
  { key: "drama", label: "Drama" },
  { key: "fantasia", label: "Fantasia" },
  { key: "aventura", label: "Aventura" },
  { key: "sombrio", label: "Sombrio" },
  { key: "geral", label: "Geral" },
];



interface CharactersPanelProps {
  onBack: () => void;
  onStartChat?: (characterId: string) => void;
}

const emptyForm = {
  name: "",
  description: "",
  personality: "",
  system_prompt: "",
  first_message: "",
  scenario: "",
  category: "geral",
  tags: "",
  is_public: true,
  is_nsfw: false,
  avatar_url: "",
};

const formatCount = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
  return String(n);
};

export const CharactersPanel = ({ onBack, onStartChat }: CharactersPanelProps) => {
  const { user } = useAuth();
  const [isVip, setIsVip] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [showOnlyFavs, setShowOnlyFavs] = useState(false);
  const [hideNsfw, setHideNsfw] = useState(true);
  const [tab, setTab] = useState<"explore" | "mine" | "create">("explore");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [previewChar, setPreviewChar] = useState<Character | null>(null);

  const fetchCharacters = useCallback(async () => {
    const { data } = await supabase
      .from("ai_characters")
      .select("*")
      .eq("is_public", true)
      .order("chat_count", { ascending: false })
      .limit(200);
    setCharacters((data as Character[]) || []);
    setLoading(false);
  }, []);

  const fetchLikes = useCallback(async () => {
    if (!user) return;
    const [likesRes, favsRes] = await Promise.all([
      supabase.from("character_likes").select("character_id").eq("user_id", user.id),
      supabase.from("character_favorites").select("character_id").eq("user_id", user.id),
    ]);
    setLikedIds(new Set((likesRes.data || []).map((l: any) => l.character_id)));
    setFavIds(new Set((favsRes.data || []).map((l: any) => l.character_id)));
  }, [user]);

  const toggleFav = async (charId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (favIds.has(charId)) {
      await supabase.from("character_favorites").delete().eq("character_id", charId).eq("user_id", user.id);
      setFavIds((p) => { const s = new Set(p); s.delete(charId); return s; });
    } else {
      await supabase.from("character_favorites").insert({ character_id: charId, user_id: user.id });
      setFavIds((p) => new Set(p).add(charId));
    }
  };

  const fetchVip = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("is_vip,is_dev")
      .eq("user_id", user.id)
      .maybeSingle();
    setIsVip(!!(data?.is_vip || data?.is_dev));
  }, [user]);

  useEffect(() => {
    fetchCharacters();
    if (user) { fetchLikes(); fetchVip(); }
  }, [user, fetchCharacters, fetchLikes, fetchVip]);

  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const fetchMyCharacters = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ai_characters")
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });
    setMyCharacters((data as Character[]) || []);
  }, [user]);

  useEffect(() => {
    if (tab === "mine") fetchMyCharacters();
  }, [tab, fetchMyCharacters]);

  const toggleLike = async (charId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (likedIds.has(charId)) {
      await supabase.from("character_likes").delete().eq("character_id", charId).eq("user_id", user.id);
      setLikedIds((prev) => { const s = new Set(prev); s.delete(charId); return s; });
      setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, likes_count: Math.max(0, c.likes_count - 1) } : c));
    } else {
      await supabase.from("character_likes").insert({ character_id: charId, user_id: user.id });
      setLikedIds((prev) => new Set(prev).add(charId));
      setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, likes_count: c.likes_count + 1 } : c));
    }
  };

  const openCharacter = (char: Character) => {
    if (char.is_nsfw && !isVip) {
      toast.error("Personagem +18 — assine VIP para acessar");
      return;
    }
    setPreviewChar(char);
  };

  const startChat = async (charId: string) => {
    setPreviewChar(null);
    onStartChat?.(charId);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/characters_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) { toast.error("Erro ao enviar imagem"); return; }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm((f) => ({ ...f, avatar_url: urlData.publicUrl }));
      toast.success("Imagem enviada!");
    } catch (err) {
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploadingAvatar(false);
    }
  };


  const handleSave = async () => {
    if (!user || !form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      personality: form.personality.trim(),
      system_prompt: form.system_prompt.trim(),
      first_message: form.first_message.trim(),
      scenario: form.scenario.trim(),
      category: form.category,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      is_public: form.is_public,
      is_nsfw: form.is_nsfw,
      avatar_url: form.avatar_url || null,
      creator_id: user.id,
    };

    if (editingId) {
      const { error } = await supabase.from("ai_characters").update(payload).eq("id", editingId);
      if (error) toast.error("Erro ao salvar");
      else { toast.success("Personagem atualizado!"); setTab("mine"); setEditingId(null); setForm(emptyForm); fetchMyCharacters(); fetchCharacters(); }
    } else {
      const { error } = await supabase.from("ai_characters").insert(payload);
      if (error) toast.error("Erro ao criar");
      else { toast.success("Personagem criado!"); setTab("mine"); setForm(emptyForm); fetchMyCharacters(); fetchCharacters(); }
    }
    setSaving(false);
  };

  const handleEdit = (char: Character) => {
    setForm({
      name: char.name,
      description: char.description,
      personality: char.personality,
      system_prompt: char.system_prompt,
      first_message: char.first_message || "",
      scenario: char.scenario || "",
      category: char.category,
      tags: (char.tags || []).join(", "),
      is_public: char.is_public,
      is_nsfw: !!char.is_nsfw,
      avatar_url: char.avatar_url || "",
    });
    setEditingId(char.id);
    setTab("create");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deletar este personagem?")) return;
    const { error } = await supabase.from("ai_characters").delete().eq("id", id);
    if (error) toast.error("Erro ao deletar");
    else { toast.success("Personagem deletado"); fetchMyCharacters(); fetchCharacters(); }
  };

  const filtered = characters.filter((c) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || (c.tags || []).some(t => t.toLowerCase().includes(q)) || c.category.toLowerCase().includes(q);
    const matchCat = category === "all" || category === "trending" || category === "favs" || c.category === category;
    const matchFav = !showOnlyFavs || favIds.has(c.id);
    const matchNsfw = !hideNsfw || !c.is_nsfw;
    return matchSearch && matchCat && matchFav && matchNsfw;
  });

  const sorted = category === "trending"
    ? [...filtered].sort((a, b) => b.chat_count - a.chat_count)
    : filtered;

  const banner = sorted.slice(0, 5);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border/10 bg-background/80 backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted/15 transition-all text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-bold gradient-text-subtle truncate">Personagens IA</h2>
            <p className="text-[10px] text-muted-foreground/40 tracking-widest uppercase">Milhares de histórias</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-32 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-9 bg-muted/10 border-border/10 h-9 text-sm"
            />
          </div>
          <button
            onClick={() => { setTab("create"); setEditingId(null); setForm(emptyForm); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Criar</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 px-4 pt-3 pb-1 border-b border-border/5">
        {([
          { key: "explore" as const, label: "Explorar" },
          { key: "mine" as const, label: "Meus" },
          { key: "create" as const, label: editingId ? "Editar" : "Criar" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ===== EXPLORE ===== */}
        {tab === "explore" && (
          <div className="p-4 space-y-5">
            {/* Banner carousel */}
            {banner.length > 0 && (
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
                {banner.map((char) => (
                  <button
                    key={"b-" + char.id}
                    onClick={() => openCharacter(char)}
                    className="relative shrink-0 w-[85%] sm:w-[420px] aspect-[16/9] rounded-2xl overflow-hidden group border border-border/10"
                  >
                    <CharacterImg src={char.avatar_url ?? ""} alt={char.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-full bg-primary/30 backdrop-blur text-[10px] text-white font-bold uppercase tracking-wider">Em alta</span>
                        <span className="flex items-center gap-1 text-[11px] text-white/80"><MessageCircle className="w-3 h-3" />{formatCount(char.chat_count)}</span>
                      </div>
                      <h3 className="text-lg font-bold text-white truncate">{char.name}</h3>
                      <p className="text-xs text-white/70 line-clamp-1">{char.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Categories pills */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
              {CATEGORIES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    category === key
                      ? "bg-foreground text-background shadow-lg"
                      : "bg-muted/15 text-muted-foreground hover:bg-muted/25 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Filter toggles */}
            <div className="flex flex-wrap items-center gap-4 px-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Switch checked={showOnlyFavs} onCheckedChange={setShowOnlyFavs} />
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Só favoritos
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Switch
                  checked={!hideNsfw}
                  onCheckedChange={(v) => {
                    if (v && !isVip) {
                      toast.error("Conteúdo +18 disponível apenas para VIP");
                      return;
                    }
                    setHideNsfw(!v);
                  }}
                />
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-destructive" /> Mostrar +18
                  {!isVip && <Lock className="w-3 h-3 opacity-50" />}
                </span>
              </label>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-2xl bg-muted/10 animate-pulse" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground/50">
                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum personagem encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {sorted.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => openCharacter(char)}
                    className="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-border/10 hover:border-primary/30 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 text-left"
                  >
                    <CharacterImg src={char.avatar_url ?? ""} alt={char.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

                    {/* Top badges */}
                    <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur text-[10px] text-white font-medium">
                        <MessageCircle className="w-3 h-3" />
                        {formatCount(char.chat_count)}
                      </div>
                      <button
                        onClick={(e) => toggleFav(char.id, e)}
                        className={`w-8 h-8 rounded-full backdrop-blur flex items-center justify-center transition-all ${favIds.has(char.id) ? "bg-yellow-500/80 hover:bg-yellow-500" : "bg-black/50 hover:bg-black/70"}`}
                        title={favIds.has(char.id) ? "Remover favorito" : "Favoritar"}
                      >
                        <Sparkles className={`w-4 h-4 ${favIds.has(char.id) ? "fill-white text-white" : "text-white/70"}`} />
                      </button>
                      <button
                        onClick={(e) => toggleLike(char.id, e)}
                        className="w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center hover:bg-black/70 transition-all"
                      >
                        <Heart className={`w-4 h-4 transition-all ${likedIds.has(char.id) ? "fill-red-500 text-red-500 scale-110" : "text-white/70"}`} />
                      </button>
                    </div>

                    {/* NSFW lock */}
                    {char.is_nsfw && !isVip && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center gap-2">
                        <Lock className="w-8 h-8 text-yellow-400" />
                        <span className="text-xs font-bold text-yellow-400">+18 VIP</span>
                      </div>
                    )}
                    {char.is_nsfw && isVip && (
                      <div className="absolute top-10 left-2 px-2 py-0.5 rounded-full bg-red-500/80 backdrop-blur text-[9px] text-white font-bold">
                        +18
                      </div>
                    )}

                    {/* Bottom info */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="text-sm font-bold text-white truncate">{char.name}</h3>
                      <p className="text-[10px] text-white/60 line-clamp-2 mt-0.5 leading-snug">{char.description}</p>
                      {char.tags && char.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5 overflow-hidden">
                          {char.tags.slice(0, 2).map((t) => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/70 truncate">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== MINE ===== */}
        {tab === "mine" && (
          <div className="p-4">
            {myCharacters.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground/50">
                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Você ainda não criou nenhum personagem</p>
                <button onClick={() => { setTab("create"); setForm(emptyForm); setEditingId(null); }} className="mt-3 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all">
                  Criar agora
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {myCharacters.map((char) => (
                  <div key={char.id} className="rounded-2xl border border-border/10 bg-muted/5 p-4 flex gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-border/15 bg-muted/10">
                      <CharacterImg src={char.avatar_url ?? ""} alt={char.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground truncate">{char.name}</h4>
                        {char.is_public ? <Eye className="w-3 h-3 text-muted-foreground/40 shrink-0" /> : <EyeOff className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                        {char.is_nsfw && <Flame className="w-3 h-3 text-red-500 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground/50 truncate">{char.description || "Sem descrição"}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1"><Heart className="w-3 h-3" />{char.likes_count}</span>
                        <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1"><MessageCircle className="w-3 h-3" />{char.chat_count}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => startChat(char.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 transition-all" title="Conversar">
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleEdit(char)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/15 transition-all">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(char.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== CREATE ===== */}
        {tab === "create" && (
          <div className="p-4 max-w-2xl mx-auto space-y-4">
            <div className="rounded-2xl border border-border/10 bg-muted/5 p-5 space-y-4">
              <h3 className="text-sm font-bold text-foreground">{editingId ? "Editar Personagem" : "Novo Personagem"}</h3>

              {/* Foto */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-border/15 bg-muted/10 flex items-center justify-center shrink-0">
                  {form.avatar_url ? (
                    <CharacterImg src={form.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Sparkles className="w-8 h-8 text-muted-foreground/20" />
                  )}
                  {uploadingAvatar && <div className="absolute inset-0 bg-background/70 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
                </div>
                <div className="flex-1 space-y-1">
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/10 border border-border/10 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-all ${uploadingAvatar ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingAvatar ? "Enviando..." : "Foto"}
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploadingAvatar} />
                  </label>
                  {form.avatar_url && !uploadingAvatar && (
                    <button onClick={() => setForm((f) => ({ ...f, avatar_url: "" }))} className="text-xs text-destructive hover:underline">Remover</button>
                  )}
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className="text-xs text-muted-foreground/60 mb-1 block">Nome *</label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Sakura, Anubis..." className="bg-muted/10 border-border/10" />
              </div>

              {/* Personalidade */}
              <div>
                <label className="text-xs text-muted-foreground/60 mb-1 block">Personalidade</label>
                <Textarea value={form.personality} onChange={(e) => setForm((f) => ({ ...f, personality: e.target.value }))} placeholder="Misterioso, dominante, sarcástico, carinhoso..." className="bg-muted/10 border-border/10 min-h-[60px]" />
              </div>

              {/* Características (description) */}
              <div>
                <label className="text-xs text-muted-foreground/60 mb-1 block">Características</label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Quem é o personagem, o que faz, gostos, manias..." className="bg-muted/10 border-border/10 min-h-[60px]" />
              </div>

              {/* Aparência física (scenario repurposed) */}
              <div>
                <label className="text-xs text-muted-foreground/60 mb-1 block">Aparência física</label>
                <Textarea value={form.scenario} onChange={(e) => setForm((f) => ({ ...f, scenario: e.target.value }))} placeholder="Cabelo, olhos, altura, roupas, traços marcantes..." className="bg-muted/10 border-border/10 min-h-[60px]" />
              </div>

              {/* Fala inicial */}
              <div>
                <label className="text-xs text-muted-foreground/60 mb-1 block">Fala</label>
                <Textarea value={form.first_message} onChange={(e) => setForm((f) => ({ ...f, first_message: e.target.value }))} placeholder="O que o personagem diz quando você entra no chat" className="bg-muted/10 border-border/10 min-h-[60px]" />
              </div>

              {/* Público / Privado */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/5 border border-border/10">
                <div className="flex items-center gap-2">
                  {form.is_public ? <Eye className="w-4 h-4 text-muted-foreground" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground">{form.is_public ? "Público (todos veem)" : "Privado (só você)"}</span>
                </div>
                <Switch checked={form.is_public} onCheckedChange={(v) => setForm((f) => ({ ...f, is_public: v }))} />
              </div>

              {/* +18 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Conteúdo +18 (NSFW)</span>
                </div>
                <Switch checked={form.is_nsfw} onCheckedChange={(v) => setForm((f) => ({ ...f, is_nsfw: v }))} />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50">
                  {saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Criar Personagem"}
                </button>
                {editingId && (
                  <button onClick={() => { setEditingId(null); setForm(emptyForm); setTab("mine"); }} className="px-4 py-2.5 rounded-xl bg-muted/10 text-muted-foreground text-sm hover:bg-muted/20 transition-all">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== Character Preview Modal ===== */}
      {previewChar && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewChar(null)}>
          <div className="relative w-full max-w-md max-h-[90vh] overflow-hidden rounded-3xl bg-background border border-border/20 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewChar(null)} className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur text-white hover:bg-black/70 flex items-center justify-center transition-all">
              <X className="w-5 h-5" />
            </button>
            <div className="relative aspect-[3/4] sm:aspect-square">
              <CharacterImg src={previewChar.avatar_url ?? ""} alt={previewChar.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-primary/30 backdrop-blur text-[10px] text-white font-bold uppercase tracking-wider">{previewChar.category}</span>
                  {previewChar.is_nsfw && <span className="px-2 py-0.5 rounded-full bg-red-500/80 text-[10px] text-white font-bold">+18</span>}
                </div>
                <h2 className="text-2xl font-bold text-foreground">{previewChar.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{previewChar.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/70">
                  <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{formatCount(previewChar.chat_count)} chats</span>
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatCount(previewChar.likes_count)}</span>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3 max-h-[40vh] overflow-y-auto border-t border-border/10">
              {previewChar.scenario && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1">🎬 Cenário</div>
                  <p className="text-sm text-foreground/90 italic">{previewChar.scenario}</p>
                </div>
              )}
              {previewChar.first_message && (
                <div className="p-3 rounded-xl bg-muted/10 border border-border/10">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1">💬 {previewChar.name} diz</div>
                  <p className="text-sm text-foreground/90">{previewChar.first_message}</p>
                </div>
              )}
              {previewChar.tags && previewChar.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {previewChar.tags.map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/15 text-muted-foreground">#{t}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border/10 bg-background">
              <button
                onClick={() => startChat(previewChar.id)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Iniciar Conversa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
