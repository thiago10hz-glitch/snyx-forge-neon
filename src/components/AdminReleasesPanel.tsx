import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Upload, Trash2, Loader2, Package, HardDrive } from "lucide-react";
import { toast } from "sonner";

interface AppRelease {
  id: string;
  version: string;
  platform: string;
  file_url: string;
  file_size: number | null;
  changelog: string | null;
  uploaded_by: string;
  created_at: string;
}

export function AdminReleasesPanel() {
  const { user } = useAuth();
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [version, setVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchReleases();
  }, []);

  const fetchReleases = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_releases")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar releases");
    else setReleases((data as AppRelease[]) || []);
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!file || !version.trim() || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "exe";
      const filePath = `releases/snyx-${version}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("app-downloads")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("app_releases")
        .insert({
          version: version.trim(),
          platform: "windows",
          file_url: filePath,
          file_size: file.size,
          changelog: changelog.trim() || null,
          uploaded_by: user.id,
        });

      if (insertError) throw insertError;

      toast.success(`Versão ${version} publicada!`);
      setVersion("");
      setChangelog("");
      setFile(null);
      fetchReleases();
    } catch (err: any) {
      toast.error(err.message || "Erro no upload");
    }
    setUploading(false);
  };

  const handleDelete = async (release: AppRelease) => {
    if (!confirm(`Deletar versão ${release.version}?`)) return;
    
    await supabase.storage.from("app-downloads").remove([release.file_url]);
    const { error } = await supabase.from("app_releases").delete().eq("id", release.id);
    if (error) toast.error("Erro ao deletar");
    else {
      toast.success("Release deletada");
      setReleases((prev) => prev.filter((r) => r.id !== release.id));
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-3 sm:p-4 space-y-4">
      {/* Upload form */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-4 space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          Publicar Nova Versão
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Versão (ex: 1.0.0)"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
          />
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground truncate">
              {file ? file.name : "Escolher arquivo (.exe, .bat, .zip, etc.)"}
            </span>
            <input
              type="file"
              accept=".exe,.msi,.zip,.bat,.apk,.rar,.7z"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <textarea
          placeholder="Changelog (opcional)"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none"
        />

        <button
          onClick={handleUpload}
          disabled={uploading || !file || !version.trim()}
          className="w-full sm:w-auto px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Enviando..." : "Publicar"}
        </button>
      </div>

      {/* Releases list */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Releases ({releases.length})
        </h3>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : releases.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma release publicada</p>
        ) : (
          releases.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border/20 bg-muted/10 hover:bg-muted/20 transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">v{r.version}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium uppercase">{r.platform}</span>
                  <span className="text-[10px] text-muted-foreground">{formatSize(r.file_size)}</span>
                </div>
                {r.changelog && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.changelog}</p>}
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <button
                onClick={() => handleDelete(r)}
                className="p-2 text-muted-foreground hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
