import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { AdminPresenceIndicator, useAdminHeartbeat } from "@/components/AdminPresence";
import {
  ShieldCheck, Code, User, Menu, Crown, MessageSquare, Sparkles, X, Loader2, Heart, History, Code2, Palette, LogOut, Flame, PenLine, PanelLeft, Phone, Drama,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type ChatChoice } from "@/components/ChatSelector";
import { HistoryPanel } from "@/components/HistoryPanel";
import { AuroraBackground } from "@/components/AuroraBackground";
import { SideRail, type RailItem } from "@/components/SideRail";
import { ChatPanel } from "@/components/ChatPanel";
import { SidebarConversations } from "@/components/SidebarConversations";
import { VipModal } from "@/components/VipModal";

const CodeEditor = lazy(() => import("@/components/CodeEditor").then(m => ({ default: m.CodeEditor })));
const UserProfile = lazy(() => import("@/components/UserProfile").then(m => ({ default: m.UserProfile })));
const ThemeSelector = lazy(() => import("@/components/ThemeSelector").then(m => ({ default: m.ThemeSelector })));

const PanelLoader = () => (
  <div className="flex items-center justify-center h-full">
    <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
  </div>
);

const Index = () => {
  const [code, setCode] = useState("");
  const { profile, user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [chatMode, setChatMode] = useState<"friend" | "vip" | "programmer" | "writer">("friend");
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pickedConvId, setPickedConvId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [chatNonce, setChatNonce] = useState(0);

  const [showModePicker, setShowModePicker] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  // Listen for global Command Palette events
  useEffect(() => {
    const onNewChat = () => {
      setPickedConvId(null);
      // Force ChatPanel remount to clear current conversation state
      setChatNonce((n) => n + 1);
    };
    const onToggleHistory = () => setHistoryOpen((v) => !v);
    const onOpenTheme = () => setShowThemeModal(true);
    const onOpenProfile = () => setShowProfile(true);

    window.addEventListener("snyx:new-chat", onNewChat);
    window.addEventListener("snyx:toggle-history", onToggleHistory);
    window.addEventListener("snyx:open-theme", onOpenTheme);
    window.addEventListener("snyx:open-profile", onOpenProfile);
    return () => {
      window.removeEventListener("snyx:new-chat", onNewChat);
      window.removeEventListener("snyx:toggle-history", onToggleHistory);
      window.removeEventListener("snyx:open-theme", onOpenTheme);
      window.removeEventListener("snyx:open-profile", onOpenProfile);
    };
  }, []);

  useAdminHeartbeat();

  const isDev = !!profile?.is_dev;
  const isVip = !!(profile?.is_vip || profile?.is_dev);

  const handlePickFromHistory = (choice: ChatChoice, conversationId: string) => {
    if (choice === "programmer" && isDev) setChatMode("programmer");
    else if (choice === "vip" && isVip) setChatMode("vip");
    else setChatMode("friend");
    setPickedConvId(conversationId);
  };

  // Chat Amigo unificado: VIP usa modo "vip", demais usam "friend"
  const switchToFriend = useCallback(() => {
    setChatMode(isVip ? "vip" : "friend");
    setPickedConvId(null);
    setShowModePicker(false);
  }, [isVip]);

  const switchToVip = useCallback(() => {
    if (!isVip) {
      setShowVipModal(true);
      return;
    }
    setChatMode("vip");
    setPickedConvId(null);
    setShowModePicker(false);
  }, [isVip]);

  // Para o botão dentro do chat amigo (não-VIP abre modal de upgrade)
  const handleUpgradeToVip = useCallback(() => {
    if (isVip) {
      setChatMode("vip");
    } else {
      setShowVipModal(true);
    }
  }, [isVip]);

  const switchToProgrammer = useCallback(() => {
    if (!isDev) return;
    setChatMode("programmer");
    setPickedConvId(null);
    setShowModePicker(false);
  }, [isDev]);

  const switchToWriter = useCallback(() => {
    setChatMode("writer");
    setPickedConvId(null);
    setShowModePicker(false);
  }, []);

  const handleUserInput = useCallback((text: string) => {
    const t = text.toLowerCase();
    if (/(quero|usar|abrir|trocar|mudar).*\bmodo\b/.test(t) || /\bmodo\s+(amigo|vip|programador)\b/.test(t)) {
      setShowModePicker(true);
    }
  }, []);

  // === Sidebar items — organizados por seções ===
  const railTopItems: RailItem[] = [
    // Conversa
    { icon: History, label: "Histórico", onClick: () => setHistoryOpen((v) => !v), active: historyOpen, sectionLabel: "Conversa", iconColor: "text-violet-400" },
    { icon: Heart, label: "Chat Amigo", onClick: switchToFriend, active: chatMode === "friend" || chatMode === "vip", iconColor: "text-pink-400" },
    { icon: PenLine, label: "Escola", onClick: switchToWriter, active: chatMode === "writer", iconColor: "text-sky-400" },

    // Ferramentas
    { icon: Drama, label: "RPG", to: "/rpg", sectionLabel: "Ferramentas", iconColor: "text-fuchsia-400" },
    { icon: Code, label: "Programador IA", to: "/programador", iconColor: "text-cyan-400" },
    { icon: Phone, label: "Atendimento", to: "/atendimento", iconColor: "text-emerald-400" },

    // Admin (só pra admin)
    ...(isAdmin
      ? ([
          { icon: ShieldCheck, label: "Admin", to: "/admin", sectionLabel: "Administração", iconColor: "text-red-400" },
          { icon: Code2, label: "API para devs", to: "/api", iconColor: "text-orange-400" },
          { icon: Crown, label: "Dono", to: "/dono", iconColor: "text-amber-400" },
        ] as RailItem[])
      : [
          { icon: Code2, label: "API para devs", to: "/api", sectionLabel: "Mais", iconColor: "text-orange-400" },
        ] as RailItem[]),
  ];

  const railBottomItems: RailItem[] = [];

  const railLogo = (
    <Link
      to="/"
      className="group relative w-8 h-8 flex items-center justify-center"
      title="SnyX"
    >
      <Flame
        className="w-[18px] h-[18px] text-foreground/85"
        strokeWidth={1.6}
      />
    </Link>
  );

  // Footer: avatar minúsculo, sem badges (estilo SKYNETchat)
  const railFooterExtra = (
    <button
      onClick={() => setShowProfile(true)}
      className="relative w-7 h-7 rounded-full overflow-hidden border border-border/40 hover:border-primary/50 transition-all flex items-center justify-center bg-muted/30 hover:bg-muted/60"
      title="Minha conta"
      aria-label="Minha conta"
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <User className="w-3.5 h-3.5 text-muted-foreground/70" />
      )}
    </button>
  );

  


  const modeOptions = [
    {
      key: "friend" as const,
      title: "Chat Amigo",
      desc: "Conversa sobre tudo, dá conselhos e te ouve. Como um amigo de verdade.",
      icon: Heart,
      color: "text-pink-300",
      bg: "bg-pink-500/10",
      border: "border-pink-500/25",
      onClick: switchToFriend,
      active: chatMode === "friend",
      visible: true,
    },
    {
      key: "vip" as const,
      title: isVip ? "Chat VIP" : "Chat VIP",
      desc: isVip
        ? "Premium ativo. Respostas mais fortes, contexto especial e modo VIP real."
        : "Desbloqueie o modo VIP com respostas premium e acesso especial.",
      icon: Crown,
      color: "text-amber-300",
      bg: "bg-amber-500/10",
      border: "border-amber-400/25",
      onClick: switchToVip,
      active: chatMode === "vip",
      visible: true,
    },
    {
      key: "programmer" as const,
      title: "Modo Programador",
      desc: "Editor de código + IA pra criar sites, apps e snippets completos.",
      icon: Code,
      color: "text-cyan-300",
      bg: "bg-cyan-500/10",
      border: "border-cyan-400/25",
      onClick: switchToProgrammer,
      active: chatMode === "programmer",
      visible: isDev,
    },
  ].filter((m) => m.visible);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-[100dvh] flex bg-background overflow-hidden relative">
        <AuroraBackground intensity="full" />

        {/* Sidebar lateral — com lista de conversas estilo ChatGPT */}
        <SideRail
          logo={railLogo}
          brandName="SnyX"
          topItems={railTopItems}
          bottomItems={railBottomItems}
          footerExtra={railFooterExtra}
          collapsed={railCollapsed}
        >
          <SidebarConversations
            activeConversationId={pickedConvId}
            onPickConversation={handlePickFromHistory}
            onNewChat={() => {
              setPickedConvId(null);
              window.dispatchEvent(new CustomEvent("snyx:new-chat"));
            }}
          />
        </SideRail>

        {/* Toggleable history panel */}
        <HistoryPanel
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          activeConversationId={pickedConvId}
          onPickConversation={(choice, id) => {
            handlePickFromHistory(choice, id);
            setHistoryOpen(false);
          }}
          onNewChat={(choice) => {
            if (choice === "programmer" && isDev) setChatMode("programmer");
            else if (choice === "vip" && isVip) setChatMode("vip");
            else setChatMode("friend");
            setPickedConvId(null);
            setHistoryOpen(false);
          }}
        />

        {/* === MAIN === */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          {/* (header central removido) */}

          {/* Toggle pra mostrar/esconder a barra lateral (fora da sidebar, no topo da \u00e1rea principal) */}
          <button
            onClick={() => setRailCollapsed((v) => !v)}
            style={{ left: railCollapsed ? "0.75rem" : "calc(260px + 0.75rem)" }}
            className="fixed top-3 z-[60] w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-card/60 transition-[left,colors] duration-300 ease-out active:scale-95"
            aria-label={railCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
            title={railCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
          >
            <PanelLeft className="w-[18px] h-[18px]" strokeWidth={1.85} />
          </button>

          {/* Top-right tiny cluster: paleta + nova conversa */}
          <div className="hidden md:flex fixed top-3 right-4 z-30 items-center gap-3">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("snyx:open-palette"))}
              className="w-7 h-7 flex items-center justify-center text-primary/80 hover:text-primary transition-colors"
              aria-label="Paleta de comandos"
              title="Comandos (Ctrl+K)"
            >
              <Sparkles className="w-[17px] h-[17px]" strokeWidth={1.85} />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("snyx:new-chat"))}
              className="w-7 h-7 flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors"
              aria-label="Nova conversa"
              title="Nova conversa (Ctrl+N)"
            >
              <MessageSquare className="w-[17px] h-[17px]" strokeWidth={1.85} />
            </button>
          </div>

          {/* (botão mobile antigo removido — agora o toggle PanelLeft cuida disso) */}

          {/* Content — chat opens DIRECTLY, no header */}
          <div className="flex-1 flex overflow-hidden">
            <div className={`w-full flex flex-col ${chatMode === "programmer" ? "md:w-[480px] md:min-w-[380px] md:shrink-0 md:border-r md:border-border/20" : ""}`}>
              <div className="flex-1 min-h-0">
                <Suspense fallback={<PanelLoader />}>
                  <ChatPanel
                    key={`${chatMode}-${chatNonce}`}
                    onCodeGenerated={setCode}
                    onModeChange={(m) => setChatMode(m as "friend" | "vip" | "programmer" | "writer")}
                    initialConversationId={pickedConvId}
                    forceMode={chatMode}
                    onUserInput={handleUserInput}
                    onUpgradeToVip={handleUpgradeToVip}
                    isVipUser={isVip}
                  />
                </Suspense>
              </div>
            </div>
            {chatMode === "programmer" && (
              <div className="hidden md:block flex-1 min-w-0">
                <Suspense fallback={<PanelLoader />}>
                  <CodeEditor code={code} onCodeChange={setCode} />
                </Suspense>
              </div>
            )}
          </div>
        </div>

        {/* === MODE PICKER OVERLAY === */}
        {showModePicker && (
          <>
            <div
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setShowModePicker(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-border/30 bg-popover/95 backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),0_0_40px_-10px_hsl(var(--primary)/0.3)] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                <div className="px-5 py-4 border-b border-border/20 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">
                      Escolha o modo
                    </p>
                    <p className="text-[13px] font-bold text-foreground mt-0.5">Como vai ser a conversa?</p>
                  </div>
                  <button
                    onClick={() => setShowModePicker(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-2.5 space-y-1.5">
                  {modeOptions.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.key}
                        onClick={opt.onClick}
                        className={`group/m w-full flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all duration-200 text-left ${
                          opt.active
                            ? "bg-primary/8 border-primary/25 shadow-[inset_0_0_24px_-10px_hsl(var(--primary)/0.4)]"
                            : "border-border/20 hover:border-primary/30 hover:bg-foreground/[0.03] hover:translate-x-0.5"
                        }`}
                      >
                        <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border ${opt.bg} ${opt.border}`}>
                          <Icon className={`w-[18px] h-[18px] ${opt.color}`} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[14px] font-bold tracking-tight text-foreground">{opt.title}</h3>
                            {opt.active && <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25">Ativo</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground/70 leading-snug mt-1">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* === MOBILE DRAWER === */}
        {mobileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border flex flex-col md:hidden animate-in slide-in-from-left duration-200">
              <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border/60">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold tracking-tight">SnyX</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-3 py-2 border-b border-sidebar-border/40 flex justify-center">
                <AdminPresenceIndicator />
              </div>

              <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                <button
                  onClick={() => { setHistoryOpen(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted/30"
                >
                  <History className="w-4 h-4" /><span>Histórico</span>
                </button>

                <button
                  onClick={() => { switchToFriend(); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${chatMode === "friend" ? "bg-primary/10 text-primary" : "hover:bg-muted/30"}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat Amigo</span>
                </button>
                <button
                  onClick={() => { switchToVip(); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${chatMode === "vip" ? "bg-primary/10 text-primary" : "hover:bg-muted/30"}`}
                >
                  <Crown className="w-4 h-4" />
                  <span>{isVip ? "Chat VIP" : "Chat VIP 🔒"}</span>
                </button>
                {isDev && (
                  <button
                    onClick={() => { switchToProgrammer(); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${chatMode === "programmer" ? "bg-primary/10 text-primary" : "hover:bg-muted/30"}`}
                  >
                    <Code className="w-4 h-4" />
                    <span>Programador</span>
                  </button>
                )}

                <Link
                  to="/api"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-primary hover:bg-primary/10"
                >
                  <Code2 className="w-4 h-4" />
                  <span>API para devs</span>
                </Link>

                {isAdmin && (
                  <>
                    <div className="px-3 pt-3 pb-1">
                      <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">Equipe</span>
                    </div>
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted/30">
                      <ShieldCheck className="w-4 h-4" /><span>Admin</span>
                    </Link>
                    <Link to="/dono" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-amber-400 hover:bg-amber-500/10">
                      <Crown className="w-4 h-4" /><span>Dono</span>
                    </Link>
                  </>
                )}
              </nav>

              <div className="p-2 border-t border-sidebar-border/60 space-y-0.5">
                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
                  {profile?.is_vip || profile?.is_dev ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/25 to-amber-500/20 text-amber-300 border border-amber-400/40">
                      <Crown size={9} className="fill-amber-300" /> VIP
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground border border-border/40">FREE</span>
                  )}
                  {profile?.is_dev && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      <Code size={9} /> DEV
                    </span>
                  )}
                  {(profile?.team_badge === "Dono" || profile?.team_badge === "Dona") && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/30 to-amber-500/20 text-amber-300 border border-amber-400/30">
                      👑 {profile.team_badge}
                    </span>
                  )}
                </div>
                <button onClick={() => { setShowProfile(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted/30">
                  <User className="w-4 h-4" /><span>Minha conta</span>
                </button>
                <button onClick={() => { setShowThemeModal(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted/30">
                  <Palette className="w-4 h-4" /><span>Tema</span>
                </button>
                <button onClick={() => { signOut(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10">
                  <LogOut className="w-4 h-4" /><span>Sair</span>
                </button>
              </div>
            </div>
          </>
        )}

        <Suspense fallback={null}>
          <UserProfile open={showProfile} onClose={() => setShowProfile(false)} />
          <ThemeSelector externalOpen={showThemeModal} onExternalClose={() => setShowThemeModal(false)} hideButton />
        </Suspense>

        <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} highlightPlan="vip" />
      </div>
    </TooltipProvider>
  );
};

export default Index;
