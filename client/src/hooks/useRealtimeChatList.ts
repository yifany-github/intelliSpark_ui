import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

/**
 * User-level realtime subscription for chat list updates.
 *
 * Subscribes to:
 * 1. INSERT/UPDATE/DELETE on chats table (chat created/deleted/renamed)
 * 2. INSERT on chat_messages table (new messages update preview/timestamp)
 *
 * When changes occur, invalidates chat list cache for fresh data.
 *
 * Key benefits:
 * - Multi-device sync (delete on phone, disappears on laptop)
 * - Live updates (new messages update chat preview)
 * - Real-time sorting (chats reorder when updated)
 * - No manual invalidation needed
 *
 * Usage: Call in ChatsPage component when showing chat list
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
      .channel(`user_${user.id}_chats`)
      // Listen to chat table changes (create, delete, update chat)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'chats',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Realtime] Chat list change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
        }
      )
      // Listen to new messages in any chat (updates preview/timestamp)
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
