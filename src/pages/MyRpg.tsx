import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Plus,
  MessageCircle,
  Sparkles,
  Loader2,
  Trash2,
  Pencil,
  Heart,
  User as UserIcon,
  Search,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Tab = "personagens" | "conversas" | "favoritos";

interface MyChar {
  id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  category: string;
  chat_count: number;
  likes_count: number;
  is_nsfw: boolean;
  is_public: boolean;
  created_at: string;
}

interface MyConv {
  id: string;
  title: string;
  updated_at: string;
  character_id: string | null;
  character?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

interface MyFav {
  id: string;
  created_at: string;
  character: {
    id: string;
    name: string;
    description: string;
    avatar_url: string | null;
    is_nsfw: boolean;
    chat_count: number;
  } | null;
}

export default function MyRpg() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("personagens");
  const [search, setSearch] = useState("");

  const [chars, setChars] = useState<MyChar[]>([]);
  const [convs, setConvs] = useState<MyConv[]>([]);
  const [favs, setFavs] = useState<MyFav[]>([]);
  const [loading, setLoading] = useState(true);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<MyConv | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteKind, setDeleteKind] = useState<"conv" | "char" | "fav">("conv");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLabel, setDeleteLabel] = useState("");

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const [c, k, f] = await Promise.all([
      supabase
        .from("ai_characters")
        .select("id, name, description, avatar_url, category, chat_count, likes_count, is_nsfw, is_public, created_at")
        .eq("creator_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("chat_conversations")
        .select("id, title, updated_at, character_id, character:ai_characters(id, name, avatar_url)")
        .eq("user_id", user.id)
        .eq("mode", "rpg")
        .order("updated_at", { ascending: false }),
      supabase
        .from("character_favorites")
        .select("id, created_at, character:ai_characters(id, name, description, avatar_url, is_nsfw, chat_count)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (c.error) toast.error("Falha ao carregar personagens");
    if (k.error) toast.error("Falha ao carregar conversas");
    if (f.error) toast.error("Falha ao carregar favoritos");

    setChars((c.data || []) as MyChar[]);
    setConvs((k.data || []) as any);
    setFavs((f.data || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const ageVerified = !!(profile as any)?.age_verified;

  const openRename = (c: MyConv) => {
    setRenameTarget(c);
    setRenameValue(c.title || "");
    setRenameOpen(true);
  };

  const confirmRename = async () => {
    if (!renameTarget) return;
    const title = renameValue.trim().slice(0, 80) || "Sem título";
    const { error } = await supabase
      .from("chat_conversations")
      .update({ title })
      .eq("id", renameTarget.id);
    if (error) {
      toast.error("Não consegui renomear");
      return;
    }
    setConvs((p) => p.map((x) => (x.id === renameTarget.id ? { ...x, title } : x)));
    setRenameOpen(false);
    toast.success("Renomeado");
  };

  const askDelete = (kind: "conv" | "char" | "fav", id: string, label: string) => {
    setDeleteKind(kind);
    setDeleteId(id);
    setDeleteLabel(label);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    if (deleteKind === "conv") {
      // Apaga mensagens primeiro (por segurança, embora RLS permita pelo conv_id)
      await supabase.from("chat_messages").delete().eq("conversation_id", deleteId);
      const { error } = await supabase.from("chat_conversations").delete().eq("id", deleteId);
      if (error) return toast.error("Não consegui apagar a conversa");
      setConvs((p) => p.filter((x) => x.id !== deleteId));
      toast.success("Conversa apagada");
    } else if (deleteKind === "char") {
      const { error } = await supabase.from("ai_characters").delete().eq("id", deleteId);
      if (error) return toast.error("Não consegui apagar o personagem");
      setChars((p) => p.filter((x) => x.id !== deleteId));
      toast.success("Personagem apagado");
    } else if (deleteKind === "fav") {
      const { error } = await supabase.from("character_favorites").delete().eq("id", deleteId);
      if (error) return toast.error("Não consegui remover");
      setFavs((p) => p.filter((x) => x.id !== deleteId));
      toast.success("Removido dos favoritos");
    }
    setDeleteOpen(false);
    setDeleteId(null);
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const filteredChars = useMemo(() => {
    if (!search.trim()) return chars;
    const q = search.toLowerCase();
    return chars.filter((c) => c.name.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q));
  }, [chars, search]);

  const filteredConvs = useMemo(() => {
    if (!search.trim()) return convs;
    const q = search.toLowerCase();
    return convs.filter(
      (c) => (c.title || "").toLowerCase().includes(q) || (c.character?.name || "").toLowerCase().includes(q),
    );
  }, [convs, search]);

  const filteredFavs = useMemo(() => {
    if (!search.trim()) return favs;
    const q = search.toLowerCase();
    return favs.filter((f) => (f.character?.name || "").toLowerCase().includes(q));
  }, [favs, search]);

  const goToChar = (charId: string, isNsfw: boolean) => {
    if (isNsfw && !ageVerified) {
      toast.warning("Verifique sua idade no perfil para acessar conteúdo +18");
      return;
    }
    navigate(`/rpg/c/${charId}`);
  };

  const TABS: { id: Tab; label: string; icon: any; count: number }[] = [
    { id: "personagens", label: "Meus personagens", icon: UserIcon, count: chars.length },
    { id: "conversas", label: "Minhas conversas", icon: MessageCircle, count: convs.length },
    { id: "favoritos", label: "Favoritos", icon: Heart, count: favs.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative border-b border-border/40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-fuchsia-500/10" />
        <div className="relative max-w-6xl mx-auto px-6 py-8">
          <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 gap-1">
            <Link to="/rpg">
              <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
            </Link>
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">Minha Conta RPG</h1>
                <p className="text-sm text-muted-foreground">
                  Tudo do seu RPG em um lugar só — personagens, conversas e favoritos.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="gap-2">
                <Link to="/">
                  <LogOut className="h-4 w-4" /> Sair do RPG
                </Link>
              </Button>
              <Button asChild className="gap-2">
                <Link to="/rpg/criar">
                  <Plus className="h-4 w-4" /> Criar personagem
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-20 bg-background/85 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_0_18px_-4px_hsl(var(--primary))]"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                <span
                  className={`text-[10px] font-bold px-1.5 rounded-full ${
                    active ? "bg-primary-foreground/20" : "bg-foreground/10"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "personagens"
                ? "Buscar nos meus personagens..."
                : tab === "conversas"
                  ? "Buscar nas minhas conversas..."
                  : "Buscar nos favoritos..."
            }
            className="pl-9 bg-card/60 backdrop-blur border-border/50"
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6 pb-24">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : tab === "personagens" ? (
          filteredChars.length === 0 ? (
            <EmptyState
              icon={UserIcon}
              title="Nenhum personagem ainda"
              hint="Crie seu primeiro personagem RPG personalizado."
              cta={{ label: "Criar personagem", href: "/rpg/criar" }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredChars.map((c) => (
                <div
                  key={c.id}
                  className="group rounded-2xl border border-border/40 bg-card/40 backdrop-blur overflow-hidden hover:border-primary/50 transition-all"
                >
                  <button
                    onClick={() => goToChar(c.id, c.is_nsfw)}
                    className="block w-full text-left"
                  >
                    <div className="aspect-[16/10] relative bg-muted/30">
                      {c.avatar_url ? (
                        <img
                          src={c.avatar_url}
                          alt={c.name}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles className="h-10 w-10 text-foreground/30" />
                        </div>
                      )}
                      {c.is_nsfw && (
                        <span className="absolute top-2 right-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-destructive/85 text-destructive-foreground">
                          +18
                        </span>
                      )}
                      {!c.is_public && (
                        <span className="absolute top-2 left-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-background/80 backdrop-blur">
                          privado
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-sm mb-1 truncate">{c.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                        {c.description || "Sem descrição"}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> {c.chat_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" /> {c.likes_count}
                        </span>
                        <span className="ml-auto">{fmt(c.created_at)}</span>
                      </div>
                    </div>
                  </button>
                  <div className="flex border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 rounded-none gap-1 text-xs"
                      onClick={() => goToChar(c.id, c.is_nsfw)}
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Conversar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 rounded-none gap-1 text-xs text-destructive hover:text-destructive"
                      onClick={() => askDelete("char", c.id, c.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Apagar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === "conversas" ? (
          filteredConvs.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Nenhuma conversa ainda"
              hint="Abra um personagem no catálogo e a conversa aparece aqui automaticamente."
              cta={{ label: "Ver catálogo", href: "/rpg" }}
            />
          ) : (
            <ul className="space-y-2">
              {filteredConvs.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card/40 backdrop-blur hover:border-primary/50 transition-all"
                >
                  <button
                    onClick={() => c.character_id && navigate(`/rpg/c/${c.character_id}`)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted/40 shrink-0 border border-border/40">
                      {c.character?.avatar_url ? (
                        <img
                          src={c.character.avatar_url}
                          alt={c.character.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Sparkles className="h-5 w-5 text-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{c.title || "Sem título"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        com{" "}
                        <span className="text-foreground/80">
                          {c.character?.name || "Personagem removido"}
                        </span>{" "}
                        · {fmt(c.updated_at)}
                      </div>
                    </div>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openRename(c)}
                    title="Renomear"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => askDelete("conv", c.id, c.title || "esta conversa")}
                    title="Apagar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : filteredFavs.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Sem favoritos ainda"
            hint="Curta personagens no catálogo para vê-los aqui."
            cta={{ label: "Explorar catálogo", href: "/rpg" }}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredFavs.map((f) =>
              f.character ? (
                <div
                  key={f.id}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-border/40 bg-muted/30 hover:border-primary/50 transition-all"
                >
                  <button
                    onClick={() => goToChar(f.character!.id, f.character!.is_nsfw)}
                    className="absolute inset-0"
                  >
                    {f.character.avatar_url ? (
                      <img
                        src={f.character.avatar_url}
                        alt={f.character.name}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="h-10 w-10 text-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                    {f.character.is_nsfw && (
                      <span className="absolute top-2 right-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-destructive/85 text-destructive-foreground">
                        +18
                      </span>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                      <h3 className="font-bold text-sm leading-tight truncate">
                        {f.character.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {f.character.description}
                      </p>
                    </div>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 left-2 h-7 w-7 bg-background/70 backdrop-blur text-destructive hover:text-destructive"
                    onClick={() => askDelete("fav", f.id, f.character!.name)}
                    title="Remover dos favoritos"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear conversa</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={80}
            placeholder="Novo título"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteKind === "char"
                ? "Apagar personagem?"
                : deleteKind === "conv"
                  ? "Apagar conversa?"
                  : "Remover dos favoritos?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteKind === "char" ? (
                <>
                  Você vai apagar <span className="font-semibold text-foreground">{deleteLabel}</span>.
                  Essa ação é permanente e também remove o personagem do catálogo.
                </>
              ) : deleteKind === "conv" ? (
                <>
                  Apaga{" "}
                  <span className="font-semibold text-foreground">{deleteLabel}</span> e todo o
                  histórico de mensagens dela. Não dá pra desfazer.
                </>
              ) : (
                <>
                  Remove <span className="font-semibold text-foreground">{deleteLabel}</span> dos
                  seus favoritos. O personagem continua no catálogo.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteKind === "fav" ? "Remover" : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  cta,
}: {
  icon: any;
  title: string;
  hint: string;
  cta: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <div className="h-14 w-14 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-sm">{hint}</p>
      <Button asChild>
        <Link to={cta.href}>{cta.label}</Link>
      </Button>
    </div>
  );
}
