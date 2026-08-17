import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  can_view_all_leads: boolean;
  can_delete_documents: boolean;
  active: boolean;
};

type AuthValue = {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  /** Admin ou usuário com permissão explícita de excluir documentos comerciais. */
  canDeleteDocuments: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  profile: null,
  isAdmin: false,
  canDeleteDocuments: false,
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
          .select("id, full_name, email, can_view_all_leads, can_delete_documents, active")
          .eq("id", current.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", current.id),
      ]);
      setProfile((p as unknown as Profile) ?? null);
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

  const canDeleteDocuments = isAdmin || profile?.can_delete_documents === true;

  return (
    <AuthContext.Provider
      value={{ user, profile, isAdmin, canDeleteDocuments, loading, refresh: load }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
