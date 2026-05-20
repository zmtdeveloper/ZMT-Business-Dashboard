import { createContext, useContext, useState, useEffect } from "react";
import { env } from "@/config/env";

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthConfigured: boolean;
  currentUser: AppUser | null;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
}

export interface AppUser {
  id: "owner" | "showcase";
  name: string;
  role: "owner" | "showcase";
  storagePrefix: "" | "showcase";
  canSyncSheets: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_KEY = "zmt_auth";
const AUTH_SESSION_KEY = "zmt_auth_session";
const APP_PASSWORD = env.appPassword;
const APP_PASSWORD_HASH = env.appPasswordHash;
const SHOWCASE_PASSWORD = env.showcasePassword;

const OWNER_USER: AppUser = {
  id: "owner",
  name: "Business Owner",
  role: "owner",
  storagePrefix: "",
  canSyncSheets: true,
};

const SHOWCASE_USER: AppUser = {
  id: "showcase",
  name: "Showcase User",
  role: "showcase",
  storagePrefix: "showcase",
  canSyncSheets: false,
};

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

function loadSessionUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string };
      if (parsed.id === "showcase") return SHOWCASE_USER;
      if (parsed.id === "owner") return OWNER_USER;
    }
  } catch {
    // Ignore malformed session storage.
  }

  const legacySession = localStorage.getItem(AUTH_KEY);
  if (legacySession === "showcase") return SHOWCASE_USER;
  if (legacySession === "owner" || legacySession === "true") return OWNER_USER;

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => loadSessionUser());
  const isAuthenticated = !!currentUser;

  useEffect(() => {
    localStorage.setItem(AUTH_KEY, currentUser?.id ?? "false");
    if (currentUser) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ id: currentUser.id }));
    } else {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  }, [currentUser, isAuthenticated]);

  async function login(password: string): Promise<boolean> {
    if (SHOWCASE_PASSWORD && timingSafeEqual(password, SHOWCASE_PASSWORD)) {
      setCurrentUser(SHOWCASE_USER);
      return true;
    }

    if (isSha256Hash(APP_PASSWORD_HASH)) {
      const passwordHash = await sha256Hex(password);
      if (passwordHash && timingSafeEqual(passwordHash, APP_PASSWORD_HASH)) {
        setCurrentUser(OWNER_USER);
        return true;
      }
    }

    if (APP_PASSWORD && timingSafeEqual(password, APP_PASSWORD)) {
      setCurrentUser(OWNER_USER);
      return true;
    }

    return false;
  }

  function logout() {
    setCurrentUser(null);
  }

  const isAuthConfigured = !!APP_PASSWORD || isSha256Hash(APP_PASSWORD_HASH) || !!SHOWCASE_PASSWORD;

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAuthConfigured, currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
