import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { AdminPresenceIndicator, useAdminHeartbeat } from "@/components/AdminPresence";
import {
  LogOut, ShieldCheck, Code, User, Menu, Palette, Crown, MessageSquare, Sparkles, X, Loader2, Heart, History, Code2,
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

  const railTopItems: RailItem[] = isAdmin
    ? ([
        { icon: ShieldCheck, label: "Admin", to: "/admin" },
        { icon: Crown, label: "Dono", to: "/dono", accent: true },
      ] as RailItem[])
    : [];

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

        {/* Mini sidebar — só pra dono/admin */}
        {isAdmin && (
          <SideRail
            logo={
              <Link
                to="/"
                className="group relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 hover:scale-110"
                title="SnyX"
              >
                <span className="absolute inset-0 rounded-2xl bg-primary/30 blur-lg opacity-60 group-hover:opacity-100 group-hover:blur-xl transition-all duration-500" aria-hidden />
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary via-primary/60 to-primary/20 shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.7),inset_0_1px_0_hsl(0_0%_100%/0.25)]" aria-hidden />
                <span className="absolute inset-0 rounded-2xl overflow-hidden" aria-hidden>
                  <span className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 group-hover:translate-x-[300%] transition-transform duration-[1100ms] ease-out" />
                </span>
                <span className="absolute inset-[2px] rounded-[14px] border border-white/15" aria-hidden />
                <Sparkles className="relative w-[18px] h-[18px] text-white drop-shadow-[0_0_6px_hsl(var(--primary))]" strokeWidth={2.4} />
              </Link>
            }
            topItems={railTopItems}
            bottomItems={railBottomItems}
          />
        )}

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
          <header className="h-14 flex items-center justify-between gap-2 px-2 sm:px-6 shrink-0 bg-transparent relative">
            <div className="flex items-center gap-2 shrink-0 sm:flex-1 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
              >
                <Menu className="w-4 h-4" />
              </button>

              {/* Logo SnyX — aparece quando não há SideRail (não-admins) ou no mobile */}
              <Link
                to="/"
                title="SnyX"
                className={`group relative w-9 h-9 rounded-2xl flex items-center justify-center transition-all duration-500 hover:scale-110 ${isAdmin ? "md:hidden" : ""}`}
              >
                <span className="absolute inset-0 rounded-2xl bg-primary/30 blur-lg opacity-60 group-hover:opacity-100 transition-all duration-500" aria-hidden />
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary via-primary/60 to-primary/20 shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.7),inset_0_1px_0_hsl(0_0%_100%/0.25)]" aria-hidden />
                <span className="absolute inset-[2px] rounded-[14px] border border-white/15" aria-hidden />
                <Sparkles className="relative w-[16px] h-[16px] text-white drop-shadow-[0_0_6px_hsl(var(--primary))]" strokeWidth={2.4} />
              </Link>

              <AdminPresenceIndicator />
            </div>

            {/* Center: red pill com Histórico / Amigo / Programador / VIP */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[calc(100vw-180px)] sm:max-w-none">
              <div className="relative flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-full border border-primary/30 bg-gradient-to-r from-background/40 via-primary/10 to-background/40 backdrop-blur-2xl shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.6),inset_0_1px_0_0_hsl(0_0%_100%/0.08)]">
                {/* glow halo */}
                <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.25),transparent_70%)] blur-md" aria-hidden />

                <button
                  onClick={() => setHistoryOpen((v) => !v)}
                  className={`relative flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[11px] font-bold tracking-tight transition-all duration-300 ${
                    historyOpen
                      ? "bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-[0_0_18px_-2px_hsl(var(--primary)),inset_0_1px_0_hsl(0_0%_100%/0.25)]"
                      : "text-foreground/70 hover:text-primary hover:bg-primary/15 hover:shadow-[0_0_12px_-3px_hsl(var(--primary)/0.6)]"
                  }`}
                  title="Histórico"
                >
                  <History className="w-3.5 h-3.5" strokeWidth={2.4} />
                  <span className="hidden sm:inline">Histórico</span>
                </button>

                <button
                  onClick={switchToFriend}
                  className={`relative flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[11px] font-bold tracking-tight transition-all duration-300 ${
                    chatMode === "friend"
                      ? "bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-[0_0_18px_-2px_hsl(var(--primary)),inset_0_1px_0_hsl(0_0%_100%/0.25)]"
                      : "text-foreground/70 hover:text-primary hover:bg-primary/15 hover:shadow-[0_0_12px_-3px_hsl(var(--primary)/0.6)]"
                  }`}
                  title="Chat Amigo"
                >
                  <Heart className={`w-3.5 h-3.5 ${chatMode === "friend" ? "fill-primary-foreground" : ""}`} strokeWidth={2.4} />
                  <span className="hidden sm:inline">Amigo</span>
                </button>

                {isDev && (
                  <button
                    onClick={switchToProgrammer}
                    className={`relative flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[11px] font-bold tracking-tight transition-all duration-300 ${
                      chatMode === "programmer"
                        ? "bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-[0_0_18px_-2px_hsl(var(--primary)),inset_0_1px_0_hsl(0_0%_100%/0.25)]"
                        : "text-foreground/70 hover:text-primary hover:bg-primary/15 hover:shadow-[0_0_12px_-3px_hsl(var(--primary)/0.6)]"
                    }`}
                    title="Modo Programador"
                  >
                    <Code className="w-3.5 h-3.5" strokeWidth={2.4} />
                    <span className="hidden sm:inline">Programador</span>
                  </button>
                )}

                {isVip && (
                  <button
                    onClick={switchToFriend}
                    className="relative flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-300 bg-gradient-to-b from-primary/95 to-primary/75 text-primary-foreground border border-primary/60 shadow-[0_0_14px_-4px_hsl(var(--primary)/0.7)] hover:shadow-[0_0_22px_-2px_hsl(var(--primary)/0.85)]"
                    title="Abrir Chat VIP"
                  >
                    <Crown className="w-3.5 h-3.5 fill-primary-foreground/90" strokeWidth={2.4} />
                    <span className="hidden sm:inline">VIP</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 sm:flex-1 sm:justify-end">
              {/* API para devs — só desktop (mobile fica no menu) */}
              <Link
                to="/api"
                title="API para devs"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-b from-primary/20 to-primary/10 text-primary border border-primary/40 hover:border-primary/70 hover:shadow-[0_0_14px_-3px_hsl(var(--primary)/0.7)] transition-all"
              >
                <Code2 className="w-3 h-3" strokeWidth={2.6} />
                <span>API devs</span>
              </Link>

              {/* Badge de plano — VIP dourado pra assinantes, FREE pra contas novas */}
              {profile?.is_vip || profile?.is_dev ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/25 to-amber-500/20 text-amber-300 border border-amber-400/40 shadow-[0_0_12px_-3px_hsl(45_100%_60%/0.5)]">
                  <Crown size={8} className="fill-amber-300" /> VIP
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground border border-border/40">
                  FREE
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
                className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-2xl overflow-hidden border border-border/30 hover:border-primary/50 transition-all duration-300 flex items-center justify-center bg-card/60 hover:bg-card/80 group hover:shadow-[0_0_22px_-4px_hsl(var(--primary)/0.5)] sm:ml-1"
                title="Minha conta"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                )}
              </button>

              {/* Botão Sair — só desktop (mobile fica no menu) */}
              <button
                onClick={signOut}
                title="Sair da conta"
                className="hidden sm:flex w-9 h-9 rounded-2xl items-center justify-center border border-border/30 hover:border-destructive/60 text-muted-foreground hover:text-destructive bg-card/60 hover:bg-destructive/10 transition-all duration-300 hover:shadow-[0_0_18px_-4px_hsl(var(--destructive)/0.6)]"
              >
                <LogOut className="w-4 h-4" />
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
