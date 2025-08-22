import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Star, Eye, Crown, Flame, TrendingUp, Users, Shield, Heart, Share, MessageCircle } from 'lucide-react';
import { Character } from '@/types';
import { useRolePlay } from '@/contexts/RolePlayContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import CharacterPreviewModal from './CharacterPreviewModal';
import { useNavigation } from '@/contexts/NavigationContext';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const filterKeys = ['popular', 'recent', 'trending', 'new', 'following', 'editorChoice'] as const;
const categoryKeys = ['all', 'anime', 'game', 'movie', 'book', 'original', 'fantasy', 'sciFi', 'romance', 'action'] as const;

interface CharacterGridProps {
  searchQuery?: string;
}

export default function CharacterGrid({ searchQuery = '' }: CharacterGridProps) {
  const [activeTab, setActiveTab] = useState('Characters');
  const [selectedFilter, setSelectedFilter] = useState('popular');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [nsfwEnabled, setNsfwEnabled] = useState(false);
  const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { navigateToPath, navigateToLogin } = useNavigation();
  
  const { setSelectedCharacter } = useRolePlay();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  
  // Mutation for creating a new chat (runs in background after immediate navigation)
  const { mutate: createChat, isPending: isCreatingChat } = useMutation({
    mutationFn: async ({ characterId }: { characterId: number }) => {
      const response = await apiRequest(
        "POST",
        "/api/chats",
        {
          characterId,
          title: t('chatWithCharacter')
        }
      );
      return response.json();
    },
    onSuccess: (chat) => {
      // ✅ REDIRECT: Replace temporary creating state with real chat (no history entry)
      setLocation(`/chat/${chat.id}`, { replace: true });
    },
    onError: (error) => {
      console.error('Failed to create chat:', error);
      // Fallback to generic chat page if creation fails
      navigateToPath('/chat');
    }
  });
  

  const { data: characters = [], isLoading, error } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
    queryFn: async () => {
      const response = await fetch('/api/characters');
      if (!response.ok) throw new Error('Failed to fetch characters');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const tabs = [
    { key: 'Characters', label: t('characters') },
    { key: 'Chats', label: t('chats') },
    { key: 'Favorites', label: t('favorites') }
  ];


  // Ensure characters is an array
  const charactersArray = Array.isArray(characters) ? characters : [];

  const filteredCharacters = charactersArray.filter((character: Character) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesName = character.name.toLowerCase().includes(query);
      const matchesDescription = (character.description || character.backstory || '').toLowerCase().includes(query);
      const matchesTraits = character.traits.some((trait: string) => trait.toLowerCase().includes(query));
      
      if (!matchesName && !matchesDescription && !matchesTraits) {
        return false;
      }
    }
    
    // Category filter
    if (selectedCategory !== 'all') {
      const categoryMap: { [key: string]: string[] } = {
        'anime': ['anime', 'manga'],
        'game': ['game', 'gaming'],
        'movie': ['movie', 'film'],
        'book': ['book', 'novel'],
        'original': ['original'],
        'fantasy': ['fantasy', 'magical'],
        'sciFi': ['sci-fi', 'science fiction'],
        'romance': ['romance', 'romantic'],
        'action': ['action', 'adventure']
      };
      
      const searchTerms = categoryMap[selectedCategory] || [selectedCategory];
      const matchesCategory = character.traits.some((trait: string) => 
        searchTerms.some(term => trait.toLowerCase().includes(term.toLowerCase()))
      );
      
      if (!matchesCategory) {
        return false;
      }
    }
    
    // Gender filter
    if (genderFilter !== 'all') {
      if (!character.gender) {
        return false; // Exclude characters with no gender specified
      }
      if (character.gender.toLowerCase() !== genderFilter.toLowerCase()) {
        return false; // Exclude characters that don't match selected gender
      }
    }
    
    return true;
  });

  // Apply tab filter
  const tabFilteredCharacters = activeTab === 'Favorites' 
    ? filteredCharacters.filter((character: Character) => favorites.includes(character.id))
    : filteredCharacters;

  // Apply sorting based on selected filter
  const sortedCharacters = [...tabFilteredCharacters].sort((a: Character, b: Character) => {
    switch (selectedFilter) {
      case 'popular':
        return b.id - a.id; // Mock popularity sorting
      case 'recent':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'new':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      default:
        return 0;
    }
  });

  const handleCharacterClick = (character: Character) => {
    setSelectedCharacter(character);
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
    if (!isAuthenticated) {
      // Redirect to login if not authenticated
      navigateToLogin();
      return;
    }
    
    // ✅ STORE CHARACTER: Set character data immediately for instant avatar loading
    setSelectedCharacter(character);
    
    // ✅ IMMEDIATE: Navigate to chat with character data pre-loaded
    // This gives instant feedback while chat is being created
    navigateToPath(`/chat/creating?characterId=${character.id}&name=${encodeURIComponent(character.name)}`);
    handlePreviewClose();
    
    // 🚀 BACKGROUND: Create chat asynchronously 
    createChat({
      characterId: character.id
    });
  };

  return (
    <div className="w-full h-full p-3 sm:p-6">
      {/* Content Header */}
      <div className="mb-6">
        <div className="text-sm text-gray-400 mb-4">
          {t('discoverAICharacters')}
        </div>
        
        
        {/* Tabs */}
        <div className="flex space-x-6 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-lg font-medium pb-2 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'text-brand-secondary border-brand-secondary bg-brand-secondary/5'
                  : 'text-content-tertiary border-transparent hover:text-content-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-4">
          <div className="flex flex-wrap gap-2">
            {filterKeys.map(filterKey => (
              <button
                key={filterKey}
                onClick={() => setSelectedFilter(filterKey)}
                className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm transition-colors flex items-center space-x-1 ${
                  selectedFilter === filterKey
                    ? 'bg-brand-secondary text-zinc-900 shadow-surface'
                    : 'bg-surface-tertiary text-content-secondary hover:bg-zinc-600'
                }`}
              >
                {filterKey === 'popular' && <Flame className="w-3 h-3" />}
                {filterKey === 'trending' && <TrendingUp className="w-3 h-3" />}
                {filterKey === 'new' && <Star className="w-3 h-3" />}
                {filterKey === 'following' && <Users className="w-3 h-3" />}
                {filterKey === 'editorChoice' && <Crown className="w-3 h-3" />}
                <span className="hidden sm:inline">{t(filterKey)}</span>
                <span className="sm:hidden">{t(filterKey).charAt(0)}</span>
              </button>
            ))}
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4 sm:ml-auto">
            <div className="flex items-center space-x-2">
              <span className="text-sm">{t('gender')}</span>
              <select 
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
              >
                <option value="all">{t('all')}</option>
                <option value="male">{t('male')}</option>
                <option value="female">{t('female')}</option>
                <option value="other">{t('other')}</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-3 bg-surface-secondary p-3 rounded-lg border border-surface-border">
              <Shield className="w-4 h-4 text-brand-secondary" />
              <span className="text-sm font-medium text-content-primary">{t('adultContentControl')}</span>
              <button
                onClick={() => setNsfwEnabled(!nsfwEnabled)}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                  nsfwEnabled 
                    ? 'bg-brand-secondary shadow-glow' 
                    : 'bg-surface-tertiary hover:bg-zinc-500'
                }`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-all duration-300 flex items-center justify-center ${
                  nsfwEnabled ? 'translate-x-6 shadow-md' : 'translate-x-0'
                }`}>
                  <Crown className="w-3 h-3 text-brand-secondary" />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Category Tags */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categoryKeys.map(categoryKey => (
            <button
              key={categoryKey}
              onClick={() => setSelectedCategory(categoryKey)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedCategory === categoryKey
                  ? 'bg-brand-accent text-white shadow-surface'
                  : 'bg-surface-tertiary text-content-secondary hover:bg-zinc-600'
              }`}
            >
              {t(categoryKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Character Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4" role="grid" aria-label="Character cards loading">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-gradient-surface border border-surface-border rounded-xl overflow-hidden shadow-elevated animate-pulse relative" role="gridcell" aria-label={`Loading character ${i + 1}`}>
              {/* Shimmer effect */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              <div className="w-full aspect-[3/4] bg-surface-tertiary relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-surface-tertiary to-zinc-600" />
              </div>
              <div className="p-4 space-y-3">
                <div className="h-5 bg-surface-tertiary rounded w-3/4 relative overflow-hidden" />
                <div className="space-y-2">
                  <div className="h-3 bg-surface-tertiary rounded w-full relative overflow-hidden" />
                  <div className="h-3 bg-surface-tertiary rounded w-2/3 relative overflow-hidden" />
                </div>
                <div className="flex space-x-2">
                  <div className="h-6 bg-surface-tertiary rounded-full w-16 relative overflow-hidden" />
                  <div className="h-6 bg-surface-tertiary rounded-full w-20 relative overflow-hidden" />
                  <div className="h-6 bg-surface-tertiary rounded-full w-12 relative overflow-hidden" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold mb-2">{t('unableToLoadCharacters')}</h3>
          <p className="text-gray-400">{t('checkConnectionRetry')}</p>
        </div>
      ) : sortedCharacters.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-xl font-semibold mb-2">
            {activeTab === 'Favorites' ? t('noFavoritesYet') : t('noCharactersFound')}
          </h3>
          <p className="text-gray-400">
            {activeTab === 'Favorites' 
              ? t('startExploring') 
              : searchQuery 
                ? t('tryAdjustingSearch')
                : t('noCharactersMatch')
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4" role="grid" aria-label="Character cards">
          {sortedCharacters.map(character => (
            <div 
              key={character.id} 
              className="group relative bg-gradient-surface border border-surface-border rounded-xl overflow-hidden shadow-elevated hover:shadow-premium hover:shadow-glow transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] cursor-pointer focus-within:ring-2 focus-within:ring-brand-secondary focus-within:ring-offset-2 focus-within:ring-offset-zinc-900"
              onClick={() => handleCharacterClick(character)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCharacterClick(character);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Select character ${character.name}. ${character.description || character.backstory}`}
            >
              <div className="relative w-full aspect-[3/4] overflow-hidden bg-surface-tertiary">
                <img
                  src={character.avatarUrl}
                  alt={`${character.name} character avatar`}
                  className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-105"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/assets/characters_img/defaults/placeholder.jpg';
                    target.onerror = null; // Prevent infinite loop
                  }}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Premium quality indicator */}
                <div className="absolute top-3 left-3">
                  <div className="flex items-center space-x-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                    <Crown className="w-3 h-3 text-brand-secondary" />
                    <span className="text-xs text-brand-primary font-medium">HD</span>
                  </div>
                </div>
                
                {/* Top-right indicators and actions */}
                <div className="absolute top-3 right-3 flex items-center space-x-2">
                  <button 
                    onClick={(e) => {
                      try {
                        e.stopPropagation();
                        handleFavoriteToggle(character.id);
                      } catch (error) {
                        console.error('Failed to toggle favorite:', error);
                      }
                    }}
                    aria-label={`${isFavorite(character.id) ? 'Remove' : 'Add'} ${character.name} to favorites`}
                    className={`p-1.5 bg-black/60 backdrop-blur-sm rounded-full hover:bg-black/80 transition-all duration-200 ${
                      isFavorite(character.id) ? 'text-brand-secondary' : 'text-white hover:text-brand-secondary'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${isFavorite(character.id) ? 'fill-current' : ''}`} />
                  </button>
                  <div className="bg-brand-secondary/90 backdrop-blur-sm px-2 py-1 rounded-full">
                    <span className="text-xs text-zinc-900 font-semibold">18+</span>
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {character.traits.slice(0, 3).map((trait: string) => (
                      <span key={trait} className="bg-brand-accent text-white px-2 py-1 rounded text-xs backdrop-blur-sm shadow-surface">
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Advanced hover overlay system */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300" role="region" aria-label={`Quick actions for ${character.name}`}>
                  {/* Primary overlay with gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-zinc-800/50 to-transparent" />
                  
                  {/* Quick action buttons - top area */}
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <button 
                      onClick={(e) => {
                        try {
                          e.stopPropagation();
                          handleFavoriteToggle(character.id);
                        } catch (error) {
                          console.error('Failed to toggle favorite:', error);
                        }
                      }}
                      aria-label={`${isFavorite(character.id) ? 'Remove' : 'Add'} ${character.name} to favorites`}
                      className="p-2 bg-black/60 backdrop-blur-sm rounded-full hover:bg-brand-secondary/20 transition-all duration-200 group/btn"
                    >
                      <Heart className={`w-4 h-4 transition-colors ${isFavorite(character.id) ? 'text-brand-secondary fill-current' : 'text-white group-hover/btn:text-brand-secondary'}`} />
                    </button>
                    <button 
                      onClick={(e) => {
                        try {
                          e.stopPropagation();
                          // TODO: Implement share functionality
                        } catch (error) {
                          console.error('Failed to share character:', error);
                        }
                      }}
                      aria-label={`Share ${character.name}`}
                      className="p-2 bg-black/60 backdrop-blur-sm rounded-full hover:bg-brand-accent/20 transition-all duration-200 group/btn"
                    >
                      <Share className="w-4 h-4 text-white group-hover/btn:text-brand-accent" />
                    </button>
                  </div>
                  
                  {/* Main action area - center */}
                  <div className="absolute inset-x-4 bottom-4 space-y-2">
                    <button 
                      onClick={(e) => {
                        try {
                          e.stopPropagation();
                          handleStartChat(character);
                        } catch (error) {
                          console.error('Failed to start chat:', error);
                        }
                      }}
                      aria-label={`Start premium chat with ${character.name}`}
                      className="w-full py-3 px-4 bg-gradient-premium hover:shadow-premium text-zinc-900 rounded-lg font-bold text-sm transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2 focus:ring-offset-zinc-900"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <MessageCircle className="w-4 h-4" />
                        <span>{t('startPremiumChat')}</span>
                      </div>
                    </button>
                    
                    <div className="flex space-x-2">
                      <button 
                        onClick={(e) => {
                          try {
                            e.stopPropagation();
                            handlePreviewOpen(character);
                          } catch (error) {
                            console.error('Failed to open preview:', error);
                          }
                        }}
                        aria-label={`Preview ${character.name}`}
                        className="flex-1 py-2 px-3 bg-surface-secondary/90 backdrop-blur-sm hover:bg-surface-tertiary text-content-primary rounded-lg font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2 focus:ring-offset-zinc-900"
                      >
{t('preview')}
                      </button>
                      <button 
                        aria-label={`View details for ${character.name}`}
                        className="flex-1 py-2 px-3 bg-surface-secondary/90 backdrop-blur-sm hover:bg-surface-tertiary text-content-primary rounded-lg font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2 focus:ring-offset-zinc-900"
                      >
{t('details')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {/* Character name with status */}
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-content-primary group-hover:text-brand-secondary transition-colors truncate">
                    {character.name}
                  </h3>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-xs text-content-tertiary font-medium">{t('available')}</span>
                  </div>
                </div>
                
                {/* Voice style and description */}
                <div className="space-y-2">
                  {/* TODO: Re-enable voice style UI when voice system is implemented (Issue #118)
                  <div className="flex items-center space-x-2">
                    <Mic className="w-3 h-3 text-brand-secondary" />
                    <span className="text-xs text-content-secondary font-medium truncate">{character.voiceStyle || t('defaultVoice')}</span>
                  </div>
                  */}
                  
                  {/* Character description - always visible */}
                  <p className="text-xs text-content-tertiary line-clamp-2 leading-relaxed">
                    {character.description || character.backstory}
                  </p>
                </div>
                
                {/* Premium traits display */}
                {character.traits?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5" role="list" aria-label={`Traits for ${character.name}`}>
                      {character.traits.slice(0, 2).map((trait: string, index: number) => (
                        <span 
                          key={trait}
                          role="listitem"
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                            index === 0 
                              ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/30'
                              : 'bg-brand-secondary/20 text-brand-secondary border border-brand-secondary/30'
                          }`}
                        >
                          {trait}
                        </span>
                      ))}
                      {character.traits.length > 2 && (
                        <span 
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface-tertiary text-content-tertiary border border-surface-border"
                          title={`${character.traits.length - 2} more traits: ${character.traits.slice(2).join(', ')}`}
                        >
                          +{character.traits.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Professional engagement metrics */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-brand-secondary fill-current" />
                      <span className="text-content-secondary font-medium">4.9</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MessageCircle className="w-3 h-3 text-content-tertiary" />
                      <span className="text-content-tertiary">
                        {character.id < 5 ? '2.1K' : character.id < 10 ? '1.8K' : '954'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Eye className="w-3 h-3 text-content-tertiary" />
                    <span className="text-content-tertiary">
                      {character.id < 5 ? '12K' : character.id < 10 ? '8.5K' : '3.2K'}
                    </span>
                  </div>
                </div>
                
                {/* Simple favorite indicator */}
                {isFavorite(character.id) && (
                  <div className="flex items-center space-x-1">
                    <Star className="w-3 h-3 text-brand-secondary fill-current" />
                    <span className="text-xs text-content-secondary font-medium">{t('favorited')}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
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
}