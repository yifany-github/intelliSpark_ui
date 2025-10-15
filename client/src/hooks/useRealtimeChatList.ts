import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

/**
 * Per-user realtime subscription for chat list updates.
 *
 * Subscribes to ALL chat messages for the authenticated user via Supabase Realtime.
 * When a new message arrives in ANY chat, the chat list is invalidated so
 * unread counts and timestamps update in real-time.
 *
 * Key benefits:
 * - Single WebSocket connection for entire app
 * - Catches messages in background chats
 * - Automatic reconnection handled by Supabase
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

    console.log(`[Realtime] Subscribing to chat list for user ${user.id}`);

    const channel = supabase
      .channel(`user-chat-list:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Realtime] New message detected, invalidating chat list');

          // Invalidate chat list query so it refetches
          // This updates unread counts, timestamps, and latest message previews
          queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Chat list subscription status: ${status}`);
      });

    // Cleanup on unmount or user change
    return () => {
      console.log(`[Realtime] Unsubscribing from chat list for user ${user.id}`);
      supabase.removeChannel(channel);
    };
  }, [user?.id, isReady, queryClient]);
}
