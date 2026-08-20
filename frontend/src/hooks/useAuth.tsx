import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { AxiosError } from "axios";
import { authService } from "../services/auth.service";
import type { AuthContextValue, AuthStatus, AuthUser } from "../types";

const AuthContext = createContext<AuthContextValue | null>(null);

const resolveAuthErrorFromUrl = () => {
  const url = new URL(window.location.href);
  const authError = url.searchParams.get("authError");

  if (!authError) {
    return null;
  }

  url.searchParams.delete("authError");
  window.history.replaceState({}, "", url);

  return authError.replaceAll("_", " ");
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    setStatus("loading");

    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setError(null);
      setStatus("authenticated");
      return currentUser;
    } catch (authError) {
      if (authError instanceof AxiosError && authError.response?.status === 401) {
        setUser(null);
        setStatus("unauthenticated");
        return null;
      }

      setUser(null);
      setError(authService.getErrorMessage(authError, "Unable to restore your session."));
      setStatus("unauthenticated");
      return null;
    }
  };

  useEffect(() => {
    const authError = resolveAuthErrorFromUrl();

    if (authError) {
      setError(authError);
    }

    void refreshUser();
  }, []);

  const login = () => {
    window.location.assign(authService.getGoogleLoginUrl());
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      error,
      isAuthenticated: status === "authenticated",
      login,
      logout,
      refreshUser,
      clearError
    }),
    [error, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
};
