import { useState, useEffect, lazy, Suspense } from "react";
import { AdminPresenceIndicator, useAdminHeartbeat } from "@/components/AdminPresence";
import {
  LogOut, ShieldCheck, Code, User,
  Menu, Palette, Crown, MessageSquare, Flame, X, Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

// Lazy load heavy components
const ChatPanel = lazy(() => import("@/components/ChatPanel").then(m => ({ default: m.ChatPanel })));
const CodeEditor = lazy(() => import("@/components/CodeEditor").then(m => ({ default: m.CodeEditor })));
const UserProfile = lazy(() => import("@/components/UserProfile").then(m => ({ default: m.UserProfile })));
const SupportChat = lazy(() => import("@/components/SupportChat").then(m => ({ default: m.SupportChat })));
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
  const [chatMode, setChatMode] = useState<string>("friend");
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  useAdminHeartbeat();

  const navItems: { to: string; icon: any; label: string }[] = [];

  // Mini icon-only sidebar item (w-14)
  const MiniItem = ({ icon: Icon, label, onClick, active, to, danger, accent }: {
    icon: any; label: string; onClick?: () => void; active?: boolean; to?: string;
    danger?: boolean; accent?: boolean;
  }) => {
    const base = (
      <button
        onClick={onClick}
        className={`relative w-10 h-10 mx-auto flex items-center justify-center rounded-xl transition-all duration-200 group
          ${active
            ? "bg-primary/15 text-primary border border-primary/25 shadow-[0_0_20px_-5px_hsl(var(--primary)/0.4)]"
            : danger
              ? "text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 border border-transparent"
              : accent
                ? "text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 border border-transparent"
                : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/15 border border-transparent"
          }`}
      >
        <Icon className="w-[17px] h-[17px]" strokeWidth={1.8} />
        {active && <span className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />}
      </button>
    );

    const wrapped = (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>{to ? <Link to={to}>{base}</Link> : base}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10} className="text-[11px] font-medium px-2.5 py-1.5">
          {label}
        </TooltipContent>
      </Tooltip>
    );
    return wrapped;
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="h-[100dvh] flex bg-background overflow-hidden relative">
        {/* === MINI SIDEBAR (desktop) — w-14 always === */}
        <aside className="hidden md:flex w-14 shrink-0 flex-col border-r border-border/10 bg-sidebar/60 backdrop-blur-xl z-20 relative">
          {/* Logo */}
          <div className="h-14 flex items-center justify-center shrink-0 border-b border-border/10">
            <Link to="/" className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10 hover:scale-105 transition-transform">
              <Flame className="w-4 h-4 text-primary" />
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-3 space-y-1.5 overflow-y-auto scrollbar-hide">
            <MiniItem icon={MessageSquare} label="Chat" onClick={() => setChatMode("friend")} active={chatMode === "friend" || chatMode === "programmer"} />

            {isAdmin && (
              <>
                <div className="my-2 mx-3 h-px bg-border/20" />
                <MiniItem to="/admin" icon={ShieldCheck} label="Admin" />
                <MiniItem to="/dono" icon={Crown} label="Dono" accent />
              </>
            )}
          </nav>

          {/* Bottom */}
          <div className="py-3 border-t border-border/10 space-y-1.5">
            <MiniItem icon={Palette} label="Tema" onClick={() => setShowThemeModal(true)} />
            <MiniItem icon={LogOut} label="Sair" onClick={signOut} danger />
          </div>
        </aside>

        {/* === MAIN === */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          {/* Header */}
          <header className="h-12 flex items-center justify-between px-3 sm:px-4 shrink-0 border-b border-border/10 bg-card/40 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="md:hidden flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold tracking-tight">SnyX</span>
              </div>
              <AdminPresenceIndicator />
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              {profile?.is_dev ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  <Code size={9} /> DEV
                </span>
              ) : profile?.is_pack_steam ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  🎮 Steam
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
            <div className={`w-full ${chatMode === "programmer" ? "md:w-[480px] md:min-w-[380px] md:shrink-0" : ""} ${chatMode === "programmer" ? "border-r border-border/10" : ""}`}>
              <Suspense fallback={<PanelLoader />}>
                <ChatPanel
                  onCodeGenerated={setCode}
                  onModeChange={(mode) => setChatMode(mode)}
                />
              </Suspense>
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
                  onClick={() => { setChatMode("friend"); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted/20 transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span>Chat</span>
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
          <SupportChat />
          <VipModal open={showVipModal} onClose={() => {}} />
          <ThemeSelector externalOpen={showThemeModal} onExternalClose={() => setShowThemeModal(false)} hideButton />
        </Suspense>
      </div>
    </TooltipProvider>
  );
};

export default Index;
