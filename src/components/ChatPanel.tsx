import { useState, useRef, useEffect, useCallback } from "react";
import { Send, User, Paperclip, Download, Heart, Code, Plus, Trash2, MessageCircle, Clock, Crown, Sparkles, Globe, Loader2, Bot, PanelLeftClose, PanelLeft, Mic, MicOff, Brain, Settings, ImagePlus, Camera, Palette, Archive, PenLine, Rocket, Copy, Check } from "lucide-react";
import { ChatSettings, getBubbleClass, getUserBubbleClass } from "./ChatSettings";

import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";
import { VipModal } from "./VipModal";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { toast } from "sonner";


interface ImageAttachment {
  kind: "image";
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

interface TextAttachment {
  kind: "text";
  name: string;
  mimeType: string;
  size: number;
  text: string;
}

type Attachment = ImageAttachment | TextAttachment;

interface Message {
  role: "user" | "assistant";
  content: string;
  attachment?: ImageAttachment;
}

interface Conversation {
  id: string;
  title: string;
  mode: string;
  created_at: string;
  updated_at?: string;
}

type MessageLimitState = {
  allowed: boolean;
  remaining?: number;
  reset_at?: string;
  is_vip?: boolean;
};

type ChatMode = "friend" | "programmer";
type PendingAction = "school" | "imagegen" | "rewrite" | null;

interface ChatPanelProps {
  onCodeGenerated: (code: string) => void;
  onModeChange?: (mode: ChatMode) => void;
  initialConversationId?: string | null;
  forceMode?: ChatMode;
  onUserInput?: (text: string) => void;
}

const TEXT_FILE_EXTENSIONS = [
  ".txt", ".md", ".json", ".csv", ".js", ".ts", ".tsx", ".jsx",
  ".html", ".css", ".sql", ".py", ".xml", ".yaml", ".yml", ".toml",
];

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

const isTextFile = (file: File) => {
  const fileName = file.name.toLowerCase();
  return file.type.startsWith("text/") || TEXT_FILE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler a imagem"));
    reader.readAsDataURL(file);
  });

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const MODE_CONFIG = {
  friend: {
    icon: Heart,
    label: "Amigo",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    activeTab: "bg-pink-500/10 text-pink-400",
    bubbleColor: "bg-muted/60",
    placeholder: "Fala comigo... 💬",
    emptyTitle: "SnyX Amigo",
    emptyText: "Seu amigo virtual. Conversa sobre tudo, dá conselhos, te ouve. Como um amigo de verdade!",
    emptyEmoji: "💬",
    premiumLabel: "Premium",
    premiumIcon: Crown,
  },
  programmer: {
    icon: Code,
    label: "Programador",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    activeTab: "bg-cyan-500/10 text-cyan-400",
    bubbleColor: "bg-muted/60",
    placeholder: "Crie um site, app ou código... 🚀",
    emptyTitle: "SnyX Programador",
    emptyText: "Crie sites, apps e código completo. Publique online!",
    emptyEmoji: "🚀",
    premiumLabel: null,
    premiumIcon: null,
  },
};

