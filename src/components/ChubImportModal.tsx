import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Search, Download, Loader2, Sparkles, Heart, MessageCircle, Flame, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type ChubCharacter = {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  tags: string[];
  chat_count: number;
  likes: number;
  nsfw: boolean;
};

interface ChubImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

export const ChubImportModal = ({ open, onClose, onImported }: ChubImportModalProps) => {
  const [search, setSearch] = useState("");
  const [nsfw, setNsfw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ChubCharacter[]>([]);
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-chub-character", {
        body: { action: "search", search, nsfw },
      });
      if (error) throw error;
      setResults(data?.results || []);
      if (!data?.results?.length) toast.info("Nenhum resultado encontrado");
    } catch (err: any) {
      toast.error("Erro na busca: " + (err.message || "tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (char: ChubCharacter) => {
    setImporting(char.id);
    try {
      const { data, error } = await supabase.functions.invoke("import-chub-character", {
        body: { action: "import", fullPath: char.id },
      });
      if (error) throw error;
      setImported((p) => new Set(p).add(char.id));
      toast.success(`${char.name} importado!`);
      onImported?.();
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err.message || ""));
    } finally {
      setImporting(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden bg-gradient-to-b from-[#150028] to-[#0a0014] border border-amber-500/20 shadow-[0_0_60px_rgba(245,158,11,0.2)]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-4 border-b border-amber-500/15 bg-[#0a0014]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)]">
              <Sparkles className="w-5 h-5 text-purple-950" />
            </div>
            <div>
              <h2 className="text-lg font-black bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">Importar do Chub.ai</h2>
              <p className="text-[10px] text-amber-500/50 tracking-widest uppercase font-mono">Milhares de personagens prontos</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-amber-500/10 text-amber-300/60 hover:text-amber-200 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="px-6 py-4 border-b border-amber-500/10 bg-purple-950/20 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar personagem (ex: warrior, anime, romance)..."
              className="w-full pl-10 pr-4 h-11 rounded-xl bg-purple-950/40 border border-amber-500/20 focus:border-amber-400/50 outline-none text-amber-100 placeholder:text-amber-500/30 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 px-3 rounded-xl bg-purple-950/40 border border-amber-500/15 cursor-pointer select-none">
            <input type="checkbox" checked={nsfw} onChange={(e) => setNsfw(e.target.checked)} className="accent-rose-500" />
            <Flame className="w-4 h-4 text-rose-400" />
            <span className="text-xs text-amber-200/70 font-medium">+18</span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="px-6 h-11 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-purple-950 font-black text-sm hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </form>

        {/* Results */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(90vh - 180px)" }}>
          {results.length === 0 && !loading && (
            <div className="text-center py-16 text-amber-500/40">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Digite algo e busque na maior biblioteca de personagens RPG</p>
              <p className="text-[10px] mt-2 tracking-widest uppercase">Imagens originais — sem geração</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {results.map((char) => {
              const isImported = imported.has(char.id);
              const isImporting = importing === char.id;
              return (
                <div
                  key={char.id}
                  className="group relative rounded-2xl overflow-hidden border border-amber-500/15 bg-purple-950/20 hover:border-amber-400/40 transition-all hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(245,158,11,0.2)]"
                >
                  <div className="aspect-[3/4] relative overflow-hidden">
                    <img
                      src={char.avatar_url}
                      alt={char.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0014] via-[#0a0014]/30 to-transparent" />
                    {char.nsfw && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-rose-500/90 text-white text-[10px] font-black backdrop-blur">+18</div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
                      <h3 className="text-sm font-black text-white truncate">{char.name}</h3>
                      <div className="flex items-center gap-3 text-[10px] text-white/60">
                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{char.chat_count}</span>
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{char.likes}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-[10px] text-amber-200/60 line-clamp-2 leading-snug min-h-[28px]">{char.description}</p>
                    <button
                      onClick={() => handleImport(char)}
                      disabled={isImporting || isImported}
                      className={`w-full h-9 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                        isImported
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                          : "bg-gradient-to-r from-amber-400 to-amber-600 text-purple-950 hover:shadow-[0_0_15px_rgba(245,158,11,0.5)] active:scale-95"
                      } disabled:opacity-60`}
                    >
                      {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isImported ? "✓ Importado" : (<><Download className="w-3.5 h-3.5" /> Importar</>)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {results.length > 0 && (
            <div className="mt-6 pt-4 border-t border-amber-500/10 text-center">
              <a href="https://chub.ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-amber-500/40 hover:text-amber-300 tracking-widest uppercase">
                Powered by Chub.ai <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
