import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

/**
 * Per-user realtime subscription for chat list updates.
 *
 * This hook subscribes to ALL chat messages for the authenticated user,
 * allowing the chat list to update in real-time when new messages arrive
 * in any chat (not just the currently viewed one).
 *
 * Key benefits over per-chat subscriptions:
 * - Single WebSocket connection for entire app
 * - Catches messages in background chats
 * - Updates unread counts and timestamps on chat list
 *
 * Usage: Call once at app root level (e.g., in MainApp)
 */
export function useRealtimeChatList() {
  const { user, isReady } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isReady || !user?.id) {
      return;
    }

    console.log(`[Realtime] Setting up per-user chat list subscription for user ${user.id}`);

    let cancelled = false;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let retryDelay = 1000;
    let retryTimeout: number | null = null;

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
        .channel('user-chat-list')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('[Realtime] New message in chat list:', payload.new);

            // Invalidate chat list so unread counts and timestamps update
            queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
          }
        )
        .subscribe((status) => {
          console.log(`[Realtime] Chat list subscription status:`, status);

          if (status === 'SUBSCRIBED') {
            retryDelay = 1000;
            if (retryTimeout) {
              window.clearTimeout(retryTimeout);
              retryTimeout = null;
            }

            // Refetch chat list once when connection established
            queryClient.refetchQueries({
              queryKey: ['/api/chats'],
              type: 'active',
            });
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Realtime] Chat list subscription issue (${status}), scheduling retry in ${retryDelay}ms`);
            queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
            scheduleRetry();
          }

          if (status === 'CLOSED' && !cancelled) {
            console.warn('[Realtime] Chat list subscription closed unexpectedly, resubscribing');
            scheduleRetry();
          }
        });
    };

    subscribe();

    // Handle visibility change: refetch when tab regains focus
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[Realtime] Tab became visible, refetching chat list');
        queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount or user change
    return () => {
      console.log(`[Realtime] Cleaning up chat list subscription for user ${user.id}`);
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
  }, [user?.id, isReady, queryClient]);
}
