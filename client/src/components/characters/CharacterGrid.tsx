import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Star, Eye, Crown, Flame, TrendingUp, Users, Shield } from 'lucide-react';
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
  
  // Mutation for creating a new chat
  const { mutate: createChat, isPending: isCreatingChat } = useMutation({
    mutationFn: async ({ characterId }: { characterId: number }) => {
      const response = await apiRequest(
        "POST",
        "/api/chats",
        {
          characterId,
          title: `Chat with Character`
        }
      );
      return response.json();
    },
    onSuccess: (chat) => {
      // Navigate to the new chat
      navigateToPath(`/chat/${chat.id}`);
      handlePreviewClose();
    },
    onError: (error) => {
      console.error('Failed to create chat:', error);
      // Fallback to generic chat page
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
      return character.traits.some((trait: string) => 
        searchTerms.some(term => trait.toLowerCase().includes(term.toLowerCase()))
      );
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
    
    setSelectedCharacter(character);
    
    // Create a new chat with the selected character
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
              </select>
            </div>
            
            <div className="flex items-center space-x-3 bg-surface-secondary p-3 rounded-lg border border-surface-border">
              <Shield className="w-4 h-4 text-brand-secondary" />
              <span className="text-sm font-medium text-content-primary">Mature Content</span>
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
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
              <div className="w-full h-64 bg-gray-700"></div>
              <div className="p-3">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold mb-2">Unable to load characters</h3>
          <p className="text-gray-400">Please check your connection and try again</p>
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
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
          {sortedCharacters.map(character => (
            <div 
              key={character.id} 
              className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-all duration-200 cursor-pointer group hover:scale-105 hover:shadow-lg"
              onClick={() => handleCharacterClick(character)}
            >
              <div className="relative">
                <img
                  src={character.avatarUrl}
                  alt={character.name}
                  className="w-full h-48 sm:h-56 md:h-64 object-cover group-hover:brightness-110 transition-all duration-200"
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
                      <span key={trait} className="bg-brand-accent text-white px-2 py-1 rounded text-xs backdrop-blur-sm shadow-surface">
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Hover overlay for actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <div className="flex space-x-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartChat(character);
                      }}
                      className="px-4 py-2 bg-brand-accent hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-surface"
                    >
                      {t('chatNow')}
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
                <h3 className="font-semibold text-content-primary mb-1 truncate group-hover:text-brand-secondary transition-colors">{character.name}</h3>
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