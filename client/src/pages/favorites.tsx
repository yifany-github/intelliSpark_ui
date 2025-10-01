import { useReducer, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { SortAsc, SortDesc, Heart, Search, Loader2, RefreshCw, Crown, Eye, MessageCircle, Star } from 'lucide-react';
import { Character } from '@/types';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useRolePlay } from '@/contexts/RolePlayContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { apiRequest } from '@/lib/queryClient';
import GlobalLayout from '@/components/layout/GlobalLayout';
import CharacterPreviewModal from '@/components/characters/CharacterPreviewModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useFavoriteCharacters } from '@/hooks/useFavoriteCharacters';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import TraitChips from '@/components/characters/TraitChips';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const FAVORITE_CATEGORY_KEYWORDS = {
  all: [] as string[],
  fantasy: ['fantasy', 'magical', 'mystical'],
  sciFi: ['sci-fi', 'science fiction', 'robotic', 'android', 'future'],
  romance: ['romance', 'romantic', 'charismatic', 'gentle'],
  adventure: ['adventure', 'warrior', 'strong', 'explorer'],
  mystery: ['mystery', 'mysterious', 'cunning', 'detective'],
  modern: ['modern', 'urban', 'cool', 'contemporary'],
} as const;

type FavoriteCategory = keyof typeof FAVORITE_CATEGORY_KEYWORDS;
type SortBy = 'name' | 'date' | 'rating';
type SortOrder = 'asc' | 'desc';
type FiltersState = {
  search: string;
  category: FavoriteCategory;
  sortBy: SortBy;
  sortOrder: SortOrder;
};

type FilterAction =
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_CATEGORY'; payload: FavoriteCategory }
  | { type: 'SET_SORT_BY'; payload: SortBy }
  | { type: 'TOGGLE_SORT_ORDER' }
  | { type: 'RESET' };

const initialFilters: FiltersState = {
  search: '',
  category: 'all',
  sortBy: 'date',
  sortOrder: 'desc',
};

