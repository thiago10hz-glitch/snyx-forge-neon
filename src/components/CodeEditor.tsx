import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  Copy, Download, Check, Code2, Eye, Terminal, Smartphone, Monitor, Tablet, 
  RotateCcw, ExternalLink, Loader2, Rocket, Maximize2, Minimize2,
  FileCode, Layers, Palette as PaletteIcon, Layout, Type, Image,
  Braces, Hash, Play, SplitSquareVertical, Sun, Moon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CodeEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
}

type ViewportSize = "desktop" | "tablet" | "mobile";
type EditorView = "code" | "preview" | "split";

const COMPONENT_SNIPPETS = [
  { label: "Navbar", icon: Layout, snippet: `<nav class="flex items-center justify-between p-4 bg-gray-900 text-white">\n  <a href="#" class="text-xl font-bold">Logo</a>\n  <div class="flex gap-4">\n    <a href="#" class="hover:text-blue-400">Home</a>\n    <a href="#" class="hover:text-blue-400">Sobre</a>\n    <a href="#" class="hover:text-blue-400">Contato</a>\n  </div>\n</nav>` },
  { label: "Hero", icon: Type, snippet: `<section class="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 bg-gradient-to-br from-gray-900 to-gray-800">\n  <h1 class="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Título Principal</h1>\n  <p class="text-gray-400 text-lg max-w-2xl mb-8">Sua descrição aqui. Personalize como quiser.</p>\n  <button class="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-all">Começar</button>\n</section>` },
  { label: "Cards", icon: Layers, snippet: `<div class="grid grid-cols-1 md:grid-cols-3 gap-6 p-8">\n  <div class="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-all">\n    <div class="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4 text-blue-400">⚡</div>\n    <h3 class="font-bold mb-2">Recurso 1</h3>\n    <p class="text-gray-400 text-sm">Descrição do recurso.</p>\n  </div>\n  <div class="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all">\n    <div class="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4 text-purple-400">🎨</div>\n    <h3 class="font-bold mb-2">Recurso 2</h3>\n    <p class="text-gray-400 text-sm">Descrição do recurso.</p>\n  </div>\n  <div class="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-emerald-500 transition-all">\n    <div class="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-4 text-emerald-400">🚀</div>\n    <h3 class="font-bold mb-2">Recurso 3</h3>\n    <p class="text-gray-400 text-sm">Descrição do recurso.</p>\n  </div>\n</div>` },
  { label: "Footer", icon: Hash, snippet: `<footer class="bg-gray-900 border-t border-gray-800 py-8 px-4">\n  <div class="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">\n    <p class="text-gray-500 text-sm">© 2024 SnyX. Todos os direitos reservados.</p>\n    <div class="flex gap-6">\n      <a href="#" class="text-gray-400 hover:text-white text-sm">Privacidade</a>\n      <a href="#" class="text-gray-400 hover:text-white text-sm">Termos</a>\n      <a href="#" class="text-gray-400 hover:text-white text-sm">Contato</a>\n    </div>\n  </div>\n</footer>` },
  { label: "Formulário", icon: FileCode, snippet: `<form class="max-w-md mx-auto p-8 bg-gray-800 rounded-2xl border border-gray-700">\n  <h2 class="text-xl font-bold mb-6">Contato</h2>\n  <div class="space-y-4">\n    <input type="text" placeholder="Nome" class="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 outline-none text-white" />\n    <input type="email" placeholder="Email" class="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 outline-none text-white" />\n    <textarea placeholder="Mensagem" rows="4" class="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 outline-none text-white resize-none"></textarea>\n    <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-all">Enviar</button>\n  </div>\n</form>` },
  { label: "Galeria", icon: Image, snippet: `<div class="grid grid-cols-2 md:grid-cols-4 gap-2 p-4">\n  <div class="aspect-square bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl hover:scale-105 transition-transform cursor-pointer"></div>\n  <div class="aspect-square bg-gradient-to-br from-emerald-600 to-cyan-600 rounded-xl hover:scale-105 transition-transform cursor-pointer"></div>\n  <div class="aspect-square bg-gradient-to-br from-orange-600 to-red-600 rounded-xl hover:scale-105 transition-transform cursor-pointer"></div>\n  <div class="aspect-square bg-gradient-to-br from-pink-600 to-violet-600 rounded-xl hover:scale-105 transition-transform cursor-pointer"></div>\n</div>` },
];

