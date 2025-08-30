import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Star, Eye, Crown, Flame, TrendingUp, Users, Shield, Heart, Share, MessageCircle, ChevronDown, Filter } from 'lucide-react';
import { Character } from '@/types';
import { useRolePlay } from '@/contexts/RolePlayContext';
import { useFavorites } from '@/contexts/FavoritesContext';
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
      const matchesDescription = (character.description || character.backstory || '').toLowerCase().includes(query);
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
        const backstory = (character.backstory || '').toLowerCase();
        const matchesDescription = keywords.some(keyword => 
          description.includes(keyword.toLowerCase()) || backstory.includes(keyword.toLowerCase())
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
      // When NSFW is disabled, only show SFW content
      const nsfwKeywords = ['nsfw', 'adult', '成人', '性', '娇羞', '淫', '魅惑', '撩人', '敏感', '情色', '欲望', '肉体', '呻吟'];
      
      // Check traits for NSFW content
      const hasNsfwTrait = character.traits.some((trait: string) => 
        nsfwKeywords.some(keyword => trait.toLowerCase().includes(keyword.toLowerCase()))
      );
      
      // Check description for NSFW content
      const description = character.description || '';
      const hasNsfwDescription = nsfwKeywords.some(keyword => 
        description.toLowerCase().includes(keyword.toLowerCase())
      );
      
      // Check backstory for NSFW content
      const backstory = character.backstory || '';
      const hasNsfwBackstory = nsfwKeywords.some(keyword => 
        backstory.toLowerCase().includes(keyword.toLowerCase())
      );
      
      // Exclude characters with any NSFW content when NSFW is disabled
      if (hasNsfwTrait || hasNsfwDescription || hasNsfwBackstory) {
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

        {/* Category Tags - 响应式折叠式设计 */}
        <div className="mb-6">
          {/* 主要分类标签和展开按钮 */}
          <div className="flex flex-wrap items-center gap-2 mb-3 transition-all duration-300">
            {/* 全部标签 */}
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-brand-secondary text-zinc-900 shadow-surface'
                  : 'bg-surface-tertiary text-content-secondary hover:bg-zinc-600'
              }`}
            >
              全部
            </button>
            
            {/* 常用分类标签（响应式显示） */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {allCategories.slice(0, visibleCategoriesCount).map((category) => (
                <button
                  key={category.key}
                  onClick={() => setSelectedCategory(category.key)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 transform hover:scale-105 ${
                    selectedCategory === category.key
                      ? 'bg-brand-accent text-white shadow-surface scale-105'
                      : 'bg-surface-tertiary text-content-secondary hover:bg-zinc-600'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
            
            {/* 展开更多分类按钮 - 只在有剩余分类时显示 */}
            {allCategories.length > visibleCategoriesCount && (
              <button
                onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs sm:text-sm bg-surface-secondary text-content-secondary hover:bg-zinc-600 transition-colors"
              >
                <Filter className="w-3 h-3" />
                <span className="hidden sm:inline">
                  更多 ({allCategories.length - visibleCategoriesCount})
                </span>
                <span className="sm:hidden">
                  +{allCategories.length - visibleCategoriesCount}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isCategoryExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
          
          {/* 展开的分类标签 */}
          {isCategoryExpanded && (
            <div className="space-y-3 p-4 bg-surface-secondary/30 rounded-lg border border-surface-border animate-in slide-in-from-top-2 duration-200">
              {categoryGroups.map(group => (
                <div key={group.key} className="space-y-2">
                  <h4 className="text-xs font-medium text-content-tertiary uppercase tracking-wider px-1">
                    {group.label}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {group.categories.map(category => (
                      <button
                        key={category.key}
                        onClick={() => {
                          setSelectedCategory(category.key);
                          setIsCategoryExpanded(false); // 选择后自动收起
                        }}
                        className={`px-3 py-1 rounded-full text-xs transition-colors ${
                          selectedCategory === category.key
                            ? 'bg-brand-accent text-white shadow-surface'
                            : 'bg-surface-tertiary text-content-secondary hover:bg-zinc-600'
                        }`}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Character Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10 gap-3 sm:gap-4" role="grid" aria-label="Character cards loading">
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
                {/* Removed overlay trait chips to avoid duplication with content area */}
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
