import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { AdminPresenceIndicator, useAdminHeartbeat } from "@/components/AdminPresence";
import {
  LogOut, ShieldCheck, Code, User, Menu, Palette, Crown, MessageSquare, Sparkles, X, Loader2, Heart, History,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type ChatChoice } from "@/components/ChatSelector";
import { HistoryPanel } from "@/components/HistoryPanel";
import { AuroraBackground } from "@/components/AuroraBackground";
import { SideRail, type RailItem } from "@/components/SideRail";

const ChatPanel = lazy(() => import("@/components/ChatPanel").then(m => ({ default: m.ChatPanel })));
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
  const [chatMode, setChatMode] = useState<"friend" | "programmer">("friend");
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pickedConvId, setPickedConvId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Mode picker overlay (triggered by typing "quero usar o modo amigo" etc.)
  const [showModePicker, setShowModePicker] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  useAdminHeartbeat();

  const isDev = !!profile?.is_dev;
  const isVip = !!(profile?.is_vip || profile?.is_dev);

  const handlePickFromHistory = (choice: ChatChoice, conversationId: string) => {
    setChatMode(choice === "programmer" && isDev ? "programmer" : "friend");
    setPickedConvId(conversationId);
  };

  const switchToFriend = useCallback(() => {
    setChatMode("friend");
    setPickedConvId(null);
    setShowModePicker(false);
  }, []);

  const switchToProgrammer = useCallback(() => {
    if (!isDev) return;
    setChatMode("programmer");
    setPickedConvId(null);
    setShowModePicker(false);
  }, [isDev]);

  // Detect "quero usar o modo amigo" / "modo programador" typed in chat input
  const handleUserInput = useCallback((text: string) => {
    const t = text.toLowerCase();
    if (/(quero|usar|abrir|trocar|mudar).*\bmodo\b/.test(t) || /\bmodo\s+(amigo|vip|programador)\b/.test(t)) {
      setShowModePicker(true);
    }
  }, []);

  const railTopItems: RailItem[] = [
    {
      icon: History,
      label: "Histórico",
      onClick: () => setHistoryOpen((v) => !v),
      active: historyOpen,
    },
    {
      icon: isVip ? Crown : MessageSquare,
      label: isVip ? "Chat VIP" : "Chat Amigo",
      onClick: switchToFriend,
      active: chatMode === "friend" && !historyOpen,
    },
    ...(isAdmin
      ? ([
          { icon: ShieldCheck, label: "Admin", to: "/admin" },
          { icon: Crown, label: "Dono", to: "/dono", accent: true },
        ] as RailItem[])
      : []),
  ];

  const railBottomItems: RailItem[] = [
    { icon: Palette, label: "Tema", onClick: () => setShowThemeModal(true) },
    { icon: User, label: "Minha conta", onClick: () => setShowProfile(true) },
    { icon: LogOut, label: "Sair", onClick: signOut, danger: true },
  ];

  const modeOptions = [
    {
      key: "friend" as const,
      title: isVip ? "Chat VIP" : "Chat Amigo",
      desc: isVip
        ? "Premium ativo automaticamente. Memória estendida, respostas mais inteligentes e sem limite."
        : "Conversa sobre tudo, dá conselhos e te ouve. Como um amigo de verdade.",
      icon: isVip ? Crown : Heart,
      color: isVip ? "text-amber-300" : "text-pink-300",
      bg: isVip ? "bg-amber-500/10" : "bg-pink-500/10",
      border: isVip ? "border-amber-400/25" : "border-pink-500/25",
      onClick: switchToFriend,
      active: chatMode === "friend",
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
        <AuroraBackground intensity="subtle" />

        {/* Mini sidebar */}
        <SideRail
          logo={
            <Link
              to="/"
              className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/35 via-primary/15 to-transparent flex items-center justify-center border border-primary/30 shadow-[0_0_18px_-4px_hsl(var(--primary)/0.5)] hover:shadow-[0_0_26px_-2px_hsl(var(--primary)/0.7)] transition-all"
              title="SnyX"
            >
              <Sparkles className="w-4 h-4 text-primary" />
            </Link>
          }
          topItems={railTopItems}
          bottomItems={railBottomItems}
        />

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
            else setChatMode("friend");
            setPickedConvId(null);
            setHistoryOpen(false);
          }}
        />

        {/* === MAIN === */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          {/* Header */}
          <header className="h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 bg-card/40 backdrop-blur-2xl relative after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-primary/25 after:to-transparent">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
              >
                <Menu className="w-4 h-4" />
              </button>
              <AdminPresenceIndicator />
            </div>

            {/* Center: status pill (no dropdown) */}
            <div className="absolute left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/40 bg-card/50">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                </span>
                <span className="text-[12px] font-semibold tracking-tight text-foreground/85">
                  {chatMode === "programmer" ? "Programador" : isVip ? "Chat VIP" : "Chat Amigo"}
                </span>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              {/* Badge VIP — pequenininho, sempre visível pra todos */}
              {profile?.is_vip || profile?.is_dev ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/25 to-amber-500/20 text-amber-300 border border-amber-400/40 shadow-[0_0_12px_-3px_hsl(45_100%_60%/0.5)]">
                  <Crown size={8} className="fill-amber-300" /> VIP
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/8 text-amber-300/60 border border-amber-500/20 hover:bg-amber-500/15 hover:text-amber-300 transition-colors">
                  <Crown size={8} /> VIP
                </span>
              )}

              {profile?.is_dev && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  <Code size={8} /> DEV
                </span>
              )}

              {(profile?.team_badge === "Dono" || profile?.team_badge === "Dona") && (
                <span className="hidden md:inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/30 to-amber-500/20 text-amber-300 border border-amber-400/30 shadow-[0_0_15px_-3px_hsl(45_100%_60%/0.4)]">
                  👑 {profile.team_badge}
                </span>
              )}

              <button
                onClick={() => setShowProfile(true)}
                className="relative w-9 h-9 rounded-2xl overflow-hidden border border-border/30 hover:border-primary/50 transition-all duration-300 flex items-center justify-center bg-card/60 hover:bg-card/80 group hover:shadow-[0_0_22px_-4px_hsl(var(--primary)/0.5)] ml-1"
                title="Minha conta"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                )}
              </button>
            </div>
          </header>

          {/* Content — chat opens DIRECTLY, no selector */}
          <div className="flex-1 flex overflow-hidden">
            <div className={`w-full flex flex-col ${chatMode === "programmer" ? "md:w-[480px] md:min-w-[380px] md:shrink-0 md:border-r md:border-border/20" : ""}`}>
              <div className="flex-1 min-h-0">
                <Suspense fallback={<PanelLoader />}>
                  <ChatPanel
                    key={chatMode}
                    onCodeGenerated={setCode}
                    onModeChange={(m) => setChatMode(m as "friend" | "programmer")}
                    initialConversationId={pickedConvId}
                    forceMode={chatMode}
                    onUserInput={handleUserInput}
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

        {/* === ABA LATERAL FLUTUANTE: PROGRAMADOR (só DEV) === */}
        {isDev && chatMode !== "programmer" && (
          <button
            onClick={switchToProgrammer}
            className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 items-center gap-2 pl-3 pr-2.5 py-3 rounded-l-2xl bg-card/90 backdrop-blur-xl border border-r-0 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/15 hover:border-cyan-400/50 hover:shadow-[0_0_24px_-4px_hsl(190_90%_55%/0.5)] transition-all group"
            title="Abrir Modo Programador"
          >
            <Code className="w-4 h-4 group-hover:scale-110 transition-transform" strokeWidth={2.2} />
            <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-black uppercase tracking-[0.2em]">
              Programador
            </span>
          </button>
        )}

        {/* Botão pra VOLTAR pro Chat Amigo quando está no Programador */}
        {isDev && chatMode === "programmer" && (
          <button
            onClick={switchToFriend}
            className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 items-center gap-2 pl-3 pr-2.5 py-3 rounded-l-2xl bg-card/90 backdrop-blur-xl border border-r-0 border-pink-500/30 text-pink-300 hover:bg-pink-500/15 hover:border-pink-400/50 hover:shadow-[0_0_24px_-4px_hsl(330_90%_65%/0.5)] transition-all group"
            title="Voltar pro Chat Amigo"
          >
            <Heart className="w-4 h-4 group-hover:scale-110 transition-transform" strokeWidth={2.2} />
            <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-black uppercase tracking-[0.2em]">
              Chat Amigo
            </span>
          </button>
        )}

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
              <div className="h-12 flex items-center justify-between px-3 border-b border-sidebar-border/60">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold tracking-tight">SnyX</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                <button
                  onClick={() => { switchToFriend(); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${chatMode === "friend" ? "bg-primary/10 text-primary" : "hover:bg-muted/30"}`}
                >
                  {isVip ? <Crown className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  <span>{isVip ? "Chat VIP" : "Chat Amigo"}</span>
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
      </div>
    </TooltipProvider>
  );
};

export default Index;
