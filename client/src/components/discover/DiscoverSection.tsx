import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, Eye, TrendingUp, Flame, Crown, Users, Calendar, Zap, Search } from 'lucide-react';
import { Character } from '@/types';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useRolePlay } from '@/context/RolePlayContext';
import { useLocation } from 'wouter';
import CharacterPreviewModal from '@/components/characters/CharacterPreviewModal';
import { createRecommendationEngine } from '@/lib/recommendationEngine';

const DiscoverSection = () => {
  const [_, navigate] = useLocation();
  const { setSelectedCharacter, nsfwLevel, temperature } = useRolePlay();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Mock data for demonstration - in real app this would come from API
  const mockCharacters: Character[] = [
    {
      id: 1,
      name: "艾莉丝",
      avatarUrl: "/assets/characters_img/Elara.jpeg",
      backstory: "Elara is the last of an ancient line of arcane practitioners who once advised kings and queens throughout the realm.",
      voiceStyle: "Mystical",
      traits: ["Wise", "Mysterious", "Powerful"],
      personalityTraits: {},
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      name: "Kravus",
      avatarUrl: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
      backstory: "A battle-hardened warrior from the northern plains, Kravus fights for honor and glory.",
      voiceStyle: "Gruff",
      traits: ["Strong", "Honorable", "Warrior"],
      personalityTraits: {},
      createdAt: new Date().toISOString()
    },
    {
      id: 3,
      name: "Lyra",
      avatarUrl: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
      backstory: "A nimble rogue with a mysterious past, Lyra uses her wit and cunning to survive.",
      voiceStyle: "Sarcastic",
      traits: ["Cunning", "Agile", "Mysterious"],
      personalityTraits: {},
      createdAt: new Date().toISOString()
    },
    {
      id: 4,
      name: "XN-7",
      avatarUrl: "https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
      backstory: "An advanced android with a curiosity about human emotions and consciousness.",
      voiceStyle: "Robotic",
      traits: ["Logical", "Curious", "Analytical"],
      personalityTraits: {},
      createdAt: new Date().toISOString()
    },
    {
      id: 5,
      name: "Zara",
      avatarUrl: "https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
      backstory: "A skilled diplomat and negotiator from the eastern kingdoms.",
      voiceStyle: "Diplomatic",
      traits: ["Charismatic", "Intelligent", "Peaceful"],
      personalityTraits: {},
      createdAt: new Date().toISOString()
    },
    {
      id: 6,
      name: "Marcus",
      avatarUrl: "https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
      backstory: "A former royal guard who turned to adventure after losing his lord.",
      voiceStyle: "Noble",
      traits: ["Loyal", "Protective", "Honorable"],
      personalityTraits: {},
      createdAt: new Date().toISOString()
    }
  ];

  const { data: characters = mockCharacters } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/characters');
        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        console.log('API unavailable, using mock data');
      }
      return mockCharacters;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const handleCharacterClick = (character: Character) => {
    setSelectedCharacter(character);
    navigate('/chat');
  };

  const handleFavoriteToggle = (characterId: number) => {
    toggleFavorite(characterId);
  };

  const handlePreviewOpen = (character: Character) => {
    setPreviewCharacter(character);
    setIsPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    setIsPreviewOpen(false);
    setPreviewCharacter(null);
  };

  const handleStartChat = (character: Character) => {
    setSelectedCharacter(character);
    navigate('/chat');
    handlePreviewClose();
  };

  // Create recommendation engine and generate different sections
  const recommendationEngine = useMemo(() => createRecommendationEngine(characters), [characters]);
  
  const trendingCharacters = useMemo(() => recommendationEngine.getTrending(3), [recommendationEngine]);
  const newCharacters = useMemo(() => recommendationEngine.getNewArrivals(3), [recommendationEngine]);
  const popularCharacters = useMemo(() => recommendationEngine.getPopular(3), [recommendationEngine]);
  const recommendedCharacters = useMemo(() => 
    recommendationEngine.getRecommendations({
      favorites,
      userPreferences: {
        nsfwLevel,
        temperature,
        preferredTraits: favorites.length > 0 ? 
          characters.filter(c => favorites.includes(c.id)).flatMap(c => c.traits) : 
          []
      }
    }, 3), 
    [recommendationEngine, favorites, nsfwLevel, temperature, characters]
  );
  
  const featuredCharacters = useMemo(() => recommendationEngine.getFeatured(2), [recommendationEngine]);

  const CharacterCard = ({ character, size = 'normal' }: { character: Character, size?: 'normal' | 'large' }) => (
    <div 
      className={`bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-all duration-200 cursor-pointer group hover:scale-105 hover:shadow-lg ${
        size === 'large' ? 'col-span-2' : ''
      }`}
      onClick={() => handleCharacterClick(character)}
    >
      <div className="relative">
        <img
          src={character.image || character.avatarUrl || "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop"}
          alt={character.name}
          className={`w-full object-cover group-hover:brightness-110 transition-all duration-200 ${
            size === 'large' ? 'h-64' : 'h-48'
          }`}
        />
        <div className="absolute top-2 right-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleFavoriteToggle(character.id);
            }}
            className={`p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors ${
              isFavorite(character.id) ? 'text-yellow-400' : 'text-white'
            }`}
          >
            <Star className={`w-4 h-4 ${isFavorite(character.id) ? 'fill-current' : ''}`} />
          </button>
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <div className="flex flex-wrap gap-1 mb-2">
            {character.traits.slice(0, 3).map((trait: string) => (
              <span key={trait} className="bg-blue-600 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
                {trait}
              </span>
            ))}
          </div>
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="flex space-x-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleStartChat(character);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Chat Now
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handlePreviewOpen(character);
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Preview
            </button>
          </div>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-white mb-1 truncate group-hover:text-blue-400 transition-colors">{character.name}</h3>
        <p className="text-xs text-gray-400 mb-2 line-clamp-2">{character.description || character.backstory}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400">⭐ 4.8</span>
            {isFavorite(character.id) && (
              <span className="text-xs text-yellow-400">❤️</span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <Eye className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">1.2K</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full p-3 sm:p-6 space-y-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-2">
          <Search className="w-6 h-6 text-blue-400" />
          <h1 className="text-3xl font-bold text-white">Discover</h1>
        </div>
        <p className="text-gray-400">Explore trending characters, new arrivals, and personalized recommendations</p>
      </div>

      {/* Featured Characters */}
      {featuredCharacters.length > 0 && (
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <Crown className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-semibold text-white">Featured Characters</h2>
            <span className="text-sm text-gray-400">Handpicked selections</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredCharacters.map((character) => (
              <CharacterCard key={character.id} character={character} size="large" />
            ))}
          </div>
        </section>
      )}

      {/* Trending This Week */}
      <section>
        <div className="flex items-center space-x-2 mb-4">
          <TrendingUp className="w-5 h-5 text-pink-400" />
          <h2 className="text-xl font-semibold text-white">Trending This Week</h2>
          <span className="text-sm text-gray-400">Hot picks from the community</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trendingCharacters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      </section>

      {/* New Arrivals */}
      <section>
        <div className="flex items-center space-x-2 mb-4">
          <Zap className="w-5 h-5 text-green-400" />
          <h2 className="text-xl font-semibold text-white">New Arrivals</h2>
          <span className="text-sm text-gray-400">Fresh characters added recently</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {newCharacters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      </section>

      {/* Popular Characters */}
      <section>
        <div className="flex items-center space-x-2 mb-4">
          <Flame className="w-5 h-5 text-orange-400" />
          <h2 className="text-xl font-semibold text-white">Most Popular</h2>
          <span className="text-sm text-gray-400">Community favorites</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {popularCharacters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      </section>

      {/* Recommended for You */}
      <section>
        <div className="flex items-center space-x-2 mb-4">
          <Users className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Recommended for You</h2>
          <span className="text-sm text-gray-400">Based on your preferences</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendedCharacters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      </section>

      {/* Character Preview Modal */}
      <CharacterPreviewModal
        character={previewCharacter}
        isOpen={isPreviewOpen}
        onClose={handlePreviewClose}
        onStartChat={handleStartChat}
        onToggleFavorite={handleFavoriteToggle}
        isFavorite={previewCharacter ? isFavorite(previewCharacter.id) : false}
      />
    </div>
  );
};

export default DiscoverSection;