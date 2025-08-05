import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Star, Eye, TrendingUp, Flame, Crown, Users, Calendar, Zap, Search, 
  BookOpen, Gamepad2, Film, Music, Sparkles, Heart, Shield, Sword,
  Globe, Brain, Bot, Palette, Coffee, Mountain, Compass, Filter, Grid
} from 'lucide-react';
import { Character } from '@/types';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useRolePlay } from '@/contexts/RolePlayContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { apiRequest } from '@/lib/queryClient';
import CharacterPreviewModal from '@/components/characters/CharacterPreviewModal';
import { createRecommendationEngine } from '@/lib/recommendationEngine';
import { useLanguage } from '@/contexts/LanguageContext';

const DiscoverSection = () => {
  const { navigateToPath } = useNavigation();
  const { setSelectedCharacter, nsfwLevel, temperature } = useRolePlay();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { t } = useLanguage();
  const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);


  const { data: characters = [], isLoading, error } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
    queryFn: async () => {
      const response = await fetch('/api/characters');
      if (!response.ok) throw new Error('Failed to fetch characters');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // State for category filtering and layout
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('masonry');

  // Mutation for creating a new chat
  const { mutate: createChat, isPending: isCreatingChat } = useMutation({
    mutationFn: async ({ characterId }: { characterId: number }) => {
      const response = await apiRequest(
        "POST",
        "/api/chats",
        {
          characterId,
          title: `Chat with ${characters.find(c => c.id === characterId)?.name || 'Character'}`
        }
      );
      return response.json();
    },
    onSuccess: (chat) => {
      navigateToPath(`/chat/${chat.id}`);
      handlePreviewClose();
    },
    onError: (error) => {
      console.error('Failed to create chat:', error);
    }
  });

  const handleCharacterClick = (character: Character) => {
    setSelectedCharacter(character);
    createChat({ characterId: character.id });
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
    createChat({ characterId: character.id });
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

  // Define explore categories with icons and colors
  const exploreCategories = [
    { id: 'All', name: t('allCharacters'), icon: Globe, color: 'text-blue-400', bgColor: 'bg-blue-600' },
    { id: 'Fantasy', name: t('fantasyMagic'), icon: Sparkles, color: 'text-purple-400', bgColor: 'bg-purple-600' },
    { id: 'Sci-Fi', name: t('sciFiFuture'), icon: Bot, color: 'text-cyan-400', bgColor: 'bg-cyan-600' },
    { id: 'Adventure', name: t('adventureAction'), icon: Sword, color: 'text-orange-400', bgColor: 'bg-orange-600' },
    { id: 'Romance', name: t('romanceDrama'), icon: Heart, color: 'text-pink-400', bgColor: 'bg-pink-600' },
    { id: 'Mystery', name: t('mysteryThriller'), icon: Search, color: 'text-indigo-400', bgColor: 'bg-indigo-600' },
    { id: 'Historical', name: t('historical'), icon: Crown, color: 'text-yellow-400', bgColor: 'bg-yellow-600' },
    { id: 'Modern', name: t('modernLifestyle'), icon: Coffee, color: 'text-green-400', bgColor: 'bg-green-600' },
    { id: 'Creative', name: t('creativeArts'), icon: Palette, color: 'text-teal-400', bgColor: 'bg-teal-600' },
    { id: 'Gaming', name: t('gamingVirtual'), icon: Gamepad2, color: 'text-red-400', bgColor: 'bg-red-600' },
    { id: 'Anime', name: t('animeManga'), icon: BookOpen, color: 'text-rose-400', bgColor: 'bg-rose-600' },
    { id: 'Movies', name: t('moviesTv'), icon: Film, color: 'text-amber-400', bgColor: 'bg-amber-600' }
  ];

  // Filter characters by category
  const filteredSections = useMemo(() => {
    const filterCharacters = (chars: Character[]) => 
      selectedCategory === 'All' 
        ? chars 
        : chars.filter(char => 
            char.traits.some(trait => 
              trait.toLowerCase().includes(selectedCategory.toLowerCase()) ||
              selectedCategory.toLowerCase() === 'sci-fi' && (trait.toLowerCase().includes('logical') || trait.toLowerCase().includes('analytical') || trait.toLowerCase().includes('curious')) ||
              selectedCategory.toLowerCase() === 'adventure' && (trait.toLowerCase().includes('strong') || trait.toLowerCase().includes('warrior') || trait.toLowerCase().includes('honorable')) ||
              selectedCategory.toLowerCase() === 'mystery' && (trait.toLowerCase().includes('cunning') || trait.toLowerCase().includes('mysterious')) ||
              selectedCategory.toLowerCase() === 'romance' && (trait.toLowerCase().includes('charismatic') || trait.toLowerCase().includes('diplomatic')) ||
              selectedCategory.toLowerCase() === 'historical' && (trait.toLowerCase().includes('wise') || trait.toLowerCase().includes('noble')) ||
              selectedCategory.toLowerCase() === 'modern' && (trait.toLowerCase().includes('intelligent') || trait.toLowerCase().includes('peaceful'))
            )
          );
    
    return {
      trending: filterCharacters(trendingCharacters),
      new: filterCharacters(newCharacters),
      popular: filterCharacters(popularCharacters),
      recommended: filterCharacters(recommendedCharacters),
      featured: filterCharacters(featuredCharacters)
    };
  }, [selectedCategory, trendingCharacters, newCharacters, popularCharacters, recommendedCharacters, featuredCharacters]);

  const CharacterCard = ({ character, size = 'normal' }: { character: Character, size?: 'normal' | 'large' }) => (
    <div 
      className={`bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-all duration-200 cursor-pointer group hover:scale-105 hover:shadow-lg ${
        size === 'large' ? 'col-span-2' : ''
      } ${isCreatingChat ? 'opacity-50 pointer-events-none' : ''}`}
      onClick={() => !isCreatingChat && handleCharacterClick(character)}
    >
      <div className="relative">
        <img
          src={character.avatarUrl}
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
                if (!isCreatingChat) {
                  handleStartChat(character);
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              disabled={isCreatingChat}
            >
              {isCreatingChat ? t('creating') : t('chatNow')}
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handlePreviewOpen(character);
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {t('preview')}
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Compass className="w-6 h-6 text-blue-400" />
              <h1 className="text-3xl font-bold text-white">{t('discoverPage')}</h1>
            </div>
            <p className="text-gray-400">{t('exploreTrendingCharacters')}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'masonry' : 'grid')}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title={viewMode === 'grid' ? t('switchToMasonryLayout') : t('switchToGridLayout')}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Explore Categories */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Mountain className="w-5 h-5 text-emerald-400 mr-2" />
            {t('exploreTypes')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {exploreCategories.map((category) => {
              const IconComponent = category.icon;
              const isSelected = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`p-3 rounded-xl transition-all duration-200 transform hover:scale-105 ${
                    isSelected 
                      ? `${category.bgColor} text-white shadow-lg` 
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <IconComponent className={`w-6 h-6 ${
                      isSelected ? 'text-white' : category.color
                    }`} />
                    <span className="text-xs font-medium text-center leading-tight">
                      {category.name.split(' ')[0]}
                      <br className="hidden sm:block" />
                      <span className="hidden sm:inline">{category.name.split(' ').slice(1).join(' ')}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Featured Characters */}
      {filteredSections.featured.length > 0 && (
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <Crown className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-semibold text-white">{t('featuredCharacters')}</h2>
            <span className="text-sm text-gray-400">{t('handpickedSelections')}</span>
            {selectedCategory !== 'All' && (
              <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                {selectedCategory}
              </span>
            )}
          </div>
          <div className={viewMode === 'masonry' 
            ? "columns-1 md:columns-2 gap-4 space-y-4" 
            : "grid grid-cols-1 md:grid-cols-2 gap-4"
          }>
            {filteredSections.featured.map((character) => (
              <div key={character.id} className={viewMode === 'masonry' ? 'break-inside-avoid' : ''}>
                <CharacterCard character={character} size="large" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trending This Week */}
      {filteredSections.trending.length > 0 && (
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-5 h-5 text-pink-400" />
            <h2 className="text-xl font-semibold text-white">{t('trendingThisWeek')}</h2>
            <span className="text-sm text-gray-400">{t('hotPicksCommunity')}</span>
            {selectedCategory !== 'All' && (
              <span className="px-2 py-1 bg-pink-600 text-white text-xs rounded-full">
                {selectedCategory}
              </span>
            )}
          </div>
          <div className={viewMode === 'masonry' 
            ? "columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4" 
            : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          }>
            {filteredSections.trending.map((character) => (
              <div key={character.id} className={viewMode === 'masonry' ? 'break-inside-avoid' : ''}>
                <CharacterCard character={character} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* New Arrivals */}
      {filteredSections.new.length > 0 && (
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <Zap className="w-5 h-5 text-green-400" />
            <h2 className="text-xl font-semibold text-white">{t('newArrivals')}</h2>
            <span className="text-sm text-gray-400">{t('freshCharactersAdded')}</span>
            {selectedCategory !== 'All' && (
              <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                {selectedCategory}
              </span>
            )}
          </div>
          <div className={viewMode === 'masonry' 
            ? "columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4" 
            : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          }>
            {filteredSections.new.map((character) => (
              <div key={character.id} className={viewMode === 'masonry' ? 'break-inside-avoid' : ''}>
                <CharacterCard character={character} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Popular Characters */}
      {filteredSections.popular.length > 0 && (
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <Flame className="w-5 h-5 text-orange-400" />
            <h2 className="text-xl font-semibold text-white">{t('mostPopular')}</h2>
            <span className="text-sm text-gray-400">{t('communityFavorites')}</span>
            {selectedCategory !== 'All' && (
              <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded-full">
                {selectedCategory}
              </span>
            )}
          </div>
          <div className={viewMode === 'masonry' 
            ? "columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4" 
            : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          }>
            {filteredSections.popular.map((character) => (
              <div key={character.id} className={viewMode === 'masonry' ? 'break-inside-avoid' : ''}>
                <CharacterCard character={character} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommended for You */}
      {filteredSections.recommended.length > 0 && (
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">{t('recommendedForYou')}</h2>
            <span className="text-sm text-gray-400">{t('basedOnPreferences')}</span>
            {selectedCategory !== 'All' && (
              <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                {selectedCategory}
              </span>
            )}
          </div>
          <div className={viewMode === 'masonry' 
            ? "columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4" 
            : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          }>
            {filteredSections.recommended.map((character) => (
              <div key={character.id} className={viewMode === 'masonry' ? 'break-inside-avoid' : ''}>
                <CharacterCard character={character} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Error State */}
      {error ? (
        <section className="text-center py-16">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold mb-2">Unable to load characters</h3>
          <p className="text-gray-400">Please check your connection and try again</p>
        </section>
      ) : (
        /* Empty State */
        selectedCategory !== 'All' && 
        filteredSections.featured.length === 0 && 
        filteredSections.trending.length === 0 && 
        filteredSections.new.length === 0 && 
        filteredSections.popular.length === 0 && 
        filteredSections.recommended.length === 0 && (
          <section className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">{t('noCharactersFound').replace('{category}', selectedCategory)}</h3>
            <p className="text-gray-400 mb-6">
              {t('tryExploringOther')}
            </p>
            <button
              onClick={() => setSelectedCategory('All')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {t('viewAllCharacters')}
            </button>
          </section>
        )
      )}

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