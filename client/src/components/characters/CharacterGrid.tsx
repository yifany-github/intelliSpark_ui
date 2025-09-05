import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Star, Eye, Crown, Flame, TrendingUp, Users, Shield, Heart, Share, MessageCircle, ChevronDown, Filter } from 'lucide-react';
import { Character } from '@/types';
import { useRolePlay } from '@/contexts/RolePlayContext';
import { useFavorites } from '@/contexts/FavoritesContext';
// useToast imported above
import CharacterPreviewModal from './CharacterPreviewModal';
import TraitChips from '@/components/characters/TraitChips';
import { useNavigation } from '@/contexts/NavigationContext';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

const filterKeys = ['popular', 'trending', 'new', 'following', 'editorChoice'] as const;

// 新的多层次分类体系
interface CategoryGroup {
  key: string;
  label: string;
  categories: {
    key: string;
    label: string;
    keywords: string[];
  }[];
}

const categoryGroups: CategoryGroup[] = [
  {
    key: 'source',
    label: '来源分类',
    categories: [
      { key: 'anime', label: '动漫', keywords: ['动漫', 'anime', 'manga', '漫画', '二次元', '动画'] },
      { key: 'game', label: '游戏', keywords: ['游戏', 'game', 'gaming', '电竞', '虚拟'] },
      { key: 'movie', label: '影视', keywords: ['影视', 'movie', 'film', '电影', '电视剧', '明星'] },
      { key: 'book', label: '书籍', keywords: ['书籍', 'book', 'novel', '小说', '文学', '名著'] },
      { key: 'celebrity', label: '真人', keywords: ['真人', 'celebrity', '名人', '明星', '历史', 'historical'] },
      { key: 'life', label: '生活', keywords: ['生活', 'life', '日常', '现实', 'original', '原创'] }
    ]
  },
  {
    key: 'scene',
    label: '场景分类', 
    categories: [
      { key: 'family', label: '家庭', keywords: ['家庭', 'family', '亲情', '家人', '父母', '兄妹'] },
      { key: 'school', label: '校园', keywords: ['校园', 'school', '学生', '老师', '同学', '青春'] },
      { key: 'office', label: '职场', keywords: ['职场', 'office', '公司', '同事', '老板', '商务'] },
      { key: 'party', label: '聚会', keywords: ['聚会', 'party', '派对', '社交', '朋友', '娱乐'] },
      { key: 'travel', label: '旅行', keywords: ['旅行', 'travel', '冒险', '探索', '度假'] },
      { key: 'medical', label: '医院', keywords: ['医院', 'medical', '医生', '护士', '病人', '治疗'] },
      { key: 'restaurant', label: '餐厅', keywords: ['餐厅', 'restaurant', '服务员', '厨师', '美食'] }
    ]
  },
  {
    key: 'style',
    label: '风格分类',
    categories: [
      { key: 'fantasy', label: '奇幻', keywords: ['奇幻', 'fantasy', '魔法', '神话', '超自然', '魔幻'] },
      { key: 'scifi', label: '科幻', keywords: ['科幻', 'sci-fi', '未来', '机器人', '太空', 'android'] },
      { key: 'warm', label: '温情', keywords: ['温情', 'warm', '治愈', '暖心', '友好', '温柔体贴', '可爱'] },
      { key: 'historical', label: '古装', keywords: ['古装', 'historical', '古代', '传统', '历史', '武侠'] },
      { key: 'modern', label: '现代', keywords: ['现代', 'modern', '都市', '时尚', '当代'] },
      { key: 'horror', label: '恐怖', keywords: ['恐怖', 'horror', '惊悚', '悬疑', '黑暗'] },
      { key: 'humor', label: '幽默', keywords: ['幽默', 'humor', '搞笑', '诙谐', '轻松', '俏皮叛逆'] }
    ]
  }
];

