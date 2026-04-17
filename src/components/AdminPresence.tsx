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
    <div className="group flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-primary/8 border border-primary/20 hover:bg-primary/12 hover:border-primary/30 transition-all duration-300">
      {/* Stacked avatars */}
      <div className="flex items-center -space-x-2">
        {onlineAdmins.slice(0, 3).map((a) => (
          <div
            key={a.user_id}
            className="relative w-5 h-5 rounded-full overflow-hidden border-2 border-background bg-muted"
            title={a.display_name || "Admin"}
          >
            {a.avatar_url ? (
              <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <ShieldCheck className="w-2.5 h-2.5 text-primary m-auto h-full" />
            )}
          </div>
        ))}
      </div>
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
      </span>
      <span className="text-[10px] font-semibold tracking-tight text-primary/90">
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
