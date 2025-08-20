import { Character } from '@/types';

export interface RecommendationOptions {
  favorites: number[];
  userPreferences?: {
    preferredTraits?: string[];
    nsfwLevel?: number;
  };
  chatHistory?: {
    characterId: number;
    interactions: number;
    lastChatTime: Date;
  }[];
}

export class RecommendationEngine {
  private characters: Character[];

  constructor(characters: Character[]) {
    this.characters = characters;
  }

  // Get trending characters (mock algorithm based on recent activity)
  getTrending(limit: number = 6): Character[] {
    return this.characters
      .sort(() => Math.random() - 0.5) // Mock trending algorithm
      .slice(0, limit);
  }

  // Get new characters (recently added)
  getNewArrivals(limit: number = 6): Character[] {
    return this.characters
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // Get popular characters (mock popularity based on ID)
  getPopular(limit: number = 6): Character[] {
    return this.characters
      .sort((a, b) => b.id - a.id) // Mock popularity
      .slice(0, limit);
  }

  // Get personalized recommendations based on user preferences
  getRecommendations(options: RecommendationOptions, limit: number = 6): Character[] {
    const { favorites, userPreferences, chatHistory } = options;
    
    // Score each character based on various factors
    const scoredCharacters = this.characters.map(character => {
      let score = 0;
      
      // Boost score if user has favorited similar characters
      if (favorites.length > 0) {
        const favoriteCharacters = this.characters.filter(c => favorites.includes(c.id));
        const favoriteTraits = favoriteCharacters.flatMap(c => c.traits);
        
        // Count matching traits
        const matchingTraits = character.traits.filter(trait => 
          favoriteTraits.includes(trait)
        ).length;
        
        score += matchingTraits * 2;
      }
      
      // Boost score based on user preferences
      if (userPreferences?.preferredTraits) {
        const matchingPreferences = character.traits.filter(trait =>
          userPreferences.preferredTraits!.includes(trait)
        ).length;
        score += matchingPreferences * 3;
      }
      
      // Boost score based on chat history
      if (chatHistory) {
        const characterHistory = chatHistory.find(h => h.characterId === character.id);
        if (characterHistory) {
          // Boost recently chatted characters less to promote variety
          const daysSinceLastChat = (Date.now() - characterHistory.lastChatTime.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLastChat > 7) {
            score += characterHistory.interactions * 0.5;
          }
        }
      }
      
      // Add some randomness to prevent stale recommendations
      score += Math.random() * 2;
      
      return { character, score };
    });
    
    // Filter out already favorited characters for variety
    const filteredCharacters = scoredCharacters.filter(
      ({ character }) => !favorites.includes(character.id)
    );
    
    // Sort by score and return top recommendations
    return filteredCharacters
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ character }) => character);
  }

  // Get characters by category with smart filtering
  getByCategory(category: string, limit: number = 6): Character[] {
    const categoryKeywords = {
      'fantasy': ['Fantasy', 'Magic', 'Mystical', 'Wise', 'Powerful'],
      'modern': ['Modern', 'Urban', 'Contemporary'],
      'sci-fi': ['Sci-Fi', 'Robot', 'Android', 'Logical', 'Analytical'],
      'romance': ['Romance', 'Charming', 'Romantic', 'Charismatic'],
      'adventure': ['Adventure', 'Warrior', 'Strong', 'Brave', 'Heroic'],
      'mystery': ['Mystery', 'Mysterious', 'Cunning', 'Secretive']
    };
    
    const keywords = categoryKeywords[category.toLowerCase() as keyof typeof categoryKeywords] || [];
    
    return this.characters
      .filter(character => 
        keywords.some(keyword => 
          character.traits.some(trait => 
            trait.toLowerCase().includes(keyword.toLowerCase())
          )
        )
      )
      .slice(0, limit);
  }

  // Get similar characters to a given character
  getSimilar(targetCharacter: Character, limit: number = 6): Character[] {
    return this.characters
      .filter(character => character.id !== targetCharacter.id)
      .map(character => {
        const commonTraits = character.traits.filter(trait =>
          targetCharacter.traits.includes(trait)
        ).length;
        
        return { character, similarity: commonTraits };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ character }) => character);
  }

  // Get featured characters for special events or promotions
  getFeatured(limit: number = 3): Character[] {
    // Mock featured algorithm - could be based on admin selection, events, etc.
    return this.characters
      .filter(character => character.traits.includes('Featured') || Math.random() > 0.7)
      .slice(0, limit);
  }

  // Get characters matching search query with smart ranking
  search(query: string, limit: number = 12): Character[] {
    const searchTerm = query.toLowerCase();
    
    return this.characters
      .map(character => {
        let relevance = 0;
        
        // Exact name match gets highest score
        if (character.name.toLowerCase().includes(searchTerm)) {
          relevance += 10;
        }
        
        // Backstory match gets medium score
        if (character.backstory.toLowerCase().includes(searchTerm)) {
          relevance += 5;
        }
        
        // Trait match gets lower score
        const traitMatches = character.traits.filter(trait =>
          trait.toLowerCase().includes(searchTerm)
        ).length;
        relevance += traitMatches * 2;
        
        return { character, relevance };
      })
      .filter(({ relevance }) => relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map(({ character }) => character);
  }
}

// Helper function to create recommendation engine instance
export function createRecommendationEngine(characters: Character[]): RecommendationEngine {
  return new RecommendationEngine(characters);
}