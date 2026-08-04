import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  can_view_all_leads: boolean;
  active: boolean;
};

type AuthValue = {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.auth.getUser();
    const current = data.user ?? null;
    setUser(current);
    if (current) {
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, can_view_all_leads, active")
          .eq("id", current.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", current.id),
      ]);
      setProfile((p as Profile) ?? null);
      setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
    } else {
      setProfile(null);
      setIsAdmin(false);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, loading, refresh: load }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
