/**
 * Fuzzy Search Utility using Fuse.js
 *
 * Provides enhanced character search with:
 * - Fuzzy matching (typo tolerance)
 * - Multi-field searching (name, description, traits, category, backstory)
 * - Weighted relevance scoring
 * - Support for Chinese and English queries
 */

import Fuse from 'fuse.js';
import { Character } from '@/types';

/**
 * Fuse.js configuration for character search
 *
 * Threshold: 0.4 (0 = exact match, 1 = match anything)
 * - Values between 0.3-0.5 provide good balance between strict and loose matching
 *
 * Keys: Fields to search with their weights
 * - Higher weight = more important in matching
 */
const FUSE_OPTIONS: Fuse.IFuseOptions<Character> = {
  keys: [
    { name: 'name', weight: 3 },           // Highest priority - character name
    { name: 'traits', weight: 2 },         // High priority - character traits
    { name: 'description', weight: 2 },    // High priority - short description
    { name: 'category', weight: 1.5 },     // Medium priority - character category
    { name: 'backstory', weight: 1 },      // Lower priority - detailed backstory
    { name: 'conversationStyle', weight: 1 },  // Lower priority - conversation style
  ],
  threshold: 0.4,          // Fuzzy match threshold (lower = more strict)
  distance: 100,           // Maximum distance for fuzzy matching
  minMatchCharLength: 2,   // Minimum characters required for matching
  ignoreLocation: true,    // Search entire field (not just beginning)
  includeScore: true,      // Include relevance score in results
  useExtendedSearch: false, // Disable extended search operators for simplicity
};

/**
 * Create a Fuse instance for character searching
 *
 * @param characters - Array of characters to search through
 * @returns Configured Fuse instance
 */
export function createCharacterSearchEngine(characters: Character[]): Fuse<Character> {
  return new Fuse(characters, FUSE_OPTIONS);
}

/**
 * Perform fuzzy search on characters
 *
 * @param characters - Array of characters to search
 * @param query - Search query string
 * @returns Array of matching characters sorted by relevance
 */
export function fuzzySearchCharacters(characters: Character[], query: string): Character[] {
  // Return all characters if query is empty
  if (!query || query.trim().length === 0) {
    return characters;
  }

  const fuse = createCharacterSearchEngine(characters);
  const results = fuse.search(query.trim());

  // Extract characters from Fuse results
  return results.map(result => result.item);
}

/**
 * Perform fuzzy search with score information
 *
 * Useful for debugging or showing relevance indicators in UI
 *
 * @param characters - Array of characters to search
 * @param query - Search query string
 * @returns Array of search results with scores
 */
export function fuzzySearchWithScores(
  characters: Character[],
  query: string
): Array<{ character: Character; score: number }> {
  if (!query || query.trim().length === 0) {
    return characters.map(character => ({ character, score: 0 }));
  }

  const fuse = createCharacterSearchEngine(characters);
  const results = fuse.search(query.trim());

  return results.map(result => ({
    character: result.item,
    score: result.score ?? 0,
  }));
}

/**
 * Check if a query is likely to be a Chinese pinyin input
 *
 * This can be used to implement pinyin search in the future
 *
 * @param query - Search query string
 * @returns True if query appears to be pinyin
 */
export function isPinyinQuery(query: string): boolean {
  // Simple heuristic: all lowercase ASCII letters with no Chinese characters
  const hasOnlyAscii = /^[a-z\s]+$/i.test(query);
  const hasChinese = /[\u4e00-\u9fa5]/.test(query);
  return hasOnlyAscii && !hasChinese;
}

/**
 * Highlight matching text in search results
 *
 * Can be used to show which parts of the text matched the query
 *
 * @param text - Original text
 * @param query - Search query
 * @returns Text with HTML <mark> tags around matches
 */
export function highlightMatches(text: string, query: string): string {
  if (!query || !text) return text;

  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}
