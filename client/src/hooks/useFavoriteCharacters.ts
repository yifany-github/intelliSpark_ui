import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Character } from '@/types';
import { useFavorites } from '@/contexts/FavoritesContext';
import { apiRequest } from '@/lib/queryClient';

type CharacterFetchResult =
  | { status: 'found'; character: Character; characterId: number }
  | { status: 'missing'; characterId: number };

interface UseFavoriteCharactersResult {
  characters: Character[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => Promise<void>;
}

export function useFavoriteCharacters(): UseFavoriteCharactersResult {
  const { favorites, removeFavorite } = useFavorites();

  const sortedIds = useMemo(() => [...favorites].sort((a, b) => a - b), [favorites]);

  const queryKey = useMemo(() => ['favoriteCharacters', sortedIds], [sortedIds]);

  const { data, isLoading, isFetching, error, refetch } = useQuery<Character[]>({
    queryKey,
    queryFn: async () => {
      if (sortedIds.length === 0) {
        return [];
      }

      const results = await Promise.allSettled(
        sortedIds.map(async (characterId): Promise<CharacterFetchResult> => {
          const response = await apiRequest('GET', `/api/characters/${characterId}`);

          if (response.status === 404) {
            return { status: 'missing', characterId };
          }

          if (!response.ok) {
            throw new Error(`Failed to fetch character ${characterId}: ${response.status}`);
          }

          const character = (await response.json()) as Character;
          return { status: 'found', character, characterId };
        })
      );

      const characters: Character[] = [];
      const missingIds: number[] = [];
      let fatalError: Error | null = null;

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.status === 'missing') {
            missingIds.push(result.value.characterId);
          } else {
            characters.push(result.value.character);
          }
        } else {
          fatalError = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
        }
      });

      if (missingIds.length > 0) {
        setTimeout(() => {
          missingIds.forEach((id) => removeFavorite(id));
        }, 0);
      }

      if (fatalError) {
        throw fatalError;
      }

      return characters;
    },
    enabled: sortedIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  return {
    characters: sortedIds.length === 0 ? [] : data ?? [],
    isLoading: sortedIds.length === 0 ? false : isLoading,
    isFetching,
    error,
    refetch: async () => {
      await refetch();
    },
  };
}
