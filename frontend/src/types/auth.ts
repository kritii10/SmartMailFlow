export type AuthUser = {
  id: string;
  googleId: string;
  name: string | null;
  email: string;
  avatar: string | null;
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  clearError: () => void;
};
