import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  ready: boolean;
  displayName: string;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  const user = session?.user ?? null;
  const displayName =
    (user?.user_metadata?.["first_name"] as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Student";

  const value = useMemo(
    () => ({ user, session, ready, displayName, signOut }),
    [user, session, ready, displayName, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/** Turns backend auth errors into friendly, student-facing messages. */
export function friendlyAuthError(message?: string | null): string {
  const raw = (message ?? "").toLowerCase();
  if (!raw) return "Something went wrong. Please try again.";
  if (raw.includes("invalid login credentials"))
    return "That email and password don't match. Please check them and try again.";
  if (raw.includes("email not confirmed"))
    return "Please confirm your email first — check your inbox for the link we sent you.";
  if (raw.includes("user already registered") || raw.includes("already been registered"))
    return "You already have an account with this email. Try logging in instead.";
  if (raw.includes("password should be at least"))
    return "Your password is too short — please use at least 6 characters.";
  if (raw.includes("weak and easy to guess") || raw.includes("pwned") || raw.includes("known to be weak"))
    return "That password has appeared in known data breaches. Please choose a stronger, more unique password.";
  if (raw.includes("rate limit") || raw.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";
  if (raw.includes("unable to validate email") || raw.includes("invalid email"))
    return "That email address doesn't look right. Please check it and try again.";
  if (raw.includes("network") || raw.includes("fetch"))
    return "We couldn't reach EduStarter. Please check your internet connection.";
  return "Something went wrong. Please try again.";
}
