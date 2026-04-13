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
    <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20">
      <div className="relative">
        <ShieldCheck size={14} className="text-emerald-400" />
        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>
      <span className="text-[10px] font-medium text-emerald-400">
        {onlineAdmins.length} Admin{onlineAdmins.length > 1 ? "s" : ""} online
      </span>
    </div>
  );
}

export function useAdminHeartbeat() {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user) return;

    let active = false;

    const checkAndBeat = async () => {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return;
      active = true;

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
