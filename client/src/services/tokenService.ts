/**
 * Shared service for token balance operations
 * Consolidates duplicate fetchTokenBalance functions across components
 */

import { apiRequest, queryClient } from '@/lib/queryClient';

export interface TokenBalance {
  user_id: number;
  balance: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches the current user's token balance
 * @returns Promise<TokenBalance> The user's token balance data
 * @throws Error if no auth token found or request fails
 */
export const fetchTokenBalance = async (): Promise<TokenBalance> => {
  const response = await apiRequest('GET', '/api/payment/user/tokens', undefined, {
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    cache: 'no-store',
  });

  return response.json();
};

/**
 * Invalidate token balance queries across all components
 * Call this after any operation that changes token balance
 */
export const invalidateTokenBalance = (): void => {
  queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
};

/**
 * Optimistically update token balance (for immediate UI feedback)
 * @param newBalance - The new token balance to display
 */
export const updateTokenBalanceOptimistically = (newBalance: number): void => {
  queryClient.setQueryData(['tokenBalance'], (oldData: any) => {
    if (oldData?.balance !== undefined) {
      return { ...oldData, balance: newBalance };
    }
    return oldData;
  });
};

export interface UserStats {
  total_chats: number;
  total_messages: number;
  unique_characters: number;
  created_characters: number;
  recent_activity: Array<{
    type: string;
    character_name: string;
    character_avatar: string;
    created_at: string | null;
    updated_at: string | null;
  }>;
  member_since: string | null;
}

/**
 * Fetches the current user's statistics
 * @returns Promise<UserStats> The user's statistics data
 * @throws Error if no auth token found or request fails
 */
export const fetchUserStats = async (): Promise<UserStats> => {
  const response = await apiRequest('GET', '/api/auth/me/stats');
  return response.json();
};
