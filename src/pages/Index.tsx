import { useState, useEffect, lazy, Suspense } from "react";
import { AdminPresenceIndicator, useAdminHeartbeat } from "@/components/AdminPresence";
import {
  LogOut, ShieldCheck, Code, User, ArrowLeft, History,
  Menu, Palette, Crown, MessageSquare, Flame, X, Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ChatSelector, type ChatChoice } from "@/components/ChatSelector";
import { HistorySidebar } from "@/components/HistorySidebar";
import { AuroraBackground } from "@/components/AuroraBackground";
import { CinematicSidebar, type SidebarItem } from "@/components/CinematicSidebar";
import { ChevronDown, Heart, Crown as CrownIcon, Code as CodeIcon, Lock } from "lucide-react";

// Lazy load heavy components
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

const choiceToMode = (choice: ChatChoice): "friend" | "programmer" =>
  choice === "programmer" ? "programmer" : "friend";

const Index = () => {
  const [code, setCode] = useState("");
  const { profile, user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showVipModal] = useState(false);
  const [chatChoice, setChatChoice] = useState<ChatChoice | null>("friend");
  const [chatMode, setChatMode] = useState<"friend" | "programmer">("friend");
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pickedConvId, setPickedConvId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  useAdminHeartbeat();

  const handleSelectChat = (choice: ChatChoice) => {
    setChatChoice(choice);
    setChatMode(choiceToMode(choice));
    setPickedConvId(null);
  };

  const handlePickFromHistory = (choice: ChatChoice, conversationId: string) => {
    setChatChoice(choice);
    setChatMode(choiceToMode(choice));
    setPickedConvId(conversationId);
  };

  const handleBackToSelector = () => { setChatChoice(null); setPickedConvId(null); };



  // Header chat title dropdown
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const chatLabels: Record<ChatChoice | "none", string> = {
    none: "SnyX",
    friend: "Chat Amigo",
    vip: "Chat VIP",
    programmer: "Chat Programador",
  };
  const currentChatLabel = chatChoice ? chatLabels[chatChoice] : chatLabels.none;

  const chatOptions: { key: ChatChoice; label: string; icon: any; locked: boolean; color: string }[] = [
    { key: "friend", label: "Chat Amigo", icon: Heart, locked: false, color: "text-pink-400" },
    { key: "vip", label: "Chat VIP", icon: CrownIcon, locked: !(profile?.is_vip || profile?.is_dev), color: "text-amber-400" },
    { key: "programmer", label: "Programador", icon: CodeIcon, locked: !profile?.is_dev, color: "text-cyan-400" },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="h-[100dvh] flex bg-background overflow-hidden relative">
        <AuroraBackground intensity={chatChoice === null ? "full" : "subtle"} />

        <CinematicSidebar
          logo={
            <Link
              to="/"
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/40 via-primary/20 to-primary/5 flex items-center justify-center border border-primary/30 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)] hover:shadow-[0_0_28px_-2px_hsl(var(--primary)/0.8)] transition-all"
            >
              <Flame className="w-4 h-4 text-primary" />
            </Link>
          }
          topItems={[
            { icon: MessageSquare, label: "Conversa", onClick: handleBackToSelector, active: chatChoice === null },
            { icon: History, label: "Histórico", onClick: () => setHistoryOpen(true), active: historyOpen, dot: chatChoice !== null },
            ...(isAdmin
              ? ([
                  { icon: ShieldCheck, label: "Admin", to: "/admin" },
                  { icon: Crown, label: "Dono", to: "/dono", accent: true },
                ] as SidebarItem[])
              : []),
          ]}
          groupDivider={isAdmin ? [{ afterIndex: 1, label: "Equipe" }] : []}
          bottomItems={[
            { icon: Palette, label: "Tema", onClick: () => setShowThemeModal(true) },
            { icon: LogOut, label: "Sair", onClick: signOut, danger: true },
          ]}
        />

        {/* === MAIN === */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          {/* Header */}
          <header className="h-12 flex items-center justify-between px-3 sm:px-4 shrink-0 border-b border-border/10 bg-card/20 backdrop-blur-xl relative">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all"
              >
                <Menu className="w-4 h-4" />
              </button>
              <AdminPresenceIndicator />
            </div>

            {/* Center: chat title + dropdown */}
            <div className="absolute left-1/2 -translate-x-1/2">
              <button
                onClick={() => setChatMenuOpen((v) => !v)}
                className="group flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-muted/15 transition-colors"
              >
                <Flame className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-bold tracking-tight text-foreground">
                  {currentChatLabel}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/60 transition-transform ${chatMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {chatMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setChatMenuOpen(false)} />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 rounded-2xl border border-border/20 bg-card/95 backdrop-blur-2xl shadow-2xl shadow-primary/10 z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-1.5">
                      {chatOptions.map((opt) => {
                        const Icon = opt.icon;
                        const active = chatChoice === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => {
                              setChatMenuOpen(false);
                              if (opt.locked) return;
                              handleSelectChat(opt.key);
                            }}
                            disabled={opt.locked}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                              active
                                ? "bg-primary/15 text-primary"
                                : opt.locked
                                  ? "text-muted-foreground/40 cursor-not-allowed"
                                  : "text-foreground hover:bg-muted/20"
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${active ? "text-primary" : opt.color}`} />
                            <span className="flex-1 text-left font-medium">{opt.label}</span>
                            {opt.locked && <Lock className="w-3 h-3 text-muted-foreground/40" />}
                            {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
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
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  <Code size={9} /> DEV
                </span>
              ) : profile?.is_vip ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  ⭐ VIP
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted/20 text-muted-foreground/70 border border-border/20">
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
                className="w-8 h-8 rounded-xl overflow-hidden border border-border/20 hover:border-primary/40 transition-all duration-300 flex items-center justify-center bg-muted/10 hover:bg-muted/20 group hover:shadow-[0_0_15px_-3px_hsl(var(--primary)/0.4)]"
                title="Minha conta"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                )}
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {chatChoice === null ? (
              <ChatSelector onSelect={handleSelectChat} />
            ) : (
              <>
                <div className={`w-full flex flex-col ${chatMode === "programmer" ? "md:w-[480px] md:min-w-[380px] md:shrink-0 md:border-r md:border-border/10" : ""}`}>
                  {/* Back to selector bar */}
                  <div className="h-9 flex items-center px-3 border-b border-border/10 bg-muted/5 shrink-0">
                    <button
                      onClick={handleBackToSelector}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Trocar de chat
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <Suspense fallback={<PanelLoader />}>
                      <ChatPanel
                        key={chatChoice}
                        onCodeGenerated={setCode}
                        onModeChange={(mode) => setChatMode(mode as "friend" | "programmer")}
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
              </>
            )}
          </div>
        </div>

        {/* === MOBILE DRAWER === */}
        {mobileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 z-50 w-60 bg-sidebar border-r border-border/15 flex flex-col md:hidden animate-in slide-in-from-left duration-200">
              <div className="h-12 flex items-center justify-between px-3 border-b border-border/10">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold tracking-tight">SnyX</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/20">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                <button
                  onClick={() => { handleBackToSelector(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted/20 transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span>Trocar de chat</span>
                </button>
                <button
                  onClick={() => { setHistoryOpen(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted/20 transition-colors"
                >
                  <History className="w-4 h-4 text-primary" />
                  <span>Histórico</span>
                </button>

                {isAdmin && (
                  <>
                    <div className="px-3 pt-3 pb-1">
                      <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Admin</span>
                    </div>
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted/20">
                      <ShieldCheck className="w-4 h-4" /><span>Admin</span>
                    </Link>
                    <Link to="/dono" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-amber-400 hover:bg-amber-500/10">
                      <Crown className="w-4 h-4" /><span>Dono</span>
                    </Link>
                  </>
                )}
              </nav>

              <div className="p-2 border-t border-border/10 space-y-0.5">
                <button onClick={() => { setShowThemeModal(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted/20">
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
          onNewChat={(choice) => { handleSelectChat(choice); }}
        />
      </div>
    </TooltipProvider>
  );
};

export default Index;
