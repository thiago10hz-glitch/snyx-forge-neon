import { useState, useEffect, createContext, useContext, useRef, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  is_vip: boolean;
  is_dev: boolean;
  is_pack_steam: boolean;
  is_rpg_premium: boolean;
  display_name: string | null;
  free_messages_used: number;
  banned_until: string | null;
  avatar_url: string | null;
  bio: string | null;
  relationship_status: string | null;
  hosting_tier: string;
  team_badge: string | null;
  gender: string | null;
  partner_user_id: string | null;
  background_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

// In-flight dedup: only one profile fetch at a time
let profileFetchPromise: Promise<Profile | null> | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    // Deduplicate concurrent calls
    if (profileFetchPromise) return profileFetchPromise;
    
    const doFetch = async (): Promise<Profile | null> => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("is_vip, is_dev, is_pack_steam, is_rpg_premium, display_name, free_messages_used, banned_until, avatar_url, bio, relationship_status, hosting_tier, team_badge, gender, partner_user_id, background_url")
          .eq("user_id", userId)
          .single();
        const p = data as Profile | null;
        if (p) setProfile(p);
        return p;
      } catch {
        return null;
      } finally {
        profileFetchPromise = null;
      }
    };

    profileFetchPromise = doFetch();
    return profileFetchPromise;
  }, []);

  useEffect(() => {
    // Get initial session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
      initializedRef.current = true;
    });

    // Then listen for changes (skip the initial event since we handle it above)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!initializedRef.current) return; // Skip first event, handled by getSession
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      profileFetchPromise = null; // Force fresh fetch
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
