"use client";

import { createContext, useContext, useEffect, useReducer, useState } from "react";
import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { auth, initAnalytics } from "@/lib/firebase/client";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  emailVerified: boolean;
  reloadUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true, isAdmin: false, emailVerified: false,
  reloadUser: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  // Lets us force a re-render after user.reload() (which mutates the user in place).
  const [, force] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    initAnalytics();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // force-refresh so newly-granted custom claims (e.g. admin) show up
        const res = await u.getIdTokenResult(true);
        setIsAdmin(res.claims.admin === true);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function reloadUser() {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser(auth.currentUser);
    force();
  }

  return (
    <Ctx.Provider value={{
      user, loading, isAdmin,
      emailVerified: !!user?.emailVerified,
      reloadUser,
      signOut: () => fbSignOut(auth),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
