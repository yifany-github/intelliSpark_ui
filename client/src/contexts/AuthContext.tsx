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
import { invalidateCachedAccessToken, refreshAccessToken } from '@/utils/auth';
import { updateAuthStore, clearAuthStore as clearAuthStoreModule } from '@/lib/authStore';

// Authentication context type
interface AuthContextType {
  user: User | null;
  token: string | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReady: boolean;
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
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const queryClient = useQueryClient();
  const pendingProfileRequest = useRef<Promise<void> | null>(null);
  const lastCacheInvalidation = useRef<number>(0);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setToken(null);
    setSession(null);
    invalidateCachedAccessToken();
    clearAuthStoreModule(); // ← Keep authStore in sync

    const privatePrefixes = [
      '/api/auth',
      '/api/payment',
      '/api/chats',
      '/api/notifications',
      '/api/preferences',
      '/api/admin',
    ];
    const privateExactKeys = new Set([
      'tokenBalance',
      'tokenUsageStats',
      'tokenTransactions',
      'pricingTiers',
      'savedPaymentMethods',
    ]);

    queryClient.removeQueries({
      predicate: (query) => {
        const key = query.queryKey?.[0];
        if (typeof key !== 'string') {
          return false;
        }
        if (privateExactKeys.has(key)) {
          return true;
        }
        return privatePrefixes.some((prefix) => key.startsWith(prefix));
      },
    });

  }, [queryClient, setSession]);

  const fetchBackendUser = useCallback(async (accessToken: string) => {
    const fetchWithToken = async (token: string) =>
      fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

    let response = await fetchWithToken(accessToken);

    if (response.status === 401) {
      console.warn('[Auth] /api/auth/me returned 401, attempting to fetch fresh session');
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) {
        console.warn('[Auth] Unable to obtain fresh session, signing out');
        await supabase.auth.signOut();
        clearAuthState();
        throw new Error('Session expired');
      }

      const newToken = data.session.access_token;
      setToken(newToken);
      response = await fetchWithToken(newToken);

      if (response.status === 401) {
        console.warn('[Auth] /api/auth/me still 401 after session check, signing out');
        await supabase.auth.signOut();
        clearAuthState();
        throw new Error('Session expired');
      }
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
    setSession(session);
    updateAuthStore(session.access_token, session); // ← Keep authStore in sync

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
  }, [clearAuthState, fetchBackendUser, setSession]);

  useEffect(() => {
    let isMounted = true;

    console.log('[Auth] Setting up auth state listener');

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      console.log(`[Auth] Auth state change event: ${event}`);

      if (event === 'INITIAL_SESSION') {
        // This is the ONLY place where isReady should be set to true
        // Wait for session sync before marking ready
        await syncUserFromSession(session);

        if (isMounted) {
          console.log('[Auth] Initial session handled, marking ready');
          setIsReady(true);
          setIsLoading(false);
        }
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('[Auth] User signed in or token refreshed');
        invalidateCachedAccessToken();
        await syncUserFromSession(session);

        // Invalidate all private queries to refetch with new token
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey?.[0];
            return typeof key === 'string' && key.startsWith('/api/');
          }
        });
      }

      if (event === 'SIGNED_OUT') {
        console.log('[Auth] User signed out');
        clearAuthState();

        if (isMounted) {
          setIsReady(true);
          setIsLoading(false);
        }
        return;
      }

      // Handle other events (USER_UPDATED, PASSWORD_RECOVERY, etc.)
      await syncUserFromSession(session);
    });

    return () => {
      console.log('[Auth] Cleaning up auth state listener');
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [clearAuthState, queryClient, syncUserFromSession]);

  // Realtime subscriptions moved to dedicated hooks:
  // - useRealtimeChatList (for global chat list updates)
  // - useRealtimeMessages (for per-chat message updates)
  // This separation of concerns makes AuthContext cleaner and scopes
  // subscriptions to where they're actually needed.

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
    session,
    isAuthenticated: Boolean(user && token),
    isLoading,
    isReady,
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
