import { useState } from "react";
import { Copy, Download, Check, Code2, Eye, Terminal } from "lucide-react";

interface CodeEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
}

export function CodeEditor({ code, onCodeChange }: CodeEditorProps) {
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    const ext = code.includes("<") ? "html" : code.includes("import") ? "tsx" : "txt";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snyx-output.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPreviewHtml = () => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body{background:#050505;color:#e5e5e5;font-family:system-ui,sans-serif;margin:0;padding:1rem;}</style>
</head>
<body>${code}</body>
</html>`;
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
              <p className="text-xs text-muted-foreground/20 max-w-xs">Use o modo Programador no chat para gerar código que aparecerá aqui</p>
            </div>
          )
        ) : (
          <iframe
            srcDoc={getPreviewHtml()}
            className="w-full h-full border-0"
            sandbox="allow-scripts"
            title="Preview"
          />
        )}
      </div>
    </div>
  );
}