export function CodeEditor({ code, onCodeChange }: CodeEditorProps) {
  const [activeView, setActiveView] = useState<EditorView>("code");
  const [copied, setCopied] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [deploying, setDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showComponents, setShowComponents] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");
  const prevCodeRef = useRef("");
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Auto-switch to preview when full HTML is generated
  useEffect(() => {
    if (code && code.includes("<!DOCTYPE html") && !prevCodeRef.current.includes("<!DOCTYPE html")) {
      setActiveView("preview");
    }
    prevCodeRef.current = code;
  }, [code]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Código copiado!");
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
        toast.success("Site publicado!", {
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
    if (code.includes("<!DOCTYPE html") || code.includes("<html")) {
      return code;
    }
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>body{background:${previewTheme === "dark" ? "#050505" : "#ffffff"};color:${previewTheme === "dark" ? "#e5e5e5" : "#1a1a1a"};font-family:system-ui,sans-serif;margin:0;padding:1rem;}</style>
</head>
<body>${code}</body>
</html>`;
  };

  const insertSnippet = (snippet: string) => {
    const newCode = code ? code + "\n\n" + snippet : snippet;
    onCodeChange(newCode);
    setShowComponents(false);
    toast.success("Componente adicionado!");
  };

  const formatCode = () => {
    try {
      // Simple HTML formatting
      let formatted = code;
      formatted = formatted.replace(/></g, ">\n<");
      formatted = formatted.replace(/\n\s*\n\s*\n/g, "\n\n");
      onCodeChange(formatted);
      toast.success("Código formatado!");
    } catch {
      toast.error("Erro ao formatar");
    }
  };

  const charCount = code.length;
  const lineCount = code.split("\n").length;
  const viewportWidths: Record<ViewportSize, string> = {
    desktop: "100%",
    tablet: "768px",
    mobile: "375px",
  };

  const lines = code.split("\n");

  const renderCodeEditor = () => (
    code ? (
      <div className="flex h-full">
      {/* Line numbers */}
        <div className="py-2 px-1.5 text-right select-none border-r border-border/8 overflow-hidden bg-muted/[0.02] shrink-0">
          {lines.map((_, i) => (
            <div key={i} className="text-[9px] leading-5 text-muted-foreground/15 font-mono tabular-nums">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={editorRef}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          spellCheck={false}
          className="flex-1 bg-transparent text-foreground/85 font-mono text-[11px] leading-5 p-2 resize-none focus:outline-none scrollbar-thin"
          placeholder="// O código gerado aparecerá aqui..."
        />
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="relative mb-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/[0.06] to-primary/[0.03] border border-cyan-500/[0.08] flex items-center justify-center">
            <Terminal className="w-6 h-6 text-cyan-400/25" />
          </div>
        </div>
        <p className="text-xs font-bold text-muted-foreground/40 mb-1">Nenhum código ainda</p>
        <p className="text-[10px] text-muted-foreground/20 max-w-[200px] leading-relaxed mb-3">
          Use o chat para descrever o que quer criar.
        </p>
        <button
          onClick={() => setShowComponents(true)}
          className="text-[10px] px-3 py-1.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 hover:bg-cyan-500/20 transition-all"
        >
          <Layers className="w-2.5 h-2.5 inline mr-1" />
          Componentes
        </button>
      </div>
    )
  );

  const renderPreview = () => (
    code ? (
      <div className="h-full overflow-auto bg-[hsl(var(--muted))]/[0.02]">
        <div
          className="mx-auto transition-all duration-500 h-full"
          style={{
            width: viewportWidths[viewport],
            maxWidth: "100%",
            ...(viewport !== "desktop" ? { padding: "12px" } : {}),
          }}
        >
          <div className={`h-full ${viewport !== "desktop" ? "rounded-xl overflow-hidden shadow-2xl shadow-black/40" : ""}`}>
            {/* Browser chrome */}
            <div className="h-6 bg-[#141414] flex items-center gap-1 px-2 border-b border-white/[0.04] rounded-t-lg">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
                <div className="w-2 h-2 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex-1 mx-4">
                <div className="h-3.5 rounded bg-white/[0.06] flex items-center justify-center">
                  <span className="text-[8px] text-white/25 font-mono">localhost:3000</span>
                </div>
              </div>
            </div>
            <iframe
              key={previewKey}
              srcDoc={getPreviewHtml()}
              className={`w-full border-0 ${previewTheme === "dark" ? "bg-[#050505]" : "bg-white"}`}
              style={{ height: "calc(100% - 24px)" }}
              sandbox="allow-scripts allow-same-origin"
              title="Preview"
            />
          </div>
        </div>
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="relative mb-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/[0.06] to-primary/[0.03] border border-violet-500/[0.06] flex items-center justify-center">
            <Eye className="w-6 h-6 text-violet-400/20" />
          </div>
        </div>
        <p className="text-xs font-bold text-muted-foreground/40 mb-1">Preview em tempo real</p>
        <p className="text-[10px] text-muted-foreground/20 max-w-[200px] leading-relaxed">
          Gere um site e veja o resultado aqui.
        </p>
      </div>
    )
  );

  return (
    <div className={`flex flex-col h-full bg-background/80 ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
      {/* Top Toolbar */}
      <div className="flex items-center justify-between border-b border-border/10 px-2.5 py-1 bg-background/60 backdrop-blur-sm shrink-0">
        {/* Left: View tabs */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 bg-muted/10 rounded-lg p-0.5 border border-border/5">
            <button
              onClick={() => setActiveView("code")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                activeView === "code"
                  ? "bg-card text-foreground shadow-sm border border-border/15"
                  : "text-muted-foreground/40 hover:text-foreground/70"
              }`}
            >
              <Code2 className="w-3 h-3" />
              Código
            </button>
            <button
              onClick={() => setActiveView("preview")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                activeView === "preview"
                  ? "bg-card text-foreground shadow-sm border border-border/15"
                  : "text-muted-foreground/40 hover:text-foreground/70"
              }`}
            >
              <Eye className="w-3 h-3" />
              Preview
            </button>
            <button
              onClick={() => setActiveView("split")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                activeView === "split"
                  ? "bg-card text-foreground shadow-sm border border-border/15"
                  : "text-muted-foreground/40 hover:text-foreground/70"
              }`}
            >
              <SplitSquareVertical className="w-3 h-3" />
              Split
            </button>
          </div>

          {/* Viewport controls (when preview is visible) */}
          {(activeView === "preview" || activeView === "split") && code && (
            <div className="flex items-center gap-0.5 bg-muted/8 rounded-md p-0.5 border border-border/5 ml-1">
              <button onClick={() => setViewport("desktop")} className={`p-1 rounded-sm transition-all ${viewport === "desktop" ? "bg-muted/20 text-foreground shadow-sm" : "text-muted-foreground/30 hover:text-foreground/60"}`} title="Desktop">
                <Monitor className="w-3 h-3" />
              </button>
              <button onClick={() => setViewport("tablet")} className={`p-1 rounded-sm transition-all ${viewport === "tablet" ? "bg-muted/20 text-foreground shadow-sm" : "text-muted-foreground/30 hover:text-foreground/60"}`} title="Tablet">
                <Tablet className="w-3 h-3" />
              </button>
              <button onClick={() => setViewport("mobile")} className={`p-1 rounded-sm transition-all ${viewport === "mobile" ? "bg-muted/20 text-foreground shadow-sm" : "text-muted-foreground/30 hover:text-foreground/60"}`} title="Mobile">
                <Smartphone className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Components Library */}
          <button
            onClick={() => setShowComponents(!showComponents)}
            className={`flex items-center gap-1 px-2 py-1.5 text-[10px] rounded-md transition-all border ${
              showComponents
                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/15"
                : "text-muted-foreground/40 hover:text-foreground border-border/5 hover:bg-muted/10"
            }`}
            title="Componentes"
          >
            <Layers className="w-3 h-3" />
            <span className="hidden lg:inline">Componentes</span>
          </button>

          {/* Format */}
          {code && (
            <button onClick={formatCode} className="p-1.5 text-muted-foreground/30 hover:text-foreground/60 rounded-md hover:bg-muted/10 transition-all" title="Formatar código">
              <Braces className="w-3 h-3" />
            </button>
          )}

          {/* Theme toggle */}
          <button
            onClick={() => setPreviewTheme(t => t === "dark" ? "light" : "dark")}
            className="p-1.5 text-muted-foreground/30 hover:text-foreground/60 rounded-md hover:bg-muted/10 transition-all"
            title={`Tema: ${previewTheme}`}
          >
            {previewTheme === "dark" ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
          </button>

          {/* Reload preview */}
          {code && (activeView === "preview" || activeView === "split") && (
            <button onClick={() => setPreviewKey(k => k + 1)} className="p-1.5 text-muted-foreground/30 hover:text-foreground/60 rounded-md hover:bg-muted/10 transition-all" title="Recarregar">
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          {/* Open in new tab */}
          {code && (
            <button onClick={openInNewTab} className="p-1.5 text-muted-foreground/30 hover:text-foreground/60 rounded-md hover:bg-muted/10 transition-all" title="Nova aba">
              <ExternalLink className="w-3 h-3" />
            </button>
          )}

          {/* Console */}
          <button
            onClick={() => setShowConsole(!showConsole)}
            className={`p-1.5 rounded-md transition-all ${
              showConsole ? "bg-muted/15 text-foreground" : "text-muted-foreground/30 hover:text-foreground/60 hover:bg-muted/10"
            }`}
            title="Console"
          >
            <Terminal className="w-3 h-3" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-muted-foreground/30 hover:text-foreground/60 rounded-md hover:bg-muted/10 transition-all"
            title={isFullscreen ? "Sair tela cheia" : "Tela cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>

          <div className="w-px h-4 bg-border/10 mx-0.5" />

          {/* Copy */}
          <button
            onClick={copyCode}
            disabled={!code}
            className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-muted-foreground/50 hover:text-foreground bg-muted/8 hover:bg-muted/15 rounded-md transition-all border border-border/5 disabled:opacity-15"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="hidden xl:inline">{copied ? "Copiado" : "Copiar"}</span>
          </button>

          {/* Download */}
          <button
            onClick={downloadCode}
            disabled={!code}
            className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-primary/60 hover:text-primary bg-primary/5 hover:bg-primary/10 rounded-md transition-all border border-primary/8 disabled:opacity-15 disabled:border-border/5 disabled:text-muted-foreground/30"
          >
            <Download className="w-3 h-3" />
            <span className="hidden xl:inline">Baixar</span>
          </button>

          {/* Publish */}
          <button
            onClick={deployToVercel}
            disabled={!code || deploying}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] bg-emerald-500/10 text-emerald-400/80 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-md transition-all border border-emerald-500/10 disabled:opacity-15 disabled:border-border/5 disabled:text-muted-foreground/30"
          >
            {deploying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
            <span className="hidden lg:inline">{deploying ? "Publicando..." : "Publicar"}</span>
          </button>

          {deployedUrl && (
            <a
              href={deployedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-[9px] text-emerald-400/60 hover:text-emerald-400 bg-emerald-500/5 rounded-md border border-emerald-500/8 truncate max-w-[100px]"
            >
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{deployedUrl.replace("https://", "")}</span>
            </a>
          )}
        </div>
      </div>

      {/* Component Library Panel */}
      {showComponents && (
        <div className="border-b border-border/10 bg-background/80 backdrop-blur-sm px-3 py-2 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-1">
            {COMPONENT_SNIPPETS.map((comp) => (
              <button
                key={comp.label}
                onClick={() => insertSnippet(comp.snippet)}
                className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium rounded-lg bg-muted/[0.04] border border-border/8 text-muted-foreground/60 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/15 transition-all whitespace-nowrap shrink-0"
              >
                <comp.icon className="w-3 h-3" />
                {comp.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex">
        {activeView === "code" && (
          <div className="flex-1 overflow-auto">
            {renderCodeEditor()}
          </div>
        )}
        {activeView === "preview" && (
          <div className="flex-1 overflow-hidden">
            {renderPreview()}
          </div>
        )}
        {activeView === "split" && (
          <>
            <div className="w-1/2 overflow-auto border-r border-border/10">
              {renderCodeEditor()}
            </div>
            <div className="w-1/2 overflow-hidden">
              {renderPreview()}
            </div>
          </>
        )}
      </div>

      {/* Console Panel */}
      {showConsole && (
        <div className="h-24 border-t border-border/10 bg-[hsl(var(--background))] shrink-0 flex flex-col">
          <div className="flex items-center justify-between px-3 py-1 border-b border-border/5">
            <div className="flex items-center gap-2">
              <Terminal className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[10px] font-medium text-muted-foreground/50">Console</span>
              {consoleLogs.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/15 text-muted-foreground/40">{consoleLogs.length}</span>
              )}
            </div>
            <button
              onClick={() => setConsoleLogs([])}
              className="text-[9px] text-muted-foreground/30 hover:text-muted-foreground transition-colors"
            >
              Limpar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-1 font-mono text-[10px]">
            {consoleLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground/20 text-[10px]">
                Nenhum log ainda
              </div>
            ) : (
              consoleLogs.map((log, i) => (
                <div key={i} className="text-muted-foreground/60 py-0.5 border-b border-border/5">
                  <span className="text-muted-foreground/20 mr-2">{`>`}</span>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="h-6 flex items-center justify-between px-3 border-t border-border/5 bg-background/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Play className="w-2.5 h-2.5 text-emerald-400/50" />
            <span className="text-[9px] text-muted-foreground/30">Pronto</span>
          </div>
          {code && (
            <>
              <span className="text-[9px] text-muted-foreground/20">{lineCount} linhas</span>
              <span className="text-[9px] text-muted-foreground/20">{charCount.toLocaleString()} chars</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-muted-foreground/20">HTML</span>
          <span className="text-[9px] text-muted-foreground/20">UTF-8</span>
          {previewTheme === "dark" ? (
            <span className="text-[9px] text-muted-foreground/20">🌙 Dark</span>
          ) : (
            <span className="text-[9px] text-muted-foreground/20">☀️ Light</span>
          )}
        </div>
      </div>
    </div>
  );
}
