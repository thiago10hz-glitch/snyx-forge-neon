import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Swords, Shield, User, Pencil, Trash2, Plus, Check, Upload, Loader2, Crown, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface PlayerCharacter {
  id: string;
  name: string;
  class: string;
  race: string;
  backstory: string;
  personality: string;
  avatar_url: string | null;
  level: number;
  is_active: boolean;
}

const CLASSES = ["Guerreiro", "Mago", "Arqueiro", "Assassino", "Paladino", "Necromante", "Druida", "Bardo", "Monge", "Ladino"];
const RACES = ["Humano", "Elfo", "Anão", "Orc", "Meio-Elfo", "Tiefling", "Draconato", "Halfling", "Gnomo", "Drow"];

interface RpgPlayerCharacterProps {
  onClose: () => void;
}

export function RpgPlayerCharacter({ onClose }: RpgPlayerCharacterProps) {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<PlayerCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [form, setForm] = useState({
    name: "",
    class: "Guerreiro",
    race: "Humano",
    backstory: "",
    personality: "",
    avatar_url: "",
  });

  const fetchCharacters = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("rpg_player_characters")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setCharacters((data as any[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/rpg_player_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) { toast.error("Erro ao enviar imagem"); return; }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm(f => ({ ...f, avatar_url: urlData.publicUrl }));
      toast.success("Imagem enviada!");
    } catch {
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
      class: form.class,
      race: form.race,
      backstory: form.backstory.trim(),
      personality: form.personality.trim(),
      avatar_url: form.avatar_url || null,
      user_id: user.id,
    };

    if (editingId) {
      const { error } = await supabase
        .from("rpg_player_characters")
        .update(payload)
        .eq("id", editingId);
      if (error) toast.error("Erro ao atualizar");
      else toast.success("Personagem atualizado!");
    } else {
      // If this is the first character, make it active
      const isFirst = characters.length === 0;
      const { error } = await supabase
        .from("rpg_player_characters")
        .insert({ ...payload, is_active: isFirst });
      if (error) toast.error("Erro ao criar personagem");
      else toast.success("Personagem criado!");
    }
    setEditing(false);
    setEditingId(null);
    setForm({ name: "", class: "Guerreiro", race: "Humano", backstory: "", personality: "", avatar_url: "" });
    setSaving(false);
    fetchCharacters();
  };

  const handleEdit = (char: PlayerCharacter) => {
    setForm({
      name: char.name,
      class: char.class,
      race: char.race,
      backstory: char.backstory || "",
      personality: char.personality || "",
      avatar_url: char.avatar_url || "",
    });
    setEditingId(char.id);
    setEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deletar este personagem?")) return;
    await supabase.from("rpg_player_characters").delete().eq("id", id);
    toast.success("Personagem deletado");
    fetchCharacters();
  };

  const handleSetActive = async (id: string) => {
    if (!user) return;
    // Deactivate all first
    await supabase
      .from("rpg_player_characters")
      .update({ is_active: false })
      .eq("user_id", user.id);
    // Activate selected
    await supabase
      .from("rpg_player_characters")
      .update({ is_active: true })
      .eq("id", id);
    toast.success("Personagem ativo atualizado!");
    fetchCharacters();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-background border border-border/20 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/10 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center border border-purple-500/20">
              <Swords className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Meu Personagem RPG</h2>
              <p className="text-[10px] text-muted-foreground/50">Crie quem você será na aventura</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/15 transition-all text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Create / Edit form */}
          {editing ? (
            <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles size={14} className="text-purple-400" />
                {editingId ? "Editar Personagem" : "Criar Personagem"}
              </h3>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-border/30 overflow-hidden bg-muted/10 flex items-center justify-center shrink-0">
                  {form.avatar_url ? (
                    <img src={form.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-muted-foreground/30" />
                  )}
                </div>
                <label className="cursor-pointer px-4 py-2 rounded-xl bg-muted/10 border border-border/10 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all flex items-center gap-2">
                  {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploadingAvatar ? "Enviando..." : "Avatar"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                </label>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-medium text-muted-foreground/60 mb-1.5 block">Nome do Personagem</label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Arthorius, Luna, Kaelith..."
                  className="bg-muted/10 border-border/10"
                  maxLength={50}
                />
              </div>

              {/* Class & Race */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground/60 mb-1.5 block">Classe</label>
                  <select
                    value={form.class}
                    onChange={e => setForm(f => ({ ...f, class: e.target.value }))}
                    className="w-full rounded-lg bg-muted/10 border border-border/10 px-3 py-2 text-sm text-foreground"
                  >
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground/60 mb-1.5 block">Raça</label>
                  <select
                    value={form.race}
                    onChange={e => setForm(f => ({ ...f, race: e.target.value }))}
                    className="w-full rounded-lg bg-muted/10 border border-border/10 px-3 py-2 text-sm text-foreground"
                  >
                    {RACES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Backstory */}
              <div>
                <label className="text-xs font-medium text-muted-foreground/60 mb-1.5 block">História de Fundo</label>
                <Textarea
                  value={form.backstory}
                  onChange={e => setForm(f => ({ ...f, backstory: e.target.value }))}
                  placeholder="De onde ele veio? Qual sua motivação? O que busca?"
                  className="bg-muted/10 border-border/10 min-h-[80px] text-sm"
                  maxLength={500}
                />
              </div>

              {/* Personality */}
              <div>
                <label className="text-xs font-medium text-muted-foreground/60 mb-1.5 block">Personalidade</label>
                <Textarea
                  value={form.personality}
                  onChange={e => setForm(f => ({ ...f, personality: e.target.value }))}
                  placeholder="Corajoso, sarcástico, gentil, misterioso..."
                  className="bg-muted/10 border-border/10 min-h-[60px] text-sm"
                  maxLength={300}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(false); setEditingId(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-muted/10 border border-border/10 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-bold hover:bg-purple-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editingId ? "Salvar" : "Criar"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Character list */}
              {characters.length === 0 ? (
                <div className="text-center py-10 space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto border border-purple-500/15">
                    <Swords className="w-10 h-10 text-purple-400/60" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Nenhum personagem criado</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">Crie seu personagem para representar você no RPG!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {characters.map(char => (
                    <div
                      key={char.id}
                      className={`relative rounded-xl border p-4 transition-all ${
                        char.is_active
                          ? "border-purple-500/30 bg-purple-500/5 shadow-lg shadow-purple-500/5"
                          : "border-border/10 bg-muted/5 hover:bg-muted/10"
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Avatar */}
                        <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/15 bg-muted/10 shrink-0">
                          {char.avatar_url ? (
                            <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-primary/30">
                              {char.name[0]}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-foreground truncate">{char.name}</h4>
                            {char.is_active && (
                              <span className="flex items-center gap-1 text-[10px] text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-full">
                                <Crown size={10} /> Ativo
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {char.race} • {char.class} • Nível {char.level}
                          </p>
                          {char.backstory && (
                            <p className="text-[11px] text-muted-foreground/40 mt-1 line-clamp-2">{char.backstory}</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/10">
                        {!char.is_active && (
                          <button
                            onClick={() => handleSetActive(char.id)}
                            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/15 text-purple-400 hover:bg-purple-500/20 transition-all"
                          >
                            <Shield size={12} /> Ativar
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(char)}
                          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-muted/10 border border-border/10 text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        <button
                          onClick={() => handleDelete(char.id)}
                          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all ml-auto"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create button */}
              <button
                onClick={() => setEditing(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border/20 text-sm text-muted-foreground hover:text-foreground hover:border-purple-500/30 hover:bg-purple-500/5 transition-all"
              >
                <Plus size={16} />
                Criar Novo Personagem
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to get the active player character for chat context
export function useActivePlayerCharacter() {
  const { user } = useAuth();
  const [activeChar, setActiveChar] = useState<PlayerCharacter | null>(null);

  useEffect(() => {
    if (!user) { setActiveChar(null); return; }

    const fetch = async () => {
      const { data } = await supabase
        .from("rpg_player_characters")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      setActiveChar(data as PlayerCharacter | null);
    };
    fetch();

    // Listen for changes
    const channel = supabase
      .channel("rpg-player-char")
      .on("postgres_changes", { event: "*", schema: "public", table: "rpg_player_characters", filter: `user_id=eq.${user.id}` }, () => {
        fetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return activeChar;
}
