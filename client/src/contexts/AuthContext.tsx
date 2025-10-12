import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';

import { User } from '../types';
import { supabase } from '@/lib/supabaseClient';

// Authentication context type
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const queryClient = useQueryClient();
  const pendingProfileRequest = useRef<Promise<void> | null>(null);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  const fetchBackendUser = useCallback(async (accessToken: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      await supabase.auth.signOut();
      clearAuthState();
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || 'Failed to load user profile');
    }

    const userData: User = await response.json();
    setUser(userData);
  }, [clearAuthState]);

  const syncUserFromSession = useCallback(async (session: Session | null) => {
    if (!session?.access_token) {
      clearAuthState();
      return;
    }

    setToken(session.access_token);

    if (pendingProfileRequest.current) {
      await pendingProfileRequest.current;
      return;
    }

    const loader = (async () => {
      try {
        await fetchBackendUser(session.access_token);
      } catch (error) {
        console.error('Failed to refresh authenticated user:', error);
        clearAuthState();
      }
    })();

    pendingProfileRequest.current = loader;
    try {
      await loader;
    } finally {
      pendingProfileRequest.current = null;
    }
  }, [clearAuthState, fetchBackendUser]);

  useEffect(() => {
    let isMounted = true;

    const initialise = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }
        if (!isMounted) {
          return;
        }
        await syncUserFromSession(data.session ?? null);
      } catch (error) {
        console.error('Supabase session initialisation failed:', error);
        clearAuthState();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initialise();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUserFromSession(session);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [clearAuthState, syncUserFromSession]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(error.message);
      }
      await syncUserFromSession(data.session ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [syncUserFromSession]);

  const register = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        throw new Error(error.message);
      }
      if (data.session) {
        await syncUserFromSession(data.session);
      }
    } finally {
      setIsLoading(false);
    }
  }, [syncUserFromSession]);

  const loginWithGoogle = useCallback(async () => {
    const redirectTo = (import.meta.env.VITE_SUPABASE_REDIRECT_URL as string | undefined) ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const logout = useCallback(() => {
    supabase.auth.signOut().catch((error) => {
      console.error('Error signing out from Supabase:', error);
    });
    clearAuthState();
  }, [clearAuthState]);

  const refreshUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Failed to refresh Supabase session:', error);
      logout();
      return;
    }
    await syncUserFromSession(data.session ?? null);
  }, [logout, syncUserFromSession]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    login,
    register,
    loginWithGoogle,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for using the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
