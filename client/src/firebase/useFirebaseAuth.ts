import { useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  AuthError
} from 'firebase/auth';
import { auth, googleProvider } from './config';

interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
  error: string | null;
}

interface AuthMethods {
  signInWithEmail: (email: string, password: string) => Promise<FirebaseUser>;
  signUpWithEmail: (email: string, password: string) => Promise<FirebaseUser>;
  signInWithGoogle: () => Promise<FirebaseUser>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useFirebaseAuth = (): AuthState & AuthMethods => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If Firebase auth is not available, set loading to false
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleAuthError = (error: AuthError): never => {
    let errorMessage = 'An error occurred during authentication';
    
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        errorMessage = 'Invalid email or password';
        break;
      case 'auth/email-already-in-use':
        errorMessage = 'Email is already registered';
        break;
      case 'auth/weak-password':
        errorMessage = 'Password should be at least 6 characters';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address';
        break;
      case 'auth/popup-closed-by-user':
        errorMessage = 'Sign-in popup was closed';
        break;
      case 'auth/cancelled-popup-request':
        errorMessage = 'Only one popup request is allowed at once';
        break;
      default:
        errorMessage = error.message;
    }
    
    setError(errorMessage);
    throw new Error(errorMessage);
  };

  const signInWithEmail = async (email: string, password: string): Promise<FirebaseUser> => {
    if (!auth) {
      setError('Firebase not configured - email authentication not available');
      throw new Error('Firebase not configured - email authentication not available');
    }

    try {
      setError(null);
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      return handleAuthError(error as AuthError);
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string): Promise<FirebaseUser> => {
    if (!auth) {
      setError('Firebase not configured - email authentication not available');
      throw new Error('Firebase not configured - email authentication not available');
    }

    try {
      setError(null);
      setLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      return handleAuthError(error as AuthError);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (): Promise<FirebaseUser> => {
    if (!auth || !googleProvider) {
      setError('Firebase not configured - Google authentication not available');
      throw new Error('Firebase not configured - Google authentication not available');
    }

    try {
      setError(null);
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      return handleAuthError(error as AuthError);
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    if (!auth) {
      setError('Firebase not configured - logout not available');
      throw new Error('Firebase not configured - logout not available');
    }

    try {
      setError(null);
      await signOut(auth);
    } catch (error) {
      handleAuthError(error as AuthError);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    user,
    loading,
    error,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    logout,
    clearError,
  };
};