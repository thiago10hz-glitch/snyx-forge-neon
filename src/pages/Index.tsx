import { useState, useEffect } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { CodeEditor } from "@/components/CodeEditor";
import { MusicPanel } from "@/components/MusicPanel";
import { CharactersPanel } from "@/components/CharactersPanel";
import { UserProfile } from "@/components/UserProfile";
import { AdminPresenceIndicator, useAdminHeartbeat } from "@/components/AdminPresence";
import { SupportChat } from "@/components/SupportChat";
import { ThemeSelector } from "@/components/ThemeSelector";
import { Zap, LogOut, ShieldCheck, MonitorPlay, Code, User, Server, Download, Menu, Gamepad2, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const Index = () => {
  const [code, setCode] = useState("");
  const { profile, user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [chatMode, setChatMode] = useState<string>("friend");
  const [showMobileNav, setShowMobileNav] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  useAdminHeartbeat();

  const navItems = [
    { to: "/iptv", icon: MonitorPlay, label: "TV" },
    { to: "/hosting", icon: Server, label: "Hosting" },
    { to: "/pack-steam", icon: Gamepad2, label: "Pack Steam" },
    { to: "/downloads", icon: Download, label: "App" },
  ];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-72 w-72 rounded-full bg-primary/5 blur-[100px] animate-glow-pulse" />
        <div className="absolute top-1/3 -right-32 h-80 w-80 rounded-full bg-primary/3 blur-[120px] animate-glow-pulse" style={{ animationDelay: '2.5s' }} />
        <div className="absolute bottom-10 left-1/4 h-56 w-56 rounded-full bg-primary/4 blur-[90px] animate-glow-pulse" style={{ animationDelay: '5s' }} />
      </div>

      {/* Header */}
      <header className="relative z-20 h-14 md:h-16 flex items-center justify-between px-3 sm:px-5 md:px-8 shrink-0 border-b border-border/10 glass">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => setShowProfile(true)}>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center border border-primary/15 shadow-lg shadow-primary/8 group-hover:shadow-primary/20 transition-all duration-500">
              <Zap className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div className="absolute -inset-1 rounded-xl bg-primary/6 blur-lg -z-10 animate-breathe opacity-50" />
          </div>
          <div className="leading-none">
            <h1 className="text-sm md:text-base font-black tracking-wide gradient-text-subtle">SnyX</h1>
            <p className="text-[8px] md:text-[9px] text-muted-foreground/30 font-semibold tracking-[0.25em] uppercase hidden sm:block">AI Platform</p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden sm:flex items-center gap-1">
          <AdminPresenceIndicator />
          <ThemeSelector />
          <button onClick={() => setChatMode(chatMode === "characters" ? "friend" : "characters")} className={`nav-link group ${chatMode === "characters" ? "text-primary" : ""}`}>
            <Users className="w-4 h-4 group-hover:text-primary transition-colors duration-300" />
            <span>Criar RPG</span>
          </button>
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="nav-link group">
              <Icon className="w-4 h-4 group-hover:text-primary transition-colors duration-300" />
              <span>{label}</span>
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin" className="nav-link group">
              <ShieldCheck className="w-4 h-4 group-hover:text-primary transition-colors duration-300" />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Tier badge */}
          {profile?.is_dev ? (
            <span className="badge-dev flex items-center gap-1 text-[9px] md:text-[10px]">
              <Code size={10} /> DEV
            </span>
          ) : profile?.is_pack_steam ? (
            <span className="badge-pack-steam flex items-center gap-1 text-[9px] md:text-[10px]">
              🎮 Pack Steam
            </span>
          ) : profile?.is_vip ? (
            <span className="badge-vip text-[9px] md:text-[10px]">⭐ VIP</span>
          ) : (
            <span className="badge-free text-[9px] md:text-[10px]">Free</span>
          )}

          {/* Avatar */}
          <button
            onClick={() => setShowProfile(true)}
            className="w-9 h-9 md:w-10 md:h-10 rounded-xl overflow-hidden border border-border/15 hover:border-primary/20 transition-all duration-300 flex items-center justify-center bg-muted/8 hover:bg-muted/15 group ring-2 ring-transparent hover:ring-primary/8"
            title="Minha conta"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-muted-foreground/35 group-hover:text-foreground transition-colors" />
            )}
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setShowMobileNav(!showMobileNav)}
            className="sm:hidden w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/15 transition-all"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Logout (desktop) */}
          <button
            onClick={signOut}
            className="hidden sm:flex w-9 h-9 md:w-10 md:h-10 rounded-xl text-muted-foreground/35 hover:text-foreground hover:bg-muted/15 transition-all duration-300 items-center justify-center"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile nav dropdown */}
      {showMobileNav && (
        <>
          <div className="fixed inset-0 z-20 bg-black/40" onClick={() => setShowMobileNav(false)} />
          <div className="absolute top-14 right-3 z-30 glass-elevated rounded-2xl border border-border/10 p-2 min-w-[180px] animate-reveal">
            <button
              onClick={() => { setChatMode("characters"); setShowMobileNav(false); }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/15 transition-all"
            >
              <Users className="w-4 h-4" />
              Criar RPG
            </button>
            {navItems.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setShowMobileNav(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/15 transition-all"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setShowMobileNav(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/15 transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin
              </Link>
            )}
            <div className="border-t border-border/10 mt-1 pt-1">
              <button
                onClick={() => { signOut(); setShowMobileNav(false); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all w-full"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {chatMode === "music" ? (
          <div className="flex-1 overflow-hidden">
            <MusicPanel onBack={() => setChatMode("friend")} />
          </div>
        ) : chatMode === "characters" ? (
          <div className="flex-1 overflow-hidden">
            <CharactersPanel onBack={() => setChatMode("friend")} onStartChat={(id) => { setChatMode("friend"); }} />
          </div>
        ) : (
          <>
            <div className={`w-full ${chatMode === "programmer" ? "md:w-[480px] md:min-w-[380px] md:shrink-0" : ""} border-r border-border/8`}>
              <ChatPanel onCodeGenerated={setCode} onModeChange={(mode) => setChatMode(mode)} />
            </div>
            {chatMode === "programmer" && (
              <div className="hidden md:block flex-1 min-w-0">
                <CodeEditor code={code} onCodeChange={setCode} />
              </div>
            )}
          </>
        )}
      </div>

      <UserProfile open={showProfile} onClose={() => setShowProfile(false)} />
      <SupportChat />
    </div>
  );
};

export default Index;
