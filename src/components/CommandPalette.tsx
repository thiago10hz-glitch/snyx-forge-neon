import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Search, Home, ShieldCheck, LogOut, Command, Crown,
  Plus, History, Palette, User as UserIcon, Code2, Sparkles,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof Home;
  color: string;
  action: () => void;
  keywords?: string[];
  category: string;
  shortcut?: string;
}

/**
 * Dispara um evento global que a página Index escuta para acionar
 * ações internas (nova conversa, abrir histórico, abrir tema, abrir perfil).
 * Mantém o palette desacoplado do estado da Index.
 */
function emit(name: string, detail?: any) {
  window.dispatchEvent(new CustomEvent(`snyx:${name}`, { detail }));
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, isAdmin, profile, user } = useAuth();
  const isDev = !!profile?.is_dev;
  const isHome = location.pathname === "/";

  // Build commands dynamically based on permissions and current route
  const commands: CommandItem[] = [
    // === Quick actions (only on home/chat) ===
    ...(isHome
      ? [
          {
            id: "new-chat",
            label: "Nova conversa",
            description: "Começa um chat do zero",
            icon: Plus,
            color: "text-emerald-400",
            action: () => emit("new-chat"),
            keywords: ["nova", "novo", "chat", "conversa", "comecar", "limpar"],
            category: "Ações",
            shortcut: "Ctrl+N",
          },
          {
            id: "history",
            label: "Abrir histórico",
            description: "Ver conversas anteriores",
            icon: History,
            color: "text-sky-400",
            action: () => emit("toggle-history"),
            keywords: ["historico", "conversas", "antigas", "lista"],
            category: "Ações",
          },
          {
            id: "theme",
            label: "Mudar tema",
            description: "Personalizar cores e visual",
            icon: Palette,
            color: "text-fuchsia-400",
            action: () => emit("open-theme"),
            keywords: ["tema", "cor", "visual", "aparencia", "dark", "claro"],
            category: "Ações",
          },
          {
            id: "profile",
            label: "Minha conta",
            description: "Ver e editar perfil",
            icon: UserIcon,
            color: "text-primary",
            action: () => emit("open-profile"),
            keywords: ["perfil", "conta", "minha", "usuario", "user"],
            category: "Ações",
          },
        ]
      : []),

    // === Navigation ===
    {
      id: "home",
      label: "Início",
      description: "Voltar para o chat",
      icon: Home,
      color: "text-primary",
      action: () => navigate("/"),
      keywords: ["home", "inicio", "principal", "chat"],
      category: "Navegação",
    },
    {
      id: "api",
      label: "API para devs",
      description: "Planos e documentação da API",
      icon: Code2,
      color: "text-cyan-400",
      action: () => navigate("/api"),
      keywords: ["api", "dev", "developer", "preco", "plano"],
      category: "Navegação",
    },
    ...(isAdmin
      ? [
          {
            id: "admin",
            label: "Painel Admin",
            description: "Gerenciar usuários e plataforma",
            icon: ShieldCheck,
            color: "text-red-400",
            action: () => navigate("/admin"),
            keywords: ["admin", "painel", "gerenciar", "users"],
            category: "Equipe",
          },
          {
            id: "owner",
            label: "Painel Dono",
            description: "Controles do proprietário",
            icon: Crown,
            color: "text-amber-400",
            action: () => navigate("/dono"),
            keywords: ["dono", "owner", "proprietario", "thiago"],
            category: "Equipe",
          },
          {
            id: "ai-pool",
            label: "Pool de IA",
            description: "Gerenciar chaves dos provedores",
            icon: Sparkles,
            color: "text-violet-400",
            action: () => navigate("/admin/ai-pool"),
            keywords: ["ia", "ai", "pool", "chaves", "keys", "provedores"],
            category: "Equipe",
          },
        ]
      : []),

    // === Account ===
    ...(user
      ? [
          {
            id: "logout",
            label: "Sair",
            description: "Encerrar sessão",
            icon: LogOut,
            color: "text-destructive",
            action: () => {
              signOut();
              setOpen(false);
            },
            keywords: ["sair", "logout", "desconectar", "exit"],
            category: "Conta",
          },
        ]
      : []),
  ];

  const filtered = query.trim()
    ? commands.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.includes(q))
        );
      })
    : commands;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const flatFiltered = Object.values(grouped).flat();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore shortcut when user is typing in an input/textarea (except Ctrl+K)
    const target = e.target as HTMLElement | null;
    const inField =
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable);

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      e.stopPropagation();
      setOpen((prev) => !prev);
      setQuery("");
      setSelectedIndex(0);
      return;
    }
    // Ctrl+N → emit new-chat (only when on home and not typing)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n" && !inField) {
      if (window.location.pathname === "/") {
        e.preventDefault();
        emit("new-chat");
      }
      return;
    }
    if (e.key === "Escape" && open) setOpen(false);
  }, [open]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    // Allow opening palette via custom event too (for buttons)
    const openHandler = () => {
      setOpen(true);
      setQuery("");
      setSelectedIndex(0);
    };
    window.addEventListener("snyx:open-palette", openHandler);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("snyx:open-palette", openHandler);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleInternalKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatFiltered[selectedIndex]) {
      flatFiltered[selectedIndex].action();
      setOpen(false);
    }
  };

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-border/30 bg-card/95 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/20">
          <Search className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInternalKey}
            placeholder="O que você quer fazer?"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/40 focus:outline-none"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-muted/30 border border-border/20 text-[10px] text-muted-foreground/50 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {Object.entries(grouped).length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground/40">Nenhum comando encontrado</p>
              <p className="text-[11px] text-muted-foreground/30 mt-1">Tente "nova conversa", "tema" ou "sair"</p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider px-3 py-2">
                  {category}
                </p>
                {items.map((item) => {
                  const idx = flatIndex++;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={() => {
                        item.action();
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                        selectedIndex === idx
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/20 border border-transparent"
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg bg-muted/30 ${item.color}`}>
                        <item.icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        {item.description && (
                          <p className="text-[11px] text-muted-foreground/50">{item.description}</p>
                        )}
                      </div>
                      {item.shortcut && selectedIndex !== idx && (
                        <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-muted/30 border border-border/20 text-[10px] text-muted-foreground/40 font-mono">
                          {item.shortcut}
                        </kbd>
                      )}
                      {selectedIndex === idx && (
                        <span className="text-[10px] text-muted-foreground/40">Enter ↵</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/20 bg-muted/5">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/40">
            <span className="flex items-center gap-1">↑↓ navegar</span>
            <span className="flex items-center gap-1">↵ selecionar</span>
            <span className="flex items-center gap-1">esc fechar</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/30">
            <Command className="w-3 h-3" />
            <span>SnyX</span>
          </div>
        </div>
      </div>
    </div>
  );
}