function filtersReducer(state: FiltersState, action: FilterAction): FiltersState {
  switch (action.type) {
    case 'SET_SEARCH':
      return { ...state, search: action.payload };
    case 'SET_CATEGORY':
      return { ...state, category: action.payload };
    case 'SET_SORT_BY':
      return { ...state, sortBy: action.payload };
    case 'TOGGLE_SORT_ORDER':
      return { ...state, sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' };
    case 'RESET':
      return initialFilters;
    default:
      return state;
  }
}

const formatNumber = (num: number): string => {
  if (num < 1000) {
    return num.toString();
  }
  if (num < 10000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  if (num < 1000000) {
    return `${Math.floor(num / 1000)}K`;
  }
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

  const nsfwKeywords = ['nsfw', 'adult', '色情', '情欲', '性感', '敏感', '情色', '欲望'];
  const traits = character.traits || [];
  const description = `${character.description || ''} ${character.backstory || ''}`.toLowerCase();

  return (
    traits.some((trait) => nsfwKeywords.some((keyword) => trait.toLowerCase().includes(keyword))) ||
    nsfwKeywords.some((keyword) => description.includes(keyword))
  );
};

const isCharacterFeatured = (character: Character): boolean => Boolean((character as any).isFeatured);

const formatDate = (value: string | undefined): number => {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatName = (value: string | undefined): string => value?.toLowerCase() ?? '';

const FAVORITE_CATEGORIES_ORDER: FavoriteCategory[] = [
  'all',
  'fantasy',
  'sciFi',
  'romance',
  'adventure',
  'mystery',
  'modern',
];

const FAVORITE_CATEGORY_LABELS: Record<FavoriteCategory, string> = {
  all: '全部',
  fantasy: '奇幻',
  sciFi: '科幻',
  romance: '浪漫',
  adventure: '冒险',
  mystery: '悬疑',
  modern: '现代',
};

interface FavoritesCharacterCardProps {
  character: Character;
  isFavorite: boolean;
  isCreating: boolean;
  onToggleFavorite: () => void;
  onStartChat: () => void;
  onPreview: () => void;
  t: (key: string) => string;
}

const FavoritesCharacterCard = (
{
  character,
  isFavorite,
  isCreating,
  onToggleFavorite,
  onStartChat,
  onPreview,
  t,
}: FavoritesCharacterCardProps) => {
  const analytics = getCharacterAnalytics(character);
  const rating = getCharacterRating(character);
  const totalActivity = analytics.viewCount + analytics.chatCount;
  const featured = isCharacterFeatured(character);

  const statusBadge = (() => {
    if (featured) {
      return (
        <div className="flex items-center gap-1 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 px-2.5 py-1 rounded-full shadow-[0_0_30px_rgba(251,191,36,0.35)] text-xs font-semibold text-amber-900">
          <Crown className="w-3.5 h-3.5" />
          官方推荐
        </div>
      );
    }
    if (totalActivity > 100) {
      return (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-400 rounded-full" />
          <span className="text-xs text-green-400">{t('popular')}</span>
        </div>
      );
    }
    if (totalActivity > 10) {
      return (
        <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-brand-secondary rounded-full" />
        <span className="text-xs text-brand-secondary">活跃</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full" />
        <span className="text-xs text-gray-400">新角色</span>
      </div>
    );
  })();

  return (
    <div
      className={`group relative grid w-full aspect-[2/1] min-h-[460px] grid-rows-[6fr_5fr] rounded-xl overflow-hidden shadow-elevated transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 liquid-glass-hero-dark ${
        featured
          ? 'border-amber-300/70 shadow-[0_0_40px_rgba(251,191,36,0.35)] hover:shadow-[0_0_55px_rgba(251,191,36,0.45)]'
          : 'hover:shadow-premium hover:shadow-glow'
      }`}
      onClick={() => !isCreating && onStartChat()}
      onKeyDown={(event) => {
        if (isCreating) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onStartChat();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`打开与${character.name}的对话`}
    >
      {featured && (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-xl border border-amber-300/60 opacity-80 animate-[pulse_3s_ease-in-out_infinite]" />
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-amber-200/10 via-amber-300/10 to-transparent mix-blend-screen animate-[pulse_4s_ease-in-out_infinite]" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <div className="absolute inset-y-[-40%] left-[-60%] w-[160%] rotate-6 bg-[linear-gradient(120deg,transparent,rgba(251,191,36,0.75),transparent)] blur-xl opacity-60 animate-[featuredShine_7s_linear_infinite]" />
          </div>
        </>
      )}

      <div className="relative z-10 overflow-hidden bg-surface-tertiary">
        <img
          src={character.avatarUrl?.startsWith('http') ? character.avatarUrl : `${API_BASE_URL}${character.avatarUrl}`}
          alt={`${character.name} character avatar`}
          className="h-full w-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="absolute top-3 right-3 flex items-center space-x-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
            aria-label={`${isFavorite ? '取消收藏' : '收藏'} ${character.name}`}
            className={`w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full hover:bg-black/80 transition-all duration-200 flex items-center justify-center ${
              isFavorite ? 'text-brand-secondary' : 'text-white hover:text-brand-secondary'
            }`}
            type="button"
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          {isCharacterNSFW(character) && (
            <div className="w-8 h-8 bg-red-500/90 backdrop-blur-sm rounded-full border border-red-400/50 flex items-center justify-center">
              <span className="text-xs text-white font-bold leading-none">18+</span>
            </div>
          )}
        </div>

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4 pointer-events-none">
          <div className="w-full space-y-2 pointer-events-auto">
            <button
              onClick={(event) => {
                event.stopPropagation();
                if (!isCreating) {
                  onStartChat();
                }
              }}
              className="w-full py-3 bg-brand-secondary text-zinc-900 rounded-lg font-bold text-sm hover:bg-brand-secondary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2 focus:ring-offset-black disabled:opacity-60"
              disabled={isCreating}
              type="button"
            >
              <div className="flex items-center justify-center space-x-2">
                <MessageCircle className="w-4 h-4" />
                <span>{isCreating ? t('creating') : t('chatNow')}</span>
              </div>
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onPreview();
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

      <div className="relative z-10 flex flex-col overflow-hidden p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex-1 truncate text-lg font-bold text-content-primary transition-colors group-hover:text-brand-secondary">
            {character.name}
          </h3>
          <div className="flex items-center">{statusBadge && <span>{statusBadge}</span>}</div>
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
                <span className="font-semibold text-content-secondary">{rating.toFixed(1)}</span>
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


const FavoritesPage = () => {
  const { navigateToPath, navigateToHome } = useNavigation();
  const { setSelectedCharacter, nsfwEnabled } = useRolePlay();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { characters, isLoading, error, isFetching, refetch } = useFavoriteCharacters();
  const [filters, dispatch] = useReducer(filtersReducer, initialFilters);
  const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { mutate: createChat, isPending: isCreatingChat } = useMutation({
    mutationFn: async ({ characterId }: { characterId: number }) => {
      const response = await apiRequest('POST', '/api/chats', {
        characterId,
        title: `Chat with ${characters.find((item) => item.id === characterId)?.name || 'Character'}`,
      });

      if (!response.ok) {
        throw new Error('Failed to create chat');
      }

      return response.json();
    },
    onSuccess: (chat) => {
      navigateToPath(`/chat/${chat.id}`);
      handlePreviewClose();
    },
    onError: () => {
      toast({ title: t('errorLoading') || '操作失败', description: '无法创建新聊天，请稍后重试。' });
    },
  });

  const filteredCharacters = useMemo(() => {
    if (!characters) return [];

    const { search, category, sortBy, sortOrder } = filters;

    const keywordMatches = FAVORITE_CATEGORY_KEYWORDS[category];

    const normalizedSearch = search.trim().toLowerCase();

    const applySearch = (items: Character[]) => {
      if (!normalizedSearch) return items;
      return items.filter((character) => {
        const nameMatch = character.name.toLowerCase().includes(normalizedSearch);
        const descriptionMatch = (character.description || character.backstory || '')
          .toLowerCase()
          .includes(normalizedSearch);
        const traitMatch = character.traits?.some((trait) => trait.toLowerCase().includes(normalizedSearch));
        return nameMatch || descriptionMatch || traitMatch;
      });
    };

    const applyCategory = (items: Character[]) => {
      if (category === 'all' || keywordMatches.length === 0) return items;
      return items.filter((character) => {
        const traitMatch = character.traits?.some((trait) =>
          keywordMatches.some((keyword) => trait.toLowerCase().includes(keyword.toLowerCase()))
        );

        const categoryMatch = character.categories?.some((cat) =>
          keywordMatches.some((keyword) => cat.toLowerCase().includes(keyword.toLowerCase()))
        );

        return traitMatch || categoryMatch;
      });
    };

    const applyNSFWFilter = (items: Character[]) => {
      if (nsfwEnabled) return items;
      return items.filter((character) => !isCharacterNSFW(character));
    };

    const applySort = (items: Character[]) => {
      const sorted = [...items].sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'name':
            comparison = formatName(a.name).localeCompare(formatName(b.name));
            break;
        case 'rating':
          comparison = getCharacterRating(a) - getCharacterRating(b);
            break;
          case 'date':
          default:
            comparison = formatDate(a.createdAt) - formatDate(b.createdAt);
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
      return sorted;
    };

    const applyChain = (items: Character[]) => applySort(applyCategory(applySearch(applyNSFWFilter(items))));

    return applyChain(characters);
  }, [characters, filters, nsfwEnabled]);

  const hasActiveFilters =
    filters.search.trim().length > 0 || filters.category !== 'all' || filters.sortBy !== 'date' || filters.sortOrder !== 'desc';

  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacter(character);
    createChat({ characterId: character.id });
  };

  const handleFavoriteToggle = (characterId: number) => {
    const willFavorite = !isFavorite(characterId);
    toggleFavorite(characterId);
    toast({ title: willFavorite ? '已收藏' : '已取消收藏' });
  };

  const handlePreviewOpen = (character: Character) => {
    setPreviewCharacter(character);
    setIsPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    setPreviewCharacter(null);
    setIsPreviewOpen(false);
  };

  const categories = FAVORITE_CATEGORIES_ORDER.map((key) => ({
    key,
    label: t(key) || FAVORITE_CATEGORY_LABELS[key],
  }));

  const handleClearFilters = () => dispatch({ type: 'RESET' });

  const hasError = Boolean(error);

  const renderSkeletons = () => (
    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 xl:gap-8" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-[460px] rounded-2xl bg-gray-800/60" />
      ))}
    </div>
  );

  return (
    <GlobalLayout>
      <div className="w-full h-full p-3 sm:p-6 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-pink-400" />
            <h1 className="text-2xl font-bold text-white">{t('myFavorites')}</h1>
            <span className="text-sm text-gray-400">({filteredCharacters.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 transition-colors"
              >
                {t('clearFilters') || '清除筛选'}
              </button>
            )}
            {isFetching && (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" aria-hidden />
            )}
            <button
              type="button"
              onClick={() => refetch()}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title={t('refreshChats') || '刷新'}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        <section className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('searchFavoriteCharacters') || t('searchCharacters') || '搜索收藏角色'}
              value={filters.search}
              onChange={(event) => dispatch({ type: 'SET_SEARCH', payload: event.target.value })}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-secondary"
            />
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <select
                value={filters.sortBy}
                onChange={(event) => dispatch({ type: 'SET_SORT_BY', payload: event.target.value as SortBy })}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-secondary"
              >
                <option value="date">{t('sortByDate')}</option>
                <option value="name">{t('sortByName')}</option>
                <option value="rating">{t('sortByRating')}</option>
              </select>
              <button
                type="button"
                onClick={() => dispatch({ type: 'TOGGLE_SORT_ORDER' })}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                title={filters.sortOrder === 'asc' ? t('sortDescending') : t('sortAscending')}
              >
                {filters.sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              type="button"
              key={category.key}
              onClick={() => dispatch({ type: 'SET_CATEGORY', payload: category.key })}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm transition-all duration-200 border',
                filters.category === category.key
                  ? 'bg-brand-secondary text-black border-brand-secondary shadow-lg'
                  : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'
              )}
            >
              {category.label}
            </button>
          ))}
        </section>

        {hasError && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4" aria-hidden>
              ⚠️
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">{t('errorLoading') || '无法加载收藏角色'}</h3>
            <p className="text-gray-400 mb-6">{t('tryAdjustingFilters') || '请稍后重试。'}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-6 py-3 bg-brand-secondary hover:bg-brand-secondary/90 text-black rounded-lg transition-colors"
            >
              {t('refreshChats') || '刷新'}
            </button>
          </div>
        )}

        {!hasError && isLoading && renderSkeletons()}

        {!hasError && !isLoading && filteredCharacters.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4" aria-hidden>
              💔
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">
              {filters.search || filters.category !== 'all' ? t('noMatchingFavorites') : t('noFavoritesYet')}
            </h3>
            <p className="text-gray-400 mb-6">
              {filters.search || filters.category !== 'all' ? t('tryAdjustingFilters') : t('startExploring')}
            </p>
            <div className="flex items-center justify-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-5 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {t('clearFilters') || '清除筛选'}
                </button>
              )}
              <button
                type="button"
                onClick={() => navigateToHome()}
                className="px-6 py-3 bg-brand-secondary hover:bg-brand-secondary/90 text-black rounded-lg transition-colors"
              >
                {t('exploreCharacters')}
              </button>
            </div>
          </div>
        )}

        {!hasError && !isLoading && filteredCharacters.length > 0 && (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 xl:gap-8">
            {filteredCharacters.map((character) => (
              <div key={character.id}>
                <FavoritesCharacterCard
                  character={character}
                  isFavorite={isFavorite(character.id)}
                  isCreating={isCreatingChat}
                  onToggleFavorite={() => handleFavoriteToggle(character.id)}
                  onStartChat={() => handleCharacterSelect(character)}
                  onPreview={() => handlePreviewOpen(character)}
                  t={t}
                />
              </div>
            ))}
          </div>
        )}

        <CharacterPreviewModal
          character={previewCharacter}
          isOpen={isPreviewOpen}
          onClose={handlePreviewClose}
          onStartChat={(character) => handleCharacterSelect(character)}
          onToggleFavorite={(characterId) => handleFavoriteToggle(characterId)}
          isFavorite={previewCharacter ? isFavorite(previewCharacter.id) : false}
        />
      </div>
    </GlobalLayout>
  );
};

export default FavoritesPage;
