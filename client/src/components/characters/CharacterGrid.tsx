import { useEffect, useId, useMemo, useState } from 'react';
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Star, Eye, Crown, Flame, TrendingUp, Users, Shield, Heart, MessageCircle, ChevronDown, Filter, Sparkles } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const filterKeys = ['popular', 'trending', 'new', 'following', 'editorChoice'] as const;
const genderOptions = ['all', 'female', 'male', 'other'] as const;
const genderIconMap: Record<typeof genderOptions[number], React.ComponentType<{ className?: string }>> = {
  all: Users,
  female: Heart,
  male: Shield,
  other: Sparkles,
};

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
  const [selectedFilter, setSelectedFilter] = useState<typeof filterKeys[number]>('popular');
  const [selectedCategory, setSelectedCategory] = useState<typeof categoryKeys[number]>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'other'>('all');
  const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { navigateToLogin } = useNavigation();

  // Helper function to detect NSFW content in character (primary: explicit flag; secondary: keyword heuristic)
  const isCharacterNSFW = (character: Character): boolean => {
    // Prefer explicit flag from backend
    if ((character.nsfwLevel || 0) > 0) return true;

    // Fallback heuristic for legacy data with no nsfwLevel set (simplified to avoid false positives)
    const nsfwKeywords = ['nsfw', '色情'];
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
  
  const { setSelectedCharacter, nsfwEnabled } = useRolePlay();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const nsfwSwitchId = useId();
  const favoritesSwitchId = useId();
  const panelId = useId();

  const selectedCategoryLabel = selectedCategory === 'all'
    ? (t('all') || '全部')
    : allCategories.find(cat => cat.key === selectedCategory)?.label || selectedCategory;

  const genderLabel =
    genderFilter === 'all'
      ? t('all') || '全部'
      : t(genderFilter) ||
        ({
          female: '女性',
          male: '男性',
          other: '其他',
        } as const)[genderFilter];

  const handleResetFilters = () => {
    setSelectedFilter('popular');
    setSelectedCategory('all');
    setGenderFilter('all');
    // Note: NSFW is now global and controlled from TopNavigation
    setActiveTab('Characters');
  };

  const activeFilters = useMemo(() => {
    const badges: { label: string; value: string; color: string }[] = [];

    if (selectedFilter !== 'popular') {
      badges.push({ label: t('sortBy') || '排序', value: t(selectedFilter), color: 'bg-brand-secondary/20 text-brand-secondary' });
    }
    if (selectedCategory !== 'all') {
      badges.push({ label: t('category') || '分类', value: selectedCategoryLabel, color: 'bg-brand-accent/20 text-brand-accent' });
    }
    if (genderFilter !== 'all') {
      badges.push({ label: t('gender') || '性别', value: genderLabel, color: 'bg-blue-500/15 text-blue-400' });
    }
    if (nsfwEnabled) {
      badges.push({ label: 'NSFW', value: t('nsfwEnabled') || '已开启', color: 'bg-red-500/20 text-red-400' });
    }
    if (activeTab === 'Favorites') {
      badges.push({ label: t('favorites') || '收藏', value: t('favoritesOnly') || '仅看收藏', color: 'bg-pink-500/20 text-pink-500' });
    }

    return badges;
  }, [selectedFilter, selectedCategory, genderFilter, nsfwEnabled, activeTab, t, selectedCategoryLabel, genderLabel]);
  
  // Mutation for creating a new chat (runs in background after immediate navigation)
  const { mutate: createChat, isPending: isCreatingChat } = useMutation({
    mutationFn: async ({ characterId }: { characterId: number }) => {
      const response = await apiRequest(
        "POST",
        "/api/chats",
        {
          characterId,
          title: t('chatWithCharacter'),
        }
      );
      return response.json();
    },
    onSuccess: (chat) => {
      if (!chat?.uuid) {
        console.error('[CharacterGrid] Chat created without UUID:', chat);
        toast({
          title: t('error') || 'Error',
          description: 'Backend error: Chat UUID missing. Please contact support.',
          variant: 'destructive',
        });
        setLocation('/', { replace: true });
        return;
      }

      setLocation(`/chat/${chat.uuid}`, { replace: true });
    },
    onError: (error) => {
      console.error('Failed to create chat:', error);
      toast({
        title: t('error') || 'Error',
        description: t('failedToStartChat') || 'Unable to start chat. Please try again.',
        variant: 'destructive',
      });
      setLocation('/', { replace: true });
    }
  });
  

  const { data: characters = [], isLoading, error } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/characters');
      if (!response.ok) throw new Error('Failed to fetch characters');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    placeholderData: keepPreviousData, // Show cached data instantly while loading fresh data
  });

  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const tabs = [
    { key: 'Characters', label: t('characters') }
  ];

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
        // Featured characters first, then alphabetical by name
        const aIsFeatured = !!(a as any).isFeatured;
        const bIsFeatured = !!(b as any).isFeatured;

        // Featured characters come first
        if (aIsFeatured && !bIsFeatured) return -1;
        if (!aIsFeatured && bIsFeatured) return 1;

        // Within same featured status, sort alphabetically by name
        return a.name.localeCompare(b.name, 'zh-CN');
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
          const backstoryQuality = (char.backstory?.length ?? 0) >= 100 ? 
            Math.min((char.backstory?.length ?? 0) / 50, 20) : 0;
          const descriptionQuality = (char.description?.length ?? 0) >= 50 ? 
            Math.min((char.description?.length ?? 0) / 25, 15) : 0;
          
          // Bonus for diverse and interesting traits
          const diversityBonus = new Set(char.traits.map(t => t.toLowerCase())).size * 1.5;
          
          // Character completeness score
          const completenessScore = [
            char.name?.length > 2,
            char.backstory?.length > 50,
            char.traits.length >= 2,
            (char.description?.length ?? 0) > 30,
            char.gender
          ].filter(Boolean).length * 2;
          
          return traitQuality + backstoryQuality + descriptionQuality + diversityBonus + completenessScore;
        };
        
        return getEditorScore(b) - getEditorScore(a);
      default:
        // Default sorting: featured characters first, then alphabetical by name
        const aIsFeaturedDefault = !!(a as any).isFeatured;
        const bIsFeaturedDefault = !!(b as any).isFeatured;

        // Featured characters come first
        if (aIsFeaturedDefault && !bIsFeaturedDefault) return -1;
        if (!aIsFeaturedDefault && bIsFeaturedDefault) return 1;

        // Within same featured status, sort alphabetically by name
        return a.name.localeCompare(b.name, 'zh-CN');
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
    
    // ✅ STORE CHARACTER: Set character data immediately so chat page can render instantly
    setSelectedCharacter(character);
    handlePreviewClose();
    createChat({
      characterId: character.id,
    });
  };

  return (
    <div className="w-full h-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 py-3 sm:py-6">
      {/* Content Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-content-tertiary">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`group relative rounded-full px-4 py-2 transition-colors ${
                activeTab === tab.key
                  ? 'bg-brand-secondary/10 text-brand-secondary shadow-surface'
                  : 'hover:text-content-secondary'
              }`}
            >
              <span className="text-sm font-medium uppercase tracking-[0.12em]">
                {tab.label}
              </span>
              {activeTab === tab.key && (
                <span className="pointer-events-none absolute inset-x-4 bottom-0 h-px rounded-full bg-brand-secondary/70" />
              )}
            </button>
          ))}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {genderOptions.map(option => {
              const GenderIcon = genderIconMap[option];
              return (
                <button
                  key={`gender-${option}`}
                  onClick={() => setGenderFilter(option)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                    genderFilter === option
                      ? 'border-brand-secondary/70 bg-brand-secondary/15 text-brand-secondary shadow-[0_6px_20px_-15px_rgba(244,164,96,0.9)]'
                      : 'border-transparent bg-surface-tertiary/60 text-content-secondary hover:bg-surface-tertiary'
                  }`}
                  type="button"
                >
                  <GenderIcon className="h-3.5 w-3.5" />
                  <span>{option === 'all' ? (t('all') || '全部') : t(option)}</span>
                </button>
              );
            })}
          </div>
          {activeFilters.length > 0 && (
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-secondary/10 px-3 py-1 text-xs font-medium text-brand-secondary shadow-[0_0_12px_rgba(244,164,96,0.15)]">
              <Sparkles className="h-3 w-3" />
              {t('activeFilters') || '已应用筛选'} · {activeFilters.length}
            </span>
          )}
        </div>

        <div className="hidden lg:flex lg:items-center lg:gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-surface-border/60 bg-surface-secondary/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-content-tertiary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-brand-secondary/50 hover:text-brand-secondary"
          >
            <Filter className="h-4 w-4" />
            <span>{t('showFilters') || '显示筛选'}</span>
          </button>
        </div>
      </div>

      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetTrigger asChild>
          <span className="hidden" />
        </SheetTrigger>
        <SheetContent side="right" className="hidden w-full max-w-[420px] border-surface-border/40 bg-gradient-to-br from-surface-secondary/80 via-surface-secondary/40 to-surface-secondary/20 px-6 pb-6 pt-8 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.65)] backdrop-blur-xl lg:block">
          <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-content-secondary">
              <Filter className="h-4 w-4" />
              <span>{t('filters') || '筛选器'}</span>
            </div>
            <button
              onClick={handleResetFilters}
              className="rounded-full bg-surface-primary/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-content-tertiary transition-colors hover:bg-brand-secondary/90 hover:text-black"
              type="button"
            >
              {t('clearFilters') || '清除筛选'}
            </button>
          </div>

          <Separator className="my-4 bg-surface-border/30" />

          <div className="flex flex-col gap-4 overflow-y-auto pr-1">
            <div className="rounded-2xl border border-white/5 bg-surface-primary/70 p-4 shadow-[0_12px_35px_-25px_rgba(0,0,0,0.65)]">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-content-tertiary/70">
                {t('category') || '分类'}
              </Label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    selectedCategory === 'all'
                      ? 'border-brand-secondary/70 bg-brand-secondary/15 text-brand-secondary shadow-[0_4px_18px_-10px_rgba(244,164,96,0.9)]'
                      : 'border-transparent bg-surface-tertiary/60 text-content-secondary hover:bg-surface-tertiary'
                  }`}
                  type="button"
                >
                  {t('all') || '全部'}
                </button>
                {categoryGroups.map(group => (
                  <div key={`sheet-group-${group.key}`} className="col-span-2">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-content-tertiary/60">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.categories.map(category => (
                        <button
                          key={category.key}
                          onClick={() => setSelectedCategory(category.key)}
                          className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                            selectedCategory === category.key
                              ? 'border-brand-secondary/70 bg-brand-secondary/15 text-brand-secondary shadow-[0_4px_18px_-10px_rgba(244,164,96,0.9)]'
                              : 'border-transparent bg-surface-tertiary/60 text-content-secondary hover:bg-surface-tertiary'
                          }`}
                          type="button"
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-surface-primary/70 p-4 shadow-[0_12px_35px_-25px_rgba(0,0,0,0.65)]">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-content-tertiary/70">
                {t('favorites') || '收藏'}
              </Label>
              <div className="mt-2 flex items-center justify-between rounded-xl border border-surface-border/40 bg-surface-secondary/60 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-content-primary">{t('favoritesOnly') || '仅看收藏'}</p>
                  <p className="text-xs text-content-tertiary">{activeTab === 'Favorites' ? t('showAllCharacters') : t('showFavoritesOnly')}</p>
                </div>
                <Switch
                  id={`${panelId}-sheet-favorites`}
                  checked={activeTab === 'Favorites'}
                  onCheckedChange={(value) => setActiveTab(value ? 'Favorites' : 'Characters')}
                  className="data-[state=checked]:bg-brand-secondary"
                />
              </div>
            </div>

            {activeFilters.length > 0 && (
              <div className="rounded-2xl border border-white/5 bg-surface-primary/70 p-4 shadow-[0_12px_35px_-25px_rgba(0,0,0,0.65)]">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-content-tertiary/70">
                  {t('activeFilters') || '已应用筛选'}
                </Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeFilters.map((badge, index) => (
                    <Badge key={`sheet-badge-${index}`} variant="secondary" className={`gap-1 rounded-full ${badge.color}`}>
                      {badge.label}: {badge.value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 space-y-4">
        <div className="lg:hidden">
          <Sheet open={isFilterPanelOpen} onOpenChange={setIsFilterPanelOpen}>
            <SheetTrigger asChild>
              <button className="flex w-full items-center justify-between rounded-2xl border border-surface-border/50 bg-surface-secondary/40 px-4 py-3 text-sm font-semibold text-content-secondary shadow-[0_14px_24px_-20px_rgba(0,0,0,0.65)]">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span>{t('filters') || '筛选器'}</span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isFilterPanelOpen ? 'rotate-180' : 'rotate-0'}`} />
              </button>
            </SheetTrigger>
            <SheetContent
              className="overflow-y-auto"
              side="left"
              style={{ width: 'min(280px, 75vw)', maxWidth: '75vw' }}
            >
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap gap-2">
                  {filterKeys.map(filterKey => (
                    <button
                      key={`mobile-${filterKey}`}
                      onClick={() => setSelectedFilter(filterKey)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                        selectedFilter === filterKey
                          ? 'border-brand-secondary bg-brand-secondary/20 text-brand-secondary shadow-surface'
                          : 'border-transparent bg-surface-tertiary text-content-secondary hover:bg-surface-tertiary/80'
                      }`}
                      type="button"
                    >
                      {filterKey === 'popular' && <Flame className="h-4 w-4" />}
                      {filterKey === 'trending' && <TrendingUp className="h-4 w-4" />}
                      {filterKey === 'new' && <Star className="h-4 w-4" />}
                      {filterKey === 'following' && <Users className="h-4 w-4" />}
                      {filterKey === 'editorChoice' && <Crown className="h-4 w-4" />}
                      <span>{t(filterKey)}</span>
                    </button>
                  ))}
                </div>

                <Separator className="bg-surface-border/40" />

                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase tracking-wide text-content-tertiary/80">{t('category') || '分类'}</Label>
                  <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as typeof categoryKeys[number])}>
                    <SelectTrigger className="h-11 rounded-xl border-surface-border/70 bg-surface-secondary text-sm font-medium">
                      <SelectValue placeholder={t('category')}>
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4 text-brand-accent" />
                          <span className="truncate text-content-primary">{selectedCategoryLabel}</span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-surface-border/70 bg-surface-primary shadow-xl" position="popper">
                      <SelectGroup>
                        <SelectLabel className="text-xs text-content-tertiary/80">{t('quickSelect') || '快速选择'}</SelectLabel>
                        <SelectItem value="all">{t('all') || '全部'}</SelectItem>
                        {categoryGroups.map(group => (
                          <div key={`mobile-group-${group.key}`}>
                            <SelectLabel className="text-xs text-content-tertiary/80">
                              {group.label}
                            </SelectLabel>
                            {group.categories.map(category => (
                              <SelectItem key={category.key} value={category.key}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase tracking-wide text-content-tertiary/80">{t('favoritesOnly') || '仅看收藏'}</Label>
                  <div className="flex items-center justify-between rounded-xl border border-surface-border/60 bg-surface-primary px-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-content-primary">{t('favoritesOnly') || '仅看收藏'}</p>
                      <p className="text-xs text-content-tertiary">{activeTab === 'Favorites' ? t('showAllCharacters') : t('showFavoritesOnly')}</p>
                    </div>
                    <Switch
                      id={`${panelId}-mobile-favorites`}
                      checked={activeTab === 'Favorites'}
                      onCheckedChange={(value) => setActiveTab(value ? 'Favorites' : 'Characters')}
                      className="data-[state=checked]:bg-brand-secondary"
                    />
                  </div>
                </div>

                {activeFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeFilters.map((badge, index) => (
                      <Badge key={`mobile-badge-${index}`} variant="secondary" className={`gap-1 rounded-full ${badge.color}`}>
                        {badge.label}: {badge.value}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {activeFilters.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-content-tertiary lg:hidden">
            <Sparkles className="h-3.5 w-3.5" />
            {t('filterHint') || '快速上手：先按“热门”排序，再选择感兴趣的分类即可开始探索。'}
          </div>
        )}
      </div>
 
      {/* Character Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 xl:gap-8" role="grid" aria-label="Character cards loading">
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
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 xl:gap-8" role="grid" aria-label="Character cards">
          {sortedCharacters.map(character => {
            const analytics = getCharacterAnalytics(character);
            const totalActivity = analytics.viewCount + analytics.chatCount;
            const rating = getCharacterRating(character);

            const isFeaturedCard = isCharacterFeatured(character);

            const statusBadge = (() => {
              if (isFeaturedCard) {
                return (
                  <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-400 px-2.5 py-1 rounded-full shadow-glow shadow-yellow-400/30 animate-pulse">
                    <Crown className="w-3.5 h-3.5 text-amber-900 drop-shadow" />
                    <span className="text-xs text-amber-900 font-semibold tracking-wide leading-none">{t('officialRecommendation')}</span>
                  </div>
                );
              }
              if (totalActivity > 100) {
                return (
                  <div className="flex items-center space-x-1 leading-none">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-xs text-green-400 font-medium leading-none">{t('popular')}</span>
                  </div>
                );
              }
              if (totalActivity > 10) {
                return (
                  <div className="flex items-center space-x-1 leading-none">
                    <div className="w-2 h-2 bg-blue-400 rounded-full" />
                    <span className="text-xs text-blue-400 font-medium leading-none">{t('active')}</span>
                  </div>
                );
              }
              return (
                <div className="flex items-center space-x-1 leading-none">
                  <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  <span className="text-xs text-gray-400 font-medium leading-none">{t('newCharacter')}</span>
                </div>
              );
            })();

            return (
              <div
                key={character.id}
                className={`group relative grid w-full aspect-[2/1] min-h-[460px] grid-rows-[6fr_5fr] bg-gradient-surface border rounded-xl overflow-hidden shadow-elevated transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] cursor-pointer focus-within:ring-2 focus-within:ring-brand-secondary focus-within:ring-offset-2 focus-within:ring-offset-zinc-900 ${
                  isFeaturedCard
                    ? 'border-amber-300/70 shadow-[0_0_40px_rgba(251,191,36,0.35)] hover:shadow-[0_0_55px_rgba(251,191,36,0.45)]'
                    : 'border-surface-border hover:shadow-premium hover:shadow-glow'
                }`}
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
                {isFeaturedCard && (
                  <>
                    <div className="pointer-events-none absolute inset-0 rounded-xl border border-amber-300/60 opacity-80 animate-[pulse_3s_ease-in-out_infinite]" />
                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-amber-200/10 via-amber-300/10 to-transparent mix-blend-screen animate-[pulse_4s_ease-in-out_infinite]" />
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                      <div className="absolute inset-y-[-40%] left-[-60%] w-[160%] rotate-6 bg-[linear-gradient(120deg,transparent,rgba(251,191,36,0.75),transparent)] blur-xl opacity-60 animate-[featuredShine_7s_linear_infinite]" />
                    </div>
                  </>
                )}
                <div className="relative z-10 overflow-hidden bg-surface-tertiary transition-all duration-500 ease-out group-hover:absolute group-hover:inset-0">
                  <img
                    src={character.avatarUrl?.startsWith('http') ? character.avatarUrl : `${API_BASE_URL}${character.avatarUrl}`}
                    alt={`${character.name} character avatar`}
                    className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 group-hover:brightness-105"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `${API_BASE_URL}/assets/characters_img/Elara.jpeg`;
                      target.onerror = null; // Prevent infinite loop
                    }}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />

                  <div className="absolute top-3 right-3 flex items-center space-x-2 z-20 transition-all duration-500">
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
                    {isCharacterNSFW(character) && (
                      <div className="w-8 h-8 bg-red-500/90 backdrop-blur-sm rounded-full border border-red-400/50 flex items-center justify-center">
                        <span className="text-xs text-white font-bold leading-none">18+</span>
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out pointer-events-none z-20 transform translate-y-4 group-hover:translate-y-0">
                    <div className="w-full space-y-2 pointer-events-auto">
                      <button
                        onClick={(e) => {
                          try {
                            e.stopPropagation();
                            handleStartChat(character);
                          } catch (error) {
                            console.error('Failed to start chat:', error);
                          }
                        }}
                        disabled={isCreatingChat}
                        className="w-full py-3 bg-brand-secondary text-zinc-900 rounded-lg font-bold text-sm hover:bg-brand-secondary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2 focus:ring-offset-black disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <MessageCircle className="w-4 h-4" />
                          <span>{isCreatingChat ? t('creating') : t('startChat')}</span>
                        </div>
                      </button>

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
                          <span>{t('previewDetails')}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="relative z-10 flex flex-col overflow-hidden p-4 transition-all duration-500 ease-out group-hover:opacity-0 group-hover:pointer-events-none group-hover:translate-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex-1 font-bold text-lg text-content-primary transition-colors truncate">
                      {character.name}
                    </h3>
                    <div className="flex items-center">{statusBadge}</div>
                  </div>

                  <p className="mt-2 text-sm text-content-tertiary line-clamp-2 md:line-clamp-3 xl:line-clamp-4 leading-relaxed">
                    {character.description || character.backstory}
                  </p>

                  <div className="mt-auto space-y-2">
                    {character.traits?.length > 0 && (
                      <TraitChips
                        traits={character.traits}
                        maxVisible={2}
                        size="xs"
                        className="flex-nowrap"
                        chipClassName="px-2.5 py-1 bg-brand-secondary/15 text-brand-secondary border border-brand-secondary/25"
                        moreChipClassName="px-2.5 py-1 bg-surface-tertiary text-content-tertiary border border-surface-border"
                      />
                    )}

                    <div className="flex items-center justify-between text-xs text-content-tertiary">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-brand-secondary fill-current" />
                          <span className="font-semibold text-content-secondary">{rating}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5 text-brand-secondary" />
                          <span className="font-medium">{formatNumber(analytics.likeCount)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5 text-content-tertiary" />
                          <span className="text-content-tertiary">{formatNumber(analytics.chatCount)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-content-tertiary" />
                        <span className="text-content-tertiary">{formatNumber(analytics.viewCount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
