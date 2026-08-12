import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type DemoUser = { name: string; email: string };

const STORAGE_KEY = "edustarter.demo-user";

type AuthContextValue = {
  user: DemoUser | null;
  ready: boolean;
  signIn: (user: DemoUser) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Placeholder auth store. Persists a demo user in localStorage so the
 * protected dashboard shell can be exercised. Swap the internals for
 * Lovable Cloud auth in a later step — the API stays the same.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as DemoUser);
    } catch {
      // ignore malformed storage
    }
    setReady(true);
  }, []);

  const signIn = useCallback((next: DemoUser) => {
    setUser(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}