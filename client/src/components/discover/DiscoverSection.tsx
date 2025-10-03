import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Star,
  Eye,
  TrendingUp,
  Flame,
  Crown,
  Users,
  Calendar,
  Search,
  BookOpen,
  Gamepad2,
  Film,
  Sparkles,
  Heart,
  Sword,
  Globe,
  Bot,
  Palette,
  Coffee,
  Mountain,
  Grid,
  Rows,
  MessageCircle,
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
import { cn } from '@/lib/utils';
import TraitChips from '@/components/characters/TraitChips';

interface DiscoverSectionProps {
  searchQuery?: string;
}

const DiscoverSection = ({ searchQuery = '' }: DiscoverSectionProps) => {
  const { navigateToPath } = useNavigation();
  const { setSelectedCharacter, nsfwEnabled } = useRolePlay();
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
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('grid');
  const [activeSegment, setActiveSegment] = useState<'trending' | 'latest' | 'recommended' | 'favorites'>('trending');
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    setVisibleCount(6);
  }, [activeSegment, selectedCategory, searchQuery]);

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
  const favoriteCharacters = useMemo(
    () => characters.filter((character) => favorites.includes(character.id)),
    [characters, favorites]
  );

  const formatNumber = (num: number): string => {
    if (num < 1000) return num.toString();
    if (num < 10000) return `${(num / 1000).toFixed(1)}K`;
    if (num < 1000000) return `${Math.floor(num / 1000)}K`;
    return `${(num / 1000000).toFixed(1)}M`;
  };

  const getCharacterAnalytics = (character: Character) => {
    const analytics = character as unknown as {
      viewCount?: number;
      chatCount?: number;
      likeCount?: number;
      trendingScore?: number;
    };

    return {
      viewCount: analytics?.viewCount ?? 0,
      chatCount: analytics?.chatCount ?? 0,
      likeCount: analytics?.likeCount ?? 0,
      trendingScore: analytics?.trendingScore ?? 0,
    };
  };

  const getCharacterRating = (character: Character): number => {
    const analytics = getCharacterAnalytics(character);
    const totalInteractions = analytics.viewCount + analytics.chatCount;

    if (totalInteractions === 0) return 4.0;

    const likeRatio = analytics.likeCount / Math.max(totalInteractions * 0.12, 1);
    const baseRating = Math.min(4.0 + likeRatio, 5.0);

    return Math.round(baseRating * 10) / 10;
  };

  const isCharacterNSFW = (character: Character): boolean => {
    if ((character.nsfwLevel || 0) > 0) return true;

    // Fallback heuristic for legacy data (simplified to avoid false positives)
    const nsfwKeywords = ['nsfw', '色情'];
    const traits = character.traits || [];
    const description = `${character.description || ''} ${character.backstory || ''}`.toLowerCase();

    return (
      traits.some((trait) => nsfwKeywords.some((keyword) => trait.toLowerCase().includes(keyword))) ||
      nsfwKeywords.some((keyword) => description.includes(keyword))
    );
  };

  const isCharacterFeatured = (character: Character): boolean => Boolean((character as any).isFeatured);

  // Define explore categories with icons and colors
  const exploreCategories = [
    { id: 'All', name: t('allCharacters'), icon: Globe, color: 'text-brand-secondary', bgColor: 'bg-brand-secondary' },
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

  // Filter characters by category and NSFW
  const filteredSections = useMemo(() => {
    const filterCharacters = (chars: Character[]) => {
      // First apply NSFW filter
      let filtered = nsfwEnabled ? chars : chars.filter(char => !isCharacterNSFW(char));

      // Then apply search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(char =>
          char.name.toLowerCase().includes(query) ||
          char.description?.toLowerCase().includes(query) ||
          char.backstory?.toLowerCase().includes(query) ||
          char.traits?.some(trait => trait.toLowerCase().includes(query))
        );
      }

      // Then apply category filter
      if (selectedCategory !== 'All') {
        filtered = filtered.filter(char =>
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
      }

      return filtered;
    };

    return {
      trending: filterCharacters(trendingCharacters),
      new: filterCharacters(newCharacters),
      popular: filterCharacters(popularCharacters),
      recommended: filterCharacters(recommendedCharacters),
      featured: filterCharacters(featuredCharacters),
      favorites: filterCharacters(favoriteCharacters),
    };
  }, [
    searchQuery,
    selectedCategory,
    nsfwEnabled,
    trendingCharacters,
    newCharacters,
    popularCharacters,
    recommendedCharacters,
    featuredCharacters,
    favoriteCharacters,
  ]);

  const heroCharacter = filteredSections.featured[0]
    || filteredSections.trending[0]
    || filteredSections.popular[0]
    || filteredSections.new[0]
    || characters[0]
    || null;

  const segmentConfig = useMemo(() => ([
    {
      id: 'trending' as const,
      label: t('trendingThisWeek'),
      description: t('hotPicksCommunity'),
      icon: TrendingUp,
      data: filteredSections.trending,
    },
    {
      id: 'latest' as const,
      label: t('newArrivals'),
      description: t('freshCharactersAdded'),
      icon: Calendar,
      data: filteredSections.new,
    },
    {
      id: 'recommended' as const,
      label: t('recommendedForYou'),
      description: t('basedOnPreferences'),
      icon: Sparkles,
      data: filteredSections.recommended,
    },
    {
      id: 'favorites' as const,
      label: t('myFavorites'),
      description: favorites.length > 0 ? t('favorites') : t('noFavoritesYet'),
      icon: Heart,
      data: filteredSections.favorites,
    },
  ]), [
    filteredSections.trending,
    filteredSections.new,
    filteredSections.recommended,
    filteredSections.favorites,
    t,
    favorites.length,
  ]);

  const activeSegmentCharacters = useMemo(() => {
    const segment = segmentConfig.find((config) => config.id === activeSegment);
    const base = segment?.data ?? [];
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return base;
    }

    return base.filter((character) => {
      const name = character.name?.toLowerCase() ?? '';
      const description = character.description?.toLowerCase() ?? '';
      const backstory = character.backstory?.toLowerCase() ?? '';
      return (
        name.includes(normalizedSearch)
        || description.includes(normalizedSearch)
        || backstory.includes(normalizedSearch)
      );
    });
  }, [segmentConfig, activeSegment, searchQuery]);

  const visibleCharacters = activeSegmentCharacters.slice(0, visibleCount);
  const hasMoreCharacters = activeSegmentCharacters.length > visibleCount;
  const showSkeleton = isLoading && characters.length === 0;

  const curatedSections = useMemo(() => ([
    {
      key: 'popular',
      title: t('mostPopular'),
      description: t('communityFavorites'),
      icon: Flame,
      accentClass: 'text-orange-400',
      data: filteredSections.popular,
    },
    {
      key: 'trending',
      title: t('trendingThisWeek'),
      description: t('hotPicksCommunity'),
      icon: TrendingUp,
      accentClass: 'text-pink-400',
      data: filteredSections.trending,
    },
    {
      key: 'recommended',
      title: t('recommendedForYou'),
      description: t('basedOnPreferences'),
      icon: Users,
      accentClass: 'text-brand-secondary',
      data: filteredSections.recommended,
    },
  ]), [
    filteredSections.popular,
    filteredSections.trending,
    filteredSections.recommended,
    t,
  ]);

  const heroStats = useMemo(() => ([
    {
      label: t('totalCharacters'),
      value: characters.length,
      icon: Users,
    },
    {
      label: t('newArrivals'),
      value: Math.max(newCharacters.length, filteredSections.new.length),
      icon: Sparkles,
    },
    {
      label: t('myFavorites'),
      value: favorites.length,
      icon: Heart,
    },
  ]), [
    characters.length,
    newCharacters.length,
    filteredSections.new.length,
    favorites.length,
    t,
  ]);

  const CharacterCard = ({ character }: { character: Character }) => {
    const analytics = getCharacterAnalytics(character);
    const totalActivity = analytics.viewCount + analytics.chatCount;
    const rating = getCharacterRating(character);
    const isFeaturedCard = isCharacterFeatured(character);
    const nsfw = isCharacterNSFW(character);

    const statusBadge = (() => {
      if (isFeaturedCard) {
        return (
          <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-400 px-2.5 py-1 rounded-full shadow-glow shadow-yellow-400/30 animate-pulse">
            <Crown className="w-3.5 h-3.5 text-amber-900 drop-shadow" />
            <span className="text-xs text-amber-900 font-semibold tracking-wide leading-none">官方推荐</span>
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
            <div className="w-2 h-2 bg-brand-secondary rounded-full" />
            <span className="text-xs text-brand-secondary font-medium leading-none">活跃</span>
          </div>
        );
      }
      return (
        <div className="flex items-center space-x-1 leading-none">
          <div className="w-2 h-2 bg-gray-400 rounded-full" />
          <span className="text-xs text-gray-400 font-medium leading-none">新角色</span>
        </div>
      );
    })();

    return (
      <div
        className={`group relative grid w-full aspect-[2/1] min-h-[460px] grid-rows-[6fr_5fr] bg-gradient-surface border rounded-xl overflow-hidden shadow-elevated transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] cursor-pointer focus-within:ring-2 focus-within:ring-brand-secondary focus-within:ring-offset-2 focus-within:ring-offset-zinc-900 ${
          isFeaturedCard
            ? 'border-amber-300/70 shadow-[0_0_40px_rgba(251,191,36,0.35)] hover:shadow-[0_0_55px_rgba(251,191,36,0.45)]'
            : 'border-surface-border hover:shadow-premium hover:shadow-glow'
        }`}
        onClick={() => handleCharacterClick(character)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleCharacterClick(character);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`选择角色 ${character.name}`}
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
            alt={`${character.name} avatar`}
            className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 group-hover:brightness-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />

          <div className="absolute top-3 right-3 flex items-center space-x-2 z-20 transition-all duration-500">
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleFavoriteToggle(character.id);
              }}
              aria-label={`${isFavorite(character.id) ? '取消收藏' : '收藏'} ${character.name}`}
              className={`w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full hover:bg-black/80 transition-all duration-200 flex items-center justify-center ${
                isFavorite(character.id) ? 'text-brand-secondary' : 'text-white hover:text-brand-secondary'
              }`}
              type="button"
            >
              <Star className={`w-4 h-4 ${isFavorite(character.id) ? 'fill-current' : ''}`} />
            </button>
            {nsfw && (
              <div className="w-8 h-8 bg-red-500/90 backdrop-blur-sm rounded-full border border-red-400/50 flex items-center justify-center">
                <span className="text-xs text-white font-bold leading-none">18+</span>
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out pointer-events-none z-20 transform translate-y-4 group-hover:translate-y-0">
            <div className="w-full space-y-2 pointer-events-auto">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  if (!isCreatingChat) {
                    handleStartChat(character);
                  }
                }}
                className="w-full py-3 bg-brand-secondary text-zinc-900 rounded-lg font-bold text-sm hover:bg-brand-secondary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2 focus:ring-offset-black disabled:opacity-60"
                disabled={isCreatingChat}
                type="button"
              >
                <div className="flex items-center justify-center space-x-2">
                  <MessageCircle className="w-4 h-4" />
                  <span>{isCreatingChat ? t('creating') : t('chatNow')}</span>
                </div>
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handlePreviewOpen(character);
                }}
                className="w-full py-2 bg-surface-secondary/90 backdrop-blur-sm text-content-primary rounded-lg font-medium text-sm hover:bg-surface-tertiary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2 focus:ring-offset-black"
                type="button"
              >
                <div className="flex items-center justify-center space-x-2">
                  <Eye className="w-4 h-4" />
                  <span>{t('preview')}</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col overflow-hidden p-4 transition-all duration-500 ease-out group-hover:opacity-0 group-hover:pointer-events-none group-hover:translate-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex-1 truncate text-lg font-bold text-content-primary transition-colors">
              {character.name}
            </h3>
            <div className="flex items-center">{statusBadge}</div>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-content-tertiary line-clamp-3">
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
  };

  return (
    <div className="w-full space-y-10 px-3 py-4 sm:px-6 sm:py-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-3xl border border-gray-800/70 bg-gradient-to-br from-indigo-900/70 via-slate-900 to-black p-6 sm:p-8">
          {showSkeleton ? (
            <div className="flex flex-col gap-6">
              <div className="h-5 w-28 animate-pulse rounded-full bg-white/10" />
              <div className="h-12 w-3/4 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-28 w-full animate-pulse rounded-2xl bg-white/5" />
            </div>
          ) : (
            <div className="relative z-10 flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-2 text-brand-secondary/80">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                    {t('discoverPage')}
                  </span>
                </div>
                <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
                  {t('exploreTrendingCharacters')}
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-gray-300 sm:text-base">
                  {t('handpickedSelections')} · {t('hotPicksCommunity')}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {heroStats.map(({ label, value, icon: StatIcon }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                      <StatIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">{value}</p>
                      <p className="text-xs text-gray-300">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSegment('recommended')}
                  className="inline-flex items-center justify-center rounded-xl bg-brand-secondary px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-brand-secondary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                  {t('startChat')}
                </button>
                <button
                  type="button"
                  onClick={() => navigateToPath('/favorites')}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-700 bg-black/40 px-5 py-3 text-sm font-semibold text-gray-200 transition-colors hover:border-brand-secondary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-60"
                  disabled={favorites.length === 0}
                >
                  {t('myFavorites')}
                </button>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/5 opacity-50" />
          <div className="pointer-events-none absolute -right-[15%] top-1/2 hidden h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-brand-secondary/20 blur-3xl lg:block" />
        </div>
        {heroCharacter && !showSkeleton && (
          <div className="hidden xl:flex xl:justify-center">
            <div className="w-full max-w-[320px] 2xl:max-w-[360px]">
              <CharacterCard character={heroCharacter} />
            </div>
          </div>
        )}
      </section>

      <section id="discover-grid" className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {segmentConfig.map((option) => {
              const IconComponent = option.icon;
              const isActive = activeSegment === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveSegment(option.id)}
                  className={cn(
                    'flex min-w-[220px] flex-1 items-center gap-3 rounded-2xl border px-4 py-3 transition-all sm:min-w-[240px]',
                    isActive
                      ? 'border-brand-secondary/70 bg-brand-secondary/15 text-white shadow-[0_10px_30px_rgba(245,158,11,0.25)]'
                      : 'border-gray-800 bg-gray-900/70 text-gray-200 hover:border-gray-700 hover:text-white'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl border',
                      isActive
                        ? 'border-brand-secondary/70 bg-brand-secondary/20 text-brand-secondary/80'
                        : 'border-gray-700 bg-gray-800 text-gray-300'
                    )}
                  >
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-semibold leading-tight">{option.label}</span>
                    <span className="text-xs text-gray-400 line-clamp-1">{option.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'grid' ? 'masonry' : 'grid')}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-gray-800 bg-gray-900/60 text-gray-300 transition-colors hover:border-brand-secondary hover:text-white sm:w-11"
              title={viewMode === 'grid' ? t('switchToMasonryLayout') : t('switchToGridLayout')}
            >
              {viewMode === 'grid' ? <Rows className="h-5 w-5" /> : <Grid className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div
          className={cn(
            'transition-all duration-200',
            viewMode === 'masonry'
              ? 'columns-1 gap-6 [column-gap:1.5rem] sm:columns-2 lg:columns-3'
              : 'grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 xl:gap-8'
          )}
        >
          {showSkeleton
            ? Array.from({ length: viewMode === 'grid' ? 8 : 6 }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    'h-[420px] animate-pulse rounded-2xl border border-gray-800 bg-gray-900/60',
                    viewMode === 'masonry' && 'mb-6 break-inside-avoid'
                  )}
                />
              ))
            : visibleCharacters.map((character) => (
                <div
                  key={character.id}
                  className={cn('h-full', viewMode === 'masonry' && 'mb-6 break-inside-avoid')}
                >
                  <CharacterCard character={character} />
                </div>
              ))}
        </div>

        {!showSkeleton && activeSegmentCharacters.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/40 p-10 text-center shadow-inner">
            <p className="text-base font-medium text-gray-200">
              {activeSegment === 'favorites'
                ? t('noFavoritesYet')
                : searchQuery
                  ? t('noMatches')
                  : t('noCharactersFound').replace('{category}', selectedCategory)}
            </p>
            <p className="mt-2 text-sm text-gray-400">{t('searchHint')}</p>
          </div>
        )}

        {!showSkeleton && hasMoreCharacters && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((previous) => previous + 6)}
              className="rounded-full border border-gray-700 px-6 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-brand-secondary hover:text-white"
            >
              {t('loadMore')}
            </button>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mountain className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">{t('exploreTypes')}</h2>
          </div>
          {selectedCategory !== 'All' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className="rounded-full border border-gray-700 px-4 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-brand-secondary hover:text-white"
            >
              {t('clearFilters')}
            </button>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {exploreCategories.map((category) => {
            const IconComponent = category.icon;
            const isSelected = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition-all',
                  isSelected
                    ? 'border-brand-secondary/80 bg-brand-secondary/15 text-white shadow-[0_8px_24px_rgba(245,158,11,0.25)]'
                    : 'border-gray-800 bg-gray-900/60 text-gray-300 hover:border-gray-700 hover:text-white'
                )}
              >
                <IconComponent
                  className={cn('h-5 w-5', isSelected ? 'text-brand-secondary/80' : category.color)}
                />
                <span className="whitespace-nowrap">{category.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-8">
        {curatedSections.map((section) => {
          if (!section.data || section.data.length === 0) {
            return null;
          }
          const IconComponent = section.icon;
          return (
            <div
              key={section.key}
              className="rounded-3xl border border-gray-800 bg-gray-900/40 shadow-lg shadow-black/20"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/70 px-4 py-3 sm:px-6">
                <div className="flex items-center gap-2">
                  <IconComponent className={cn('h-5 w-5', section.accentClass)} />
                  <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                  <span className="hidden text-sm text-gray-400 sm:inline">{section.description}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToPath('/characters')}
                  className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-brand-secondary hover:text-white"
                >
                  {t('viewAll')}
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {section.data.slice(0, 6).map((character) => (
                    <CharacterCard
                      key={`${section.key}-${character.id}`}
                      character={character}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {error && (
        <section className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center shadow-inner">
          <p className="text-lg font-semibold text-red-200">{t('errorLoading')}</p>
          <p className="mt-2 text-sm text-red-200/80">{t('tryAgain')}</p>
        </section>
      )}

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
