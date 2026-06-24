"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { login as loginRequest, me, register as registerRequest, updateProfile as updateProfileRequest } from "@/lib/api";
import type { AuthSession, User } from "@/lib/types";

type AuthContextValue = {
  token: string;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  updateProfile: (input: { name: string; language: "en" | "ar" }) => Promise<void>;
  logout: () => void;
};

const STORAGE_KEY = "bookbot-auth";
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setLoading(false);
      return;
    }

    const parsed = safeParseSession(saved);
    if (!parsed) {
      localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
      return;
    }

    setToken(parsed.token);
    setUser(parsed.user);
    me(parsed.token)
      .then((result) => setUser(result.user))
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken("");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(input: { email: string; password: string }) {
    const session = await loginRequest(input);
    saveSession(session);
  }

  async function register(input: { name: string; email: string; password: string }) {
    const session = await registerRequest(input);
    saveSession(session);
  }

  async function updateProfile(input: { name: string; language: "en" | "ar" }) {
    const result = await updateProfileRequest(input, token);
    const session = { token, user: result.user };
    saveSession(session);
  }

  function saveSession(session: AuthSession) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setToken(session.token);
    setUser(session.user);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setToken("");
    setUser(null);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAdmin: user?.role === "admin",
      login,
      register,
      updateProfile,
      logout
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

function safeParseSession(value: string): AuthSession | null {
  try {
    const parsed = JSON.parse(value) as AuthSession;
    if (!parsed.token || !parsed.user?.email) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
