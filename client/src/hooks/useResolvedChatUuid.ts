import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Chat } from '@/types';

/**
 * Resolves any chat identifier (numeric or UUID) to its canonical UUID.
 *
 * This hook handles the migration from legacy numeric routes (/chat/123)
 * to UUID-based routes (/chat/abc-def-...). It:
 *
 * 1. Detects if chatId is numeric (legacy route)
 * 2. Fetches the chat to get its UUID
 * 3. Optionally redirects to the UUID route
 *
 * Benefits:
 * - Single source of truth: all downstream code uses UUID only
 * - Backward compatible: old /chat/123 links still work
 * - Simplifies realtime, cache keys, and query logic
 *
 * Usage:
 * const resolvedUuid = useResolvedChatUuid(params.id, { redirect: true });
 */
export function useResolvedChatUuid(
  chatId: string | undefined,
  options: { redirect?: boolean; enabled?: boolean } = {}
): string | null {
  const { redirect = false, enabled = true } = options;
  const [, navigate] = useLocation();

  // If chatId is already a UUID (or missing), return it as-is
  const isNumeric = chatId && /^\d+$/.test(chatId);

  if (!chatId || !isNumeric) {
    return chatId ?? null;
  }

  // Numeric chatId detected - need to resolve to UUID
  const { data: chat } = useQuery<Chat>({
    queryKey: [`/api/chats/${chatId}`],
    enabled: enabled && isNumeric,
    staleTime: Infinity,  // UUID mapping is permanent
  });

  const resolvedUuid = chat?.uuid ?? null;

  // Optionally redirect numeric route to UUID route
  useEffect(() => {
    if (redirect && resolvedUuid && chatId !== resolvedUuid) {
      console.log(`[ChatRoute] Redirecting numeric route /chat/${chatId} → /chat/${resolvedUuid}`);
      navigate(`/chat/${resolvedUuid}`, { replace: true });
    }
  }, [redirect, resolvedUuid, chatId, navigate]);

  return resolvedUuid;
}
