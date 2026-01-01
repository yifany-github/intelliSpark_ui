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
interface UseRealtimeMessagesOptions {
  onAssistantMessage?: (message: ChatMessage) => void;
}

export function useRealtimeMessages(
  canonicalUuid: string | undefined,
  options?: UseRealtimeMessagesOptions,
) {
  const { user, isReady } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isReady || !user?.id || !canonicalUuid) {
      return;
    }

    console.log(`[Realtime] Subscribing to messages for chat ${canonicalUuid}`);

    const channel = supabase
      .channel(`chat:${canonicalUuid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_uuid=eq.${canonicalUuid}`,
        },
        (payload) => {
          console.log('[Realtime] New message received in current chat');

          const newMessage = payload.new as ChatMessage;

          // Directly mutate messages cache using canonical UUID
          queryClient.setQueryData<ChatMessage[]>(
            [`/api/chats/${canonicalUuid}/messages`],
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

          options?.onAssistantMessage?.(newMessage);

          // Invalidate chat detail queries to refresh metadata (message count, timestamps)
          // The UUID-first cache keys + backend normalization already ensure both /chat/123
          // and /chat/uuid routes work correctly; this just keeps metadata fresh when messages arrive
          queryClient.invalidateQueries({
            predicate: (query) => {
              const key = query.queryKey[0];
              if (typeof key !== 'string') return false;

              // Match any chat detail query: /api/chats/{id}
              // But NOT message queries: /api/chats/{id}/messages
              return key.startsWith('/api/chats/') && !key.includes('/messages');
            }
          });

          // Also invalidate state query to update character state panel
          queryClient.invalidateQueries({
            queryKey: [`/api/chats/${canonicalUuid}/state`],
          });
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Chat ${canonicalUuid} subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          queryClient.invalidateQueries({
            queryKey: [`/api/chats/${canonicalUuid}/messages`],
          });
        }
      });

    // Cleanup when leaving chat or unmounting
    return () => {
      console.log(`[Realtime] Unsubscribing from chat ${canonicalUuid}`);
      supabase.removeChannel(channel);
    };
  }, [canonicalUuid, user?.id, isReady, queryClient]);
}
