import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook that handles auth session recovery when tab wakes from sleep.
 *
 * When a tab is left open for a long time:
 * 1. Supabase session may have expired
 * 2. WebSocket connections are closed
 * 3. React Query cache may be stale
 *
 * This hook:
 * - Listens for page visibility changes
 * - Refreshes user session when tab becomes visible
 * - Invalidates all queries to refetch with fresh token
 * - Handles errors by forcing logout if session can't be recovered
 *
 * Usage: Call once at app root level (e.g., in MainApp)
 */
export function useAuthRecovery() {
  const { isAuthenticated, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Only attempt recovery if tab becomes visible and user is authenticated
      if (document.hidden || !isAuthenticated) {
        return;
      }

      console.log('[AuthRecovery] Tab became visible, checking session validity');

      try {
        // Refresh user session (this will trigger token refresh if needed)
        await refreshUser();

        // Invalidate all private queries to refetch with fresh token
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === 'string' && key.startsWith('/api/');
          }
        });

        console.log('[AuthRecovery] Session recovered successfully');
      } catch (error) {
        console.error('[AuthRecovery] Failed to recover session:', error);
        // refreshUser() will handle logout if session can't be recovered
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, refreshUser, queryClient]);
}
