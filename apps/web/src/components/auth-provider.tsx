"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiClientError, acceptReadingTerms as acceptReadingTermsRequest, login as loginRequest, me, register as registerRequest, updateProfile as updateProfileRequest } from "@/lib/api";
import type { AdminPermission } from "@/lib/api";
import type { AuthSession, User } from "@/lib/types";

type AuthContextValue = {
  token: string;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isOrgAdmin: boolean;
  /**
   * Whether this admin was granted one specific tool. Admin is no longer
   * all-or-nothing, so screens gate on this rather than on `isAdmin`. The
   * server enforces the same check — this only decides what is worth showing.
   */
  can: (permission: AdminPermission) => boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  updateProfile: (input: { name: string; language: "en" | "ar" }) => Promise<void>;
  /** Record acceptance of the reading agreement and refresh the cached session. */
  acceptTerms: () => Promise<void>;
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

    // Optimistically trust the cached session so the UI can render immediately,
    // then revalidate in the background.
    setToken(parsed.token);
    setUser(parsed.user);

    let settled = false;
    const stopLoading = () => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    };

    // Never strand the app on a spinner if /me hangs (server unreachable but the
    // socket stays open): fall back to the cached session after a timeout.
    const timer = setTimeout(stopLoading, 8000);

    me(parsed.token)
      .then((result) => setUser(result.user))
      .catch((error) => {
        // Only sign out on a real auth rejection. On network/timeout errors we
        // keep the cached session so offline users aren't kicked out.
        if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) {
          localStorage.removeItem(STORAGE_KEY);
          setToken("");
          setUser(null);
        }
      })
      .finally(() => {
        clearTimeout(timer);
        stopLoading();
      });

    return () => clearTimeout(timer);
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

  async function acceptTerms() {
    const result = await acceptReadingTermsRequest(token);
    saveSession({ token, user: result.user });
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
      isOrgAdmin: user?.role === "org_admin",
      can: (permission: AdminPermission) =>
        user?.role === "admin" && Boolean(user.adminPermissions?.includes(permission)),
      login,
      register,
      updateProfile,
      acceptTerms,
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
