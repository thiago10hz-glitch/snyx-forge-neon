import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Search, Home, ShieldCheck, Tv, Globe, Download, Package, LogOut,
  Crown, Code2, MessageCircle, Settings, Zap, Command
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
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const commands: CommandItem[] = [
    // Navigation
    { id: "home", label: "Início", description: "Página principal", icon: Home, color: "text-primary", action: () => navigate("/"), keywords: ["home", "inicio", "principal"], category: "Navegação" },
    { id: "admin", label: "Painel Admin", description: "Gerenciar plataforma", icon: ShieldCheck, color: "text-red-400", action: () => navigate("/admin"), keywords: ["admin", "painel", "gerenciar"], category: "Navegação" },
    { id: "iptv", label: "IPTV", description: "Assistir canais ao vivo", icon: Tv, color: "text-purple-400", action: () => navigate("/iptv"), keywords: ["iptv", "tv", "canais", "assistir"], category: "Navegação" },
    { id: "hosting", label: "Hosting", description: "Hospedar sites", icon: Globe, color: "text-orange-400", action: () => navigate("/hosting"), keywords: ["hosting", "site", "hospedar"], category: "Navegação" },
    { id: "downloads", label: "Downloads", description: "Baixar aplicativo", icon: Download, color: "text-emerald-400", action: () => navigate("/downloads"), keywords: ["download", "baixar", "app"], category: "Navegação" },
    { id: "packsteam", label: "Pack Steam", description: "Jogos Steam", icon: Package, color: "text-green-400", action: () => navigate("/pack-steam"), keywords: ["pack", "steam", "jogos"], category: "Navegação" },
    // Actions
    { id: "logout", label: "Sair", description: "Encerrar sessão", icon: LogOut, color: "text-destructive", action: () => { signOut(); setOpen(false); }, keywords: ["sair", "logout", "desconectar"], category: "Ações" },
  ];

  const filtered = query.trim()
    ? commands.filter(c => {
        const q = query.toLowerCase();
        return c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.keywords?.some(k => k.includes(q));
      })
    : commands;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const flatFiltered = Object.values(grouped).flat();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(prev => !prev);
      setQuery("");
      setSelectedIndex(0);
    }
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
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
      setSelectedIndex(i => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
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
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/20">
          <Search className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleInternalKey}
            placeholder="Buscar comando..."
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
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider px-3 py-2">
                  {category}
                </p>
                {items.map(item => {
                  const idx = flatIndex++;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={() => { item.action(); setOpen(false); }}
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
