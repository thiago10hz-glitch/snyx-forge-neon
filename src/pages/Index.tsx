import { useState, useEffect, lazy, Suspense } from "react";
import { AdminPresenceIndicator, useAdminHeartbeat } from "@/components/AdminPresence";
import {
  Zap, LogOut, ShieldCheck, MonitorPlay, Code, User, Server, Download,
  Menu, Gamepad2, Users, Palette, Crown, MessageSquare, ChevronLeft,
  ChevronRight, Flame, X, Globe, Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Lazy load heavy components
const ChatPanel = lazy(() => import("@/components/ChatPanel").then(m => ({ default: m.ChatPanel })));
const CodeEditor = lazy(() => import("@/components/CodeEditor").then(m => ({ default: m.CodeEditor })));
const MusicPanel = lazy(() => import("@/components/MusicPanel").then(m => ({ default: m.MusicPanel })));
const CharactersPanel = lazy(() => import("@/components/CharactersPanel").then(m => ({ default: m.CharactersPanel })));
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
  const [showVipModal, setShowVipModal] = useState(false);
  const [chatMode, setChatMode] = useState<string>("friend");
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [activeCharacter, setActiveCharacter] = useState<{ id: string; name: string; system_prompt: string; avatar_url: string | null } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  const hasRpgAccess = !!(profile?.is_rpg_premium || profile?.is_vip || profile?.is_dev || isAdmin);
  const safeChatMode = chatMode === "characters" && !hasRpgAccess ? "friend" : chatMode;

  useEffect(() => {
    if (!hasRpgAccess) {
      if (chatMode === "characters") setChatMode("friend");
      if (activeCharacter) setActiveCharacter(null);
    }
  }, [hasRpgAccess, chatMode, activeCharacter]);

  useAdminHeartbeat();

  const navItems = [
    { to: "/iptv", icon: MonitorPlay, label: "TV" },
    { to: "/hosting", icon: Server, label: "Hosting" },
    { to: "/clone-site", icon: Globe, label: "Clone Site" },
    { to: "/pack-steam", icon: Gamepad2, label: "Pack Steam" },
    { to: "/downloads", icon: Download, label: "App" },
    { to: "/accelerator", icon: Zap, label: "Accelerator" },
  ];

  const toggleCharactersPanel = () => {
    if (!hasRpgAccess) { setShowVipModal(true); return; }
    setChatMode((c) => c === "characters" ? "friend" : "characters");
  };

  const handleCharacterStartChat = async (id: string) => {
    if (!hasRpgAccess) { setShowVipModal(true); return; }
    const { data } = await supabase
      .from("ai_characters")
      .select("id, name, system_prompt, avatar_url")
      .eq("id", id)
      .single();
    if (data) {
      setActiveCharacter(data);
      await supabase.rpc("increment_character_chat_count", { p_character_id: id });
    }
    setChatMode("friend");
  };

  const SidebarItem = ({ icon: Icon, label, onClick, active, to, className }: any) => {
    const content = (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={onClick}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-200 group
              ${active
                ? "bg-primary/12 text-primary border border-primary/15"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border border-transparent"
              } ${className || ""}`}
          >
            <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? "text-primary" : "group-hover:text-primary"}`} />
            {sidebarOpen && <span className="text-[13px] font-medium truncate">{label}</span>}
          </div>
        </TooltipTrigger>
        {!sidebarOpen && (
          <TooltipContent side="right" className="glass-elevated border-border/20 text-xs">
            {label}
          </TooltipContent>
        )}
      </Tooltip>
    );

    if (to) {
      return <Link to={to}>{content}</Link>;
    }
    return content;
  };

  return (
    <div className="h-[100dvh] flex bg-background overflow-hidden relative">

      {/* === SIDEBAR (desktop) === */}
      <aside className={`hidden md:flex flex-col shrink-0 border-r border-border/15 bg-sidebar transition-all duration-300 z-20 relative
        ${sidebarOpen ? "w-48" : "w-14"}`}>
        {/* Logo */}
        <div className={`h-12 flex items-center shrink-0 border-b border-border/10 ${sidebarOpen ? "px-3 gap-2.5" : "justify-center"}`}>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
            <Flame className="w-4 h-4 text-primary" />
          </div>
          {sidebarOpen && (
            <div className="leading-none">
              <h1 className="text-xs font-black tracking-wide gradient-text-subtle">SnyX</h1>
              <p className="text-[7px] text-muted-foreground/40 font-semibold tracking-[0.25em] uppercase">AI Platform</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-1.5 space-y-0.5 overflow-y-auto scrollbar-thin">
          <SidebarItem icon={MessageSquare} label="Chat" onClick={() => setChatMode("friend")} active={safeChatMode === "friend" || safeChatMode === "programmer"} />
          <SidebarItem icon={Users} label="Criar RPG" onClick={toggleCharactersPanel} active={safeChatMode === "characters"} />

          <div className={`${sidebarOpen ? "px-3 pt-4 pb-1" : "pt-4 pb-1 flex justify-center"}`}>
            {sidebarOpen ? (
              <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Serviços</span>
            ) : (
              <div className="w-6 h-px bg-border/30" />
            )}
          </div>

          {navItems.map(({ to, icon, label }) => (
            <SidebarItem key={to} to={to} icon={icon} label={label} />
          ))}

          {isAdmin && (
            <>
              <div className={`${sidebarOpen ? "px-3 pt-4 pb-1" : "pt-4 pb-1 flex justify-center"}`}>
                {sidebarOpen ? (
                  <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Admin</span>
                ) : (
                  <div className="w-6 h-px bg-border/30" />
                )}
              </div>
              <SidebarItem to="/admin" icon={ShieldCheck} label="Admin" />
              <SidebarItem to="/dono" icon={Crown} label="Dono" className="text-amber-400 hover:text-amber-300" />
            </>
          )}
        </nav>

        {/* Bottom: theme + user */}
        <div className="p-1.5 border-t border-border/10 space-y-0.5">
          <SidebarItem icon={Palette} label="Tema" onClick={() => setShowThemeModal(true)} />
          <SidebarItem icon={LogOut} label="Sair" onClick={signOut} className="hover:text-destructive" />
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-2.5 top-16 w-5 h-5 rounded-full bg-card border border-border/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all z-30 shadow-md"
        >
          {sidebarOpen ? <ChevronLeft className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
        </button>
      </aside>

      {/* === MAIN AREA === */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header (top bar) */}
        <header className="h-11 flex items-center justify-between px-3 sm:px-4 shrink-0 border-b border-border/10 glass">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="md:hidden flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold gradient-text-subtle">SnyX</span>
            </div>
            <AdminPresenceIndicator />
          </div>

          {/* Right section */}
          <div className="flex items-center gap-1.5">
            {/* Tier badge */}
            {profile?.is_dev ? (
              <span className="badge-dev flex items-center gap-1 text-[8px]">
                <Code size={8} /> DEV
              </span>
            ) : (profile as any)?.is_rpg_premium ? (
              <span className="flex items-center gap-1 text-[8px] px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30 font-bold">
                🎭 RPG
              </span>
            ) : profile?.is_pack_steam ? (
              <span className="badge-pack-steam flex items-center gap-1 text-[8px]">
                🎮 Steam
              </span>
            ) : profile?.is_vip ? (
              <span className="badge-vip text-[8px]">⭐ VIP</span>
            ) : (
              <span className="badge-free text-[8px]">Free</span>
            )}

            {/* Owner badge */}
            {(profile?.team_badge === "Dono" || profile?.team_badge === "Dona") && (
              <span className="hidden sm:flex items-center gap-1 text-[8px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/25 to-amber-500/20 text-amber-300 font-black border border-amber-400/30 shadow-lg shadow-amber-500/15 animate-pulse" style={{ animationDuration: '3s' }}>
                👑 {profile.team_badge}
              </span>
            )}

            {/* Avatar */}
            <button
              onClick={() => setShowProfile(true)}
              className="w-7 h-7 rounded-lg overflow-hidden border border-border/20 hover:border-primary/30 transition-all duration-300 flex items-center justify-center bg-muted/10 hover:bg-muted/20 group"
              title="Minha conta"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
              )}
            </button>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">
          {safeChatMode === "music" ? (
            <div className="flex-1 overflow-hidden">
              <Suspense fallback={<PanelLoader />}>
                <MusicPanel onBack={() => setChatMode("friend")} />
              </Suspense>
            </div>
          ) : safeChatMode === "characters" ? (
            <div className="flex-1 overflow-hidden">
              <Suspense fallback={<PanelLoader />}>
                <CharactersPanel onBack={() => setChatMode("friend")} onStartChat={handleCharacterStartChat} />
              </Suspense>
            </div>
          ) : (
            <>
              <div className={`w-full ${safeChatMode === "programmer" ? "md:w-[480px] md:min-w-[380px] md:shrink-0" : ""} border-r border-border/8`}>
                <Suspense fallback={<PanelLoader />}>
                  <ChatPanel
                    onCodeGenerated={setCode}
                    onModeChange={(mode) => setChatMode(mode)}
                    activeCharacter={hasRpgAccess ? activeCharacter : null}
                    onClearCharacter={() => setActiveCharacter(null)}
                  />
                </Suspense>
              </div>
              {safeChatMode === "programmer" && (
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

      {/* === MOBILE SIDEBAR OVERLAY === */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-56 bg-sidebar border-r border-border/15 flex flex-col animate-reveal">
            <div className="h-11 flex items-center justify-between px-3 border-b border-border/10">
              <div className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-primary" />
                <span className="text-xs font-black gradient-text-subtle">SnyX</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
              <SidebarItem icon={MessageSquare} label="Chat" onClick={() => { setChatMode("friend"); setMobileMenuOpen(false); }} active={safeChatMode === "friend"} />
              <SidebarItem icon={Users} label="Criar RPG" onClick={() => { toggleCharactersPanel(); setMobileMenuOpen(false); }} active={safeChatMode === "characters"} />

              <div className="px-2.5 pt-3 pb-0.5">
                <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Serviços</span>
              </div>
              {navItems.map(({ to, icon, label }) => (
                <div key={to} onClick={() => setMobileMenuOpen(false)}>
                  <SidebarItem to={to} icon={icon} label={label} />
                </div>
              ))}

              {isAdmin && (
                <>
                  <div className="px-2.5 pt-3 pb-0.5">
                    <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Admin</span>
                  </div>
                  <div onClick={() => setMobileMenuOpen(false)}>
                    <SidebarItem to="/admin" icon={ShieldCheck} label="Admin" />
                  </div>
                  <div onClick={() => setMobileMenuOpen(false)}>
                    <SidebarItem to="/dono" icon={Crown} label="Dono" className="text-amber-400" />
                  </div>
                </>
              )}
            </nav>

            <div className="p-2 border-t border-border/10 space-y-0.5">
              <SidebarItem icon={Palette} label="Tema" onClick={() => { setShowThemeModal(true); setMobileMenuOpen(false); }} />
              <SidebarItem icon={LogOut} label="Sair" onClick={() => { signOut(); setMobileMenuOpen(false); }} className="hover:text-destructive" />
            </div>
          </div>
        </>
      )}

      <Suspense fallback={null}>
        <UserProfile open={showProfile} onClose={() => setShowProfile(false)} />
        <SupportChat />
        <VipModal open={showVipModal} onClose={() => setShowVipModal(false)} highlightPlan="rpg" />
        <ThemeSelector externalOpen={showThemeModal} onExternalClose={() => setShowThemeModal(false)} hideButton />
      </Suspense>
    </div>
  );
};

export default Index;
