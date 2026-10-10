"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ApiError, tokenStore } from "@/lib/api";
import { authApi } from "@/services/busmate";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  /** Re-load the signed-in user from the server (e.g. after editing the profile). */
  refresh: () => Promise<void>;
  /** Replace the cached user with fresh data the caller already has (e.g. the PUT /me response). */
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    const onLogout = () => { setUser(null); router.replace("/login"); };
    window.addEventListener("busmate:logout", onLogout);
    if (!tokenStore.get()) { setReady(true); return () => window.removeEventListener("busmate:logout", onLogout); }
    authApi.me()
      .then(({ user }) => {
        if (user.role !== "ADMIN") { tokenStore.clear(); return; }
        setUser(user);
      })
      .catch(() => { /* 401 handled by api(); network errors keep the user on the login page */ })
      .finally(() => setReady(true));
    return () => window.removeEventListener("busmate:logout", onLogout);
  }, [router]);

  const login = useCallback(async (identifier: string, password: string) => {
    const { token, user } = await authApi.login(identifier, password);
    if (user.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Only college administrators can use the dashboard.");
    tokenStore.set(token);
    setUser(user);
  }, []);

  const refresh = useCallback(async () => {
    const { user } = await authApi.me();
    if (user.role === "ADMIN") setUser(user);
  }, []);

  const updateUser = useCallback((next: User) => {
    setUser((cur) => (cur ? { ...cur, ...next } : next));
  }, []);

  return <AuthContext.Provider value={{ user, ready, login, logout, refresh, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