// 扁平化所有分类用于快速查找
const allCategories = categoryGroups.flatMap(group => group.categories);
const categoryKeys = ['all', ...allCategories.map(cat => cat.key)] as const;

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
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const [visibleCategoriesCount, setVisibleCategoriesCount] = useState(6);
  const { navigateToPath, navigateToLogin } = useNavigation();

  // Helper function to detect NSFW content in character (primary: explicit flag; secondary: keyword heuristic)
  const isCharacterNSFW = (character: Character): boolean => {
    // Prefer explicit flag from backend
    if ((character.nsfwLevel || 0) > 0) return true;

    // Fallback heuristic for legacy data with no nsfwLevel set
    const nsfwKeywords = ['nsfw', 'adult', '成人', '性', '娇羞', '淫', '魅惑', '撩人', '敏感', '情色', '欲望', '肉体', '呻吟', '诱惑', '性感'];
    const hasNsfwTrait = character.traits.some((trait: string) => 
      nsfwKeywords.some(keyword => trait.toLowerCase().includes(keyword.toLowerCase()))
    );
    const description = character.description || '';
    const hasNsfwDescription = nsfwKeywords.some(keyword => 
      description.toLowerCase().includes(keyword.toLowerCase())
    );
    const backstory = character.backstory || '';
    const hasNsfwBackstory = nsfwKeywords.some(keyword => 
      backstory.toLowerCase().includes(keyword.toLowerCase())
    );
    return hasNsfwTrait || hasNsfwDescription || hasNsfwBackstory;
  };

  // Helper function to check if character is featured by admin
  const isCharacterFeatured = (character: Character): boolean => {
    // Check if character has isFeatured field from backend analytics
    return !!(character as any).isFeatured;
  };

  // Helper function to format numbers for display (1000 -> 1K, 1500 -> 1.5K)
  const formatNumber = (num: number): string => {
    if (num < 1000) {
      return num.toString();
    } else if (num < 10000) {
      return `${(num / 1000).toFixed(1)}K`;
    } else if (num < 1000000) {
      return `${Math.floor(num / 1000)}K`;
    } else {
      return `${(num / 1000000).toFixed(1)}M`;
    }
  };

  // Helper function to get real character analytics data
  const getCharacterAnalytics = (character: Character) => {
    const charAnalytics = character as any;
    return {
      viewCount: charAnalytics.viewCount || 0,
      chatCount: charAnalytics.chatCount || 0,
      likeCount: charAnalytics.likeCount || 0,
      trendingScore: charAnalytics.trendingScore || 0.0
    };
  };

  // Helper function to calculate rating from likes and interactions
  const getCharacterRating = (character: Character): number => {
    const analytics = getCharacterAnalytics(character);
    const totalInteractions = analytics.viewCount + analytics.chatCount;
    
    // Base rating calculation: more likes and interactions = higher rating
    if (totalInteractions === 0) return 4.0; // Default rating for new characters
    
    const likeRatio = analytics.likeCount / Math.max(totalInteractions * 0.1, 1); // Assume ~10% like rate is good
    const baseRating = Math.min(4.0 + likeRatio, 5.0); // Cap at 5.0
    
    // Round to 1 decimal place
    return Math.round(baseRating * 10) / 10;
  };
  
  const { setSelectedCharacter } = useRolePlay();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
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
      // SECURITY: Always use UUID for privacy - no fallback to integer ID
      if (!chat.uuid) {
        console.error('Security error: Chat UUID missing from API response');
        toast({
          title: 'Unable to start chat',
          description: 'There was a technical issue creating your chat. Please try again.',
          variant: 'destructive',
        });
        navigateToPath('/chat'); // Fallback to generic chat page
        return;
      }
      setLocation(`/chat/${chat.uuid}`, { replace: true });
    },
    onError: (error) => {
      console.error('Failed to create chat:', error);
      toast({
        title: 'Chat creation failed',
        description: 'Unable to start your conversation. Please check your connection and try again.',
        variant: 'destructive',
      });
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

  // 根据屏幕宽度计算可显示的分类标签数量
  const calculateVisibleCategories = useCallback(() => {
    const screenWidth = window.innerWidth;
    
    // 根据不同屏幕宽度设置不同的显示数量
    if (screenWidth < 640) {        // sm breakpoint
      return 2; // 移动端显示最少
    } else if (screenWidth < 768) { // md breakpoint  
      return 4;
    } else if (screenWidth < 1024) { // lg breakpoint
      return 6;
    } else if (screenWidth < 1280) { // xl breakpoint
      return 8;
    } else if (screenWidth < 1536) { // 2xl breakpoint
      return 10;
    } else {                        // 超大屏幕
      return 12; // 显示更多分类
    }
  }, []);

  // 监听窗口大小变化
  useEffect(() => {
    const updateVisibleCategories = () => {
      const newCount = calculateVisibleCategories();
      setVisibleCategoriesCount(newCount);
      
      // 如果新的可见分类数量能够包含所有分类，自动收起展开状态
      if (newCount >= allCategories.length && isCategoryExpanded) {
        setIsCategoryExpanded(false);
      }
    };

    // 初始化
    updateVisibleCategories();

    // 添加窗口大小变化监听器 - 使用防抖以提高性能
    let timeoutId: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateVisibleCategories, 100);
    };

    window.addEventListener('resize', debouncedUpdate);

    // 清理监听器
    return () => {
      window.removeEventListener('resize', debouncedUpdate);
      clearTimeout(timeoutId);
    };
  }, [calculateVisibleCategories, isCategoryExpanded, allCategories.length]);


  // Ensure characters is an array
  const charactersArray = Array.isArray(characters) ? characters : [];

  const filteredCharacters = charactersArray.filter((character: Character) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesName = character.name.toLowerCase().includes(query);
      const matchesDescription = (character.description || '').toLowerCase().includes(query);
      const matchesTraits = character.traits.some((trait: string) => trait.toLowerCase().includes(query));
      
      if (!matchesName && !matchesDescription && !matchesTraits) {
        return false;
      }
    }
    
    // Category filter - 新的多层次分类系统
    if (selectedCategory !== 'all') {
      const selectedCategoryData = allCategories.find(cat => cat.key === selectedCategory);
      
      if (selectedCategoryData) {
        const keywords = selectedCategoryData.keywords;
        
        // 检查角色的traits和category字段
        const matchesTraits = character.traits.some((trait: string) => 
          keywords.some(keyword => trait.toLowerCase().includes(keyword.toLowerCase()))
        );
        
        const matchesCategory = character.category && 
          keywords.some(keyword => character.category!.toLowerCase().includes(keyword.toLowerCase()));
        
        // 检查描述和背景故事
        const description = (character.description || '').toLowerCase();
        const matchesDescription = keywords.some(keyword => 
          description.includes(keyword.toLowerCase())
        );
        
        // 只要有一个匹配就通过
        if (!matchesTraits && !matchesCategory && !matchesDescription) {
          return false;
        }
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
    
    // NSFW filter
    if (!nsfwEnabled) {
      // Hide characters explicitly marked NSFW
      if ((character.nsfwLevel || 0) > 0) return false;
      // For legacy data without nsfwLevel, fall back to heuristic
      if (isCharacterNSFW(character)) return false;
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
        // Calculate popularity score based on multiple factors
        const getPopularityScore = (char: Character) => {
          const ageInDays = (Date.now() - new Date(char.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          const recencyBonus = Math.max(0, (30 - ageInDays) * 0.1); // Bonus for newer characters (up to 30 days)
          
          // Mock popularity calculation until we have real analytics data
          // Higher ID = newer character, gets slight popularity boost
          const mockPopularity = char.id * 0.01;
          
          // Characters with more traits are considered more detailed/popular
          const traitBonus = char.traits.length * 0.5;
          
          // Longer backstories indicate more effort/quality
          const backstoryBonus = (char.backstory?.length || 0) * 0.001;
          
          return mockPopularity + traitBonus + backstoryBonus + recencyBonus;
        };
        
        return getPopularityScore(b) - getPopularityScore(a);
      case 'trending':
        // Calculate trending score based on recent activity and momentum  
        const getTrendingScore = (char: Character) => {
          const now = Date.now();
          const createdTime = new Date(char.createdAt).getTime();
          const ageInHours = (now - createdTime) / (1000 * 60 * 60);
          
          // Recent activity boost: newer characters get higher trending scores
          const recencyMultiplier = Math.max(0.1, 1 - (ageInHours / (24 * 7))); // 1 week decay
          
          // Quality indicators for trending momentum
          const qualityScore = (
            (char.traits.length * 2) + // Rich traits indicate engaging content
            ((char.backstory?.length || 0) / 100) + // Detailed backstory
            ((char.description?.length || 0) / 50) // Rich description
          );
          
          // Trending score combines quality with recency
          const trendingScore = qualityScore * recencyMultiplier;
          
          // Add slight randomness to simulate dynamic trending (0.8-1.2x multiplier)
          const randomFactor = 0.8 + (Math.sin(char.id * 0.1 + Date.now() / 86400000) + 1) * 0.2;
          
          return trendingScore * randomFactor;
        };
        
        return getTrendingScore(b) - getTrendingScore(a);
      case 'new':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'following':
        // Mock following system - prioritize characters user might be interested in
        const getFollowingScore = (char: Character) => {
          // Simulate user preference based on character traits and type
          const preferredTraits = ['friendly', 'helpful', 'cute', 'intelligent', 'caring', 'funny'];
          const traitMatches = char.traits.filter(trait => 
            preferredTraits.some(preferred => 
              trait.toLowerCase().includes(preferred.toLowerCase())
            )
          ).length;
          
          // Characters with preferred traits get higher scores
          const preferenceScore = traitMatches * 3;
          
          // Add some variety with character ID-based pseudo-randomization
          const varietyScore = (char.id % 7) * 0.5;
          
          return preferenceScore + varietyScore;
        };
        
        return getFollowingScore(b) - getFollowingScore(a);
      case 'editorChoice':
        // Use real featured status from backend + quality fallback
        const getEditorScore = (char: Character) => {
          // Featured characters get top priority
          if ((char as any).isFeatured) {
            return 1000; // High priority for admin-featured characters
          }
          
          // Fallback to quality-based scoring for non-featured characters
          const traitQuality = char.traits.length >= 3 ? char.traits.length * 2 : 0;
          const backstoryQuality = (char.backstory?.length || 0) >= 100 ? 
            Math.min((char.backstory?.length || 0) / 50, 20) : 0;
          const descriptionQuality = (char.description?.length || 0) >= 50 ? 
            Math.min((char.description?.length || 0) / 25, 15) : 0;
          
          // Bonus for diverse and interesting traits
          const diversityBonus = new Set(char.traits.map(t => t.toLowerCase())).size * 1.5;
          
          // Character completeness score
          const completenessScore = [
            char.name?.length > 2,
            char.backstory?.length > 50,
            char.traits.length >= 2,
            char.description?.length > 30,
            char.gender
          ].filter(Boolean).length * 2;
          
          return traitQuality + backstoryQuality + descriptionQuality + diversityBonus + completenessScore;
        };
        
        return getEditorScore(b) - getEditorScore(a);
      default:
        return 0;
    }
  });

  const handleCharacterClick = (character: Character) => {
    setSelectedCharacter(character);
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
    <div className="w-full h-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 py-3 sm:py-6">
      {/* Content Header */}
      <div className="mb-6">        
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
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-sm font-medium transition-colors flex items-center space-x-2 min-h-[44px] min-w-[44px] justify-center ${
                  selectedFilter === filterKey
                    ? 'bg-brand-secondary text-zinc-900 shadow-surface'
                    : 'bg-surface-tertiary text-content-secondary hover:bg-zinc-600 active:bg-zinc-500'
                }`}
              >
                {filterKey === 'popular' && <Flame className="w-4 h-4" />}
                {filterKey === 'trending' && <TrendingUp className="w-4 h-4" />}
                {filterKey === 'new' && <Star className="w-4 h-4" />}
                {filterKey === 'following' && <Users className="w-4 h-4" />}
                {filterKey === 'editorChoice' && <Crown className="w-4 h-4" />}
                <span className="hidden sm:inline">{t(filterKey)}</span>
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

        {/* Category Tags - 水平滚动设计，移动端友好 */}
        <div className="mb-6">
          <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-border">
            {/* 全部标签 */}
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors min-h-[40px] ${
                selectedCategory === 'all'
                  ? 'bg-brand-secondary text-zinc-900 shadow-surface'
                  : 'bg-surface-tertiary text-content-secondary hover:bg-zinc-600 active:bg-zinc-500'
              }`}
            >
              全部
            </button>
            
            {/* 所有分类标签水平滚动 */}
            {allCategories.map((category) => (
              <button
                key={category.key}
                onClick={() => setSelectedCategory(category.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors min-h-[40px] ${
                  selectedCategory === category.key
                    ? 'bg-brand-accent text-white shadow-surface'
                    : 'bg-surface-tertiary text-content-secondary hover:bg-zinc-600 active:bg-zinc-500'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Character Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10 gap-3 sm:gap-4" role="grid" aria-label="Character cards loading">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="group relative bg-gradient-surface border border-surface-border rounded-xl overflow-hidden shadow-elevated animate-pulse" role="gridcell" aria-label={`Loading character ${i + 1}`}>
              {/* Enhanced shimmer effect */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" 
                   style={{ animationDuration: '2s', animationIterationCount: 'infinite' }} />
              
              {/* Image area matching aspect ratio */}
              <div className="relative w-full aspect-[3/4] overflow-hidden bg-surface-tertiary">
                <div className="absolute inset-0 bg-gradient-to-br from-surface-tertiary to-zinc-600" />
                
                {/* Loading indicators in corners */}
                <div className="absolute top-3 left-3">
                  <div className="w-12 h-6 bg-surface-secondary/60 rounded-full" />
                </div>
                <div className="absolute top-3 right-3 z-20 flex items-center space-x-2">
                  <div className="w-6 h-6 bg-surface-secondary/60 rounded-full" />
                </div>
              </div>
              
              {/* Content area matching real card */}
              <div className="p-4 space-y-3">
                {/* Character name with status - matching real layout */}
                <div className="flex items-center justify-between">
                  <div className="h-5 bg-surface-tertiary rounded w-2/3" />
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-surface-tertiary rounded-full" />
                    <div className="w-8 h-3 bg-surface-tertiary rounded" />
                  </div>
                </div>
                
                {/* Description area - matching line-clamp-2 */}
                <div className="space-y-1.5">
                  <div className="h-3 bg-surface-tertiary rounded w-full" />
                  <div className="h-3 bg-surface-tertiary rounded w-4/5" />
                </div>
                
                {/* Trait chips - matching maxVisible={2} */}
                <div className="flex gap-2">
                  <div className="h-6 bg-surface-tertiary rounded-full w-16" />
                  <div className="h-6 bg-surface-tertiary rounded-full w-14" />
                </div>
                
                {/* Metrics area - matching real layout */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-surface-tertiary rounded" />
                      <div className="w-6 h-3 bg-surface-tertiary rounded" />
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-surface-tertiary rounded" />
                      <div className="w-8 h-3 bg-surface-tertiary rounded" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-surface-tertiary rounded" />
                    <div className="w-8 h-3 bg-surface-tertiary rounded" />
                  </div>
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
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10 gap-3 sm:gap-4" role="grid" aria-label="Character cards">
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
              aria-label={`Select character ${character.name}. ${character.description || ''}`}
            >
              <div className="relative w-full aspect-[3/4] overflow-hidden bg-surface-tertiary">
                <img
                  src={character.avatarUrl}
                  alt={`${character.name} character avatar`}
                  className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-105"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/assets/characters_img/Elara.jpeg';
                    target.onerror = null; // Prevent infinite loop
                  }}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Featured character indicator - only show for admin-featured characters */}
                {isCharacterFeatured(character) && (
                  <div className="absolute top-3 left-3 animate-pulse">
                    <div className="flex items-center justify-center space-x-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 px-3 py-1.5 rounded-full shadow-lg shadow-yellow-500/50 border-2 border-yellow-300 h-8">
                      <Crown className="w-4 h-4 text-amber-900 drop-shadow-sm" />
                      <span className="text-xs text-amber-900 font-black tracking-wide drop-shadow-sm leading-none">精选</span>
                    </div>
                  </div>
                )}
                
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
                    aria-label={`${isFavorite(character.id) ? '取消收藏' : '收藏'} ${character.name}`}
                    className={`w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full hover:bg-black/80 transition-all duration-200 flex items-center justify-center ${
                      isFavorite(character.id) ? 'text-brand-secondary' : 'text-white hover:text-brand-secondary'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${isFavorite(character.id) ? 'fill-current' : ''}`} />
                  </button>
                  {/* NSFW indicator - only show for characters with adult content */}
                  {isCharacterNSFW(character) && (
                    <div className="w-8 h-8 bg-red-500/90 backdrop-blur-sm rounded-full border border-red-400/50 flex items-center justify-center">
                      <span className="text-xs text-white font-bold leading-none">18+</span>
                    </div>
                  )}
                </div>
                {/* Removed overlay trait chips to avoid duplication with content area */}
                {/* Simplified hover overlay - dual action layout */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4 pointer-events-none">
                  <div className="w-full space-y-2 pointer-events-auto">
                    {/* Primary action - Start Chat */}
                    <button 
                      onClick={(e) => {
                        try {
                          e.stopPropagation();
                          handleStartChat(character);
                        } catch (error) {
                          console.error('Failed to start chat:', error);
                        }
                      }}
                      className="w-full py-3 bg-brand-secondary text-zinc-900 rounded-lg font-bold text-sm hover:bg-brand-secondary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2 focus:ring-offset-black"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <MessageCircle className="w-4 h-4" />
                        <span>开始聊天</span>
                      </div>
                    </button>
                    
                    {/* Secondary action - Preview */}
                    <button 
                      onClick={(e) => {
                        try {
                          e.stopPropagation();
                          handlePreviewOpen(character);
                        } catch (error) {
                          console.error('Failed to open preview:', error);
                        }
                      }}
                      className="w-full py-2 bg-surface-secondary/90 backdrop-blur-sm text-content-primary rounded-lg font-medium text-sm hover:bg-surface-tertiary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2 focus:ring-offset-black"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <Eye className="w-4 h-4" />
                        <span>预览详情</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {/* Character name with meaningful status */}
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-content-primary group-hover:text-brand-secondary transition-colors truncate">
                    {character.name}
                  </h3>
                  {/* Show activity level based on real data instead of confusing "online" status */}
                  {(() => {
                    const analytics = getCharacterAnalytics(character);
                    const totalActivity = analytics.viewCount + analytics.chatCount;
                    
                    if (isCharacterFeatured(character)) {
                      return (
                        <div className="flex items-center space-x-1">
                          <Crown className="w-3 h-3 text-yellow-500" />
                          <span className="text-xs text-yellow-500 font-medium">官方推荐</span>
                        </div>
                      );
                    } else if (totalActivity > 100) {
                      return (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full" />
                          <span className="text-xs text-green-400 font-medium">热门</span>
                        </div>
                      );
                    } else if (totalActivity > 10) {
                      return (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full" />
                          <span className="text-xs text-blue-400 font-medium">活跃</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full" />
                          <span className="text-xs text-gray-400 font-medium">新角色</span>
                        </div>
                      );
                    }
                  })()}
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
                    {character.description}
                  </p>
                </div>
                
                {/* Traits display (single location on card) */}
                {character.traits?.length > 0 && (
                  <div className="space-y-2">
                    <TraitChips
                      traits={character.traits}
                      maxVisible={2}
                      size="xs"
                      chipClassName="px-2.5 py-1 bg-brand-secondary/20 text-brand-secondary border border-brand-secondary/30"
                      moreChipClassName="px-2.5 py-1 bg-surface-tertiary text-content-tertiary border border-surface-border"
                    />
                  </div>
                )}
                
                {/* Real-time engagement metrics from backend analytics */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-brand-secondary fill-current" />
                      <span className="text-content-secondary font-medium">
                        {getCharacterRating(character)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MessageCircle className="w-3 h-3 text-content-tertiary" />
                      <span className="text-content-tertiary">
                        {formatNumber(getCharacterAnalytics(character).chatCount)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Eye className="w-3 h-3 text-content-tertiary" />
                    <span className="text-content-tertiary">
                      {formatNumber(getCharacterAnalytics(character).viewCount)}
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
