import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { useFirebaseAuth } from '../firebase/useFirebaseAuth';
import { User as FirebaseUser } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';

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
  
  const firebaseAuth = useFirebaseAuth();

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  // Initialize auth state from localStorage and Firebase
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Wait for Firebase auth to initialize
        if (!firebaseAuth.loading) {
          const storedToken = localStorage.getItem('auth_token');
          if (storedToken) {
            setToken(storedToken);
            await getCurrentUser(storedToken);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Clear invalid token
        localStorage.removeItem('auth_token');
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [firebaseAuth.loading]);

  // Handle Firebase auth state changes
  useEffect(() => {
    if (!firebaseAuth.loading && firebaseAuth.user && !token) {
      // Firebase user is authenticated but we don't have a backend token
      // This happens after successful Firebase authentication
      handleFirebaseAuthSuccess(firebaseAuth.user);
    } else if (!firebaseAuth.loading && !firebaseAuth.user && token) {
      // Firebase user is logged out but we still have a backend token
      // This shouldn't normally happen, but clean up if it does
      logout();
    }
  }, [firebaseAuth.user, firebaseAuth.loading, token]);

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
      const authToken = data.access_token;

      // Store token
      localStorage.setItem('auth_token', authToken);
      setToken(authToken);

      // Get user info
      await getCurrentUser(authToken);
    } catch (error) {
      console.error('Error handling Firebase auth success:', error);
      throw error;
    }
  };

  // Get current user from API
  const getCurrentUser = async (authToken: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get user info');
      }

      const userData = await response.json();
      setUser(userData);
    } catch (error) {
      console.error('Error getting current user:', error);
      // Clear invalid token
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
      throw error;
    }
  };

  // Login function with email (Firebase + Backend)
  const login = async (email: string, password: string): Promise<void> => {
    try {
      // First authenticate with Firebase
      const firebaseUser = await firebaseAuth.signInWithEmail(email, password);
      
      // Firebase auth success handler will exchange token with backend
      await handleFirebaseAuthSuccess(firebaseUser);
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
      
      // Firebase auth success handler will create user in backend and get token
      await handleFirebaseAuthSuccess(firebaseUser);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  // Google login function
  const loginWithGoogle = async (): Promise<void> => {
    try {
      // Authenticate with Google via Firebase
      await firebaseAuth.signInWithGoogle();
      
      // Let useEffect handle the backend exchange automatically
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
      const authToken = data.access_token;

      // Store token
      localStorage.setItem('auth_token', authToken);
      setToken(authToken);

      // Get user info
      await getCurrentUser(authToken);
    } catch (error) {
      console.error('Legacy login error:', error);
      throw error;
    }
  };

  const queryClient = useQueryClient();

  // Logout function
  const logout = (): void => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    // Clear all cached queries
    queryClient.clear();
    // Also sign out from Firebase
    firebaseAuth.logout().catch(console.error);
  };

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    if (token) {
      try {
        await getCurrentUser(token);
      } catch (error) {
        console.error('Error refreshing user:', error);
        logout();
      }
    }
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user && !!token,
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