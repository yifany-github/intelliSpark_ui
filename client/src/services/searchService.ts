/**
 * Search Service
 *
 * Handles API calls related to search functionality
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface TrendingCharacter {
  id: number;
  name: string;
  trending_score: number;
}

/**
 * Fetch trending character names from the backend
 *
 * Returns real trending data based on character analytics:
 * - view_count
 * - chat_count
 * - like_count
 * - trending_score
 *
 * @param limit - Maximum number of trending characters to fetch (default: 10)
 * @returns Promise resolving to array of trending characters
 */
export async function fetchTrendingSearches(limit: number = 10): Promise<TrendingCharacter[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/search/trending?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch trending searches: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching trending searches:', error);
    throw error;
  }
}

/**
 * Extract character names from trending data
 *
 * @param trendingData - Array of trending characters
 * @returns Array of character names only
 */
export function extractTrendingNames(trendingData: TrendingCharacter[]): string[] {
  return trendingData.map(item => item.name);
}
