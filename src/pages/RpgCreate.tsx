import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, ArrowLeft, Wand2, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface GeneratedChar {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_message: string;
  tags: string[];
  category: string;
  avatar_prompt: string;
  is_nsfw: boolean;
  language: string;
}

export default function RpgCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [idea, setIdea] = useState("");
  const [nsfw, setNsfw] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState<GeneratedChar | null>(null);

  const handleGenerate = async () => {
    if (idea.trim().length < 5) {
      toast.error("Descreva sua ideia em pelo menos 5 caracteres");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("character-builder", {
        body: { idea: idea.trim(), nsfw, language: "pt-BR" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setGenerated(data as GeneratedChar);
      toast.success("Personagem gerado! Revise e salve.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (publish: boolean) => {
    if (!user || !generated) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("ai_characters")
        .insert({
          creator_id: user.id,
          name: generated.name,
          description: generated.description,
          personality: generated.personality,
          scenario: generated.scenario,
          first_message: generated.first_message,
          tags: generated.tags,
          category: generated.category,
          is_nsfw: generated.is_nsfw,
          language: generated.language,
          is_public: publish,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success(publish ? "Publicado no catálogo!" : "Salvo (privado)");
      navigate(`/rpg/c/${data.id}`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (k: keyof GeneratedChar, v: any) => {
    if (!generated) return;
    setGenerated({ ...generated, [k]: v });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link to="/rpg" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-2 flex items-center gap-2">
            <Wand2 className="h-7 w-7 text-primary" /> Criar personagem
          </h1>
          <p className="text-muted-foreground">
            Descreva sua ideia em 1 frase. A IA monta personalidade, cenário e fala inicial.
          </p>
        </div>

        {/* Step 1: Ideia */}
        <Card className="p-5 mb-6 bg-card/60 backdrop-blur border-border/60">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sua ideia</Label>
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Ex: Um vampiro chefe possessivo que me contratou como assistente, cenário moderno..."
            rows={3}
            maxLength={600}
            className="mt-2 resize-none"
            disabled={generating}
          />
          <div className="flex items-center justify-between mt-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={nsfw} onCheckedChange={setNsfw} disabled={generating} />
              <span className={nsfw ? "text-destructive font-semibold" : "text-muted-foreground"}>
                Conteúdo +18 (NSFW)
              </span>
            </label>
            <span className="text-xs text-muted-foreground">{idea.length}/600</span>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating || idea.trim().length < 5}
            className="w-full mt-4 gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Gerando..." : generated ? "Gerar de novo" : "Gerar com IA"}
          </Button>
        </Card>

        {/* Step 2: Edit */}
        {generated && (
          <Card className="p-5 space-y-4 bg-card/60 backdrop-blur border-border/60">
            <div>
              <Label>Nome</Label>
              <Input value={generated.name} onChange={(e) => updateField("name", e.target.value)} maxLength={80} className="mt-1.5" />
            </div>

            <div>
              <Label>Descrição curta</Label>
              <Textarea value={generated.description} onChange={(e) => updateField("description", e.target.value)} rows={2} maxLength={500} className="mt-1.5 resize-none" />
            </div>

            <div>
              <Label>Personalidade</Label>
              <Textarea value={generated.personality} onChange={(e) => updateField("personality", e.target.value)} rows={4} maxLength={1500} className="mt-1.5 resize-none" />
            </div>

            <div>
              <Label>Cenário</Label>
              <Textarea value={generated.scenario} onChange={(e) => updateField("scenario", e.target.value)} rows={2} maxLength={800} className="mt-1.5 resize-none" />
            </div>

            <div>
              <Label>Primeira mensagem (do personagem)</Label>
              <Textarea value={generated.first_message} onChange={(e) => updateField("first_message", e.target.value)} rows={5} maxLength={2000} className="mt-1.5 resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Input value={generated.category} onChange={(e) => updateField("category", e.target.value)} maxLength={30} className="mt-1.5" />
              </div>
              <div>
                <Label>Tags (separadas por vírgula)</Label>
                <Input
                  value={generated.tags.join(", ")}
                  onChange={(e) => updateField("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8))}
                  className="mt-1.5"
                />
              </div>
            </div>

            {generated.avatar_prompt && (
              <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/30 border border-border/40">
                <span className="font-semibold text-foreground/80">Sugestão pra avatar:</span> {generated.avatar_prompt}
                <br />
                <span className="opacity-70">(Você pode adicionar avatar depois editando o personagem.)</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/40">
              <Button onClick={() => handleSave(false)} disabled={saving} variant="outline" className="flex-1 gap-2">
                <Save className="h-4 w-4" /> Salvar privado
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving} className="flex-1 gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Publicar no catálogo
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
