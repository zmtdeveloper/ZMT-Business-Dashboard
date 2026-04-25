import { createContext, useContext, useState, useEffect } from "react";
import { env } from "@/config/env";

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthConfigured: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_KEY = "zmt_auth";
const APP_PASSWORD = env.appPassword;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem(AUTH_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(AUTH_KEY, String(isAuthenticated));
  }, [isAuthenticated]);

  function login(password: string): boolean {
    if (APP_PASSWORD && password === APP_PASSWORD) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }

  function logout() {
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAuthConfigured: !!APP_PASSWORD, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
