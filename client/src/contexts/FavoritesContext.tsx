import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface FavoritesContextType {
  favorites: number[];
  addFavorite: (characterId: number) => void;
  removeFavorite: (characterId: number) => void;
  toggleFavorite: (characterId: number) => void;
  isFavorite: (characterId: number) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<number[]>([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    if (user) {
      const storageKey = `favorites_${user.id}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsedFavorites = JSON.parse(stored);
          setFavorites(Array.isArray(parsedFavorites) ? parsedFavorites : []);
        } catch (error) {
          console.error('Failed to parse favorites from localStorage:', error);
          setFavorites([]);
        }
      }
    } else {
      // For non-authenticated users, use a global key
      const stored = localStorage.getItem('favorites_guest');
      if (stored) {
        try {
          const parsedFavorites = JSON.parse(stored);
          setFavorites(Array.isArray(parsedFavorites) ? parsedFavorites : []);
        } catch (error) {
          console.error('Failed to parse guest favorites from localStorage:', error);
          setFavorites([]);
        }
      }
    }
  }, [user]);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    const storageKey = user ? `favorites_${user.id}` : 'favorites_guest';
    localStorage.setItem(storageKey, JSON.stringify(favorites));
  }, [favorites, user]);

  const addFavorite = (characterId: number) => {
    setFavorites(prev => {
      if (prev.includes(characterId)) return prev;
      return [...prev, characterId];
    });
  };

  const removeFavorite = (characterId: number) => {
    setFavorites(prev => prev.filter(id => id !== characterId));
  };

  const toggleFavorite = (characterId: number) => {
    setFavorites(prev => {
      if (prev.includes(characterId)) {
        return prev.filter(id => id !== characterId);
      } else {
        return [...prev, characterId];
      }
    });
  };

  const isFavorite = (characterId: number) => {
    return favorites.includes(characterId);
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        addFavorite,
        removeFavorite,
        toggleFavorite,
        isFavorite,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}