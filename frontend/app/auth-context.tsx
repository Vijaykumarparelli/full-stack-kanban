"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { api } from "./api";

interface AuthState {
  authenticated: boolean;
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  authenticated: false,
  username: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me()
      .then((data) => {
        setAuthenticated(true);
        setUsername(data.username);
      })
      .catch(() => {
        setAuthenticated(false);
        setUsername(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(() => {
    api.logout().catch(() => {}).finally(() => {
      setAuthenticated(false);
      setUsername(null);
    });
  }, []);

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [logout]);

  const login = async (user: string, pass: string) => {
    const data = await api.login(user, pass);
    setAuthenticated(true);
    setUsername(data.username);
  };

  return (
    <AuthContext.Provider value={{ authenticated, username, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
