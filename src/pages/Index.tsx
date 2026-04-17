import { useState, useEffect, lazy, Suspense } from "react";
import { AdminPresenceIndicator, useAdminHeartbeat } from "@/components/AdminPresence";
import {
  LogOut, ShieldCheck, Code, User, History,
  Menu, Palette, Crown, MessageSquare, Sparkles, X, Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type ChatChoice } from "@/components/ChatSelector";
import { HistorySidebar } from "@/components/HistorySidebar";
import { AuroraBackground } from "@/components/AuroraBackground";
import { CinematicSidebar, type SidebarItem } from "@/components/CinematicSidebar";
import { ChevronDown, Heart, Crown as CrownIcon, Code as CodeIcon } from "lucide-react";

const ChatPanel = lazy(() => import("@/components/ChatPanel").then(m => ({ default: m.ChatPanel })));
const CodeEditor = lazy(() => import("@/components/CodeEditor").then(m => ({ default: m.CodeEditor })));
const UserProfile = lazy(() => import("@/components/UserProfile").then(m => ({ default: m.UserProfile })));
const ThemeSelector = lazy(() => import("@/components/ThemeSelector").then(m => ({ default: m.ThemeSelector })));
const VipModal = lazy(() => import("@/components/VipModal").then(m => ({ default: m.VipModal })));

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
  const [showVipModal] = useState(false);
  // Chat mode: friend by default. VIP/DEV auto-route to friend (premium handled inside ChatPanel via profile flags).
  // Programmer mode is opt-in for DEVs only.
  const [chatMode, setChatMode] = useState<"friend" | "programmer">("friend");
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pickedConvId, setPickedConvId] = useState<string | null>(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);

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
    // Friend & VIP both use friend panel; programmer only for DEVs
    setChatMode(choice === "programmer" && isDev ? "programmer" : "friend");
    setPickedConvId(conversationId);
  };

  const switchToFriend = () => {
    setChatMode("friend");
    setPickedConvId(null);
    setChatMenuOpen(false);
  };

  const switchToProgrammer = () => {
    if (!isDev) return;
    setChatMode("programmer");
    setPickedConvId(null);
    setChatMenuOpen(false);
  };

  // Header label
  const currentChatLabel =
    chatMode === "programmer" ? "Chat Programador" : isVip ? "Chat VIP" : "Chat Amigo";

  const chatOptions = [
    {
      key: "friend" as const,
      label: isVip ? "Chat VIP" : "Chat Amigo",
      sub: isVip ? "Premium ativo automaticamente" : "Conversa livre",
      icon: isVip ? CrownIcon : Heart,
      color: isVip ? "text-amber-300" : "text-pink-400",
      bg: isVip ? "bg-amber-500/10" : "bg-pink-500/10",
      onClick: switchToFriend,
      visible: true,
      active: chatMode === "friend",
    },
    {
      key: "programmer" as const,
      label: "Programador",
      sub: "Editor de código + IA",
      icon: CodeIcon,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      onClick: switchToProgrammer,
      visible: isDev,
      active: chatMode === "programmer",
    },
  ].filter((o) => o.visible);

  const sidebarTopItems: SidebarItem[] = [
    {
      icon: isVip ? CrownIcon : MessageSquare,
      label: isVip ? "Chat VIP" : "Chat Amigo",
      onClick: switchToFriend,
      active: chatMode === "friend",
    },
    ...(isDev
      ? [{
          icon: CodeIcon,
          label: "Programador",
          onClick: switchToProgrammer,
          active: chatMode === "programmer",
        } as SidebarItem]
      : []),
    {
      icon: History,
      label: "Histórico",
      onClick: () => setHistoryOpen(true),
      active: historyOpen,
    },
    ...(isAdmin
      ? ([
          { icon: ShieldCheck, label: "Admin", to: "/admin" },
          { icon: Crown, label: "Dono", to: "/dono", accent: true },
        ] as SidebarItem[])
      : []),
  ];

  const adminDividerIdx = isDev ? 2 : 1; // after Histórico

  return (
    <TooltipProvider delayDuration={150}>
      <div className="h-[100dvh] flex bg-background overflow-hidden relative">
        <AuroraBackground intensity="subtle" />

        <CinematicSidebar
          logo={
            <Link
              to="/"
              className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/35 via-primary/15 to-transparent flex items-center justify-center border border-primary/30 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)] hover:shadow-[0_0_28px_-2px_hsl(var(--primary)/0.7)] transition-all"
            >
              <Sparkles className="w-4 h-4 text-primary" />
            </Link>
          }
          topItems={sidebarTopItems}
          groupDivider={isAdmin ? [{ afterIndex: adminDividerIdx, label: "Equipe" }] : []}
          bottomItems={[
            { icon: Palette, label: "Tema", onClick: () => setShowThemeModal(true) },
            { icon: LogOut, label: "Sair", onClick: signOut, danger: true },
          ]}
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

            {/* Center: chat title + dropdown */}
            <div className="absolute left-1/2 -translate-x-1/2">
              <button
                onClick={() => setChatMenuOpen((v) => !v)}
                className="group flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/40 bg-card/60 hover:border-primary/40 hover:bg-card/80 hover:shadow-[0_0_24px_-8px_hsl(var(--primary)/0.5)] transition-all duration-300"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                </span>
                <span className="text-[13px] font-bold tracking-tight text-foreground">
                  {currentChatLabel}
                </span>
                {chatOptions.length > 1 && (
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-300 ${chatMenuOpen ? "rotate-180 text-primary" : ""}`} />
                )}
              </button>

              {chatMenuOpen && chatOptions.length > 1 && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setChatMenuOpen(false)} />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 rounded-2xl border border-border/30 bg-popover/95 backdrop-blur-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7),0_0_30px_-8px_hsl(var(--primary)/0.25)] z-40 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 border-b border-border/20">
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
                        Trocar de conversa
                      </p>
                    </div>
                    <div className="p-1.5">
                      {chatOptions.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.key}
                            onClick={opt.onClick}
                            className={`group/o w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                              opt.active
                                ? "bg-primary/10 text-primary border border-primary/25 shadow-[inset_0_0_20px_-8px_hsl(var(--primary)/0.4)]"
                                : "text-foreground hover:bg-foreground/[0.05] hover:translate-x-0.5 border border-transparent"
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${opt.active ? "bg-primary/15" : opt.bg}`}>
                              <Icon className={`w-4 h-4 ${opt.active ? "text-primary" : opt.color}`} />
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-semibold tracking-tight leading-tight">{opt.label}</div>
                              <div className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">{opt.sub}</div>
                            </div>
                            {opt.active && <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right */}
            <div className="flex items-center gap-2 flex-1 justify-end">
              {profile?.is_dev ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  <Code size={9} /> DEV
                </span>
              ) : profile?.is_vip ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  ⭐ VIP
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground/70 border border-border/30">
                  Free
                </span>
              )}

              {(profile?.team_badge === "Dono" || profile?.team_badge === "Dona") && (
                <span className="hidden md:inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/30 to-amber-500/20 text-amber-300 border border-amber-400/30 shadow-[0_0_15px_-3px_hsl(45_100%_60%/0.4)]">
                  👑 {profile.team_badge}
                </span>
              )}

              <button
                onClick={() => setShowProfile(true)}
                className="relative w-9 h-9 rounded-2xl overflow-hidden border border-border/30 hover:border-primary/50 transition-all duration-300 flex items-center justify-center bg-card/60 hover:bg-card/80 group hover:shadow-[0_0_22px_-4px_hsl(var(--primary)/0.5)]"
                title="Minha conta"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                )}
                <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/5 pointer-events-none" />
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

        {/* === MOBILE DRAWER === */}
        {mobileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col md:hidden animate-in slide-in-from-left duration-200">
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
                  {isVip ? <CrownIcon className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  <span>{isVip ? "Chat VIP" : "Chat Amigo"}</span>
                </button>
                {isDev && (
                  <button
                    onClick={() => { switchToProgrammer(); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${chatMode === "programmer" ? "bg-primary/10 text-primary" : "hover:bg-muted/30"}`}
                  >
                    <CodeIcon className="w-4 h-4" />
                    <span>Programador</span>
                  </button>
                )}
                <button
                  onClick={() => { setHistoryOpen(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted/30 transition-colors"
                >
                  <History className="w-4 h-4" />
                  <span>Histórico</span>
                </button>

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
          <VipModal open={showVipModal} onClose={() => {}} />
          <ThemeSelector externalOpen={showThemeModal} onExternalClose={() => setShowThemeModal(false)} hideButton />
        </Suspense>

        <HistorySidebar
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onPickConversation={handlePickFromHistory}
          onNewChat={(choice) => {
            if (choice === "programmer" && isDev) setChatMode("programmer");
            else setChatMode("friend");
            setPickedConvId(null);
          }}
        />
      </div>
    </TooltipProvider>
  );
};

export default Index;
