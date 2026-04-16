import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Clock, AlertTriangle } from "lucide-react";
import Index from "./Index";

export default function Demo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [demo, setDemo] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadDemo = async () => {
      const { data } = await (supabase
        .from("clone_demos" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1) as any);

      if (data && data.length > 0) {
        setDemo(data[0]);
      } else {
        setExpired(true);
      }
    };
    loadDemo();
  }, [user]);

  // Countdown
  useEffect(() => {
    if (!demo) return;

    const interval = setInterval(() => {
      const expiresAt = new Date(demo.expires_at);
      const diff = expiresAt.getTime() - Date.now();

      if (diff <= 0) {
        setExpired(true);
        clearInterval(interval);
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [demo]);

  if (expired) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background flex-col gap-4 p-4">
        <AlertTriangle className="w-12 h-12 text-yellow-500" />
        <h1 className="text-2xl font-black">Demonstração expirada</h1>
        <p className="text-sm text-muted-foreground/60 text-center max-w-md">
          Sua hora de teste acabou. Assine para ter acesso completo e permanente ao seu site personalizado!
        </p>
        <button
          onClick={() => navigate("/clone-site")}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm"
        >
          Assinar agora
        </button>
      </div>
    );
  }

  if (!demo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Demo banner */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-yellow-500/90 text-black px-4 py-2 flex items-center justify-between text-xs font-bold backdrop-blur-sm">
        <span>⚡ DEMONSTRAÇÃO — {demo.site_name}</span>
        <div className="flex items-center gap-3">
          <span className="opacity-70">Acesso privado</span>
          <span className="flex items-center gap-1 bg-black/10 px-2 py-0.5 rounded font-mono">
            <Clock className="w-3 h-3" />
            {timeLeft}
          </span>
        </div>
      </div>

      {/* Push content down by banner height */}
      <div className="pt-9">
        <Index />
      </div>
    </div>
  );
}
