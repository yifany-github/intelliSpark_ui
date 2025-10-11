import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { User } from '../types';
import { useFirebaseAuth } from '../firebase/useFirebaseAuth';
import { User as FirebaseUser } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { isTokenValid, clearTokenValidationCache } from '../utils/auth';
import {
  getAccessToken as getStoredAccessToken,
  getRefreshToken as getStoredRefreshToken,
  setAccessToken as persistAccessToken,
  setRefreshToken as persistRefreshToken,
  clearStoredTokens,
  ACCESS_TOKEN_UPDATED_EVENT,
  TOKENS_CLEARED_EVENT,
} from '../utils/tokenManager';
import { forceRefreshAccessToken, apiRequest } from '@/lib/queryClient';

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
  // Legacy support for components that still use username
  loginLegacy: (username: string, password: string) => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExchangingToken, setIsExchangingToken] = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const exchangePromiseRef = useRef<Promise<void> | null>(null);

  const firebaseAuth = useFirebaseAuth();
  const queryClient = useQueryClient();

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  // Initialize auth state from stored credentials and Firebase
  useEffect(() => {
    const initializeAuth = async () => {
      if (firebaseAuth.loading) {
        return;
      }

      try {
        let activeToken = getStoredAccessToken();
        const storedRefresh = getStoredRefreshToken();

        if (activeToken && !isTokenValid(activeToken)) {
          activeToken = null;
        }

        if (!activeToken && storedRefresh) {
          try {
            activeToken = await forceRefreshAccessToken();
          } catch (error) {
            console.warn('Failed to refresh stored token on init:', error);
            clearStoredTokens();
            clearTokenValidationCache();
            activeToken = null;
          }
        }

        if (activeToken) {
          setToken(activeToken);
          await getCurrentUser(activeToken);
        } else {
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        clearStoredTokens();
        clearTokenValidationCache();
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [firebaseAuth.loading]);

  // Handle Firebase auth state changes
  useEffect(() => {
    if (!firebaseAuth.loading && firebaseAuth.user && (!token || !isTokenValid(token))) {
      // Ensure only one exchange runs at a time
      startTokenExchange(firebaseAuth.user).catch(error => {
        console.error('Error exchanging Firebase token:', error);
        setExchangeError(error instanceof Error ? error.message : 'Authentication failed');
      });
    } else if (!firebaseAuth.loading && !firebaseAuth.user && token) {
      // Firebase user is logged out but we still have a backend token
      // This shouldn't normally happen, but clean up if it does
      logout();
    }
  }, [firebaseAuth.user, firebaseAuth.loading, token]);

  useEffect(() => {
    return () => {
      exchangePromiseRef.current = null;
    };
  }, []);

  // Listen for token expiration events from API requests
  useEffect(() => {
    const handleTokenExpired = () => {
      console.log('Token expired event received, logging out...');
      setToken(null);
      setUser(null);
      setIsExchangingToken(false);
      exchangePromiseRef.current = null;
      clearStoredTokens();
      queryClient.clear();
      clearTokenValidationCache();
    };

    window.addEventListener('auth-token-expired', handleTokenExpired);
    return () => window.removeEventListener('auth-token-expired', handleTokenExpired);
  }, [queryClient]);

  useEffect(() => {
    const handleTokenUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ token?: string | null }>).detail;
      const latestToken = detail?.token ?? getStoredAccessToken();
      setToken(latestToken ?? null);
    };

    const handleTokensCleared = () => {
      setToken(null);
      setUser(null);
      setIsExchangingToken(false);
      exchangePromiseRef.current = null;
    };

    window.addEventListener(ACCESS_TOKEN_UPDATED_EVENT, handleTokenUpdated as EventListener);
    window.addEventListener(TOKENS_CLEARED_EVENT, handleTokensCleared);

    return () => {
      window.removeEventListener(ACCESS_TOKEN_UPDATED_EVENT, handleTokenUpdated as EventListener);
      window.removeEventListener(TOKENS_CLEARED_EVENT, handleTokensCleared);
    };
  }, []);

  // Handle successful Firebase authentication
  const handleFirebaseAuthSuccess = async (firebaseUser: FirebaseUser): Promise<void> => {
    try {
      // Get Firebase ID token
      const firebaseToken = await firebaseUser.getIdToken();
      
      // Exchange Firebase token for backend JWT token
      const response = await fetch(`${API_BASE_URL}/api/auth/login/firebase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firebase_token: firebaseToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to authenticate with backend');
      }

      const data = await response.json();
      const authToken: string | undefined = data?.access_token;
      const refreshToken: string | undefined = data?.refresh_token;

      if (!authToken || !refreshToken) {
        throw new Error('Backend did not return token pair');
      }

      persistAccessToken(authToken);
      persistRefreshToken(refreshToken);
      setToken(authToken);
      setExchangeError(null);
      clearTokenValidationCache();

      // Get user info
      await getCurrentUser(authToken);

      // Refresh chat-related cached data now that we have a fresh session
      queryClient.setQueryDefaults(['/api/chats'], { staleTime: 0 });
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/chats/') && key.endsWith('/messages');
        }
      });
    } catch (error) {
      console.error('Error handling Firebase auth success:', error);
      throw error;
    }
  };

  const startTokenExchange = (firebaseUser: FirebaseUser): Promise<void> => {
    if (!firebaseUser) {
      return Promise.reject(new Error('Firebase user is required for token exchange'));
    }

    if (exchangePromiseRef.current) {
      return exchangePromiseRef.current;
    }

    const exchangePromise = (async () => {
      setIsExchangingToken(true);
      try {
        await handleFirebaseAuthSuccess(firebaseUser);
      } finally {
        setIsExchangingToken(false);
        exchangePromiseRef.current = null;
      }
    })();

    exchangePromiseRef.current = exchangePromise;
    return exchangePromise;
  };

  // Get current user from API
  const getCurrentUser = async (authToken: string): Promise<void> => {
    try {
      const response = await apiRequest('GET', `/api/auth/me`);
      const userData = await response.json();
      setUser(userData);
    } catch (error) {
      console.error('Error getting current user:', error);
      // Only clear auth state if this token is still the active one
      const currentStoredToken = getStoredAccessToken();
      if (currentStoredToken === authToken) {
        clearStoredTokens();
        clearTokenValidationCache();
        setToken(null);
        setUser(null);
      } else {
        console.log('Token exchange already updated auth state, skipping clear');
      }
      throw error;
    }
  };

  // Login function with email (Firebase + Backend)
  const login = async (email: string, password: string): Promise<void> => {
    try {
      // First authenticate with Firebase
      const firebaseUser = await firebaseAuth.signInWithEmail(email, password);

      // Ensure token exchange runs in a single flight
      await startTokenExchange(firebaseUser);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Register function with email (Firebase + Backend)
  const register = async (email: string, password: string): Promise<void> => {
    try {
      // First create account with Firebase
      const firebaseUser = await firebaseAuth.signUpWithEmail(email, password);

      // Run backend token exchange once
      await startTokenExchange(firebaseUser);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  // Google login function
  const loginWithGoogle = async (): Promise<void> => {
    try {
      // Authenticate with Google via Firebase
      const firebaseUser = await firebaseAuth.signInWithGoogle();

      await startTokenExchange(firebaseUser);
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  // Legacy login function for existing username-based users
  const loginLegacy = async (username: string, password: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login/legacy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();
      const authToken: string | undefined = data?.access_token;
      const refreshToken: string | undefined = data?.refresh_token;

      if (!authToken || !refreshToken) {
        throw new Error('Login response missing tokens');
      }

      persistAccessToken(authToken);
      persistRefreshToken(refreshToken);
      setToken(authToken);
      clearTokenValidationCache();

      // Get user info
      await getCurrentUser(authToken);
    } catch (error) {
      console.error('Legacy login error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = (): void => {
    const refreshToken = getStoredRefreshToken();
    clearStoredTokens();
    setToken(null);
    setUser(null);
    setIsExchangingToken(false);
    exchangePromiseRef.current = null;
    // Clear all cached queries
    queryClient.clear();
    clearTokenValidationCache();
    if (refreshToken) {
      fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        credentials: 'include',
      }).catch((error) => {
        console.warn('Failed to notify backend of logout', error);
      });
    }
    // Also sign out from Firebase
    firebaseAuth.logout().catch(console.error);
  };

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    const latestToken = getStoredAccessToken();
    if (latestToken) {
      try {
        await getCurrentUser(latestToken);
      } catch (error) {
        console.error('Error refreshing user:', error);
        logout();
      }
    }
  };

  // Import shared token validation utility
  // (isTokenValid function moved to shared utils/auth.ts)

  const value = {
    user,
    token,
    isAuthenticated: !!user && !!token && isTokenValid(token),
    isLoading: isLoading || firebaseAuth.loading,
    login,
    register,
    loginWithGoogle,
    loginLegacy,
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
