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

import { User, ChatMessage } from '../types';
import { supabase } from '@/lib/supabaseClient';
import { invalidateCachedAccessToken, refreshAccessToken } from '@/utils/auth';

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

  // Per-user realtime subscription for all chat messages
  // This eliminates subscription gaps caused by per-chat subscriptions
  useEffect(() => {
    if (!user?.id) return;

    console.log(`[Realtime] Setting up per-user subscription for user ${user.id}`);

    let cancelled = false;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let retryDelay = 1000;
    let retryTimeout: number | null = null;

    const invalidateChatQueries = () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey?.[0];
          return (
            typeof key === 'string' &&
            (key.startsWith('/api/chats') || key.includes('/messages'))
          );
        },
      });
    };

    const scheduleRetry = () => {
      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
      }
      retryTimeout = window.setTimeout(() => {
        retryTimeout = null;
        subscribe();
      }, retryDelay);
      retryDelay = Math.min(Math.floor(retryDelay * 1.5), 5000);
    };

    const subscribe = () => {
      if (cancelled) {
        return;
      }

      if (currentChannel) {
        supabase.removeChannel(currentChannel);
        currentChannel = null;
      }

      currentChannel = supabase
        .channel('user-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('[Realtime] New message received:', payload.new);

            const newMessage = payload.new as ChatMessage;
            const chatUuid = newMessage.chat_uuid;
            const chatId = newMessage.chat_id;

            const mergeMessage = (oldMessages: ChatMessage[] = []) => {
              const exists = oldMessages.some((msg) => msg.id === newMessage.id);
              if (exists) {
                console.log('[Realtime] Message already in cache, skipping');
                return oldMessages;
              }
              console.log('[Realtime] Adding message to cache');
              return [...oldMessages, newMessage];
            };

            if (chatUuid) {
              queryClient.setQueryData<ChatMessage[]>([`/api/chats/${chatUuid}/messages`], mergeMessage);
            }
            if (typeof chatId === 'number') {
              queryClient.setQueryData<ChatMessage[]>([`/api/chats/${chatId}/messages`], mergeMessage);
              queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}`] });
            }

            queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
            if (newMessage.role === 'assistant') {
              setIsTyping(false);
            }
          }
        )
        .subscribe((status) => {
          console.log(`[Realtime] Per-user subscription status:`, status);
          if (status === 'SUBSCRIBED') {
            retryDelay = 1000;
            if (retryTimeout) {
              window.clearTimeout(retryTimeout);
              retryTimeout = null;
            }
            queryClient.refetchQueries({
              type: 'active',
              predicate: (query) => {
                const key = query.queryKey?.[0];
                if (typeof key !== 'string') {
                  return false;
                }
                if (key === '/api/chats') {
                  return true;
                }
                return key.includes('/messages');
              },
            });
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Realtime] Subscription issue (${status}), scheduling retry in ${retryDelay}ms`);
            invalidateChatQueries();
            setIsTyping(false);
            scheduleRetry();
          }

          if (status === 'CLOSED' && !cancelled) {
            console.warn('[Realtime] Subscription closed unexpectedly, resubscribing');
            setIsTyping(false);
            scheduleRetry();
          }
        });
    };

    subscribe();

    // Handle visibility change: refetch when tab regains focus
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[Realtime] Tab became visible, invalidating message queries');
        // Invalidate all message queries to catch any missed during tab sleep
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey?.[0];
            return typeof key === 'string' && key.includes('/messages');
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount or user change
    return () => {
      console.log(`[Realtime] Cleaning up per-user subscription for user ${user.id}`);
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (retryTimeout) {
        window.clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
        currentChannel = null;
      }
    };
  }, [user?.id, queryClient]);

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