export function ChatPanel({ onCodeGenerated, onModeChange, initialConversationId, forceMode, onUserInput }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [vipModalPlan, setVipModalPlan] = useState<"vip" | "programmer">("vip");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [mode, setMode] = useState<ChatMode>(forceMode ?? "friend");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationSummary, setConversationSummary] = useState<string>("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [showChatSettings, setShowChatSettings] = useState(false);
  
  const [bubbleStyle, setBubbleStyle] = useState("default");
  const [chatThemeColor, setChatThemeColor] = useState("#8b5cf6");
  const [aiAvatarUrl, setAiAvatarUrl] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const skipNextLoadRef = useRef<string | null>(null);
  const { profile, user } = useAuth();
  const [messageLimit, setMessageLimit] = useState<MessageLimitState | null>(null);
  const hasPremiumAccess = !!(profile?.is_vip || profile?.is_dev);
  const usePremium = mode === "friend" && hasPremiumAccess;

  const config = MODE_CONFIG[mode];
  const ModeIcon = config.icon;

  // Read-only when user opens a conversation from a chat tier they no longer have access to
  const activeConv = conversations.find(c => c.id === activeConversationId);
  const convMode = activeConv?.mode;
  const isReadOnly = !!convMode && (
    ((convMode === "premium") && !profile?.is_vip && !profile?.is_dev) ||
    ((convMode === "code" || convMode === "programmer") && !profile?.is_dev)
  );
  const readOnlyTier: "vip" | "programmer" | null = isReadOnly
    ? (convMode === "premium" ? "vip" : "programmer")
    : null;

  const checkMessageLimit = useCallback(async (): Promise<MessageLimitState | null> => {
    if (!user || profile?.is_vip || profile?.is_dev) {
      setMessageLimit(null);
      return null;
    }

    const { data, error } = await supabase.rpc("can_send_message");
    if (error) {
      console.error("Erro ao verificar limite de mensagens:", error);
      return null;
    }

    const nextLimit = data as MessageLimitState;
    setMessageLimit(nextLimit);
    return nextLimit;
  }, [user, profile?.is_vip, profile?.is_dev]);

  useEffect(() => { void checkMessageLimit(); }, [checkMessageLimit]);

  // Load bubble style and AI avatar from customization
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("chat_customization")
        .select("bubble_style, theme_color, ai_avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setBubbleStyle((data as any).bubble_style || "default");
        setChatThemeColor(data.theme_color || "#8b5cf6");
        setAiAvatarUrl((data as any).ai_avatar_url || null);
      }
    })();
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, thinkingText]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    // Load conversations for current mode. For friend mode, also load premium conversations
    const modes = mode === "friend" ? ["friend", "premium"] : mode === "programmer" ? ["code", "programmer"] : [mode];
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, mode, created_at")
      .eq("user_id", user.id)
      .in("mode", modes)
      .order("updated_at", { ascending: false });
    if (data) setConversations(data as Conversation[]);
  }, [user, mode]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Apply initialConversationId from parent (e.g. picked from history sidebar)
  useEffect(() => {
    if (!initialConversationId) return;
    setActiveConversationId(initialConversationId);
  }, [initialConversationId]);

  // Apply forceMode from parent
  useEffect(() => {
    if (forceMode && forceMode !== mode) {
      setMode(forceMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceMode]);

  // Auto-resume last conversation per mode (persisted in localStorage)
  useEffect(() => {
    if (!user || conversations.length === 0) return;
    if (activeConversationId) return;
    const storageKey = `snyx:lastConv:${user.id}:${mode}`;
    const remembered = localStorage.getItem(storageKey);
    const exists = remembered && conversations.some((c) => c.id === remembered);
    const target = exists ? remembered! : conversations[0].id;
    setActiveConversationId(target);
  }, [user, mode, conversations, activeConversationId]);

  // Persist active conversation per mode
  useEffect(() => {
    if (!user || !activeConversationId) return;
    localStorage.setItem(`snyx:lastConv:${user.id}:${mode}`, activeConversationId);
  }, [user, mode, activeConversationId]);

  // Reset active conversation when switching mode (will auto-pick this mode's last)
  useEffect(() => {
    setActiveConversationId(null);
  }, [mode]);

  useEffect(() => {
    if (!activeConversationId) { setMessages([]); setConversationSummary(""); return; }
    // If this conversation was just created locally, skip the reload (would wipe in-flight messages)
    if (skipNextLoadRef.current === activeConversationId) {
      skipNextLoadRef.current = null;
      return;
    }
    (async () => {
      const [msgsRes, sumRes] = await Promise.all([
        supabase.from("chat_messages").select("role, content").eq("conversation_id", activeConversationId).order("created_at", { ascending: true }),
        supabase.from("conversation_summaries").select("summary").eq("conversation_id", activeConversationId).maybeSingle(),
      ]);
      if (msgsRes.data) setMessages(msgsRes.data as Message[]);
      setConversationSummary((sumRes.data as any)?.summary || "");
    })();
  }, [activeConversationId]);

  

  const createConversation = async (): Promise<string | null> => {
    if (!user) return null;
    // Map mode for DB compatibility
    let dbMode = mode;
    if (mode === "friend" && usePremium) dbMode = "premium" as any;
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ user_id: user.id, mode: dbMode, title: "Nova conversa" })
      .select("id")
      .single();
    if (error || !data) return null;
    await loadConversations();
    return data.id;
  };

  const deleteConversation = async (id: string) => {
    await supabase.from("chat_conversations").delete().eq("id", id);
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
      setAttachment(null);
    }
    loadConversations();
  };

  const saveMessage = async (conversationId: string, role: string, content: string) => {
    await supabase.from("chat_messages").insert({ conversation_id: conversationId, role, content });
  };

  const updateConversationTitle = async (conversationId: string, firstMessage: string) => {
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
    await supabase.from("chat_conversations").update({ title }).eq("id", conversationId);
    loadConversations();
  };

  const handleDownloadZip = async (content: string) => {
    try {
      const zip = new JSZip();
      const regex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;
      let fileIndex = 0;
      while ((match = regex.exec(content)) !== null) {
        const lang = match[1] || "txt";
        const code = match[2];
        const extMap: Record<string, string> = {
          javascript: "js", typescript: "ts", tsx: "tsx", jsx: "jsx",
          python: "py", html: "html", css: "css", json: "json",
          powershell: "ps1", bash: "sh", sql: "sql", txt: "txt",
        };
        const ext = extMap[lang] || lang;
        zip.file(`file_${fileIndex}.${ext}`, code);
        fileIndex++;
      }
      if (fileIndex === 0) zip.file("response.txt", content);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "snyx-output.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao gerar ZIP:", err);
    }
  };

  const [deployingMsg, setDeployingMsg] = useState<number | null>(null);
  const [deployedUrls, setDeployedUrls] = useState<Record<number, string>>({});
  const [showUpdatePicker, setShowUpdatePicker] = useState<number | null>(null);
  const [copiedMsg, setCopiedMsg] = useState<number | null>(null);

  const handleCopyMessage = useCallback((content: string, index: number) => {
    const clean = content.replace(/<audio:[^>]+>/g, "").trim();
    navigator.clipboard.writeText(clean).then(() => {
      setCopiedMsg(index);
      setTimeout(() => setCopiedMsg(null), 2000);
    });
  }, []);
  const [updatePickerSites, setUpdatePickerSites] = useState<Array<{ id: string; name: string; url: string }>>([]);
  const [loadingUpdatePicker, setLoadingUpdatePicker] = useState(false);

  const extractHtmlFromMessage = (content: string): string | null => {
    const htmlMatch = content.match(/```html\n([\s\S]*?)```/);
    if (htmlMatch) return htmlMatch[1];
    if (content.trim().startsWith("<!DOCTYPE") || content.trim().startsWith("<html")) return content;
    return null;
  };

  const handleDeploySite = async (_content: string, _msgIndex: number, _existingSiteName?: string) => {
    toast.info("Publicação de sites removida — recurso indisponível.");
  };

  const openUpdatePicker = async (msgIndex: number) => {
    setShowUpdatePicker(msgIndex);
    setLoadingUpdatePicker(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-vercel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ action: "list" }),
      });
      const data = await res.json();
      if (data.success) setUpdatePickerSites(data.projects || []);
    } catch { /* ignore */ } finally {
      setLoadingUpdatePicker(false);
    }
  };

  const [showDeleteSitesModal, setShowDeleteSitesModal] = useState(false);
  const [vercelSites, setVercelSites] = useState<Array<{ id: string; name: string; url: string; createdAt: number }>>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);
  
  const [addingDomain, setAddingDomain] = useState<string | null>(null);
  const [removingDomain, setRemovingDomain] = useState<string | null>(null);
  const [siteDomains, setSiteDomains] = useState<Record<string, Array<{ name: string; verified: boolean; verification: any[] }>>>({});

  const loadVercelSites = async () => {
    setLoadingSites(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-vercel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "list" }),
      });

      const data = await res.json();
      if (data.success) {
        setVercelSites(data.projects || []);
      } else {
        toast.error("Erro ao listar sites");
      }
    } catch {
      toast.error("Erro ao listar sites");
    } finally {
      setLoadingSites(false);
    }
  };

  const handleDeleteSite = async (projectId: string) => {
    setDeletingSiteId(projectId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-vercel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "delete", projectId }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Site excluído com sucesso!");
        setVercelSites(prev => prev.filter(s => s.id !== projectId));
      } else {
        toast.error(data.error || "Erro ao excluir site");
      }
    } catch {
      toast.error("Erro ao excluir site");
    } finally {
      setDeletingSiteId(null);
    }
  };

  const loadSiteDomains = async (projectId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-vercel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ action: "list-domains", projectId }),
      });
      const data = await res.json();
      if (data.success) {
        setSiteDomains(prev => ({ ...prev, [projectId]: data.domains || [] }));
      }
    } catch { /* ignore */ }
  };

  const handleAddDomain = async (projectId: string, domain: string) => {
    if (!domain.trim()) return;
    setAddingDomain(projectId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-vercel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ action: "add-domain", projectId, domain: domain.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Domínio ${domain} adicionado! ${data.verified ? '✅ Verificado' : '⏳ Configure o DNS para verificar.'}`);
        loadSiteDomains(projectId);
      } else {
        toast.error(data.error || "Erro ao adicionar domínio");
      }
    } catch {
      toast.error("Erro ao adicionar domínio");
    } finally {
      setAddingDomain(null);
    }
  };

  const handleRemoveDomain = async (projectId: string, domain: string) => {
    setRemovingDomain(domain);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-vercel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ action: "remove-domain", projectId, domain }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Domínio ${domain} removido!`);
        setSiteDomains(prev => ({ ...prev, [projectId]: (prev[projectId] || []).filter(d => d.name !== domain) }));
      } else {
        toast.error("Erro ao remover domínio");
      }
    } catch {
      toast.error("Erro ao remover domínio");
    } finally {
      setRemovingDomain(null);
    }
  };

  // Intercept "excluir sites" command in programmer mode
  useEffect(() => {
    const lastUserMsg = messages.filter(m => m.role === "user").pop();
    if (lastUserMsg && mode === "programmer" && /excluir\s*sites?/i.test(lastUserMsg.content)) {
      setShowDeleteSitesModal(true);
      loadVercelSites();
    }
  }, [messages, mode]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.type.startsWith("image/")) {
        if (!profile?.is_vip && !profile?.is_dev && pendingAction !== "school" && mode === "friend") {
          setVipModalPlan("vip");
          setShowVipModal(true);
          return;
        }
        if (file.size > MAX_IMAGE_SIZE_BYTES) { toast.error("A imagem deve ter no máximo 8MB."); return; }
        const dataUrl = await readFileAsDataUrl(file);
        setAttachment({ kind: "image", name: file.name, mimeType: file.type || "image/png", size: file.size, dataUrl });
        return;
      }
      // ZIP file support
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed") {
        if (file.size > 20 * 1024 * 1024) { toast.error("O ZIP deve ter no máximo 20MB."); return; }
        toast.info("Extraindo arquivos do ZIP...");
        const zip = await JSZip.loadAsync(file);
        const textExtensions = [...TEXT_FILE_EXTENSIONS, ".env", ".gitignore", ".dockerignore", ".sh", ".bash", ".bat", ".cfg", ".ini", ".conf", ".log", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".hpp", ".rb", ".php", ".swift", ".kt", ".dart", ".r", ".scala", ".lua", ".makefile", ".gradle"];
        const extractedFiles: string[] = [];
        let totalSize = 0;
        const maxExtractedSize = 500 * 1024; // 500KB max total extracted text

        const entries = Object.entries(zip.files)
          .filter(([path, entry]) => !entry.dir && !path.startsWith("__MACOSX") && !path.includes(".DS_Store"))
          .sort(([a], [b]) => a.localeCompare(b));

        for (const [path, entry] of entries) {
          if (totalSize > maxExtractedSize) {
            extractedFiles.push(`\n... (mais ${entries.length - extractedFiles.length} arquivos truncados por limite de tamanho)`);
            break;
          }
          const lowerPath = path.toLowerCase();
          const isText = textExtensions.some(ext => lowerPath.endsWith(ext)) || 
                        lowerPath === "readme" || lowerPath === "license" || lowerPath === "makefile" ||
                        lowerPath.endsWith("file"); // Dockerfile, Gemfile etc
          if (isText) {
            try {
              const content = await entry.async("string");
              const truncated = content.length > 10000 ? content.slice(0, 10000) + "\n... (truncado)" : content;
              extractedFiles.push(`━━━ ${path} ━━━\n${truncated}`);
              totalSize += truncated.length;
            } catch { /* skip binary files that fail */ }
          }
        }

        if (extractedFiles.length === 0) {
          toast.error("Nenhum arquivo de código encontrado no ZIP.");
          return;
        }

        const fullText = `📦 ZIP: ${file.name} (${entries.length} arquivos)\n\n${extractedFiles.join("\n\n")}`;
        setAttachment({ kind: "text", name: file.name, mimeType: "application/zip", size: file.size, text: fullText });
        toast.success(`${extractedFiles.length} arquivos extraídos do ZIP`);
        return;
      }
      if (isTextFile(file)) {
        const text = await file.text();
        setAttachment({ kind: "text", name: file.name, mimeType: file.type || "text/plain", size: file.size, text });
        return;
      }
      toast.error("Envie imagens, arquivos de texto ou ZIP.");
    } catch (err) {
      console.error("Erro ao ler arquivo:", err);
      toast.error("Não foi possível ler o arquivo.");
    } finally {
      e.target.value = "";
    }
  };

  // Microphone recording using Web Speech API
  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta gravação de áudio. Use Chrome ou Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInput(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        toast.error("Permita o acesso ao microfone nas configurações do navegador.");
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && !attachment) return;

    const shouldTrackFreeMessage = mode === "friend" && !profile?.is_vip && !profile?.is_dev;

    // +18 content detection - only VIP can access
    if (mode === "friend" && !profile?.is_vip) {
      const contentLower = trimmedInput.toLowerCase();
      const adultKeywords = [
        "+18", "18+", "nsfw", "sexo", "porn", "nudes", "hentai", "safada", "safado",
        "putaria", "gostosa", "gostoso", "tesão", "transar", "foder", "buceta", "pau",
        "punheta", "masturbação", "oral", "anal", "fetiche", "dominação", "submissão",
        "sem censura", "erótico", "erotico", "erótica", "erotica", "conteúdo adulto", "conteudo adulto"
      ];
      if (adultKeywords.some(kw => contentLower.includes(kw))) {
        setVipModalPlan("vip");
        setShowVipModal(true);
        return;
      }
    }
    
    // (música removida)

    let freeLimitSnapshot: MessageLimitState | null = null;

    // Image attachment requires VIP/DEV in friend mode (unless using school action)
    if (attachment?.kind === "image" && mode === "friend" && pendingAction !== "school" && !profile?.is_vip && !profile?.is_dev) {
      setVipModalPlan("vip");
      setShowVipModal(true);
      return;
    }

    // Programmer mode requires DEV only
    if (mode === "programmer" && !profile?.is_dev) {
      setVipModalPlan("programmer");
      setShowVipModal(true);
      return;
    }

    // School/imagegen actions require VIP or DEV
    if ((pendingAction === "school" || pendingAction === "imagegen") && !profile?.is_vip && !profile?.is_dev) {
      setVipModalPlan("vip");
      setShowVipModal(true);
      return;
    }

    // Rewrite is free for everyone - no check needed

    // Free users in friend mode have message limits
    if (shouldTrackFreeMessage) {
      const nextLimit = await checkMessageLimit();
      if (!nextLimit) {
        toast.error("Não foi possível verificar seu limite agora.");
        return;
      }

      freeLimitSnapshot = nextLimit;

      if (!nextLimit.allowed) {
        setMessageLimit(nextLimit);
        setShowLimitModal(true);
        return;
      }
    }

    const consumeFreeMessage = async () => {
      if (!shouldTrackFreeMessage || !freeLimitSnapshot) return;

      const { error } = await supabase.rpc("increment_free_messages");
      if (error) {
        console.error("Erro ao atualizar limite gratuito:", error);
        return;
      }

      const optimisticRemaining = Math.max((freeLimitSnapshot.remaining ?? 1) - 1, 0);
      setMessageLimit({
        ...freeLimitSnapshot,
        allowed: optimisticRemaining > 0,
        remaining: optimisticRemaining,
        is_vip: false,
      });
      void checkMessageLimit();
    };

    // Stop recording if active
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }

    let convId = activeConversationId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) { toast.error("Erro ao criar conversa"); return; }
      skipNextLoadRef.current = convId;
      setActiveConversationId(convId);
    }

    const persistAssistantMessage = async (content: string) => {
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: convId,
        role: "assistant",
        content,
      });

      if (error) {
        console.error("Erro ao salvar resposta da IA:", error);
      }
    };

    let userMsg: Message;
    let storedContent: string;

    if (attachment?.kind === "image") {
      const imagePrompt = trimmedInput || "Analise esta imagem.";
      userMsg = { role: "user", content: imagePrompt, attachment };
      storedContent = `📷 Imagem anexada: ${attachment.name}${trimmedInput ? `\n\n${trimmedInput}` : ""}`;
    } else if (attachment?.kind === "text") {
      const textContent = `[Arquivo anexado: ${attachment.name}]\n${attachment.text}${trimmedInput ? `\n\n${trimmedInput}` : ""}`;
      userMsg = { role: "user", content: textContent };
      storedContent = textContent;
    } else {
      userMsg = { role: "user", content: trimmedInput };
      storedContent = trimmedInput;
    }

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setAttachment(null);
    setIsLoading(true);
    setThinkingText("Pensando...");

    // Route to appropriate edge function
    let chatUrl: string;
    if (pendingAction === "imagegen") {
      chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-imagegen`;
    } else if (pendingAction === "rewrite") {
      chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-rewrite`;
    } else if (pendingAction === "school") {
      chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-school`;
    } else if (mode === "programmer") {
      chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-programmer`;
    } else if (mode === "friend" && usePremium) {
      chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-vip`;
    } else {
      chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-friend`;
    }

    try {
      await saveMessage(convId, "user", storedContent);

      if (messages.length === 0) {
        updateConversationTitle(
          convId,
          trimmedInput || (attachment?.kind === "image" ? `Imagem: ${attachment.name}` : attachment?.name || "Nova conversa")
        );
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Cycle thinking text
      const thinkingInterval = setInterval(() => {
        setThinkingText(prev => {
          if (prev === "Pensando...") return "Analisando...";
          if (prev === "Analisando...") return "Elaborando resposta...";
          return "Pensando...";
        });
      }, 2500);

      // Build request body based on mode/action
      let requestBody: any;
      if (pendingAction === "imagegen") {
        requestBody = { prompt: trimmedInput };
      } else if (pendingAction === "school") {
        requestBody = {
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content,
            ...(m.attachment?.kind === "image" ? { imageData: m.attachment.dataUrl } : {}),
          })),
          display_name: profile?.display_name || "",
          user_gender: profile?.gender || null,
        };
      } else {
        requestBody = {
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content,
            ...(m.attachment?.kind === "image" ? { imageData: m.attachment.dataUrl } : {}),
          })),
          mode: usePremium ? "premium" : mode,
          is_vip: hasPremiumAccess,
          is_admin: !!profile?.is_dev,
          display_name: profile?.display_name || "",
          team_badge: profile?.team_badge || null,
          user_gender: profile?.gender || null,
          user_bio: profile?.bio || null,
          user_relationship_status: profile?.relationship_status || null,
          
          ...(conversationSummary ? { conversation_summary: conversationSummary } : {}),
        };
      }

      // Clear pending action after building request
      setPendingAction(null);

      // Retry logic: on 429/503, show restart message and keep retrying until it works
      let res: Response | null = null;
      const maxRetries = 10;
      let showedRestart = false;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        res = await fetch(chatUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(requestBody),
        });

        if (res.ok) {
          // If we showed the restart message, remove it
          if (showedRestart) {
            setMessages((prev) => prev.filter(m => m.content !== "🔄 Reiniciando o sistema do chat. Calma aí, voltaremos em breve..."));
          }
          break;
        }

        // On 429 or 503, show restart message and keep trying
        if ((res.status === 429 || res.status === 503) && attempt < maxRetries - 1) {
          if (!showedRestart) {
            showedRestart = true;
            setMessages((prev) => [...prev, { role: "assistant", content: "🔄 Reiniciando o sistema do chat. Calma aí, voltaremos em breve..." }]);
          }
          setThinkingText("Reiniciando sistema...");
          const waitSec = Math.min((attempt + 1) * 5, 30); // 5s, 10s, 15s... max 30s
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }

        break;
      }

      clearInterval(thinkingInterval);

      if (!res || !res.ok) {
        // Remove restart message if present
        if (showedRestart) {
          setMessages((prev) => prev.filter(m => m.content !== "🔄 Reiniciando o sistema do chat. Calma aí, voltaremos em breve..."));
        }
        const errData = await res?.json().catch(() => null);
        const errorMsg = errData?.error || `Erro ${res?.status || "desconhecido"}`;
        const persistedErrorMessage = `⚠️ ${errorMsg}`;
        setMessages((prev) => [...prev, { role: "assistant", content: persistedErrorMessage }]);
        await persistAssistantMessage(persistedErrorMessage);
        setIsLoading(false);
        setThinkingText("");
        return;
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        // Handle rate limit
        if (data.error === "rate_limit") {
          const rateLimitMessage = `⏳ ${data.message || "Serviço de IA sobrecarregado. Tente novamente em alguns minutos."}`;
          setMessages((prev) => [...prev, { role: "assistant", content: rateLimitMessage }]);
          await persistAssistantMessage(rateLimitMessage);
          setIsLoading(false);
          setThinkingText("");
          return;
        }
        if (data.success && data.audioContent) {
          const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
          const musicContent = `🎵 **Música gerada!**\n\n_"${data.prompt || trimmedInput}"_\n\n<audio:${audioUrl}>`;
          setMessages((prev) => [...prev, { role: "assistant", content: musicContent }]);
          await persistAssistantMessage(musicContent);
        } else if (data.type === "image" && data.image_url) {
          const imageContent = `🎨 **Imagem gerada!** ✨\n\n<generated_image:${data.image_url}>`;
          setMessages((prev) => [...prev, { role: "assistant", content: imageContent }]);
          await persistAssistantMessage(imageContent);
        } else {
          const textContent = data.text || data.error || "Resposta recebida.";
          setMessages((prev) => [...prev, { role: "assistant", content: textContent }]);
          await persistAssistantMessage(textContent);
        }
        // increment already done before sending
      } else {
        if (!res.body) throw new Error("Sem corpo de resposta");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let assistantSoFar = "";
        let persistedAssistantContent = "";
        let persistedAssistantMessageId: string | null = null;
        let persistDraftTimer: number | undefined;
        let hasQueuedAssistantPersist = false;
        let persistDraftQueue = Promise.resolve();

        const persistAssistantDraft = (content: string, force = false) => {
          const snapshot = content.trim();
          if (!snapshot) return persistDraftQueue;
          if (!force && snapshot === persistedAssistantContent) return persistDraftQueue;

          persistDraftQueue = persistDraftQueue
            .then(async () => {
              if (!force && snapshot === persistedAssistantContent) return;

              const { data: insertedDraft, error: insertError } = await supabase
                .from("chat_messages")
                .insert({ conversation_id: convId, role: "assistant", content: snapshot })
                .select("id")
                .single();

              if (insertError) {
                console.error("Erro ao salvar rascunho da resposta:", insertError);
                return;
              }

              const previousDraftId = persistedAssistantMessageId;
              persistedAssistantMessageId = insertedDraft.id;
              persistedAssistantContent = snapshot;

              if (previousDraftId) {
                const { error: deleteError } = await supabase
                  .from("chat_messages")
                  .delete()
                  .eq("id", previousDraftId);

                if (deleteError) {
                  console.error("Erro ao substituir rascunho da resposta:", deleteError);
                }
              }
            })
            .catch((persistError) => {
              console.error("Erro ao persistir resposta parcial:", persistError);
            });

          return persistDraftQueue;
        };

        const scheduleAssistantDraftPersist = (content: string) => {
          if (!hasQueuedAssistantPersist) {
            hasQueuedAssistantPersist = true;
            void persistAssistantDraft(content, true);
            return;
          }

          if (persistDraftTimer) {
            window.clearTimeout(persistDraftTimer);
          }

          persistDraftTimer = window.setTimeout(() => {
            void persistAssistantDraft(content);
          }, 800);
        };

        const upsertAssistant = (chunk: string) => {
          assistantSoFar += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
            }
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
          scheduleAssistantDraftPersist(assistantSoFar);
        };

        let streamDone = false;
        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") { streamDone = true; break; }
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.text || parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                setThinkingText("");
                upsertAssistant(content);
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        if (persistDraftTimer) {
          window.clearTimeout(persistDraftTimer);
        }

        if (assistantSoFar) {
          await persistAssistantDraft(assistantSoFar, true);
          if (mode === "programmer") {
            // Extract the largest code block (prefer html blocks)
            const allBlocks = [...assistantSoFar.matchAll(/```(\w*)\n([\s\S]*?)```/g)];
            if (allBlocks.length > 0) {
              const htmlBlock = allBlocks.find(m => m[1] === "html");
              const best = htmlBlock || allBlocks.reduce((a, b) => a[2].length > b[2].length ? a : b);
              onCodeGenerated(best[2]);
            }
          }
        }
      }

      await consumeFreeMessage();
    } catch (err) {
      console.error("Chat error:", err);
      const errMsg = "❌ Erro ao contactar a IA. Tente novamente.";
      setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
      await persistAssistantMessage(errMsg);
      // Re-check limit on error to restore accurate state
      void checkMessageLimit();
    } finally {
      setIsLoading(false);
      setThinkingText("");
    }
  };

  const switchMode = (newMode: ChatMode) => {
    // Block access to locked modes — show payment modal instead
    if (newMode === "programmer" && !profile?.is_dev) {
      setVipModalPlan("programmer");
      setShowVipModal(true);
      return;
    }

    setMode(newMode);
    onModeChange?.(newMode);
    setPendingAction(null);
    setActiveConversationId(null);
    setMessages([]);
    setAttachment(null);
    setInput("");
  };

  const acceptedFileTypes = "image/*,.txt,.md,.json,.csv,.js,.ts,.tsx,.jsx,.html,.css,.sql,.py,.xml,.yaml,.yml,.toml,.zip,.gz";

  const inputPlaceholder = pendingAction === "imagegen"
    ? "Descreva a imagem que deseja criar... 🎨"
    : pendingAction === "school"
    ? "Tire uma foto ou pergunte sobre o exercício... 📚"
    : pendingAction === "rewrite"
    ? "Cole o texto que deseja reescrever... ✍️"
    : isRecording ? "🎤 Gravando... fale agora" : config.placeholder;

  return (
    <div className="flex h-full bg-background/50 text-foreground relative overflow-hidden">
      {/* Sidebar overlay for mobile */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 sm:hidden" 
          onClick={() => setShowSidebar(false)} 
        />
      )}
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-80 fixed sm:relative inset-y-0 left-0 z-40 sm:z-auto' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-border/10 flex flex-col shrink-0 bg-background/95 backdrop-blur-xl sm:bg-background/60`}>
        {/* Header */}
        <div className="p-3 border-b border-border/10 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">Histórico</h3>
            <span className="text-[10px] text-muted-foreground/40 font-medium">{conversations.length}</span>
          </div>
          <button
            onClick={() => { setActiveConversationId(null); setMessages([]); setAttachment(null); setShowSidebar(false); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-bold text-primary-foreground bg-gradient-to-b from-primary to-primary/85 border border-primary/40 shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.7)] hover:shadow-[0_6px_20px_-4px_hsl(var(--primary)/0.9)] hover:from-primary hover:to-primary transition-all duration-300 group"
          >
            <Plus size={15} strokeWidth={2.6} />
            Nova conversa
          </button>
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Buscar conversas..."
              className="w-full pl-8 pr-3 py-2 text-[12px] rounded-xl bg-muted/30 border border-border/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:bg-muted/50 transition-all"
            />
            <MessageCircle size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          </div>
        </div>

        {/* Grouped conversations */}
        <div className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin">
          {conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-2xl bg-muted/30 border border-border/30 flex items-center justify-center mx-auto mb-3">
                <MessageCircle size={20} className="text-muted-foreground/40" />
              </div>
              <p className="text-xs text-muted-foreground/50 font-medium">Nenhuma conversa ainda</p>
              <p className="text-[10px] text-muted-foreground/30 mt-1">Comece uma nova!</p>
            </div>
          ) : (() => {
            const filtered = conversations.filter(c =>
              !historySearch || c.title.toLowerCase().includes(historySearch.toLowerCase())
            );
            if (filtered.length === 0) {
              return <p className="text-center text-xs text-muted-foreground/40 py-8">Nada encontrado</p>;
            }

            // Group by date
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const yesterday = today - 86400000;
            const weekAgo = today - 7 * 86400000;
            const groups: Record<string, Conversation[]> = { Hoje: [], Ontem: [], "Esta semana": [], Anteriores: [] };
            filtered.forEach((c) => {
              const t = new Date(c.updated_at || c.created_at).getTime();
              if (t >= today) groups["Hoje"].push(c);
              else if (t >= yesterday) groups["Ontem"].push(c);
              else if (t >= weekAgo) groups["Esta semana"].push(c);
              else groups["Anteriores"].push(c);
            });

            const modeMeta: Record<string, { icon: typeof MessageCircle; label: string; color: string }> = {
              friend:     { icon: Heart,   label: "Amigo",       color: "from-pink-500/30 to-rose-500/20 text-pink-300 border-pink-500/30" },
              programmer: { icon: Code,    label: "Programador", color: "from-primary/40 to-primary/20 text-primary-foreground border-primary/40" },
              school:     { icon: Brain,   label: "Escola",      color: "from-sky-500/30 to-blue-500/20 text-sky-300 border-sky-500/30" },
              imagegen:   { icon: ImagePlus, label: "Imagem",    color: "from-violet-500/30 to-fuchsia-500/20 text-violet-300 border-violet-500/30" },
              rewrite:    { icon: PenLine, label: "Reescrever",  color: "from-amber-500/30 to-orange-500/20 text-amber-300 border-amber-500/30" },
              premium:    { icon: Crown,   label: "VIP",         color: "from-yellow-500/40 to-amber-500/20 text-amber-300 border-amber-400/40" },
            };

            const formatTime = (iso: string) => {
              const d = new Date(iso);
              const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              const diffDays = Math.floor((today - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
              if (diffDays === 1) return "Ontem";
              if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" });
              return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
            };

            return Object.entries(groups).filter(([, arr]) => arr.length > 0).map(([label, items]) => (
              <div key={label} className="mb-3">
                <div className="px-2 py-1 mb-1 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/40 to-transparent" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{label}</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/40 to-transparent" />
                </div>
                <div className="space-y-1">
                  {items.map((conv) => {
                    const meta = modeMeta[conv.mode] || modeMeta.friend;
                    const Icon = meta.icon;
                    const active = conv.id === activeConversationId;
                    return (
                      <div
                        key={conv.id}
                        onClick={() => { setActiveConversationId(conv.id); setAttachment(null); setShowSidebar(false); }}
                        className={`group/conv relative flex items-center gap-2.5 px-2.5 py-2.5 rounded-2xl cursor-pointer transition-all duration-200 ${
                          active
                            ? "bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30 shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.5)]"
                            : "border border-transparent hover:bg-muted/40 hover:border-border/40"
                        }`}
                      >
                        {/* Active indicator bar */}
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
                        )}

                        {/* Avatar circular por modo */}
                        <div className={`relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br border ${meta.color}`}>
                          <Icon size={16} strokeWidth={2.2} />
                          {conv.mode === "premium" && (
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-background flex items-center justify-center">
                              <Crown size={6} className="text-amber-900" />
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className={`truncate text-[13px] font-semibold ${active ? "text-foreground" : "text-foreground/85"}`}>
                              {conv.title}
                            </span>
                            <span className={`text-[10px] shrink-0 font-medium ${active ? "text-primary/80" : "text-muted-foreground/50"}`}>
                              {formatTime(conv.updated_at || conv.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] text-muted-foreground/60">
                              {meta.label}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                              className="p-1 rounded-lg opacity-0 group-hover/conv:opacity-100 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
                              title="Excluir"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra de modos removida — controles já no header superior (Histórico / Amigo / Programador / VIP) */}


        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {messages.length === 0 ? (
            <div className="flex flex-col h-full items-center justify-center px-6 py-10">
              <div className="relative max-w-md w-full text-center animate-in fade-in-0 zoom-in-95 duration-500">
                {/* Glow halo */}
                <div className="absolute inset-0 -z-10 bg-primary/10 blur-3xl rounded-full" aria-hidden />

                {/* Avatar / emoji circle */}
                <div className="relative mx-auto w-20 h-20 mb-5 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary/25 via-primary/10 to-transparent border border-primary/30 shadow-[0_0_40px_-8px_hsl(var(--primary)/0.6)]">
                  <span className="text-4xl">{config.emptyEmoji}</span>
                  <span className="absolute -inset-1 rounded-2xl bg-primary/20 blur-md -z-10 animate-pulse-ring" aria-hidden />
                </div>

                <h2 className="text-2xl sm:text-3xl font-black tracking-tight gradient-text-primary mb-2">
                  Bem-vindo ao {config.emptyTitle}
                </h2>
                <p className="text-sm text-muted-foreground/80 leading-relaxed mb-6">
                  {config.emptyText}
                </p>

                {/* Quick suggestions */}
                <div className="grid gap-2">
                  {(mode === "friend"
                    ? ["Me dá um conselho 💭", "Conta uma curiosidade 🤔", "Vamos conversar 💬"]
                    : mode === "programmer"
                      ? ["Cria um site bonito 🚀", "Explica esse código 🧠", "Faz um app de lista ✅"]
                      : ["Me ajuda com matemática 📐", "Explica de forma simples 📚", "Faz um resumo ✍️"]
                  ).map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s.replace(/\s[^\w\s]+$/, ""))}
                      className="text-[13px] px-4 py-2.5 rounded-xl text-left text-foreground/80 bg-card/40 border border-border/40 hover:bg-primary/10 hover:border-primary/40 hover:text-foreground transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={`${mode === "programmer" ? "max-w-3xl" : "max-w-4xl lg:max-w-5xl"} mx-auto px-3 sm:px-5 md:px-8 ${mode === "programmer" ? "py-3 sm:py-4 space-y-3 sm:space-y-4" : "py-4 sm:py-6 space-y-4 sm:space-y-5 md:space-y-6"}`}>
              {messages.map((rawMsg, i) => {
                const msg = { ...rawMsg, content: rawMsg.content ?? "" };
                return (
                <div key={i} className="group animate-in fade-in-0 slide-in-from-bottom-3 duration-400">
                  {msg.role === "user" ? (
                    <div className="flex gap-3 justify-end relative">
                      <div className="max-w-[85%] md:max-w-[80%] relative">
                        {msg.attachment && (
                          <img
                            src={msg.attachment.dataUrl}
                            alt={msg.attachment.name}
                            className="rounded-2xl max-w-full mb-2 border border-border/15 shadow-lg"
                            style={{ maxHeight: 300 }}
                          />
                        )}
                        <div className={`bg-primary text-primary-foreground chat-bubble-user ${getUserBubbleClass(bubbleStyle)} px-3 sm:px-3.5 md:px-4 py-2 sm:py-2.5 md:py-3 text-[12px] sm:text-[13px] md:text-sm leading-relaxed`}>
                          {msg.content}
                        </div>
                        <button
                          onClick={() => handleCopyMessage(msg.content, i)}
                          className="opacity-0 group-hover:opacity-100 mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-all ml-auto"
                          title="Copiar"
                        >
                          {copiedMsg === i ? <><Check size={10} /> Copiado</> : <><Copy size={10} /> Copiar</>}
                        </button>
                      </div>
                      <div className="relative shrink-0 mt-1">
                        <span className="absolute inset-0 rounded-xl bg-primary/30 blur-md animate-pulse-ring pointer-events-none" aria-hidden />
                        <div className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-xl overflow-hidden flex items-center justify-center border border-primary/40 bg-gradient-to-br from-primary/30 to-primary/10 shadow-[0_0_14px_-2px_hsl(var(--primary)/0.55)]">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Você" className="w-full h-full object-cover" />
                          ) : (
                            <User size={14} className="text-primary-foreground/95 drop-shadow-[0_0_6px_hsl(var(--primary))]" strokeWidth={2.2} />
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="relative shrink-0 mt-1">
                        <span className="absolute inset-0 rounded-xl bg-primary/20 blur-md animate-pulse-ring pointer-events-none" aria-hidden />
                        <div className={`relative w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-xl overflow-hidden flex items-center justify-center border border-primary/30 bg-gradient-to-br from-card/80 to-background/90 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.45),inset_0_1px_0_hsl(var(--primary)/0.15)]`}>
                          {aiAvatarUrl ? (
                            <img src={aiAvatarUrl} alt="AI" className="w-full h-full object-cover" />
                          ) : (
                            <Bot size={14} className="text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.7)]" strokeWidth={2.2} />
                          )}
                        </div>
                      </div>
                      <div className={`flex-1 min-w-0 chat-bubble-ai ${getBubbleClass(bubbleStyle, chatThemeColor)} px-3 py-2`}>
                        <div className="text-sm leading-relaxed text-foreground/90 prose prose-invert prose-sm max-w-none">
                          {msg.content.includes("<generated_image:") ? (
                            <>
                              <ReactMarkdown>
                                {msg.content.replace(/<generated_image:[^>]+>/g, "")}
                              </ReactMarkdown>
                              {(() => {
                                const imgMatch = msg.content.match(/<generated_image:([^>]+)>/);
                                if (!imgMatch) return null;
                                const imgSrc = imgMatch[1];
                                return (
                                  <div className="mt-3">
                                    <img
                                      src={imgSrc}
                                      alt="Imagem gerada"
                                      className="rounded-2xl max-w-full border border-border/20 shadow-lg"
                                      style={{ maxHeight: 400 }}
                                    />
                                    <div className="flex gap-2 mt-2">
                                      <a
                                        href={imgSrc}
                                        download="snyx-image.png"
                                        className="flex items-center gap-1.5 text-xs text-purple-400/70 hover:text-purple-400 transition-colors"
                                      >
                                        <Download size={12} /> Baixar Imagem
                                      </a>
                                    </div>
                                  </div>
                                );
                              })()}
                            </>
                          ) : (
                            <ReactMarkdown
                              components={{
                                code({ className, children, ...props }) {
                                  return <code className={`${className} bg-muted rounded px-1.5 py-0.5 text-[13px] font-mono text-foreground/80`} {...props}>{children}</code>;
                                },
                                pre({ children }) {
                                  return <pre className="bg-muted/80 rounded-xl p-4 overflow-x-auto my-3 text-xs font-mono border border-border/20">{children}</pre>;
                                },
                                img({ src, alt }) {
                                  return (
                                    <img
                                      src={src}
                                      alt={alt || "Imagem gerada"}
                                      className="rounded-2xl max-w-full mt-2 border border-border/20"
                                      style={{ maxHeight: 400 }}
                                    />
                                  );
                                },
                                a({ href, children }) {
                                  return (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary underline hover:text-primary/80 transition-colors"
                                    >
                                      {children}
                                    </a>
                                  );
                                },
                                // Support text sizes: <sub> for small, <sup> for large styled text
                                h1({ children }) {
                                  return <h1 className="text-2xl sm:text-3xl font-black my-3 text-foreground">{children}</h1>;
                                },
                                h2({ children }) {
                                  return <h2 className="text-xl sm:text-2xl font-bold my-2.5 text-foreground">{children}</h2>;
                                },
                                h3({ children }) {
                                  return <h3 className="text-lg sm:text-xl font-bold my-2 text-foreground">{children}</h3>;
                                },
                                h4({ children }) {
                                  return <h4 className="text-base sm:text-lg font-semibold my-1.5 text-foreground">{children}</h4>;
                                },
                                blockquote({ children }) {
                                  return <blockquote className="border-l-3 border-primary/40 pl-3 my-2 italic text-foreground/70">{children}</blockquote>;
                                },
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          )}
                        </div>
                        {mode === "programmer" && (
                          <div className="mt-3 space-y-2">
                            {/* Action buttons - always visible */}
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => handleDownloadZip(msg.content)}
                                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-muted/10 border border-border/10 text-muted-foreground/70 hover:text-foreground hover:bg-muted/20 transition-all"
                              >
                                <Download size={12} /> ZIP
                              </button>
                              {deployedUrls[i] ? (
                                <a
                                  href={deployedUrls[i]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                                >
                                  <Globe size={12} /> {deployedUrls[i].replace("https://", "").slice(0, 25)}...
                                </a>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleDeploySite(msg.content, i)}
                                    disabled={deployingMsg === i}
                                    className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-emerald-400/80 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all disabled:opacity-50"
                                  >
                                    {deployingMsg === i ? (
                                      <><Loader2 size={12} className="animate-spin" /> Publicando...</>
                                    ) : (
                                      <><Rocket size={12} /> Publicar</>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => openUpdatePicker(i)}
                                    disabled={deployingMsg === i}
                                    className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-primary/8 border border-primary/10 text-primary/70 hover:bg-primary/15 hover:text-primary transition-all disabled:opacity-50"
                                  >
                                    <Settings size={12} /> Atualizar Site
                                  </button>
                                </>
                              )}
                            </div>

                            {/* Update picker dropdown */}
                            {showUpdatePicker === i && (
                              <div className="rounded-xl bg-muted/15 border border-border/15 p-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-medium text-muted-foreground/70">Selecione o site para atualizar:</p>
                                  <button onClick={() => setShowUpdatePicker(null)} className="text-muted-foreground/30 hover:text-foreground text-xs">✕</button>
                                </div>
                                {loadingUpdatePicker ? (
                                  <div className="flex items-center justify-center py-4">
                                    <Loader2 size={16} className="animate-spin text-muted-foreground/40" />
                                  </div>
                                ) : updatePickerSites.length === 0 ? (
                                  <p className="text-xs text-muted-foreground/40 text-center py-3">Nenhum site publicado.</p>
                                ) : (
                                  <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
                                    {updatePickerSites.map(site => (
                                      <button
                                        key={site.id}
                                        onClick={() => handleDeploySite(msg.content, i, site.name)}
                                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left hover:bg-primary/10 hover:text-primary transition-all"
                                      >
                                        <Globe size={12} className="shrink-0 text-muted-foreground/40" />
                                        <span className="truncate flex-1">{site.name}</span>
                                        <span className="text-[10px] text-muted-foreground/30 shrink-0">Atualizar</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => handleCopyMessage(msg.content, i)}
                          className="opacity-0 group-hover:opacity-100 mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-all"
                          title="Copiar"
                        >
                          {copiedMsg === i ? <><Check size={10} /> Copiado</> : <><Copy size={10} /> Copiar</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-3 animate-slide-up-fade">
                  <div className="relative shrink-0">
                    <span className="absolute inset-0 rounded-xl bg-primary/30 blur-md animate-pulse-ring pointer-events-none" aria-hidden />
                    <div className="relative w-9 h-9 rounded-xl flex items-center justify-center border border-primary/40 bg-gradient-to-br from-primary/20 to-card/80 shadow-[0_0_14px_-2px_hsl(var(--primary)/0.6)]">
                      <Bot size={15} className="text-primary drop-shadow-[0_0_6px_hsl(var(--primary))]" strokeWidth={2.2} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 py-2">
                    {thinkingText ? (
                      <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-input border border-primary/20 shadow-[0_0_18px_-6px_hsl(var(--primary)/0.45)]">
                        <Brain size={14} className="text-primary animate-pulse drop-shadow-[0_0_4px_hsl(var(--primary)/0.6)]" />
                        <span className="text-xs font-medium text-foreground/80 animate-pulse">{thinkingText}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl chat-bubble-ai">
                        <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))] animate-dot-pulse" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))] animate-dot-pulse" style={{ animationDelay: '180ms' }} />
                        <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))] animate-dot-pulse" style={{ animationDelay: '360ms' }} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>


        {/* Attachment preview */}
        {attachment && (
          <div className="px-4 py-2 border-t border-border/10">
            <div className="max-w-3xl lg:max-w-4xl mx-auto">
              <div className="flex items-center gap-3 glass-input rounded-xl p-2.5 border border-border/10">
                {attachment.kind === "image" ? (
                  <img src={attachment.dataUrl} alt={attachment.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : attachment.mimeType === "application/zip" ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <Archive size={14} className="text-amber-400" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/10">
                    <Paperclip size={14} className="text-muted-foreground/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground/80">{attachment.name}</p>
                  <p className="text-[11px] text-muted-foreground/30">{formatFileSize(attachment.size)}</p>
                </div>
                <button onClick={() => setAttachment(null)} className="p-1.5 rounded-lg hover:bg-destructive/8 hover:text-destructive transition-all duration-200">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending action indicator */}
        {pendingAction && (
          <div className="px-4 py-1.5 border-t border-border/10">
            <div className="max-w-3xl lg:max-w-4xl mx-auto">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium ${
                pendingAction === "school" 
                  ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                  : pendingAction === "rewrite"
                  ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                  : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
              }`}>
                {pendingAction === "school" ? <Camera size={12} /> : pendingAction === "rewrite" ? <PenLine size={12} /> : <ImagePlus size={12} />}
                {pendingAction === "school" ? "Modo Escola ativo" : pendingAction === "rewrite" ? "Modo Reescrever ativo" : "Modo Criar Imagem ativo"}
                <button onClick={() => setPendingAction(null)} className="ml-1 opacity-60 hover:opacity-100">✕</button>
              </div>
            </div>
          </div>
        )}

        {/* Read-only banner */}
        {isReadOnly && (
          <div className="px-3 sm:px-4 md:px-6 pt-2">
            <div className={`max-w-3xl lg:max-w-4xl mx-auto flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[11px] ${
              readOnlyTier === "programmer"
                ? "border-cyan-500/25 bg-cyan-500/8 text-cyan-300"
                : "border-amber-500/25 bg-amber-500/8 text-amber-300"
            }`}>
              <Crown className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 font-medium">
                Conversa em modo leitura — sua tag {readOnlyTier === "programmer" ? "DEV" : "VIP"} expirou. Histórico salvo, mas envio bloqueado.
              </span>
              <button
                onClick={() => { setVipModalPlan(readOnlyTier === "programmer" ? "programmer" : "vip"); setShowVipModal(true); }}
                className="px-2.5 py-1 rounded-lg bg-background/40 hover:bg-background/60 border border-border/30 font-bold text-[10px] uppercase tracking-wider transition-all"
              >
                Reativar
              </button>
            </div>
          </div>
        )}

        {/* Input area */}
        {!isReadOnly && (
        <div className={`${mode === "programmer" ? "p-1.5 sm:p-2" : "px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 pt-2"} safe-bottom`}>
          <div className={`${mode === "programmer" ? "max-w-2xl" : "max-w-3xl lg:max-w-4xl"} mx-auto`}>
            {/* Main input container */}
            <div className={`relative ${mode === "programmer" ? "rounded-xl" : "rounded-2xl sm:rounded-[20px]"} bg-card/40  border border-border/10 shadow-xl shadow-black/5 focus-within:border-primary/20 focus-within:shadow-primary/8 transition-all duration-500`}>
              {/* Textarea row */}
              <div className="flex items-end gap-1 px-2 sm:px-3 py-2 sm:py-2.5">
                <input type="file" accept={acceptedFileTypes} ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); onUserInput?.(e.target.value); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={inputPlaceholder}
                  rows={1}
                  className="flex-1 min-w-0 bg-transparent py-1 sm:py-1.5 text-[13px] sm:text-sm outline-none placeholder:text-muted-foreground/25 resize-none max-h-[200px] leading-relaxed text-foreground"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && !attachment)}
                  className={`p-2.5 rounded-xl transition-all duration-300 shrink-0 ${
                    input.trim() || attachment
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/40 hover:scale-105'
                      : 'bg-muted/8 text-muted-foreground/20'
                  } disabled:opacity-30 disabled:hover:scale-100`}
                >
                  <Send size={15} />
                </button>
              </div>

              {/* Bottom toolbar */}
              <div className="flex items-center gap-0.5 px-2 sm:px-3 pb-2 pt-0">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-foreground/60 hover:bg-muted/10 transition-all duration-200"
                  title="Anexar arquivo"
                >
                  <Paperclip size={15} />
                </button>
                <button
                  onClick={toggleRecording}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                    isRecording
                      ? "bg-destructive/15 text-destructive animate-pulse"
                      : "text-muted-foreground/30 hover:text-foreground/60 hover:bg-muted/10"
                  }`}
                  title={isRecording ? "Parar gravação" : "Gravar áudio"}
                >
                  {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                <button
                  onClick={() => { setPendingAction("school"); fileInputRef.current?.click(); }}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                    pendingAction === "school"
                      ? "text-green-400 bg-green-500/10"
                      : "text-muted-foreground/30 hover:text-green-400 hover:bg-green-500/8"
                  }`}
                  title="📚 Escola IA"
                >
                  <Camera size={15} />
                </button>
                <button
                  onClick={() => setPendingAction(prev => prev === "imagegen" ? null : "imagegen")}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                    pendingAction === "imagegen"
                      ? "text-purple-400 bg-purple-500/10"
                      : "text-muted-foreground/30 hover:text-purple-400 hover:bg-purple-500/8"
                  }`}
                  title="🎨 Criar imagem"
                >
                  <ImagePlus size={15} />
                </button>
                <button
                  onClick={() => setPendingAction(prev => prev === "rewrite" ? null : "rewrite")}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                    pendingAction === "rewrite"
                      ? "text-sky-400 bg-sky-500/10"
                      : "text-muted-foreground/30 hover:text-sky-400 hover:bg-sky-500/8"
                  }`}
                  title="✍️ Reescrever"
                >
                  <PenLine size={15} />
                </button>

                <div className="flex-1" />
                <span className="text-[9px] text-muted-foreground/15 hidden sm:block select-none">SnyX AI</span>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} highlightPlan={vipModalPlan} />
      <ChatSettings open={showChatSettings} onClose={() => setShowChatSettings(false)} />
      

      {/* Limit modal */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60  p-4">
          <div className="glass-elevated rounded-2xl p-8 max-w-sm w-full text-center animate-enter border border-border/15">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/8 mb-5 animate-float">
              <Clock className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Limite atingido</h2>
            <p className="text-sm text-muted-foreground/60 leading-relaxed mb-1">
              Você usou suas <span className="text-foreground font-medium">5 mensagens gratuitas</span>.
            </p>
            {messageLimit?.reset_at && (
              <p className="text-xs text-muted-foreground/30 mb-6">
                Renovação em{" "}
                <span className="text-foreground/70 font-mono tabular-nums">
                  {new Date(messageLimit.reset_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>
            )}
            <div className="space-y-2">
              <button
                onClick={() => { setShowLimitModal(false); setVipModalPlan("vip"); setShowVipModal(true); }}
                className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl py-3.5 transition-all duration-300 shadow-lg shadow-primary/15 hover:shadow-primary/25"
              >
                <Sparkles className="w-4 h-4" />
                VIRAR VIP
              </button>
              <button
                onClick={() => setShowLimitModal(false)}
                className="w-full text-xs text-muted-foreground/40 hover:text-foreground py-2.5 transition-colors duration-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Site Management Modal */}
      {showDeleteSitesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60  p-4">
          <div className="glass-elevated rounded-2xl p-6 max-w-lg w-full animate-enter border border-border/15 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Globe size={18} className="text-primary" />
                Meus Sites
              </h2>
              <button
                onClick={() => setShowDeleteSitesModal(false)}
                className="text-muted-foreground/40 hover:text-foreground transition-colors text-xl"
              >
                ✕
              </button>
            </div>

            {loadingSites ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-muted-foreground/40" />
              </div>
            ) : vercelSites.length === 0 ? (
              <p className="text-sm text-muted-foreground/50 text-center py-8">Nenhum site publicado ainda.</p>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin">
                {vercelSites.map(site => {
                  const domains = siteDomains[site.id] || [];
                  const isExpanded = !!siteDomains[site.id];
                  return (
                    <div
                      key={site.id}
                      className="rounded-xl bg-muted/10 border border-border/10 overflow-hidden"
                    >
                      <div className="flex items-center gap-3 p-3 group">
                        <Globe size={16} className="text-muted-foreground/40 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground/80 truncate">{site.name}</p>
                          <a
                            href={site.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary/60 hover:text-primary truncate block"
                          >
                            {site.url.replace("https://", "")}
                          </a>
                        </div>
                        <button
                          onClick={() => {
                            if (!isExpanded) loadSiteDomains(site.id);
                            else setSiteDomains(prev => { const n = { ...prev }; delete n[site.id]; return n; });
                          }}
                          className="p-2 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all"
                          title="Gerenciar domínios"
                        >
                          <Settings size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteSite(site.id)}
                          disabled={deletingSiteId === site.id}
                          className="p-2 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
                        >
                          {deletingSiteId === site.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>

                      {/* Domain management section */}
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-border/10 pt-3 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground/60 mb-2">Domínios personalizados</p>
                          
                          {domains.filter(d => !d.name.endsWith(".vercel.app")).length > 0 && (
                            <div className="space-y-1.5">
                              {domains.filter(d => !d.name.endsWith(".vercel.app")).map(d => (
                                <div key={d.name} className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg bg-muted/15 border border-border/8">
                                  <span className={`w-1.5 h-1.5 rounded-full ${d.verified ? 'bg-emerald-400' : 'bg-yellow-400 animate-pulse'}`} />
                                  <span className="flex-1 truncate text-foreground/70">{d.name}</span>
                                  <span className="text-[10px] text-muted-foreground/40">{d.verified ? 'Verificado' : 'DNS pendente'}</span>
                                  <button
                                    onClick={() => handleRemoveDomain(site.id, d.name)}
                                    disabled={removingDomain === d.name}
                                    className="p-1 rounded hover:text-destructive hover:bg-destructive/10 transition-all text-muted-foreground/30 disabled:opacity-50"
                                  >
                                    {removingDomain === d.name ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = e.target as HTMLFormElement;
                              const input = form.elements.namedItem("domain") as HTMLInputElement;
                              if (input.value.trim()) {
                                handleAddDomain(site.id, input.value);
                                input.value = "";
                              }
                            }}
                            className="flex gap-2"
                          >
                            <input
                              name="domain"
                              type="text"
                              placeholder="meusite.com.br"
                              disabled={addingDomain === site.id}
                              className="flex-1 text-xs px-3 py-2 rounded-lg bg-muted/10 border border-border/15 text-foreground placeholder:text-muted-foreground/25 outline-none focus:border-primary/30 transition-colors disabled:opacity-50"
                            />
                            <button
                              type="submit"
                              disabled={addingDomain === site.id}
                              className="px-3 py-2 text-xs font-medium rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-all disabled:opacity-50"
                            >
                              {addingDomain === site.id ? <Loader2 size={12} className="animate-spin" /> : "Adicionar"}
                            </button>
                          </form>

                          <p className="text-[10px] text-muted-foreground/30 leading-relaxed">
                            Aponte o DNS do seu domínio (registro A) para o IP da Vercel ou use um CNAME para <span className="font-mono text-muted-foreground/50">cname.vercel-dns.com</span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setShowDeleteSitesModal(false)}
              className="mt-4 w-full text-xs text-muted-foreground/40 hover:text-foreground py-2.5 transition-colors duration-300"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
