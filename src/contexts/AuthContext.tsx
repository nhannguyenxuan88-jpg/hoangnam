import { createContext, useContext, useEffect, useState } from "react";
// Use a single Supabase client app-wide to avoid multiple GoTrue instances
import { supabase } from "../supabaseClient";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { safeAudit } from "../lib/repository/auditLogsRepository";
import { showToast } from "../utils/toast";

export type UserRole = "owner" | "manager" | "staff";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const handleAuthEvent = async (
      event: AuthChangeEvent,
      nextSession: Session | null
    ) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        loadUserProfile(nextSession.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthEvent);

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      // Ưu tiên bảng profiles trước, sau đó fallback sang user_profiles nếu không có hoặc bảng không tồn tại
      let { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error && (error as any).code !== "PGRST116") {
        // Lỗi khác PGRST116 (table not found) => ném lỗi để hiển thị
        throw error;
      }

      if (!data) {
        const alt = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        data = alt.data as any;
        error = alt.error as any;
        if (error && (error as any).code !== "PGRST116") throw error;
      }

      if (error) throw error;
      if (!data) {
        setProfile(null);
      } else {
        setProfile(data as any);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      setProfile(null);
      setError("Không thể tải hồ sơ người dùng");
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    setError(null);
    // Audit login (best-effort)
    const userId = data?.user?.id || null;
    void safeAudit(userId, { action: "auth.login" });
  };

  const signOut = async () => {
    const currentUserId = user?.id || null;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setError(null);
    // Audit logout (best-effort)
    void safeAudit(currentUserId, { action: "auth.logout" });
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!profile) return false;
    return roles.includes(profile.role);
  };

  const value = {
    user,
    profile,
    session,
    loading,
    error,
    signIn,
    signOut,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
