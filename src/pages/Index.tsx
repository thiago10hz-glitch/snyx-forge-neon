import { useState, useEffect } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { CodeEditor } from "@/components/CodeEditor";
import { UserProfile } from "@/components/UserProfile";
import { AdminPresenceIndicator, useAdminHeartbeat } from "@/components/AdminPresence";
import { SupportChat } from "@/components/SupportChat";
import { Zap, LogOut, ShieldCheck, MonitorPlay, Code, User, Server, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const Index = () => {
  const [code, setCode] = useState("");
  const { profile, user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [chatMode, setChatMode] = useState<string>("friend");

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  useAdminHeartbeat();

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative">
      {/* Ambient background effects */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/6 blur-[120px] animate-glow-pulse" />
        <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-primary/4 blur-[140px] animate-glow-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-primary/3 blur-[100px] animate-glow-pulse" style={{ animationDelay: '4s' }} />
      </div>

      {/* Top Bar */}
      <header className="relative z-20 h-12 sm:h-13 md:h-14 flex items-center justify-between px-2.5 sm:px-4 md:px-6 lg:px-8 shrink-0 glass border-b border-border/15">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="relative group">
            <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center border border-primary/15 shadow-lg shadow-primary/10 group-hover:shadow-primary/20 transition-all duration-500">
              <Zap className="w-4 h-4 sm:w-[18px] sm:h-[18px] md:w-5 md:h-5 text-primary" />
            </div>
            <div className="absolute -inset-1.5 rounded-xl bg-primary/8 blur-lg -z-10 animate-breathe opacity-60" />
          </div>
          <div className="leading-none">
            <h1 className="text-xs sm:text-sm md:text-[15px] font-extrabold tracking-wide text-foreground gradient-text-subtle">SnyX</h1>
            <p className="text-[7px] sm:text-[8px] md:text-[9px] text-muted-foreground/35 font-semibold tracking-[0.2em] uppercase mt-0.5 hidden sm:block">AI Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-0.5 sm:gap-1 md:gap-1.5">
          <AdminPresenceIndicator />
          
          {/* Nav links */}
          {[
            { to: "/iptv", icon: MonitorPlay, label: "TV" },
            { to: "/hosting", icon: Server, label: "Hosting" },
            { to: "/downloads", icon: Download, label: "App" },
          ].map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:gap-1.5 text-xs font-medium sm:px-2.5 md:px-3 sm:py-1.5 md:py-2 rounded-lg sm:rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-muted/15 active:bg-muted/25 transition-all duration-300 group"
            >
              <Icon className="w-[15px] h-[15px] sm:w-4 sm:h-4 group-hover:text-primary transition-colors duration-300" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}

          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:gap-1.5 text-xs font-medium sm:px-2.5 md:px-3 sm:py-1.5 md:py-2 rounded-lg sm:rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-muted/15 active:bg-muted/25 transition-all duration-300 group"
            >
              <ShieldCheck className="w-[15px] h-[15px] sm:w-4 sm:h-4 group-hover:text-primary transition-colors duration-300" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          {/* Tier badge */}
          {profile?.is_dev ? (
            <span className="badge-dev flex items-center gap-1 text-[8px] sm:text-[9px] md:text-[10px]">
              <Code size={9} />
              DEV
            </span>
          ) : profile?.is_vip ? (
            <span className="badge-vip text-[8px] sm:text-[9px] md:text-[10px]">VIP</span>
          ) : (
            <span className="badge-free text-[8px] sm:text-[9px] md:text-[10px]">Free</span>
          )}

          {/* Avatar */}
          <button
            onClick={() => setShowProfile(true)}
            className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-xl overflow-hidden border border-border/20 hover:border-primary/25 transition-all duration-300 flex items-center justify-center bg-muted/10 hover:bg-muted/20 active:bg-muted/30 group ml-0.5 ring-2 ring-transparent hover:ring-primary/10"
            title="Minha conta"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
            )}
          </button>

          {/* Logout */}
          <button
            onClick={signOut}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl text-muted-foreground/40 hover:text-foreground hover:bg-muted/15 active:bg-muted/25 transition-all duration-300 flex items-center justify-center"
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {chatMode === "music" ? (
          <div className="flex-1 overflow-hidden flex flex-col bg-background items-center justify-center p-6">
            <div className="text-center max-w-md animate-fade-in-up">
              <div className="w-20 h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4 border border-orange-500/20">
                <span className="text-4xl">🎵</span>
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">SnyX Música</h2>
              <p className="text-sm text-muted-foreground mb-1">
                Crie músicas incríveis com inteligência artificial usando o Musicful AI.
              </p>
              <p className="text-xs text-muted-foreground/60 mb-6">
                O gerador de música abre em uma nova aba para a melhor experiência.
              </p>
              <a
                href="https://br.musicful.ai/ai-music-generator/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-primary-foreground font-semibold rounded-xl transition-all text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30"
              >
                🎶 Abrir Musicful AI
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className={`w-full ${chatMode === "programmer" ? "md:w-[480px] md:min-w-[380px] md:shrink-0" : ""} border-r border-border/10`}>
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
