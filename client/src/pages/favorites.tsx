import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, Eye, Filter, Grid, List, SortAsc, SortDesc, Heart, Search } from 'lucide-react';
import { Character } from '@/types';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useRolePlay } from '@/context/RolePlayContext';
import { useLocation } from 'wouter';
import GlobalLayout from '@/components/layout/GlobalLayout';
import CharacterPreviewModal from '@/components/characters/CharacterPreviewModal';

const FavoritesPage = () => {
  const [_, navigate] = useLocation();
  const { setSelectedCharacter } = useRolePlay();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'rating'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterCategory, setFilterCategory] = useState('All');

  // Mock data for demonstration
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

  // Filter to show only favorite characters
  const favoriteCharacters = useMemo(() => {
    const favChars = characters.filter(char => isFavorite(char.id));
    
    // Apply search filter
    let filtered = favChars;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = favChars.filter(char => 
        char.name.toLowerCase().includes(query) ||
        char.backstory.toLowerCase().includes(query) ||
        char.traits.some(trait => trait.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter
    if (filterCategory !== 'All') {
      filtered = filtered.filter(char => 
        char.traits.some(trait => trait.toLowerCase().includes(filterCategory.toLowerCase()))
      );
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'rating':
          comparison = 0; // Mock rating sort
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [characters, isFavorite, searchQuery, filterCategory, sortBy, sortOrder]);

  const categories = ['All', 'Fantasy', 'Sci-Fi', 'Romance', 'Adventure', 'Mystery'];

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

  const CharacterCard = ({ character }: { character: Character }) => (
    <div 
      className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-all duration-200 cursor-pointer group hover:scale-105 hover:shadow-lg"
      onClick={() => handleCharacterClick(character)}
    >
      <div className="relative">
        <img
          src={character.image || character.avatarUrl || "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop"}
          alt={character.name}
          className="w-full h-48 sm:h-56 md:h-64 object-cover group-hover:brightness-110 transition-all duration-200"
        />
        <div className="absolute top-2 right-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleFavoriteToggle(character.id);
            }}
            className="p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors text-yellow-400"
          >
            <Star className="w-4 h-4 fill-current" />
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
            <span className="text-xs text-yellow-400">❤️</span>
          </div>
          <div className="flex items-center space-x-1">
            <Eye className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">1.2K</span>
          </div>
        </div>
      </div>
    </div>
  );

  const CharacterListItem = ({ character }: { character: Character }) => (
    <div 
      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-all duration-200 cursor-pointer group flex items-center space-x-4"
      onClick={() => handleCharacterClick(character)}
    >
      <img
        src={character.image || character.avatarUrl || "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop"}
        alt={character.name}
        className="w-16 h-16 rounded-full object-cover"
      />
      <div className="flex-1">
        <h3 className="font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">{character.name}</h3>
        <p className="text-sm text-gray-400 mb-2 line-clamp-2">{character.description || character.backstory}</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {character.traits.slice(0, 4).map((trait: string) => (
            <span key={trait} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
              {trait}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-end space-y-2">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleFavoriteToggle(character.id);
          }}
          className="p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors text-yellow-400"
        >
          <Star className="w-4 h-4 fill-current" />
        </button>
        <div className="flex items-center space-x-1 text-xs text-gray-400">
          <Eye className="w-3 h-3" />
          <span>1.2K</span>
        </div>
      </div>
    </div>
  );

  return (
    <GlobalLayout>
      <div className="w-full h-full p-3 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Heart className="w-6 h-6 text-pink-400" />
            <h1 className="text-2xl font-bold text-white">My Favorites</h1>
            <span className="text-sm text-gray-400">({favoriteCharacters.length} characters)</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search your favorite characters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'rating')}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="date">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="rating">Sort by Rating</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Content */}
        {favoriteCharacters.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">💔</div>
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery || filterCategory !== 'All' ? 'No matching favorites' : 'No favorites yet'}
            </h3>
            <p className="text-gray-400 mb-6">
              {searchQuery || filterCategory !== 'All' 
                ? 'Try adjusting your search or filter criteria' 
                : 'Start exploring characters and add them to your favorites'
              }
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Explore Characters
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" 
            : "space-y-4"
          }>
            {favoriteCharacters.map(character => 
              viewMode === 'grid' ? (
                <CharacterCard key={character.id} character={character} />
              ) : (
                <CharacterListItem key={character.id} character={character} />
              )
            )}
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
    </GlobalLayout>
  );
};

export default FavoritesPage;