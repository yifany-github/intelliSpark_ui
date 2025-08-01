/**
 * Shared service for token balance operations
 * Consolidates duplicate fetchTokenBalance functions across components
 */

import { queryClient } from '@/lib/queryClient';

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
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  const response = await fetch(`${API_BASE_URL}/api/payment/user/tokens`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch token balance: ${response.status}`);
  }

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