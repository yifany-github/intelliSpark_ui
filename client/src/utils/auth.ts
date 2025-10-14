import { supabase } from "@/lib/supabaseClient";

let cachedToken: {
  value: string | null;
  fetchedAt: number;
} = {
  value: null,
  fetchedAt: 0,
};

let inFlightSessionPromise: Promise<string | null> | null = null;

/**
 * Resolve the current Supabase access token with a short-lived cache and
 * deduplicated session fetches. This keeps us from hammering supabase.auth.getSession()
 * when multiple network requests fire at the same time (e.g. right after login).
 */
export async function getAccessTokenCached(): Promise<string | null> {
  if (cachedToken.value) {
    return cachedToken.value;
  }

  if (!inFlightSessionPromise) {
    inFlightSessionPromise = supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error("[Auth] Failed to get Supabase session:", error.message);
          return null;
        }
        const token = data.session?.access_token ?? null;
        cachedToken = { value: token, fetchedAt: Date.now() };
        return token;
      })
      .finally(() => {
        inFlightSessionPromise = null;
      });
  }

  return inFlightSessionPromise;
}

/**
 * Force fetch a fresh session (deduplicated) and update the cached token.
 */
export async function refreshAccessToken(): Promise<string | null> {
  // Reuse the same logic as getAccessTokenCached but skip TTL by resetting cache first.
  cachedToken = { value: null, fetchedAt: 0 };
  return getAccessTokenCached();
}

/**
 * Clear any cached token (e.g. after logout).
 */
export function invalidateCachedAccessToken() {
  cachedToken = { value: null, fetchedAt: 0 };
  inFlightSessionPromise = null;
}
