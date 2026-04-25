import { createContext, useContext, useState, useEffect } from "react";
import { env } from "@/config/env";

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthConfigured: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_KEY = "zmt_auth";
const APP_PASSWORD = env.appPassword;
const APP_PASSWORD_HASH = env.appPasswordHash;

function isSha256Hash(value: string | undefined): value is string {
  return !!value && /^[a-f0-9]{64}$/i.test(value);
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }

  return mismatch === 0;
}

async function sha256Hex(value: string) {
  if (!globalThis.crypto?.subtle) return undefined;

  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem(AUTH_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(AUTH_KEY, String(isAuthenticated));
  }, [isAuthenticated]);

  async function login(password: string): Promise<boolean> {
    if (isSha256Hash(APP_PASSWORD_HASH)) {
      const passwordHash = await sha256Hex(password);
      if (passwordHash && timingSafeEqual(passwordHash, APP_PASSWORD_HASH)) {
        setIsAuthenticated(true);
        return true;
      }
    }

    if (APP_PASSWORD && timingSafeEqual(password, APP_PASSWORD)) {
      setIsAuthenticated(true);
      return true;
    }

    return false;
  }

  function logout() {
    setIsAuthenticated(false);
  }

  const isAuthConfigured = !!APP_PASSWORD || isSha256Hash(APP_PASSWORD_HASH);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAuthConfigured, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
