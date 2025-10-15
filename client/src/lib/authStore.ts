import { Session } from '@supabase/supabase-js';

/**
 * Module-level auth store (outside React)
 * This singleton is kept in sync by AuthContext and used by queryFn
 * to access tokens without needing React hooks.
 */
interface AuthStore {
  token: string | null;
  expiresAt: number;
  session: Session | null;
}

let authStore: AuthStore = {
  token: null,
  expiresAt: 0,
  session: null,
};

/**
 * Get the current auth store state.
 * Can be called from anywhere (including React Query's queryFn).
 */
export function getAuthStore(): Readonly<AuthStore> {
  return authStore;
}

/**
 * Update the auth store with new session data.
 * Called by AuthContext when session changes.
 */
export function updateAuthStore(token: string | null, session: Session | null) {
  authStore = {
    token,
    expiresAt: session?.expires_at ? session.expires_at * 1000 : 0,
    session,
  };

  console.log('[AuthStore] Updated:', {
    hasToken: !!token,
    expiresAt: authStore.expiresAt ? new Date(authStore.expiresAt).toISOString() : null,
  });
}

/**
 * Clear the auth store.
 * Called by AuthContext on logout or session expiry.
 */
export function clearAuthStore() {
  authStore = {
    token: null,
    expiresAt: 0,
    session: null,
  };

  console.log('[AuthStore] Cleared');
}

/**
 * Check if the current token is expired or will expire soon (within 5 minutes).
 * Returns true if:
 * - No token exists
 * - Token has already expired
 * - Token will expire in less than 5 minutes
 */
export function isTokenExpired(): boolean {
  if (!authStore.token) {
    return true;
  }

  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  // Consider token expired if it expires within next 5 minutes
  return now >= (authStore.expiresAt - fiveMinutes);
}

/**
 * Get time until token expiration in milliseconds.
 * Returns 0 if token is already expired or doesn't exist.
 */
export function getTimeUntilExpiry(): number {
  if (!authStore.token || !authStore.expiresAt) {
    return 0;
  }

  const remaining = authStore.expiresAt - Date.now();
  return Math.max(0, remaining);
}
