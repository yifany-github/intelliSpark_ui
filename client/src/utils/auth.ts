import { supabase } from "@/lib/supabaseClient";
import { getAuthStore, isTokenExpired, updateAuthStore } from "@/lib/authStore";

let inFlightRefreshPromise: Promise<string | null> | null = null;

/**
 * Get the current access token from authStore.
 * If token is expired or will expire soon, automatically refresh it.
 *
 * This function can be called from React Query's queryFn (outside React).
 * The authStore is kept in sync by AuthContext.
 */
export async function getAccessTokenCached(): Promise<string | null> {
  const store = getAuthStore();

  // If token is valid and not expired, return it immediately
  if (store.token && !isTokenExpired()) {
    return store.token;
  }

  // Token is expired or missing, need to refresh
  console.log('[Auth] Token expired or missing, refreshing session');

  // Deduplicate refresh requests (if multiple queries fire at once)
  if (!inFlightRefreshPromise) {
    inFlightRefreshPromise = supabase.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error || !data.session?.access_token) {
          console.warn('[Auth] Session refresh failed:', error?.message || 'No session');
          // Sign out to clear stale state
          supabase.auth.signOut().catch(console.error);
          return null;
        }

        // Update authStore with fresh token
        // AuthContext will also receive SIGNED_IN event and update React state
        updateAuthStore(data.session.access_token, data.session);

        console.log('[Auth] Token refreshed successfully');
        return data.session.access_token;
      })
      .finally(() => {
        inFlightRefreshPromise = null;
      });
  }

  return inFlightRefreshPromise;
}

/**
 * Force fetch a fresh session.
 * This is called by AuthContext on TOKEN_REFRESHED events.
 */
export async function refreshAccessToken(): Promise<string | null> {
  // Clear any in-flight refresh to force a new one
  inFlightRefreshPromise = null;
  return getAccessTokenCached();
}

/**
 * Clear cached token state.
 * Called by AuthContext on logout or session invalidation.
 */
export function invalidateCachedAccessToken() {
  inFlightRefreshPromise = null;
  // Note: authStore is cleared by AuthContext via clearAuthStore()
}
