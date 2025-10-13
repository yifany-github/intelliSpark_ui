import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { queryClient } from '@/lib/queryClient';
import { ChatMessage } from '@/types';
import { useRolePlay } from '@/contexts/RolePlayContext';

/**
 * Subscribe to real-time chat message inserts via Supabase Realtime.
 *
 * This hook eliminates the need for polling by pushing new messages
 * directly to the React Query cache when they're inserted into the database.
 *
 * Fixes the stuck-pending state bug caused by async message generation.
 *
 * @param chatUuid - The UUID string for the chat (used for query key)
 * @param chatNumericId - The numeric ID for filtering (matches chat_messages.chat_id column)
 */
export function useChatRealtime(chatUuid?: string, chatNumericId?: number) {
  const { setIsTyping } = useRolePlay();

  useEffect(() => {
    if (!chatUuid || !chatNumericId) return;

    console.log(`[Realtime] Subscribing to chat messages for chat UUID ${chatUuid} (numeric ID: ${chatNumericId})`);

    // Create a unique channel name for this chat
    const channel = supabase
      .channel(`chat-messages:${chatUuid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          // CRITICAL: Filter by numeric chat_id column, not chat_uuid
          // chat_messages.chat_id is INTEGER, not UUID
          filter: `chat_id=eq.${chatNumericId}`,
        },
        (payload) => {
          console.log('[Realtime] New message received:', payload.new);

          const newMessage = payload.new as ChatMessage;

          // Update React Query cache with the new message
          queryClient.setQueryData<ChatMessage[]>(
            [`/api/chats/${chatUuid}/messages`],
            (oldMessages = []) => {
              // Avoid duplicates (in case polling also fetched it)
              const messageExists = oldMessages.some(msg => msg.id === newMessage.id);
              if (messageExists) {
                console.log('[Realtime] Message already in cache, skipping');
                return oldMessages;
              }

              console.log('[Realtime] Adding message to cache');
              return [...oldMessages, newMessage];
            }
          );

          // Clear typing indicator when assistant message arrives
          if (newMessage.role === 'assistant') {
            console.log('[Realtime] Assistant message received, clearing typing state');
            setIsTyping(false);
          }

          // Invalidate chat list to update message count
          queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status:`, status);
      });

    // Cleanup on unmount or when chat changes
    return () => {
      console.log(`[Realtime] Unsubscribing from chat UUID ${chatUuid} (numeric ID: ${chatNumericId})`);
      supabase.removeChannel(channel);
    };
  }, [chatUuid, chatNumericId, setIsTyping]);
}
