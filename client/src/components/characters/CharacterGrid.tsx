import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Star, Eye, Crown, Flame, TrendingUp, Users } from 'lucide-react';
import { Character } from '@/types';
import { useRolePlay } from '@/context/RolePlayContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import CharacterPreviewModal from './CharacterPreviewModal';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

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
  const [_, navigate] = useLocation();
  
  const { setSelectedCharacter } = useRolePlay();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  
  // Mutation for creating a new chat
  const { mutate: createChat, isPending: isCreatingChat } = useMutation({
    mutationFn: async ({ characterId, sceneId }: { characterId: number; sceneId: number }) => {
      const response = await apiRequest(
        "POST",
        "/api/chats",
        {
          characterId,
          sceneId,
          title: `Chat with ${mockCharacters.find(c => c.id === characterId)?.name || 'Character'}`
        }
      );
      return response.json();
    },
    onSuccess: (chat) => {
      // Navigate to the new chat
      navigate(`/chat/${chat.id}`);
      handlePreviewClose();
    },
    onError: (error) => {
      console.error('Failed to create chat:', error);
      // Fallback to generic chat page
      navigate('/chat');
    }
  });
  
  // Mock data for demonstration
  const mockCharacters: Character[] = [
    {
      id: 1,
      name: "艾莉丝",
      avatarUrl: "/assets/characters_img/Elara.jpeg",
      backstory: "Elara is the last of an ancient line of arcane practitioners who once advised kings and queens throughout the realm. After centuries of extending her life through magical means, she has accumulated vast knowledge but has grown somewhat detached from humanity.",
      voiceStyle: "Mystical",
      traits: ["Wise", "Mysterious", "Powerful"],
      personalityTraits: {},
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      name: "Kravus",
      avatarUrl: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
      backstory: "A battle-hardened warrior from the northern plains, Kravus fights for honor and glory. His imposing presence and scarred visage tell of countless battles survived through sheer strength and determination.",
      voiceStyle: "Gruff",
      traits: ["Strong", "Honorable", "Warrior"],
      personalityTraits: {},
      createdAt: new Date().toISOString()
    },
    {
      id: 3,
      name: "Lyra",
      avatarUrl: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
      backstory: "A nimble rogue with a mysterious past, Lyra uses her wit and cunning to survive in a world that has never shown her kindness. Despite her tough exterior, she harbors a soft spot for those who have been wronged.",
      voiceStyle: "Sarcastic",
      traits: ["Cunning", "Agile", "Mysterious"],
      personalityTraits: {},
      createdAt: new Date().toISOString()
    },
    {
      id: 4,
      name: "XN-7",
      avatarUrl: "https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
      backstory: "An advanced android with a curiosity about human emotions. XN-7 was designed to assist with complex calculations and data analysis, but has developed beyond its original programming and now seeks to understand what it means to be alive.",
      voiceStyle: "Robotic",
      traits: ["Logical", "Curious", "Analytical"],
      personalityTraits: {},
      createdAt: new Date().toISOString()
    },
    {
      id: 5,
      name: "Zara",
      avatarUrl: "https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
      backstory: "A skilled diplomat and negotiator from the eastern kingdoms, Zara believes in solving conflicts through words rather than weapons. Her charm and intelligence have prevented many wars.",
      voiceStyle: "Diplomatic",
      traits: ["Charismatic", "Intelligent", "Peaceful"],
      personalityTraits: {},
      createdAt: new Date().toISOString()
    },
    {
      id: 6,
      name: "Marcus",
      avatarUrl: "https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
      backstory: "A former royal guard who turned to adventure after losing his lord in a terrible battle. Marcus seeks redemption and purpose in helping others achieve their goals.",
      voiceStyle: "Noble",
      traits: ["Loyal", "Protective", "Honorable"],
      personalityTraits: {},
      createdAt: new Date().toISOString()
    }
  ];

  const { data: characters = mockCharacters, isLoading, error } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
    // Use mock data as fallback when API fails
    queryFn: async () => {
      // Try to fetch from API, but return mock data if it fails
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
      navigate('/login');
      return;
    }
    
    setSelectedCharacter(character);
    
    // Create a new chat with the selected character
    // Using default scene ID 1 for now
    createChat({
      characterId: character.id,
      sceneId: 1 // Default scene, you might want to let users choose
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
                  ? 'text-pink-400 border-pink-400'
                  : 'text-gray-400 border-transparent hover:text-white'
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
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
            
            <div className="flex items-center space-x-2">
              <span className="text-sm">NSFW</span>
              <button
                onClick={() => setNsfwEnabled(!nsfwEnabled)}
                className={`w-10 h-6 rounded-full transition-colors ${
                  nsfwEnabled ? 'bg-pink-600' : 'bg-gray-600'
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                  nsfwEnabled ? 'translate-x-5' : 'translate-x-1'
                }`} />
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
        <div className="text-center py-8">
          <p className="text-red-500">{t('errorLoadingCharacters')}</p>
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
                  src={character.image || character.avatarUrl || `https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop`}
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
                      <span key={trait} className="bg-blue-600 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
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
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
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