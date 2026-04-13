import { useState, useEffect } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { CodeEditor } from "@/components/CodeEditor";
import { UserProfile } from "@/components/UserProfile";
import { AdminPresenceIndicator, useAdminHeartbeat } from "@/components/AdminPresence";
import { SupportChat } from "@/components/SupportChat";
import { Zap, LogOut, ShieldCheck, MonitorPlay, Code, User } from "lucide-react";
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
      <header className="relative z-20 h-12 md:h-14 flex items-center justify-between px-2 md:px-5 shrink-0 glass border-b border-border/20">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center border border-primary/15 shadow-lg shadow-primary/10">
              <Zap className="w-4 h-4 md:w-[18px] md:h-[18px] text-primary" />
            </div>
            <div className="absolute -inset-1 rounded-xl bg-primary/10 blur-md -z-10 animate-breathe" />
          </div>
          <div className="leading-none">
            <h1 className="text-xs md:text-sm font-bold tracking-wide text-foreground">SnyX</h1>
            <p className="text-[8px] md:text-[9px] text-muted-foreground/40 font-medium tracking-widest uppercase mt-0.5 hidden sm:block">AI Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 md:gap-1">
          <AdminPresenceIndicator />
          <Link
            to="/iptv"
            className="flex items-center gap-1.5 text-xs font-medium px-2 md:px-3 py-1.5 md:py-2 rounded-xl text-muted-foreground/70 hover:text-foreground hover:bg-muted/20 transition-all duration-300 group"
          >
            <MonitorPlay className="w-4 h-4 group-hover:text-primary transition-colors duration-300" />
            <span className="hidden md:inline">TV</span>
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 text-xs font-medium px-2 md:px-3 py-1.5 md:py-2 rounded-xl text-muted-foreground/70 hover:text-foreground hover:bg-muted/20 transition-all duration-300 group"
            >
              <ShieldCheck className="w-4 h-4 group-hover:text-primary transition-colors duration-300" />
              <span className="hidden md:inline">Admin</span>
            </Link>
          )}

          {profile?.is_dev ? (
            <span className="badge-dev flex items-center gap-1 text-[10px] md:text-xs">
              <Code size={10} />
              DEV
            </span>
          ) : profile?.is_vip ? (
            <span className="badge-vip text-[10px] md:text-xs">VIP</span>
          ) : (
            <span className="badge-free text-[10px] md:text-xs">Free</span>
          )}

          <button
            onClick={() => setShowProfile(true)}
            className="w-8 h-8 md:w-9 md:h-9 rounded-xl overflow-hidden border border-border/30 hover:border-primary/20 transition-all duration-300 flex items-center justify-center bg-muted/10 hover:bg-muted/20 hover:shadow-lg hover:shadow-primary/5 group ml-0.5 md:ml-1"
            title="Minha conta"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
            )}
          </button>

          <button
            onClick={signOut}
            className="p-1.5 md:p-2 rounded-xl text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 transition-all duration-300"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {chatMode === "music" ? (
          <div className="flex-1 overflow-hidden flex flex-col bg-background items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
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
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all text-sm"
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
