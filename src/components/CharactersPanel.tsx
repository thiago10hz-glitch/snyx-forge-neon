import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Heart, MessageCircle, Search, Sparkles, Crown, TrendingUp, Star, Filter, Plus, Pencil, Trash2, Eye, EyeOff, Upload, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

function CharacterImg({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="relative w-full h-full">
      {!loaded && !error && (
        <div className="absolute inset-0 bg-muted/20 animate-pulse rounded-inherit" />
      )}
      {error ? (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-lg font-bold text-primary/40">
          {alt?.[0] || "?"}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
        />
      )}
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
  tags: string[] | null;
  likes_count: number;
  chat_count: number;
  creator_id: string;
  is_public: boolean;
};

const CATEGORIES_FILTER = [
  { key: "all", label: "Todos", icon: Sparkles },
  { key: "anime", label: "Anime", icon: Star },
  { key: "romance", label: "Romance", icon: Heart },
  { key: "aventura", label: "Aventura", icon: TrendingUp },
  { key: "geral", label: "Geral", icon: Filter },
];

const CATEGORIES_OPTIONS = ["geral", "anime", "romance", "aventura"];

interface CharactersPanelProps {
  onBack: () => void;
  onStartChat?: (characterId: string) => void;
}

const emptyForm = {
  name: "",
  description: "",
  personality: "",
  system_prompt: "",
  category: "geral",
  tags: "",
  is_public: true,
  avatar_url: "",
};

export const CharactersPanel = ({ onBack, onStartChat }: CharactersPanelProps) => {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"explore" | "mine" | "create">("explore");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const fetchCharacters = useCallback(async () => {
    const { data } = await supabase
      .from("ai_characters")
      .select("*")
      .eq("is_public", true)
      .order("likes_count", { ascending: false })
      .limit(100);
    setCharacters(data || []);
    setLoading(false);
  }, []);

  const fetchLikes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("character_likes")
      .select("character_id")
      .eq("user_id", user.id);
    setLikedIds(new Set((data || []).map((l) => l.character_id)));
  }, [user]);

  useEffect(() => {
    fetchCharacters();
    if (user) fetchLikes();
  }, [user, fetchCharacters, fetchLikes]);

  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const fetchMyCharacters = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ai_characters")
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });
    setMyCharacters(data || []);
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
      setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, likes_count: c.likes_count - 1 } : c));
    } else {
      await supabase.from("character_likes").insert({ character_id: charId, user_id: user.id });
      setLikedIds((prev) => new Set(prev).add(charId));
      setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, likes_count: c.likes_count + 1 } : c));
    }
  };

  const startChat = (charId: string) => {
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
      if (error) {
        console.error("Upload error:", error);
        toast.error("Erro ao enviar imagem");
        return;
      }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm((f) => ({ ...f, avatar_url: urlData.publicUrl }));
      toast.success("Imagem enviada!");
    } catch (err) {
      console.error(err);
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
      category: form.category,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      is_public: form.is_public,
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
      category: char.category,
      tags: (char.tags || []).join(", "),
      is_public: char.is_public,
      avatar_url: char.avatar_url || "",
    });
    setEditingId(char.id);
    setTab("create");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ai_characters").delete().eq("id", id);
    if (error) toast.error("Erro ao deletar");
    else { toast.success("Personagem deletado"); fetchMyCharacters(); fetchCharacters(); }
  };

  const filtered = characters.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || c.category === category;
    return matchSearch && matchCat;
  });

  const topRanking = [...characters].sort((a, b) => b.chat_count - a.chat_count).slice(0, 5);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border/10 glass px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted/15 transition-all text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold gradient-text-subtle">Criar RPG</h2>
            <p className="text-[10px] text-muted-foreground/40 tracking-widest uppercase">Explore & Crie</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-48 hidden md:block">
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Criar</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 px-4 pt-3 pb-1">
        {([
          { key: "explore" as const, label: "Explorar" },
          { key: "mine" as const, label: "Meus" },
          { key: "create" as const, label: editingId ? "Editar" : "Criar" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/15"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* ===== CREATE / EDIT TAB ===== */}
        {tab === "create" && (
          <div className="max-w-lg mx-auto space-y-4">
            <div className="glass-elevated rounded-2xl border border-border/10 p-5 space-y-4">
              <h3 className="text-sm font-bold text-foreground">{editingId ? "Editar Personagem" : "Criar Personagem"}</h3>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-border/15 bg-muted/10 flex items-center justify-center shrink-0">
                  {form.avatar_url ? (
                    <CharacterImg src={form.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Sparkles className="w-8 h-8 text-muted-foreground/20" />
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-background/70 flex items-center justify-center backdrop-blur-sm">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/10 border border-border/10 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-all ${uploadingAvatar ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingAvatar ? "Enviando..." : "Upload Avatar"}
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploadingAvatar} />
                  </label>
                  {form.avatar_url && !uploadingAvatar && (
                    <button onClick={() => setForm((f) => ({ ...f, avatar_url: "" }))} className="text-xs text-destructive hover:underline">Remover</button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs text-muted-foreground/60 mb-1 block">Nome *</label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Sakura, Naruto..." className="bg-muted/10 border-border/10" />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-muted-foreground/60 mb-1 block">Descrição</label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Uma breve descrição do personagem..." className="bg-muted/10 border-border/10 min-h-[60px]" />
              </div>

              {/* Personality */}
              <div>
                <label className="text-xs text-muted-foreground/60 mb-1 block">Personalidade</label>
                <Textarea value={form.personality} onChange={(e) => setForm((f) => ({ ...f, personality: e.target.value }))} placeholder="Amigável, engraçado, misterioso..." className="bg-muted/10 border-border/10 min-h-[60px]" />
              </div>

              {/* System Prompt */}
              <div>
                <label className="text-xs text-muted-foreground/60 mb-1 block">System Prompt (instruções para a IA)</label>
                <Textarea value={form.system_prompt} onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))} placeholder="Você é um personagem que..." className="bg-muted/10 border-border/10 min-h-[80px]" />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs text-muted-foreground/60 mb-1 block">Categoria</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES_OPTIONS.map((c) => (
                    <button key={c} onClick={() => setForm((f) => ({ ...f, category: c }))} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${form.category === c ? "bg-primary text-primary-foreground" : "bg-muted/10 text-muted-foreground border border-border/10 hover:bg-muted/20"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs text-muted-foreground/60 mb-1 block">Tags (separadas por vírgula)</label>
                <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="anime, fofo, divertido" className="bg-muted/10 border-border/10" />
              </div>

              {/* Public toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {form.is_public ? <Eye className="w-4 h-4 text-muted-foreground" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground">{form.is_public ? "Público" : "Privado"}</span>
                </div>
                <Switch checked={form.is_public} onCheckedChange={(v) => setForm((f) => ({ ...f, is_public: v }))} />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50">
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

        {/* ===== MY CHARACTERS TAB ===== */}
        {tab === "mine" && (
          <>
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
                  <div key={char.id} className="glass-elevated rounded-2xl border border-border/10 p-4 flex gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-border/15 bg-muted/10">
                      {char.avatar_url ? (
                        <CharacterImg src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg font-bold text-primary/30">{char.name[0]}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground truncate">{char.name}</h4>
                        {char.is_public ? <Eye className="w-3 h-3 text-muted-foreground/40 shrink-0" /> : <EyeOff className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground/50 truncate">{char.description || "Sem descrição"}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1"><Heart className="w-3 h-3" />{char.likes_count}</span>
                        <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1"><MessageCircle className="w-3 h-3" />{char.chat_count}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
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
          </>
        )}

        {/* ===== EXPLORE TAB ===== */}
        {tab === "explore" && (
          <>
            {/* Mobile search */}
            <div className="md:hidden relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar personagem..." className="pl-9 bg-muted/10 border-border/10" />
            </div>

            {/* Ranking */}
            {topRanking.length > 0 && (
              <div className="glass-elevated rounded-2xl border border-border/10 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-base font-bold text-foreground">Ranking</h3>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {topRanking.map((char, i) => (
                    <button key={char.id} onClick={() => startChat(char.id)} className="flex flex-col items-center gap-2 min-w-[80px] group">
                      <div className="relative">
                        <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${i === 0 ? "border-yellow-500" : i === 1 ? "border-gray-400" : i === 2 ? "border-amber-700" : "border-border/20"} group-hover:scale-105 transition-transform`}>
                          {char.avatar_url ? (
                            <CharacterImg src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-lg font-bold text-primary">{char.name[0]}</div>
                          )}
                        </div>
                        <span className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? "bg-yellow-500 text-black" : i === 1 ? "bg-gray-400 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                      </div>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[80px]">{char.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {CATEGORIES_FILTER.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setCategory(key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${category === key ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-muted/10 text-muted-foreground hover:bg-muted/20 hover:text-foreground border border-border/10"}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Grid */}
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
                  <button key={char.id} onClick={() => startChat(char.id)} className="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-border/10 hover:border-primary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
                    {char.avatar_url ? (
                      <CharacterImg src={char.avatar_url} alt={char.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/5 to-background flex items-center justify-center">
                        <span className="text-4xl font-black text-primary/30">{char.name[0]}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <button onClick={(e) => toggleLike(char.id, e)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-all">
                      <Heart className={`w-4 h-4 ${likedIds.has(char.id) ? "fill-red-500 text-red-500" : "text-white/70"}`} />
                    </button>
                    {char.likes_count > 0 && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-[10px] text-white/80">
                        <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                        {char.likes_count >= 1000 ? (char.likes_count / 1000).toFixed(1) + "k" : char.likes_count}
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="text-sm font-bold text-white truncate">{char.name}</h3>
                      <p className="text-[10px] text-white/50 truncate mt-0.5">{char.description}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="flex items-center gap-1 text-[10px] text-white/40">
                          <MessageCircle className="w-3 h-3" />
                          {char.chat_count >= 1000 ? (char.chat_count / 1000).toFixed(1) + "k" : char.chat_count}
                        </span>
                        {char.tags && char.tags.length > 0 && (
                          <span className="text-[10px] text-white/30 truncate">{char.tags[0]}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
