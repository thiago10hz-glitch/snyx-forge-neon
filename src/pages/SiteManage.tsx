import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Globe, Edit, ExternalLink, Loader2, Check, X, ArrowLeft, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SiteData {
  id: string;
  site_name: string;
  vercel_url: string | null;
  html_content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const SiteManage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Editing
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSite = async () => {
      if (!id) { setNotFound(true); setLoading(false); return; }
      
      const { data, error } = await supabase
        .from("hosted_sites")
        .select("id, site_name, vercel_url, html_content, created_at, updated_at, user_id")
        .eq("id", id)
        .eq("status", "active")
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setSite(data as SiteData);
        setNewName(data.site_name);
        setIsOwner(user?.id === data.user_id);
      }
      setLoading(false);
    };
    loadSite();
  }, [id, user]);

  const handleSaveName = async () => {
    if (!site || !newName.trim() || newName.trim() === site.site_name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("hosted_sites")
      .update({ site_name: newName.trim(), updated_at: new Date().toISOString() })
      .eq("id", site.id);

    if (error) {
      toast.error("Erro ao atualizar nome");
    } else {
      setSite({ ...site, site_name: newName.trim() });
      toast.success("Nome atualizado!");
    }
    setEditing(false);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !site) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/10 flex items-center justify-center">
            <Globe size={28} className="text-muted-foreground/20" />
          </div>
          <p className="text-muted-foreground">Site não encontrado</p>
          <Link to="/" className="text-primary text-sm hover:underline">Voltar ao início</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 md:px-8 border-b border-border/10">
        <div className="flex items-center gap-3">
          <Link to={isOwner ? "/hosting" : "/"} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm hidden sm:inline">Voltar</span>
          </Link>
          <div className="w-px h-6 bg-border/20" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/10 flex items-center justify-center border border-primary/15">
            <Globe size={14} className="text-primary" />
          </div>

          {/* Site Name (editable) */}
          {editing && isOwner ? (
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-sm w-48"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") { setEditing(false); setNewName(site.site_name); }
                }}
              />
              <button onClick={handleSaveName} disabled={saving} className="p-1.5 rounded-lg hover:bg-emerald-500/15 text-emerald-400 transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button onClick={() => { setEditing(false); setNewName(site.site_name); }} className="p-1.5 rounded-lg hover:bg-muted/20 text-muted-foreground transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold">{site.site_name}</h1>
              {isOwner && (
                <button onClick={() => setEditing(true)} className="p-1 rounded-md hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors">
                  <Edit size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {site.vercel_url && (
          <a
            href={site.vercel_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors"
          >
            <ExternalLink size={12} />
            <span className="hidden sm:inline">{site.vercel_url.replace("https://", "")}</span>
            <span className="sm:hidden">Abrir site</span>
          </a>
        )}
      </header>

      {/* Site Preview */}
      <div className="flex-1 relative">
        <iframe
          srcDoc={site.html_content}
          className="w-full h-full absolute inset-0"
          title={site.site_name}
          sandbox="allow-scripts"
        />
      </div>

      {/* Footer with info */}
      {isOwner && (
        <div className="border-t border-border/10 px-4 md:px-8 py-3 flex items-center justify-between bg-background/80 backdrop-blur-sm">
          <div className="text-[10px] text-muted-foreground/50">
            Criado em {new Date(site.created_at).toLocaleDateString("pt-BR")}
            {site.updated_at !== site.created_at && ` • Editado em ${new Date(site.updated_at).toLocaleDateString("pt-BR")}`}
          </div>
          <button
            onClick={() => toast.info("Para remover seu projeto, entre em contato com o suporte. A remoção é um serviço pago.", { duration: 6000 })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Lock size={10} />
            Remover projeto
          </button>
        </div>
      )}
    </div>
  );
};

export default SiteManage;
