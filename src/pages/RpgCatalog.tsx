import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, MessageCircle, Sparkles, Flame, Loader2, User as UserIcon } from "lucide-react";
import { AgeGateModal } from "@/components/AgeGateModal";
import { toast } from "sonner";

interface Character {
  id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  banner_url: string | null;
  category: string;
  tags: string[] | null;
  is_nsfw: boolean;
  chat_count: number;
  likes_count: number;
  language: string;
  creator_id: string;
}

const CATEGORIES = [
  { id: "all", label: "Explorar", icon: Sparkles },
  { id: "trending", label: "Bombando", icon: Flame },
  { id: "meus", label: "Meus", icon: UserIcon },
  { id: "romance", label: "Romance" },
  { id: "drama", label: "Drama" },
  { id: "fantasia", label: "Fantasia" },
  { id: "escola", label: "Escola" },
  { id: "fanfic", label: "Fanfic" },
  { id: "terror", label: "Terror" },
  { id: "aventura", label: "Aventura" },
  { id: "vida", label: "Vida" },
];

export default function RpgCatalog() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [chars, setChars] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [ageGateOpen, setAgeGateOpen] = useState(false);

  const ageVerified = !!(profile as any)?.age_verified;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("ai_characters")
        .select("id, name, description, avatar_url, banner_url, category, tags, is_nsfw, chat_count, likes_count, language, creator_id")
        .eq("is_public", true)
        .order("chat_count", { ascending: false })
        .limit(120);

      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        toast.error("Falha ao carregar catálogo");
        setChars([]);
      } else {
        setChars((data || []) as Character[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = chars;
    if (activeCat === "trending") {
      list = [...list].sort((a, b) => b.chat_count - a.chat_count).slice(0, 24);
    } else if (activeCat === "meus") {
      list = user ? list.filter((c) => c.creator_id === user.id) : [];
    } else if (activeCat !== "all") {
      list = list.filter((c) => c.category === activeCat);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [chars, activeCat, search, user]);

  const handleClickChar = (c: Character) => {
    if (c.is_nsfw && !ageVerified) {
      setAgeGateOpen(true);
      return;
    }
    navigate(`/rpg/c/${c.id}`);
  };

  const formatCount = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
    n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative border-b border-border/40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-fuchsia-500/10" />
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                SnyX RPG
              </h1>
              <p className="text-sm text-muted-foreground">
                Milhares de personagens. Histórias infinitas.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar personagem, tag, vibe..."
                className="pl-9 bg-card/60 backdrop-blur border-border/50"
              />
            </div>
            <Button asChild className="gap-2">
              <Link to="/rpg/criar">
                <Plus className="h-4 w-4" />
                Criar personagem
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs categoria */}
      <div className="sticky top-0 z-20 bg-background/85 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((c) => {
            const Icon = (c as any).icon;
            const active = activeCat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_0_18px_-4px_hsl(var(--primary))]"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">
              {chars.length === 0
                ? "Nenhum personagem ainda. Que tal criar o primeiro?"
                : "Nenhum personagem encontrado nesse filtro."}
            </p>
            <Button asChild>
              <Link to="/rpg/criar">
                <Plus className="h-4 w-4 mr-2" /> Criar personagem
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => handleClickChar(c)}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-border/40 bg-muted/30 hover:border-primary/50 hover:shadow-[0_0_24px_-6px_hsl(var(--primary)/0.5)] transition-all text-left"
              >
                {/* Imagem */}
                {c.avatar_url ? (
                  <img
                    src={c.avatar_url}
                    alt={c.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-fuchsia-500/15 to-amber-400/10 flex items-center justify-center">
                    <Sparkles className="h-10 w-10 text-foreground/30" />
                  </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

                {/* NSFW badge */}
                {c.is_nsfw && (
                  <span className="absolute top-2 right-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-destructive/85 text-destructive-foreground">
                    +18
                  </span>
                )}

                {/* Chat count */}
                <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/70 backdrop-blur text-[10px] font-semibold">
                  <MessageCircle className="h-2.5 w-2.5" />
                  {formatCount(c.chat_count)}
                </div>

                {/* Info bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="font-bold text-sm leading-tight mb-1 truncate">{c.name}</h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
                    {c.description || "Sem descrição"}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(c.tags || []).slice(0, 2).map((t) => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/70">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AgeGateModal
        open={ageGateOpen}
        onOpenChange={setAgeGateOpen}
        onVerified={() => {
          // refetch profile via reload of catalog (cheap)
          window.location.reload();
        }}
      />
    </div>
  );
}
