import { useState, useEffect, useRef } from "react";
import { Copy, Download, Check, Code2, Eye, Terminal, Smartphone, Monitor, Tablet, RotateCcw, ExternalLink, Loader2, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CodeEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
}

type ViewportSize = "desktop" | "tablet" | "mobile";

export function CodeEditor({ code, onCodeChange }: CodeEditorProps) {
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [copied, setCopied] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [deploying, setDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const prevCodeRef = useRef("");

  // Auto-switch to preview when full HTML is generated
  useEffect(() => {
    if (code && code.includes("<!DOCTYPE html") && !prevCodeRef.current.includes("<!DOCTYPE html")) {
      setActiveTab("preview");
    }
    prevCodeRef.current = code;
  }, [code]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    const isHtml = code.includes("<!DOCTYPE html") || code.includes("<html");
    const ext = isHtml ? "html" : code.includes("import") ? "tsx" : "txt";
    const blob = new Blob([code], { type: isHtml ? "text/html" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snyx-site.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deployToVercel = async () => {
    if (!code || deploying) return;
    setDeploying(true);
    setDeployedUrl(null);
    try {
      const htmlContent = getPreviewHtml();
      const { data, error } = await supabase.functions.invoke("deploy-vercel", {
        body: { html: htmlContent, projectName: "snyx-site" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        setDeployedUrl(data.url);
        toast.success("Site publicado na Vercel!", {
          description: data.url,
          action: { label: "Abrir", onClick: () => window.open(data.url, "_blank") },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao publicar";
      toast.error("Falha no deploy", { description: msg });
    } finally {
      setDeploying(false);
    }
  };

  const openInNewTab = () => {
    const blob = new Blob([getPreviewHtml()], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const getPreviewHtml = () => {
    // If code is already a full HTML page, use it directly
    if (code.includes("<!DOCTYPE html") || code.includes("<html")) {
      return code;
    }
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>body{background:#050505;color:#e5e5e5;font-family:system-ui,sans-serif;margin:0;padding:1rem;}</style>
</head>
<body>${code}</body>
</html>`;
  };

  const viewportWidths: Record<ViewportSize, string> = {
    desktop: "100%",
    tablet: "768px",
    mobile: "375px",
  };

  const lines = code.split("\n");

  return (
    <div className="flex flex-col h-full bg-background/80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/10 px-3 py-1.5 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center gap-1 bg-muted/10 rounded-lg p-0.5 border border-border/8">
          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-300 ${
              activeTab === "code"
                ? "bg-card text-foreground shadow-md border border-border/15"
                : "text-muted-foreground/40 hover:text-foreground/70"
            }`}
          >
            <Code2 className="w-3 h-3" />
            Código
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-300 ${
              activeTab === "preview"
                ? "bg-card text-foreground shadow-md border border-border/15"
                : "text-muted-foreground/40 hover:text-foreground/70"
            }`}
          >
            <Eye className="w-3 h-3" />
            Preview
          </button>
        </div>

        <div className="flex items-center gap-1">
          {activeTab === "preview" && code && (
            <>
              <div className="flex items-center gap-0.5 bg-muted/8 rounded-md p-0.5 border border-border/5 mr-1">
                <button
                  onClick={() => setViewport("desktop")}
                  className={`p-1 rounded-sm transition-all ${viewport === "desktop" ? "bg-muted/20 text-foreground shadow-sm" : "text-muted-foreground/30 hover:text-foreground/60"}`}
                  title="Desktop"
                >
                  <Monitor className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setViewport("tablet")}
                  className={`p-1 rounded-sm transition-all ${viewport === "tablet" ? "bg-muted/20 text-foreground shadow-sm" : "text-muted-foreground/30 hover:text-foreground/60"}`}
                  title="Tablet"
                >
                  <Tablet className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setViewport("mobile")}
                  className={`p-1 rounded-sm transition-all ${viewport === "mobile" ? "bg-muted/20 text-foreground shadow-sm" : "text-muted-foreground/30 hover:text-foreground/60"}`}
                  title="Mobile"
                >
                  <Smartphone className="w-3 h-3" />
                </button>
              </div>
              <button onClick={() => setPreviewKey(k => k + 1)} className="p-1.5 text-muted-foreground/30 hover:text-foreground/60 rounded-md hover:bg-muted/10 transition-all" title="Recarregar">
                <RotateCcw className="w-3 h-3" />
              </button>
              <button onClick={openInNewTab} className="p-1.5 text-muted-foreground/30 hover:text-foreground/60 rounded-md hover:bg-muted/10 transition-all" title="Nova aba">
                <ExternalLink className="w-3 h-3" />
              </button>
            </>
          )}
          <button
            onClick={copyCode}
            disabled={!code}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] text-muted-foreground/50 hover:text-foreground bg-muted/8 hover:bg-muted/15 rounded-lg transition-all border border-border/5 disabled:opacity-15"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            onClick={downloadCode}
            disabled={!code}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] text-primary/60 hover:text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-all border border-primary/8 disabled:opacity-15 disabled:border-border/5 disabled:text-muted-foreground/30"
          >
            <Download className="w-3 h-3" />
            Baixar
          </button>
          <button
            onClick={deployToVercel}
            disabled={!code || deploying}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] bg-emerald-500/8 text-emerald-400/70 hover:bg-emerald-500/15 hover:text-emerald-400 rounded-lg transition-all border border-emerald-500/10 disabled:opacity-15 disabled:border-border/5 disabled:text-muted-foreground/30"
          >
            {deploying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
            {deploying ? "Publicando..." : "Publicar"}
          </button>
          {deployedUrl && (
            <a
              href={deployedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-[9px] text-emerald-400/60 hover:text-emerald-400 bg-emerald-500/5 rounded-md border border-emerald-500/8 truncate max-w-[120px]"
            >
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{deployedUrl.replace("https://", "")}</span>
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "code" ? (
          code ? (
            <div className="flex h-full">
              {/* Line numbers */}
              <div className="py-3 px-2.5 text-right select-none border-r border-border/8 overflow-hidden bg-muted/[0.02]">
                {lines.map((_, i) => (
                  <div key={i} className="text-[10px] leading-6 text-muted-foreground/15 font-mono tabular-nums">
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Editor area */}
              <textarea
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                spellCheck={false}
                className="flex-1 bg-transparent text-foreground/85 font-mono text-[12px] leading-6 p-3 resize-none focus:outline-none scrollbar-thin"
                placeholder="// O código gerado aparecerá aqui..."
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/[0.06] to-primary/[0.03] border border-cyan-500/[0.08] flex items-center justify-center shadow-2xl">
                  <Terminal className="w-8 h-8 text-cyan-400/25" />
                </div>
                <div className="absolute -inset-6 bg-cyan-500/[0.03] rounded-full blur-3xl -z-10" />
              </div>
              <p className="text-sm font-bold text-muted-foreground/40 mb-1.5">Nenhum código ainda</p>
              <p className="text-[11px] text-muted-foreground/20 max-w-[240px] leading-relaxed">
                Use o chat ao lado para descrever o que quer criar. A IA gera o código e o preview aparece aqui.
              </p>
            </div>
          )
        ) : (
          code ? (
            <div className="flex items-start justify-center h-full overflow-auto p-3 bg-[hsl(var(--muted))]/[0.02]">
              <div
                className="transition-all duration-500 h-full"
                style={{
                  width: viewportWidths[viewport],
                  maxWidth: "100%",
                  ...(viewport !== "desktop" ? { boxShadow: "0 0 40px rgba(0,0,0,0.5)", borderRadius: "12px", overflow: "hidden" } : {}),
                }}
              >
                {/* Browser chrome */}
                <div className="h-7 bg-[#141414] flex items-center gap-1.5 px-3 border-b border-white/[0.04] rounded-t-xl">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 mx-6">
                    <div className="h-4 rounded-md bg-white/[0.06] flex items-center justify-center">
                      <span className="text-[9px] text-white/25 font-mono">localhost:3000</span>
                    </div>
                  </div>
                </div>
                <iframe
                  key={previewKey}
                  srcDoc={getPreviewHtml()}
                  className="w-full border-0 bg-white"
                  style={{ height: "calc(100% - 28px)", ...(viewport !== "desktop" ? { borderRadius: "0 0 12px 12px" } : {}) }}
                  sandbox="allow-scripts allow-same-origin"
                  title="Preview"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/[0.06] to-primary/[0.03] border border-violet-500/[0.06] flex items-center justify-center">
                  <Eye className="w-8 h-8 text-violet-400/20" />
                </div>
              </div>
              <p className="text-sm font-bold text-muted-foreground/40 mb-1.5">Preview em tempo real</p>
              <p className="text-[11px] text-muted-foreground/20 max-w-[240px] leading-relaxed">
                Gere um site no chat e veja o resultado renderizado aqui instantaneamente.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
