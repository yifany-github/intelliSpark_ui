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
import { useToast } from '@/hooks/use-toast';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
import { useLanguage } from '@/contexts/LanguageContext';

const DiscoverSection = () => {
  const { navigateToPath } = useNavigation();
  const { setSelectedCharacter } = useRolePlay();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);


  const { data: characters = [], isLoading, error } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/characters');
      if (!response.ok) throw new Error('Failed to fetch characters');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Lightweight skeleton will render within the main layout to preserve hook order

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
    const willFavorite = !isFavorite(characterId);
    toggleFavorite(characterId);
    toast({
      title: willFavorite ? '已收藏' : '已取消收藏',
      description: willFavorite ? '已添加到收藏列表' : '已从收藏列表移除',
    });
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
        preferredTraits: favorites.length > 0 ? 
          characters.filter(c => favorites.includes(c.id)).flatMap(c => c.traits) : 
          []
      }
    }, 3), 
    [recommendationEngine, favorites, characters]
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
      className={`relative rounded-2xl overflow-hidden bg-gray-900/70 border border-gray-800/60 backdrop-blur-sm transition-all duration-300 cursor-pointer group ${
        size === 'large' ? 'col-span-2' : ''
      } ${
        isCreatingChat
          ? 'opacity-50 pointer-events-none'
          : 'hover:-translate-y-1 hover:shadow-xl'
      }`}
      onClick={() => !isCreatingChat && handleCharacterClick(character)}
    >
      <div className="relative">
        <img
          src={character.avatarUrl?.startsWith('http') ? character.avatarUrl : `${API_BASE_URL}${character.avatarUrl}`}
          alt={character.name}
          className={`w-full object-cover transition-all duration-500 group-hover:scale-[1.03] ${
            size === 'large' ? 'h-80' : 'h-64'
          }`}
        />
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          {(character.nsfwLevel || 0) > 0 && (
            <div className="w-9 h-9 bg-red-500/75 backdrop-blur-sm rounded-full border border-red-400/40 flex items-center justify-center text-white text-xs font-bold">
              18+
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFavoriteToggle(character.id);
            }}
            title={isFavorite(character.id) ? '取消收藏' : '收藏'}
            aria-label={isFavorite(character.id) ? '取消收藏' : '收藏'}
            className={`p-2 rounded-full bg-black/45 hover:bg-black/65 transition-colors border border-white/10 shadow-sm ${
              isFavorite(character.id) ? 'text-yellow-400' : 'text-white'
            }`}
          >
            <Star className={`w-[18px] h-[18px] ${isFavorite(character.id) ? 'fill-current' : ''}`} />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="flex flex-wrap justify-center gap-2 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isCreatingChat) {
                  handleStartChat(character);
                }
              }}
              className="px-4 py-2 rounded-full bg-blue-600/90 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
              disabled={isCreatingChat}
            >
              {isCreatingChat ? t('creating') : t('chatNow')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePreviewOpen(character);
              }}
              className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors backdrop-blur-sm"
            >
              {t('preview')}
            </button>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-white text-lg leading-tight line-clamp-2 group-hover:text-blue-400 transition-colors">
            {character.name}
          </h3>
          {isFavorite(character.id) && <span className="text-sm">❤️</span>}
        </div>
        <p className="text-sm text-gray-300/90 leading-relaxed line-clamp-3">
          {character.description || character.backstory}
        </p>
        {character.traits?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {character.traits.slice(0, 4).map((trait: string) => (
              <span
                key={trait}
                className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-800/70 border border-gray-700/60 text-blue-100"
              >
                {trait}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span>⭐ 4.8</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-200">{t('popular')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-gray-400" />
            <span>1.2K</span>
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

      {/* Loading skeleton while fetching */}
      {isLoading && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2" aria-live="polite">
          {[0,1,2].map((_, idx) => (
            <section key={idx} className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 w-40 bg-gray-700 rounded" />
                <div className="h-8 w-20 bg-gray-700 rounded" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[0,1,2].map(i => (
                  <div key={i} className="h-40 bg-gray-800 rounded-xl border border-gray-700 animate-pulse" />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Featured Characters */}
      {filteredSections.featured.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-semibold text-white">{t('featuredCharacters')}</h2>
            <span className="text-sm text-gray-400">{t('handpickedSelections')}</span>
            {selectedCategory !== 'All' && (
              <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                {selectedCategory}
              </span>
            )}
            </div>
            <button
              onClick={() => navigateToPath('/characters')}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-200"
            >
              {t('viewAll') || '查看全部'}
            </button>
          </div>
          <div className={viewMode === 'masonry'
            ? "columns-1 md:columns-2 gap-5 space-y-5"
            : "grid grid-cols-1 md:grid-cols-2 gap-5"
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-pink-400" />
            <h2 className="text-xl font-semibold text-white">{t('trendingThisWeek')}</h2>
            <span className="text-sm text-gray-400">{t('hotPicksCommunity')}</span>
            {selectedCategory !== 'All' && (
              <span className="px-2 py-1 bg-pink-600 text-white text-xs rounded-full">
                {selectedCategory}
              </span>
            )}
            </div>
            <button
              onClick={() => navigateToPath('/characters')}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-200"
            >
              {t('viewAll') || '查看全部'}
            </button>
          </div>
          <div className={viewMode === 'masonry'
            ? "columns-1 md:columns-2 gap-5 space-y-5"
            : "grid grid-cols-1 md:grid-cols-2 gap-5"
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-green-400" />
            <h2 className="text-xl font-semibold text-white">{t('newArrivals')}</h2>
            <span className="text-sm text-gray-400">{t('freshCharactersAdded')}</span>
            {selectedCategory !== 'All' && (
              <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                {selectedCategory}
              </span>
            )}
            </div>
            <button
              onClick={() => navigateToPath('/characters')}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-200"
            >
              {t('viewAll') || '查看全部'}
            </button>
          </div>
          <div className={viewMode === 'masonry'
            ? "columns-1 md:columns-2 gap-5 space-y-5"
            : "grid grid-cols-1 md:grid-cols-2 gap-5"
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
            ? "columns-1 md:columns-2 gap-5 space-y-5"
            : "grid grid-cols-1 md:grid-cols-2 gap-5"
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
            ? "columns-1 md:columns-2 gap-5 space-y-5"
            : "grid grid-cols-1 md:grid-cols-2 gap-5"
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
