import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api, type ChildInfo } from "@/lib/api";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  child: ChildInfo | null;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [child, setChild] = useState<ChildInfo | null>(null);

  useEffect(() => {
    api.getDashboard()
      .then((data) => {
        setChild(data.child);
        setIsAuthenticated(true);
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (token: string) => {
    const result = await api.login(token);
    setChild(result.child);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setChild(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, child, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
