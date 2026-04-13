import { useState, useEffect, useRef } from "react";
import { Copy, Download, Check, Code2, Eye, Terminal, Smartphone, Monitor, Tablet, RotateCcw, ExternalLink, Upload, Loader2, Rocket } from "lucide-react";
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
      <div className="flex items-center justify-between border-b border-border/15 px-4 py-2.5 glass">
        <div className="flex items-center gap-1.5 bg-muted/15 rounded-xl p-0.5 border border-border/10">
          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
              activeTab === "code"
                ? "bg-card text-foreground shadow-lg shadow-black/20 border border-border/20"
                : "text-muted-foreground/50 hover:text-foreground/80"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Código
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
              activeTab === "preview"
                ? "bg-card text-foreground shadow-lg shadow-black/20 border border-border/20"
                : "text-muted-foreground/50 hover:text-foreground/80"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {activeTab === "preview" && code && (
            <>
              {/* Viewport toggles */}
              <div className="flex items-center gap-0.5 bg-muted/10 rounded-lg p-0.5 border border-border/10 mr-1">
                <button
                  onClick={() => setViewport("desktop")}
                  className={`p-1.5 rounded-md transition-all ${viewport === "desktop" ? "bg-primary/20 text-primary" : "text-muted-foreground/40 hover:text-foreground/60"}`}
                  title="Desktop"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewport("tablet")}
                  className={`p-1.5 rounded-md transition-all ${viewport === "tablet" ? "bg-primary/20 text-primary" : "text-muted-foreground/40 hover:text-foreground/60"}`}
                  title="Tablet"
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewport("mobile")}
                  className={`p-1.5 rounded-md transition-all ${viewport === "mobile" ? "bg-primary/20 text-primary" : "text-muted-foreground/40 hover:text-foreground/60"}`}
                  title="Mobile"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={() => setPreviewKey(k => k + 1)}
                className="p-1.5 text-muted-foreground/40 hover:text-foreground/60 rounded-md hover:bg-muted/15 transition-all"
                title="Recarregar"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={openInNewTab}
                className="p-1.5 text-muted-foreground/40 hover:text-foreground/60 rounded-md hover:bg-muted/15 transition-all"
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={copyCode}
            disabled={!code}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground/60 hover:text-foreground bg-muted/10 hover:bg-muted/20 rounded-xl transition-all duration-200 border border-border/10 disabled:opacity-20"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copiado!" : "Copiar"}
          </button>
          <button
            onClick={downloadCode}
            disabled={!code}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary/8 text-primary/80 hover:bg-primary/15 hover:text-primary rounded-xl transition-all duration-200 border border-primary/10 disabled:opacity-20 disabled:border-border/10 disabled:text-muted-foreground/40"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "code" ? (
          code ? (
            <div className="flex h-full">
              {/* Line numbers */}
              <div className="py-4 px-3 text-right select-none border-r border-border/10 overflow-hidden">
                {lines.map((_, i) => (
                  <div key={i} className="text-[11px] leading-6 text-muted-foreground/20 font-mono tabular-nums">
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Editor area */}
              <textarea
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                spellCheck={false}
                className="flex-1 bg-transparent text-foreground/85 font-mono text-sm leading-6 p-4 resize-none focus:outline-none scrollbar-thin"
                placeholder="// O código gerado aparecerá aqui..."
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-slide-up-fade">
              <div className="w-16 h-16 rounded-2xl bg-muted/10 border border-border/10 flex items-center justify-center mb-5 animate-float">
                <Terminal className="w-7 h-7 text-muted-foreground/20" />
              </div>
              <p className="text-sm font-medium text-muted-foreground/30 mb-1">Nenhum código ainda</p>
              <p className="text-xs text-muted-foreground/20 max-w-xs">
                Converse no modo Programador — diga que tipo de site quer criar e a IA vai gerar pra você!
              </p>
            </div>
          )
        ) : (
          code ? (
            <div className="flex items-start justify-center h-full bg-[#1a1a2e] overflow-auto p-4">
              <div
                className="transition-all duration-300 h-full"
                style={{
                  width: viewportWidths[viewport],
                  maxWidth: "100%",
                  ...(viewport !== "desktop" ? { boxShadow: "0 0 40px rgba(0,0,0,0.5)", borderRadius: "12px", overflow: "hidden" } : {}),
                }}
              >
                <iframe
                  key={previewKey}
                  srcDoc={getPreviewHtml()}
                  className="w-full h-full border-0 bg-white"
                  style={viewport !== "desktop" ? { borderRadius: "12px" } : {}}
                  sandbox="allow-scripts allow-same-origin"
                  title="Preview"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <Eye className="w-12 h-12 text-muted-foreground/15 mb-4" />
              <p className="text-sm text-muted-foreground/30">Gere um site para ver o preview aqui</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
