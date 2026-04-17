import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck } from "lucide-react";

interface AdminPresenceEntry {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  last_seen_at: string;
}

export function AdminPresenceIndicator() {
  const [onlineAdmins, setOnlineAdmins] = useState<AdminPresenceEntry[]>([]);

  useEffect(() => {
    const loadAdmins = async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("admin_presence")
        .select("user_id, display_name, avatar_url, last_seen_at")
        .gte("last_seen_at", fiveMinutesAgo);
      if (data) setOnlineAdmins(data);
    };

    loadAdmins();

    const channel = supabase
      .channel("admin-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_presence" }, () => {
        loadAdmins();
      })
      .subscribe();

    const interval = setInterval(loadAdmins, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (onlineAdmins.length === 0) return null;

  return (
    <div className="group relative flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-gradient-to-r from-emerald-500/10 via-emerald-400/5 to-transparent border border-emerald-400/25 hover:border-emerald-300/45 hover:shadow-[0_0_22px_-6px_hsl(152_76%_55%/0.55)] backdrop-blur-xl transition-all duration-300 overflow-hidden">
      {/* shimmer sweep */}
      <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1400ms] ease-out bg-gradient-to-r from-transparent via-emerald-300/15 to-transparent" aria-hidden />

      {/* Stacked avatars */}
      <div className="relative flex items-center -space-x-2">
        {onlineAdmins.slice(0, 3).map((a) => (
          <div
            key={a.user_id}
            className="relative w-6 h-6 rounded-full overflow-hidden border-2 border-background bg-muted ring-1 ring-emerald-400/40 shadow-[0_0_8px_-2px_hsl(152_76%_55%/0.6)] hover:scale-110 hover:z-10 transition-transform duration-300"
            title={a.display_name || "Admin"}
          >
            {a.avatar_url ? (
              <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <ShieldCheck className="w-3 h-3 text-emerald-300 m-auto h-full" />
            )}
          </div>
        ))}
      </div>

      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-[0_0_8px_hsl(152_76%_55%)]" />
      </span>

      <span className="relative text-[10px] font-bold tracking-wide uppercase bg-gradient-to-r from-emerald-200 to-emerald-400 bg-clip-text text-transparent">
        {onlineAdmins.length} online
      </span>
    </div>
  );
}

export function useAdminHeartbeat() {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user) return;

    const checkAndBeat = async () => {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return;

      const upsertPresence = async () => {
        await supabase.from("admin_presence").upsert({
          user_id: user.id,
          display_name: profile?.display_name || user.email || "Admin",
          avatar_url: profile?.avatar_url || null,
          last_seen_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      };

      upsertPresence();
      const interval = setInterval(upsertPresence, 60000);

      return () => {
        clearInterval(interval);
        supabase.from("admin_presence").delete().eq("user_id", user.id);
      };
    };

    let cleanup: (() => void) | undefined;
    checkAndBeat().then((c) => { cleanup = c; });

    return () => {
      cleanup?.();
    };
  }, [user, profile?.display_name, profile?.avatar_url]);
}
