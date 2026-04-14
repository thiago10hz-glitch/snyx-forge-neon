import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CreateCharacterProps {
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORIES = [
  { value: "anime", label: "🎌 Anime" },
  { value: "assistente", label: "🤖 Assistente" },
  { value: "roleplay", label: "🎭 Roleplay" },
  { value: "amigo", label: "💬 Amigo" },
  { value: "educacao", label: "📚 Educação" },
  { value: "geral", label: "✨ Geral" },
];

export function CreateCharacter({ onClose, onCreated }: CreateCharacterProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    personality: "",
    system_prompt: "",
    category: "geral",
    avatar_url: "",
    is_public: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim()) return;

    setSaving(true);
    const { error } = await supabase.from("ai_characters").insert({
      creator_id: user.id,
      name: form.name.trim(),
      description: form.description.trim(),
      personality: form.personality.trim(),
      system_prompt: form.system_prompt.trim(),
      category: form.category,
      avatar_url: form.avatar_url.trim() || null,
      is_public: form.is_public,
    });

    if (error) {
      toast.error("Erro ao criar personagem");
      console.error(error);
    } else {
      toast.success("Personagem criado!");
      onCreated();
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b border-border/10 shrink-0">
        <h2 className="text-base font-bold text-foreground">Criar Personagem</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/20">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Avatar URL */}
        <div>
          <label className="text-xs text-muted-foreground/70 mb-1 block">Avatar (URL da imagem)</label>
          <input
            value={form.avatar_url}
            onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-xl bg-muted/10 border border-border/15 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30"
          />
          {form.avatar_url && (
            <div className="mt-2 flex justify-center">
              <img src={form.avatar_url} alt="Preview" className="w-16 h-16 rounded-full object-cover border border-border/20" />
            </div>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-muted-foreground/70 mb-1 block">Nome *</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Nome do personagem"
            required
            className="w-full px-3 py-2 rounded-xl bg-muted/10 border border-border/15 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-muted-foreground/70 mb-1 block">Descrição curta</label>
          <input
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Uma frase sobre o personagem"
            className="w-full px-3 py-2 rounded-xl bg-muted/10 border border-border/15 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs text-muted-foreground/70 mb-1 block">Categoria</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  form.category === cat.value
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-muted/10 text-muted-foreground/60 border border-border/15 hover:bg-muted/20"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Personality */}
        <div>
          <label className="text-xs text-muted-foreground/70 mb-1 block">Personalidade</label>
          <textarea
            value={form.personality}
            onChange={e => setForm(f => ({ ...f, personality: e.target.value }))}
            placeholder="Descreva como o personagem age, fala, seus traços..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-muted/10 border border-border/15 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 resize-none"
          />
        </div>

        {/* System Prompt */}
        <div>
          <label className="text-xs text-muted-foreground/70 mb-1 block">Prompt do sistema (avançado)</label>
          <textarea
            value={form.system_prompt}
            onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
            placeholder="Instruções detalhadas para a IA (opcional)"
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-muted/10 border border-border/15 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 resize-none"
          />
        </div>

        {/* Public toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, is_public: !f.is_public }))}
            className={`w-10 h-6 rounded-full transition-colors relative ${form.is_public ? "bg-primary/40" : "bg-muted/30"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-foreground transition-transform ${form.is_public ? "left-[18px]" : "left-0.5"}`} />
          </button>
          <span className="text-xs text-muted-foreground/70">{form.is_public ? "Público - todos podem ver" : "Privado - só você"}</span>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!form.name.trim() || saving}
          className="w-full py-3 rounded-2xl bg-primary/15 hover:bg-primary/25 text-primary font-semibold text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {saving ? "Criando..." : "Criar Personagem"}
        </button>
      </form>
    </div>
  );
}
