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
import { clearPendingChatRequest } from '@/utils/pendingChat';

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
  const lastCacheInvalidation = useRef<number>(0);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setToken(null);

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

    try {
      clearPendingChatRequest();
    } catch (error) {
      console.warn('[Auth] Failed to clear pending chat request during logout', error);
    }
  }, [queryClient]);

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

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Invalidate React Query caches on token refresh or sign in to prevent stale data
      // Throttle to prevent rate limit loops (max once per 10 seconds)
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        const now = Date.now();
        const timeSinceLastInvalidation = now - lastCacheInvalidation.current;

        if (timeSinceLastInvalidation > 10000) {
          console.log(`[Auth] ${event} - Invalidating React Query caches`);
          lastCacheInvalidation.current = now;

          queryClient.invalidateQueries({
            predicate: (query) => {
              const key = query.queryKey?.[0];
              return typeof key === 'string' && key.startsWith('/api/');
            }
          });
        } else {
          console.log(`[Auth] ${event} - Skipping cache invalidation (throttled, ${Math.round(timeSinceLastInvalidation / 1000)}s ago)`);
        }
      }

      syncUserFromSession(session);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [clearAuthState, syncUserFromSession]);

  // Per-user realtime subscription for all chat messages
  // This eliminates subscription gaps caused by per-chat subscriptions
  useEffect(() => {
    if (!user?.id) return;

    console.log(`[Realtime] Setting up per-user subscription for user ${user.id}`);

    const channel = supabase
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

          // Update cache for the specific chat this message belongs to
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

          // Invalidate chat list to update message counts
          queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
          if (newMessage.role === 'assistant') {
            setIsTyping(false);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Per-user subscription status:`, status);
      });

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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
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
