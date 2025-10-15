import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { ChatMessage } from '@/types';

/**
 * Per-chat realtime subscription for message updates.
 *
 * Subscribes to new messages in a specific chat via Supabase Realtime.
 * When a new message arrives, it's directly added to React Query cache
 * for instant UI updates (no refetch needed).
 *
 * Key benefits:
 * - Instant message updates (cache mutation, not invalidation)
 * - Automatic cleanup when leaving chat
 * - Scoped to specific chat (no global pollution)
 *
 * Usage: Call in ChatPage component with current chatId
 */
export function useRealtimeMessages(chatId: string | undefined) {
  const { user, isReady } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isReady || !user?.id || !chatId) {
      return;
    }

    console.log(`[Realtime] Subscribing to messages for chat ${chatId}`);

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_uuid=eq.${chatId}`,
        },
        (payload) => {
          console.log('[Realtime] New message received in current chat');

          const newMessage = payload.new as ChatMessage;

          // Directly mutate messages cache for instant update
          queryClient.setQueryData<ChatMessage[]>(
            [`/api/chats/${chatId}/messages`],
            (oldMessages = []) => {
              // Prevent duplicates
              const exists = oldMessages.some((msg) => msg.id === newMessage.id);
              if (exists) {
                console.log('[Realtime] Message already in cache, skipping');
                return oldMessages;
              }

              console.log('[Realtime] Adding new message to cache');
              return [...oldMessages, newMessage];
            }
          );

          // Also invalidate chat detail to update metadata (updated_at, message_count)
          queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}`] });
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Chat ${chatId} subscription status: ${status}`);
      });

    // Cleanup when leaving chat or unmounting
    return () => {
      console.log(`[Realtime] Unsubscribing from chat ${chatId}`);
      supabase.removeChannel(channel);
    };
  }, [chatId, user?.id, isReady, queryClient]);
}
