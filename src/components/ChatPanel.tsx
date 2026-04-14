import { useState, useRef, useEffect, useCallback } from "react";
import { Send, User, Paperclip, Download, Heart, Code, Plus, Trash2, MessageCircle, Clock, Crown, Sparkles, Globe, Loader2, Bot, PanelLeftClose, PanelLeft, Mic, MicOff, Brain, Settings, ImagePlus, Camera, Music, Palette, Phone, Archive, Link2, PenLine, Rocket } from "lucide-react";
import { ChatSettings, getBubbleClass, getUserBubbleClass } from "./ChatSettings";
import { VoiceCall } from "./VoiceCall";
import { ConnectionModal } from "./ConnectionModal";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";
import { VipModal } from "./VipModal";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { toast } from "sonner";
import { resolveCharacterAvatar } from "@/lib/characterAvatars";

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
}

type MessageLimitState = {
  allowed: boolean;
  remaining?: number;
  reset_at?: string;
  is_vip?: boolean;
};

type ChatMode = "friend" | "programmer" | "music";
type PendingAction = "school" | "imagegen" | "rewrite" | null;

interface ChatPanelProps {
  onCodeGenerated: (code: string) => void;
  onModeChange?: (mode: ChatMode) => void;
  activeCharacter?: { id: string; name: string; system_prompt: string; avatar_url: string | null } | null;
  onClearCharacter?: () => void;
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
  music: {
    icon: Music,
    label: "Música",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    activeTab: "bg-orange-500/10 text-orange-400",
    bubbleColor: "bg-muted/60",
    placeholder: "Descreva a música que deseja criar... 🎵",
    emptyTitle: "SnyX Música",
    emptyText: "Crie músicas originais com IA! Descreva o estilo, gênero e mood. Powered by ElevenLabs.",
    emptyEmoji: "🎵",
    premiumLabel: null,
    premiumIcon: null,
  },
};

export function ChatPanel({ onCodeGenerated, onModeChange, activeCharacter, onClearCharacter }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [vipModalPlan, setVipModalPlan] = useState<"vip" | "programmer">("vip");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [mode, setMode] = useState<ChatMode>("friend");
  const [usePremium, setUsePremium] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [bubbleStyle, setBubbleStyle] = useState("default");
  const [chatThemeColor, setChatThemeColor] = useState("#8b5cf6");

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const { profile, user } = useAuth();
  const [messageLimit, setMessageLimit] = useState<MessageLimitState | null>(null);

  const config = MODE_CONFIG[mode];
  const ModeIcon = config.icon;
  const activeCharacterAvatar = activeCharacter ? resolveCharacterAvatar(activeCharacter.name, activeCharacter.avatar_url) : null;

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

  // Load bubble style from customization
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("chat_customization")
        .select("bubble_style, theme_color")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setBubbleStyle((data as any).bubble_style || "default");
        setChatThemeColor(data.theme_color || "#8b5cf6");
      }
    })();
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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

  useEffect(() => {
    if (!activeConversationId) { setMessages([]); return; }
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
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
  const [updatePickerSites, setUpdatePickerSites] = useState<Array<{ id: string; name: string; url: string }>>([]);
  const [loadingUpdatePicker, setLoadingUpdatePicker] = useState(false);

  const extractHtmlFromMessage = (content: string): string | null => {
    const htmlMatch = content.match(/```html\n([\s\S]*?)```/);
    if (htmlMatch) return htmlMatch[1];
    if (content.trim().startsWith("<!DOCTYPE") || content.trim().startsWith("<html")) return content;
    return null;
  };

  const handleDeploySite = async (content: string, msgIndex: number, existingSiteName?: string) => {
    // Publishing requires a hosting plan
    if (!profile?.hosting_tier || profile.hosting_tier === "none") {
      toast.error("Você precisa de um plano de Hosting para publicar sites", {
        description: "Ative uma chave de hosting para desbloquear a publicação.",
      });
      return;
    }

    const html = extractHtmlFromMessage(content);
    if (!html) {
      toast.error("Nenhum código HTML encontrado nesta mensagem");
      return;
    }

    setDeployingMsg(msgIndex);
    setShowUpdatePicker(null);
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
        body: JSON.stringify({
          html,
          siteName: existingSiteName || `snyx-${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Erro ao publicar site na Vercel");
        return;
      }

      setDeployedUrls(prev => ({ ...prev, [msgIndex]: data.url }));
      toast.success(existingSiteName ? `Site "${existingSiteName}" atualizado!` : "Site publicado na Vercel com sucesso!");
    } catch (err) {
      console.error("Deploy error:", err);
      toast.error("Erro ao publicar site na Vercel");
    } finally {
      setDeployingMsg(null);
    }
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
    
    // Music mode requires VIP or DEV
    if (mode === "music" && !profile?.is_vip && !profile?.is_dev) {
      setVipModalPlan("vip");
      setShowVipModal(true);
      return;
    }
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

    // Premium features in friend mode require VIP
    if (mode === "friend" && usePremium && !profile?.is_vip) {
      setVipModalPlan("vip");
      setShowVipModal(true);
      return;
    }

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
      setActiveConversationId(convId);
    }

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

    await saveMessage(convId, "user", storedContent);

    if (messages.length === 0) {
      updateConversationTitle(
        convId,
        trimmedInput || (attachment?.kind === "image" ? `Imagem: ${attachment.name}` : attachment?.name || "Nova conversa")
      );
    }

    // Route to appropriate edge function
    let chatUrl: string;
    if (mode === "music") {
      chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-music`;
    } else if (pendingAction === "imagegen") {
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
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Cycle thinking text
      const thinkingInterval = setInterval(() => {
        setThinkingText(prev => {
          if (mode === "music") {
            if (prev === "Pensando...") return "Compondo...";
            if (prev === "Compondo...") return "Criando melodia...";
            return "Pensando...";
          }
          if (prev === "Pensando...") return "Analisando...";
          if (prev === "Analisando...") return "Elaborando resposta...";
          return "Pensando...";
        });
      }, 2500);

      // Build request body based on mode/action
      let requestBody: any;
      if (mode === "music") {
        requestBody = { prompt: trimmedInput, duration: 30 };
      } else if (pendingAction === "imagegen") {
        requestBody = { prompt: trimmedInput };
      } else if (pendingAction === "school") {
        requestBody = {
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content,
            ...(m.attachment?.kind === "image" ? { imageData: m.attachment.dataUrl } : {}),
          })),
        };
      } else {
        requestBody = {
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content,
            ...(m.attachment?.kind === "image" ? { imageData: m.attachment.dataUrl } : {}),
          })),
          mode: usePremium ? "premium" : mode,
          is_vip: !!profile?.is_vip,
          is_admin: !!profile?.is_dev,
          display_name: profile?.display_name || "",
          team_badge: (profile as any)?.team_badge || null,
          ...(activeCharacter ? { character_system_prompt: activeCharacter.system_prompt } : {}),
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
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${errorMsg}` }]);
        setIsLoading(false);
        setThinkingText("");
        return;
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        // Handle rate limit
        if (data.error === "rate_limit") {
          setMessages((prev) => [...prev, { role: "assistant", content: `⏳ ${data.message || "Serviço de IA sobrecarregado. Tente novamente em alguns minutos."}` }]);
          setIsLoading(false);
          setThinkingText("");
          return;
        }
        if (data.success && data.audioContent) {
          const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
          const musicContent = `🎵 **Música gerada!**\n\n_"${data.prompt || trimmedInput}"_\n\n<audio:${audioUrl}>`;
          setMessages((prev) => [...prev, { role: "assistant", content: musicContent }]);
          await saveMessage(convId, "assistant", `🎵 Música gerada: "${data.prompt || trimmedInput}"`);
        } else if (data.type === "image" && data.image_url) {
          const imageContent = `🎨 Imagem gerada!\n\n![Imagem gerada](${data.image_url})`;
          setMessages((prev) => [...prev, { role: "assistant", content: imageContent }]);
          await saveMessage(convId, "assistant", imageContent);
        } else {
          const textContent = data.text || data.error || "Resposta recebida.";
          setMessages((prev) => [...prev, { role: "assistant", content: textContent }]);
          await saveMessage(convId, "assistant", textContent);
        }
        // increment already done before sending
      } else {
        if (!res.body) throw new Error("Sem corpo de resposta");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let assistantSoFar = "";

        const upsertAssistant = (chunk: string) => {
          assistantSoFar += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
            }
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
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

        if (assistantSoFar) {
          await saveMessage(convId, "assistant", assistantSoFar);
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
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Erro ao contactar a IA. Tente novamente." }]);
      // Re-check limit on error to restore accurate state
      void checkMessageLimit();
    } finally {
      setIsLoading(false);
      setThinkingText("");
    }
  };

  const switchMode = (newMode: ChatMode) => {
    setMode(newMode);
    onModeChange?.(newMode);
    setUsePremium(false);
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
    <div className="flex h-full bg-background/50 text-foreground relative">
      {/* Sidebar overlay for mobile */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 sm:hidden" 
          onClick={() => setShowSidebar(false)} 
        />
      )}
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-64 fixed sm:relative inset-y-0 left-0 z-40 sm:z-auto' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-border/10 flex flex-col shrink-0 bg-background sm:bg-transparent`}>
        <div className="p-3 border-b border-border/10">
          <button
            onClick={() => { setActiveConversationId(null); setMessages([]); setAttachment(null); setShowSidebar(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground/70 hover:text-foreground glass-input border hover:border-primary/15 transition-all duration-300 group"
          >
            <Plus size={16} className="text-muted-foreground/40 group-hover:text-primary transition-colors duration-300" />
            Nova conversa
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-thin">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground/30 text-center py-8">Nenhuma conversa</p>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer rounded-xl transition-all duration-200 group ${
                  conv.id === activeConversationId
                    ? "bg-muted/40 text-foreground font-medium border border-border/20"
                    : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                }`}
                onClick={() => { setActiveConversationId(conv.id); setAttachment(null); setShowSidebar(false); }}
              >
                <MessageCircle size={14} className="shrink-0 opacity-40" />
                <span className="truncate flex-1 text-[13px]">{conv.title}</span>
                {(conv.mode === "premium") && (
                  <Crown size={10} className="text-yellow-400 shrink-0" />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar with mode tabs */}
        <div className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 border-b border-border/8 shrink-0 glass">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-1.5 sm:p-2 md:p-2 rounded-lg sm:rounded-xl text-muted-foreground/50 hover:text-foreground hover:bg-muted/15 active:bg-muted/25 transition-all duration-300 shrink-0"
          >
            {showSidebar ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>

          <div className="flex items-center gap-0.5 bg-muted/8 rounded-xl p-0.5 border border-border/6 overflow-x-auto scrollbar-hide flex-shrink min-w-0">
            {(Object.keys(MODE_CONFIG) as ChatMode[]).map((m) => {
              const c = MODE_CONFIG[m];
              const Icon = c.icon;
              const isActive = mode === m;
              const isLocked = (m === "programmer" && !profile?.is_dev) || (m === "music" && !profile?.is_vip && !profile?.is_dev);
              return (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 md:px-3 py-1.5 md:py-2 text-[10px] sm:text-[11px] md:text-xs font-medium rounded-md sm:rounded-lg transition-all duration-300 whitespace-nowrap active:scale-95 ${
                    isActive ? `${c.activeTab} shadow-sm border border-transparent` : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20"
                  }`}
                >
                  <Icon size={12} className="sm:hidden" />
                  <Icon size={14} className="hidden sm:block" />
                  <span>{c.label}</span>
                  {isLocked && <span className="text-[8px] opacity-50">🔒</span>}
                </button>
              );
            })}

            {/* Premium toggle in friend mode */}
            {mode === "friend" && (
              <button
                onClick={() => {
                  if (!profile?.is_vip) {
                    setVipModalPlan("vip");
                    setShowVipModal(true);
                    return;
                  }
                  setUsePremium(!usePremium);
                }}
                className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 md:py-2 text-[10px] sm:text-xs font-medium rounded-md sm:rounded-lg transition-all duration-300 whitespace-nowrap ${
                  usePremium
                    ? "bg-yellow-500/10 text-yellow-400 shadow-sm"
                    : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20"
                }`}
              >
                <Crown size={12} className="sm:hidden" />
                <Crown size={14} className="hidden sm:block" />
                <span className="hidden sm:inline">Premium</span>
                {!profile?.is_vip && <span className="text-[8px] opacity-50">🔒</span>}
              </button>
            )}
          </div>

          {/* Voice Call Button (friend mode) */}
          {mode === "friend" && (
            <button
              onClick={() => setShowVoiceCall(true)}
              className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-muted-foreground/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-300"
              title="Ligar para a IA"
            >
              <Phone size={14} className="sm:hidden" />
              <Phone size={15} className="hidden sm:block" />
            </button>
          )}

          {mode === "friend" && (
            <button
              onClick={() => setShowConnectionModal(true)}
              className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-muted-foreground/40 hover:text-purple-400 hover:bg-purple-500/10 transition-all duration-300"
              title="Conectar com alguém"
            >
              <Link2 size={14} className="sm:hidden" />
              <Link2 size={15} className="hidden sm:block" />
            </button>
          )}

          {/* Chat Settings Button */}
          <button
            onClick={() => setShowChatSettings(true)}
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all duration-300"
            title="Personalizar chat"
          >
            <Palette size={14} className="sm:hidden" />
            <Palette size={15} className="hidden sm:block" />
          </button>

          {mode === "programmer" && profile?.is_dev && (
            <button
              onClick={() => { setShowDeleteSitesModal(true); loadVercelSites(); }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-medium bg-muted/15 text-muted-foreground/60 hover:text-foreground hover:bg-muted/30 border border-border/15 transition-all duration-300"
              title="Gerenciar sites publicados"
            >
              <Settings size={12} className="sm:hidden" />
              <Settings size={14} className="hidden sm:block" />
              <span className="hidden sm:inline">Meus Sites</span>
            </button>
          )}
          {mode === "programmer" && !profile?.is_dev && (
            <span className="text-[10px] font-bold px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-400 border border-cyan-500/20">
              DEV
            </span>
          )}
          {mode === "friend" && !profile?.is_vip && !profile?.is_dev && messageLimit && !messageLimit.is_vip && (
            <div className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-muted/20 border border-border/20 shrink-0" title={`${messageLimit.remaining ?? 0} de 5 mensagens restantes`}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full transition-all duration-500 ${
                    i < (messageLimit.remaining ?? 0) ? "bg-primary shadow-sm shadow-primary/40 scale-110" : "bg-muted-foreground/15"
                  }`}
                />
              ))}
              <span className="text-[8px] sm:text-[10px] font-medium text-muted-foreground/60 ml-0.5 tabular-nums">
                {messageLimit.remaining ?? 0}/5
              </span>
            </div>
          )}
        </div>

        {/* Character banner */}
        {activeCharacter && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border/10 bg-primary/5 shrink-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-primary/20 bg-muted/10 shrink-0">
              {activeCharacterAvatar ? (
                <img src={activeCharacterAvatar} alt="" className="w-full h-full object-cover" loading="lazy" width={1024} height={1024} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">{activeCharacter.name[0]}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-foreground">{activeCharacter.name}</span>
              <span className="text-[10px] text-muted-foreground/50 ml-2">Personagem RPG</span>
            </div>
            <button onClick={onClearCharacter} className="text-[10px] px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/15 transition-all">
              ✕ Sair
            </button>
          </div>
        )}

        {mode === "music" ? (
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <div>
              <Music size={48} className="text-orange-400 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">A aba Música abre o Musicful AI em tela cheia.</p>
            </div>
          </div>
        ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {messages.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full px-5 sm:px-8 ${mode === "programmer" ? "py-4 sm:py-6" : "py-8 sm:py-12"}`}>
              <div className={`${mode === "programmer" ? "max-w-sm" : "max-w-md lg:max-w-lg"} text-center space-y-3 sm:space-y-4 ${mode !== "programmer" ? "md:space-y-6 lg:space-y-8" : ""}`}>
                {/* Icon with glow */}
                <div className="relative mx-auto w-fit animate-reveal stagger-1">
                  <div className={`${mode === "programmer" ? "w-12 h-12 sm:w-14 sm:h-14 rounded-xl" : "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-2xl md:rounded-3xl"} flex items-center justify-center mx-auto ${config.bgColor} border ${config.borderColor} shadow-2xl animate-float`}>
                    {mode === "programmer" ? (
                      <ModeIcon size={20} className={config.color} />
                    ) : (
                      <>
                        <ModeIcon size={24} className={`${config.color} sm:hidden`} />
                        <ModeIcon size={32} className={`${config.color} hidden sm:block md:hidden`} />
                        <ModeIcon size={40} className={`${config.color} hidden md:block lg:hidden`} />
                        <ModeIcon size={48} className={`${config.color} hidden lg:block`} />
                      </>
                    )}
                  </div>
                  <div className={`absolute -inset-4 sm:-inset-6 ${mode !== "programmer" ? "md:-inset-8" : ""} ${config.bgColor} rounded-full blur-3xl opacity-20 -z-10 animate-pulse-ring`} />
                </div>

                {/* Title */}
                <div className={`${mode === "programmer" ? "space-y-1" : "space-y-2 sm:space-y-3"} animate-reveal stagger-2`}>
                  <h2 className={`${mode === "programmer" ? "text-base sm:text-lg" : "text-lg sm:text-xl md:text-2xl lg:text-3xl"} font-black text-foreground tracking-tight`}>{config.emptyTitle}</h2>
                  <p className={`${mode === "programmer" ? "text-[11px] sm:text-xs" : "text-xs sm:text-sm md:text-base"} text-muted-foreground/50 leading-relaxed max-w-sm mx-auto`}>{config.emptyText}</p>
                </div>

                {/* Suggestions */}
                {mode === "programmer" && (
                  <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 animate-reveal stagger-3">
                    {["Landing Page", "Portfolio", "Loja Online", "Dashboard"].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(`Crie um site de ${suggestion.toLowerCase()} completo`)}
                        className="text-[10px] sm:text-[11px] px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg glass-subtle text-muted-foreground/60 border border-border/10 hover:bg-muted/25 hover:text-foreground hover:border-border/25 hover:shadow-xl active:scale-[0.97] transition-all duration-300"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                {mode === "friend" && (
                  <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5 animate-reveal stagger-3">
                    {["Me dá um conselho", "Preciso desabafar", "Me conte algo legal", "Me ajuda com algo"].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="text-[11px] sm:text-xs md:text-sm px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-xl glass-subtle text-muted-foreground/60 border border-border/10 hover:bg-muted/25 hover:text-foreground hover:border-border/25 hover:shadow-xl active:scale-[0.97] transition-all duration-300"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {/* Keyboard hint */}
                <p className={`hidden md:block ${mode === "programmer" ? "text-[9px]" : "text-[10px] lg:text-[11px]"} text-muted-foreground/20 animate-reveal stagger-4`}>
                  Pressione <kbd className="px-1.5 py-0.5 rounded-md bg-muted/15 border border-border/10 text-muted-foreground/35 font-mono text-[9px]">Enter</kbd> para enviar
                </p>
              </div>
            </div>
          ) : (
            <div className={`${mode === "programmer" ? "max-w-2xl" : "max-w-3xl lg:max-w-4xl"} mx-auto px-3 sm:px-4 md:px-6 ${mode === "programmer" ? "py-3 sm:py-4 space-y-3 sm:space-y-4" : "py-4 sm:py-6 space-y-4 sm:space-y-5 md:space-y-6"}`}>
              {messages.map((msg, i) => (
                <div key={i} className="group animate-in fade-in-0 slide-in-from-bottom-3 duration-400">
                  {msg.role === "user" ? (
                    <div className="flex gap-3 justify-end">
                      <div className="max-w-[85%] md:max-w-[80%]">
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
                      </div>
                      <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg sm:rounded-xl bg-primary/12 flex items-center justify-center shrink-0 mt-1 border border-primary/8">
                        <User size={12} className="text-primary md:hidden" />
                        <User size={14} className="text-primary hidden md:block" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 mt-1 ${config.bgColor} border ${config.borderColor} shadow-sm`}>
                        <Bot size={12} className={`${config.color} sm:hidden`} /><Bot size={13} className={`${config.color} hidden sm:block md:hidden`} /><Bot size={14} className={`${config.color} hidden md:block`} />
                      </div>
                      <div className={`flex-1 min-w-0 chat-bubble-ai ${getBubbleClass(bubbleStyle, chatThemeColor)} px-3 py-2`}>
                        <div className="text-sm leading-relaxed text-foreground/90 prose prose-invert prose-sm max-w-none">
                          {/* Check for audio content (music mode) */}
                          {msg.content.includes("<audio:") ? (
                            <>
                              <ReactMarkdown>
                                {msg.content.replace(/<audio:[^>]+>/g, "")}
                              </ReactMarkdown>
                              {(() => {
                                const audioMatch = msg.content.match(/<audio:([^>]+)>/);
                                if (!audioMatch) return null;
                                const audioSrc = audioMatch[1];
                                return (
                                  <div className="mt-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                                        <Music size={18} className="text-orange-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <audio controls className="w-full" style={{ height: 36 }}>
                                          <source src={audioSrc} type="audio/mpeg" />
                                        </audio>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                      <a
                                        href={audioSrc}
                                        download="snyx-music.mp3"
                                        className="flex items-center gap-1.5 text-xs text-orange-400/70 hover:text-orange-400 transition-colors"
                                      >
                                        <Download size={12} /> Baixar MP3
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
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 animate-slide-up-fade">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${config.bgColor} border ${config.borderColor}`}>
                    <Bot size={14} className={config.color} />
                  </div>
                  <div className="flex items-center gap-2 py-3">
                    {thinkingText && (
                      <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-input border border-border/10">
                        <Brain size={14} className={`${config.color} animate-pulse`} />
                        <span className="text-xs text-muted-foreground/60 animate-pulse">{thinkingText}</span>
                      </div>
                    )}
                    {!thinkingText && (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-dot-pulse" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-dot-pulse" style={{ animationDelay: '200ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-dot-pulse" style={{ animationDelay: '400ms' }} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Attachment preview */}
        {mode !== "music" && attachment && (
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

        {/* Input area */}
        {mode !== "music" && (
        <div className={`${mode === "programmer" ? "p-1.5 sm:p-2" : "p-2 sm:p-3 md:p-4"} safe-bottom`}>
          <div className={`${mode === "programmer" ? "max-w-2xl" : "max-w-3xl lg:max-w-4xl"} mx-auto`}>
            <div className={`flex items-end gap-1 sm:gap-1.5 glass-elevated ${mode === "programmer" ? "rounded-xl px-2 py-1.5 sm:py-2" : "rounded-2xl px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3"} border border-border/6 focus-within:border-primary/15 focus-within:shadow-2xl focus-within:shadow-primary/5 transition-all duration-500`}>
              <input type="file" accept={acceptedFileTypes} ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              {/* School photo button - hidden on mobile */}
              <button
                onClick={() => { setPendingAction("school"); fileInputRef.current?.click(); }}
                className={`p-2 rounded-xl transition-all duration-300 shrink-0 mb-0.5 hidden sm:block ${
                  pendingAction === "school" 
                    ? "text-green-400 bg-green-500/10" 
                    : "text-muted-foreground/30 hover:text-green-400 hover:bg-green-500/10"
                }`}
                title="📚 Foto do exercício (Escola IA)"
              >
                <Camera size={18} />
              </button>
              {/* Image generation button - hidden on mobile */}
              <button
                onClick={() => {
                  setPendingAction(prev => prev === "imagegen" ? null : "imagegen");
                }}
                className={`p-2 rounded-xl transition-all duration-300 shrink-0 mb-0.5 hidden sm:block ${
                  pendingAction === "imagegen"
                    ? "text-purple-400 bg-purple-500/10"
                    : "text-muted-foreground/30 hover:text-purple-400 hover:bg-purple-500/10"
                }`}
                title="🎨 Criar imagem com IA"
              >
                <ImagePlus size={18} />
              </button>
              {/* Rewrite button - hidden on mobile */}
              <button
                onClick={() => {
                  setPendingAction(prev => prev === "rewrite" ? null : "rewrite");
                }}
                className={`p-2 rounded-xl transition-all duration-300 shrink-0 mb-0.5 hidden sm:block ${
                  pendingAction === "rewrite"
                    ? "text-sky-400 bg-sky-500/10"
                    : "text-muted-foreground/30 hover:text-sky-400 hover:bg-sky-500/10"
                }`}
                title="✍️ Reescrever texto"
              >
                <PenLine size={18} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-muted-foreground/30 hover:text-foreground/70 hover:bg-muted/10 transition-all duration-300 shrink-0 mb-0.5"
              >
                <Paperclip size={16} className="sm:hidden" />
                <Paperclip size={18} className="hidden sm:block" />
              </button>
              <button
                onClick={toggleRecording}
                className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all duration-300 shrink-0 mb-0.5 ${
                  isRecording
                    ? "bg-destructive/10 text-destructive animate-pulse"
                    : "text-muted-foreground/30 hover:text-foreground/70 hover:bg-muted/10"
                }`}
                title={isRecording ? "Parar gravação" : "Gravar áudio"}
              >
                {isRecording ? <MicOff size={16} className="sm:hidden" /> : <Mic size={16} className="sm:hidden" />}
                {isRecording ? <MicOff size={18} className="hidden sm:block" /> : <Mic size={18} className="hidden sm:block" />}
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={inputPlaceholder}
                rows={1}
                className="flex-1 min-w-0 bg-transparent py-1.5 sm:py-2 text-[12px] sm:text-[13px] md:text-sm outline-none placeholder:text-muted-foreground/20 resize-none max-h-[200px] leading-relaxed"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !attachment)}
                className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-300 shrink-0 mb-0.5 ${
                  input.trim() || attachment
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/35 hover:scale-105 btn-glow'
                    : 'bg-muted/10 text-muted-foreground/15'
                } disabled:opacity-40 disabled:hover:scale-100`}
              >
                <Send size={14} className="sm:hidden" />
                <Send size={16} className="hidden sm:block" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground/15 text-center mt-1.5 sm:mt-2 hidden sm:block">
              SnyX pode cometer erros. Verifique informações importantes.
            </p>
          </div>
        </div>
        )}
      </div>

      <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} highlightPlan={vipModalPlan} />
      <ChatSettings open={showChatSettings} onClose={() => setShowChatSettings(false)} />
      <VoiceCall open={showVoiceCall} onClose={() => setShowVoiceCall(false)} />
      <ConnectionModal isOpen={showConnectionModal} onClose={() => setShowConnectionModal(false)} />

      {/* Limit modal */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
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
