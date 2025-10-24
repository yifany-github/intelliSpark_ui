import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import CharacterPreviewModal from "@/components/characters/CharacterPreviewModal";
import TraitChips from "@/components/characters/TraitChips";
import { toast } from "@/hooks/use-toast";
import { 
  MoreVertical, 
  Edit, 
  Eye, 
  EyeOff, 
  MessageCircle, 
  Trash2, 
  Calendar, 
  Search,
  Filter
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { useLanguage } from "@/contexts/LanguageContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface Character {
  id: number;
  name: string;
  description: string;
  avatarUrl?: string;
  backstory: string;
  personaPrompt?: string;
  voiceStyle: string;
  traits: string[];
  category?: string;
  gender?: string;
  age?: number;
  nsfwLevel: number;
  conversationStyle?: string;
  isPublic: boolean;
  createdBy?: number;
  createdAt: string;
  isFeatured: boolean;
  viewCount: number;
  likeCount: number;
  chatCount: number;
  trendingScore: number;
  lastActivity?: string;
  categories?: string[];
}

export default function MyCharactersPage() {
  const { t } = useLanguage();
  const [deleteCharacterId, setDeleteCharacterId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "private">("all");
  const [nsfwFilter, setNsfwFilter] = useState<"all" | "safe" | "nsfw">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortOption, setSortOption] = useState<"newest" | "oldest" | "mostChats" | "mostViews">("newest");
  const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null);
  const queryClient = useQueryClient();

  const { data: characters = [], isLoading, error } = useQuery({
    queryKey: ['myCharacters'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/characters/users/me');
      return response.json();
    },
    placeholderData: keepPreviousData, // Show cached data instantly while loading fresh data
  });

  const togglePublishMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest('PUT', `/api/characters/${characterId}/publish`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCharacters'] });
      toast({
        title: "Success",
        description: "Character visibility updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update character visibility",
        variant: "destructive",
      });
    }
  });

  const deleteCharacterMutation = useMutation({
    mutationFn: async (characterId: number) => {
      const response = await apiRequest('DELETE', `/api/characters/${characterId}`);
      return response.json();
    },
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['myCharacters'] });
      await queryClient.cancelQueries({ queryKey: ['/api/characters'] });

      // Snapshot previous values for rollback
      const previousMyChars = queryClient.getQueryData(['myCharacters']);
      const previousAllChars = queryClient.getQueryData(['/api/characters']);

      // Optimistically remove from ALL character caches
      queryClient.setQueryData(['myCharacters'], (old: any) =>
        old?.filter((char: any) => char.id !== deletedId)
      );
      queryClient.setQueryData(['/api/characters'], (old: any) =>
        old?.filter((char: any) => char.id !== deletedId)
      );

      // Close delete dialog immediately
      setDeleteCharacterId(null);

      // Return context for potential rollback
      return { previousMyChars, previousAllChars };
    },
    onError: (error: any, deletedId, context) => {
      // Rollback optimistic updates on error
      if (context?.previousMyChars) {
        queryClient.setQueryData(['myCharacters'], context.previousMyChars);
      }
      if (context?.previousAllChars) {
        queryClient.setQueryData(['/api/characters'], context.previousAllChars);
      }

      toast({
        title: "Error",
        description: error.message || "Failed to delete character",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Character deleted successfully",
      });
    },
    onSettled: () => {
      // Force immediate refetch to sync with server (whether success or error)
      // Using refetchQueries instead of invalidateQueries to bypass staleTime
      queryClient.refetchQueries({ queryKey: ['myCharacters'] });
      queryClient.refetchQueries({ queryKey: ['/api/characters'] });
    }
  });

  const handleTogglePublish = (characterId: number) => {
    togglePublishMutation.mutate(characterId);
  };

  const handleDeleteCharacter = (characterId: number) => {
    deleteCharacterMutation.mutate(characterId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getNSFWBadge = (nsfwLevel: number) => {
    if (nsfwLevel === 0) {
      return <Badge variant="secondary" className="text-green-600">{t('myCharactersFilterSafe')}</Badge>;
    } else {
      return <Badge variant="destructive">{t('myCharactersFilterNsfwBadge')}</Badge>;
    }
  };

  const getVisibilityBadge = (isPublic: boolean) => (
    <Badge variant={isPublic ? "default" : "outline"} className={isPublic ? "bg-blue-600" : undefined}>
      {isPublic ? t('myCharactersPublic') : t('myCharactersPrivate')}
    </Badge>
  );

  const CharacterMetric = ({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) => (
    <div className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );

  const TraitChip = ({ trait }: { trait: string }) => (
    <Badge variant="secondary" className="bg-slate-800 text-slate-200 text-xs">
      {trait}
    </Badge>
  );

  const stats = useMemo(() => {
    const total = characters.length;
    const published = characters.filter((c: Character) => c.isPublic).length;
    const privateCount = total - published;
    const nsfw = characters.filter((c: Character) => c.nsfwLevel > 0).length;
    const latest = characters.reduce((latestDate: Date | null, character: Character) => {
      const date = new Date(character.createdAt);
      if (!latestDate || date > latestDate) {
        return date;
      }
      return latestDate;
    }, null as Date | null);

    return {
      total,
      published,
      privateCount,
      nsfw,
      latestUpdated: latest ? latest.toLocaleDateString() : "—",
    };
  }, [characters]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    characters.forEach((character: Character) => {
      if (character.category) {
        set.add(character.category);
      }
      character.categories?.forEach((category) => set.add(category));
    });
    return Array.from(set).sort();
  }, [characters]);

  const filteredCharacters = useMemo(() => {
    return characters
      .filter((character: Character) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          character.name.toLowerCase().includes(query) ||
          (character.description && character.description.toLowerCase().includes(query)) ||
          character.traits?.some(trait => trait.toLowerCase().includes(query))
        );
      })
      .filter((character: Character) => {
        if (visibilityFilter === "public") return character.isPublic;
        if (visibilityFilter === "private") return !character.isPublic;
        return true;
      })
      .filter((character: Character) => {
        if (nsfwFilter === "safe") return character.nsfwLevel === 0;
        if (nsfwFilter === "nsfw") return character.nsfwLevel > 0;
        return true;
      })
      .filter((character: Character) => {
        if (categoryFilter === "all") return true;
        return character.category === categoryFilter || character.categories?.includes(categoryFilter);
      })
      .sort((a: Character, b: Character) => {
        switch (sortOption) {
          case "oldest":
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case "mostChats":
            return (b.chatCount || 0) - (a.chatCount || 0);
          case "mostViews":
            return (b.viewCount || 0) - (a.viewCount || 0);
          case "newest":
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }, [characters, searchQuery, visibilityFilter, nsfwFilter, categoryFilter, sortOption]);

  const content = (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="rounded-3xl border border-slate-700 bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-900/40 p-8 shadow-xl shadow-slate-900/30">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/60 px-3 py-1 text-xs font-medium uppercase tracking-wider text-blue-200">
              <Filter className="h-3 w-3" />
              {t('myCharactersTagline')}
            </div>
            <h1 className="text-3xl font-bold text-white">{t('myCharactersHeading')}</h1>
            <p className="text-sm text-slate-300">
              {t('myCharactersSubheading')}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">{t('myCharactersStatsTotal')}</p>
                <p className="mt-1 text-2xl font-semibold text-white">{stats.total}</p>
                <p className="text-xs text-slate-500">{t('characters')}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">{t('myCharactersStatsPublished')}</p>
                <p className="mt-1 text-2xl font-semibold text-white">{stats.published}</p>
                <p className="text-xs text-slate-500">{t('myCharactersFilterPublished')}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">{t('myCharactersStatsPrivate')}</p>
                <p className="mt-1 text-2xl font-semibold text-white">{stats.privateCount}</p>
                <p className="text-xs text-slate-500">{t('myCharactersFilterPrivate')}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">{t('myCharactersStatsLatest')}</p>
                <p className="mt-1 text-lg font-semibold text-white">{stats.latestUpdated}</p>
                <p className="text-xs text-slate-500">{t('myCharactersUpdated')}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800" asChild>
              <Link to="/characters">{t('myCharactersBrowseLibrary')}</Link>
            </Button>
            <Button className="bg-brand-secondary text-zinc-900 hover:bg-brand-secondary/90" asChild>
              <Link to="/create-character">{t('myCharactersCreateNew')}</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('myCharactersSearchPlaceholder')}
              className="pl-9 bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:w-auto">
            <Select value={visibilityFilter} onValueChange={(value: "all" | "public" | "private") => setVisibilityFilter(value)}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue placeholder={t('myCharactersFilterVisibility')} />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100">
                <SelectItem value="all">{t('myCharactersFilterVisibility')}</SelectItem>
                <SelectItem value="public">{t('myCharactersFilterPublished')}</SelectItem>
                <SelectItem value="private">{t('myCharactersFilterPrivate')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={nsfwFilter} onValueChange={(value: "all" | "safe" | "nsfw") => setNsfwFilter(value)}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue placeholder={t('myCharactersFilterContent')} />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100">
                <SelectItem value="all">{t('myCharactersFilterContent')}</SelectItem>
                <SelectItem value="safe">{t('myCharactersFilterSafe')}</SelectItem>
                <SelectItem value="nsfw">{t('myCharactersFilterNsfw')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value)}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue placeholder={t('myCharactersFilterCategory')} />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100 max-h-64">
                <SelectItem value="all">{t('myCharactersFilterCategory')}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortOption} onValueChange={(value: "newest" | "oldest" | "mostChats" | "mostViews") => setSortOption(value)}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue placeholder={t('myCharactersSortBy')} />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100">
                <SelectItem value="newest">{t('myCharactersSortNewest')}</SelectItem>
                <SelectItem value="oldest">{t('myCharactersSortOldest')}</SelectItem>
                <SelectItem value="mostChats">{t('myCharactersSortChats')}</SelectItem>
                <SelectItem value="mostViews">{t('myCharactersSortViews')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filteredCharacters.length === 0 ? (
        <div className="text-center py-12 text-white">
          <div className="text-slate-300 mb-4">
            {characters.length === 0
              ? t('myCharactersEmptyHeading')
              : t('myCharactersEmptyFiltered')}
          </div>
          <Link to="/create-character">
            <Button className="bg-brand-secondary text-zinc-900 hover:bg-brand-secondary/90">{t('myCharactersCreateFirst')}</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCharacters.map((character: Character) => (
            <div key={character.id} className="group grid grid-cols-1 sm:grid-cols-2 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/70 hover:border-brand-secondary/60 transition-colors">
              <div className="relative h-64 sm:h-full">
                <img
                  src={character.avatarUrl?.startsWith('http') ? character.avatarUrl : `${API_BASE_URL}${character.avatarUrl}`}
                  alt={`${character.name} avatar`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  onError={(event) => {
                    const target = event.target as HTMLImageElement;
                    target.src = `${API_BASE_URL}/assets/characters_img/Elara.jpeg`;
                    target.onerror = null;
                  }}
                />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {character.nsfwLevel > 0 && (
                    <div className="w-8 h-8 rounded-full bg-red-500/90 border border-red-400/50 flex items-center justify-center text-[11px] font-semibold text-white">
                      18+
                    </div>
                  )}
                </div>
              </div>
              <div className="relative flex flex-col gap-4 p-5">
                <div className="flex items-center justify-end gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span>{character.isPublic ? t('myCharactersPublic') : t('myCharactersPrivate')}</span>
                    <Switch
                      checked={character.isPublic}
                      onCheckedChange={() => handleTogglePublish(character.id)}
                      className="data-[state=checked]:bg-brand-secondary"
                    />
                  </div>
                  <Button variant="outline" size="icon" className="border-slate-700 text-slate-300 hover:bg-slate-800" asChild>
                    <Link to={`/character/${character.id}/edit`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center justify-center w-8 h-8 rounded-full bg-black/40 text-slate-200 hover:bg-black/60">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-slate-100">
                      <DropdownMenuItem onClick={() => setDeleteCharacterId(character.id)} className="text-red-500 focus:text-red-500">
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-white leading-tight">{character.name}</h3>
                  <p className="text-xs text-slate-400">{character.category || t('myCharactersFilterCategory')}</p>
                  {character.traits?.length > 0 && (
                    <TraitChips
                      traits={character.traits}
                      maxVisible={2}
                      size="xs"
                      className="flex-nowrap"
                      chipClassName="px-2.5 py-1 bg-brand-secondary/15 text-brand-secondary border border-brand-secondary/25"
                      moreChipClassName="px-2.5 py-1 bg-surface-tertiary text-slate-300 border border-surface-border"
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  {getVisibilityBadge(character.isPublic)}
                  {getNSFWBadge(character.nsfwLevel)}
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <span>{t('myCharactersUpdated')}</span>
                    <span>{formatDate(character.createdAt)}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                  {character.description || character.backstory || t('myCharactersEmptyHeading')}
                </p>

                <div className="mt-auto flex items-center justify-end gap-2 text-xs">
                  <Button
                    className="px-3 py-1.5 bg-brand-secondary text-zinc-900 hover:bg-brand-secondary/90"
                    onClick={() => {
                      /* TODO: start chat */
                    }}
                  >
                    {t('myCharactersStartChat')}
                  </Button>
                  <Button
                    variant="outline"
                    className="px-3 py-1.5 border-slate-700 text-slate-200 hover:bg-slate-800"
                    onClick={() => setPreviewCharacter(character)}
                  >
                    {t('myCharactersPreview')}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <Calendar className="h-3 w-3" />
                    <span>{t('myCharactersCreated')}</span>
                    <span>{formatDate(character.createdAt)}</span>
                  </div>
                  {character.chatCount > 0 && (
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {character.chatCount} {t('myCharactersChatsLabel')}
                    </div>
                  )}
                  {character.viewCount > 0 && (
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {character.viewCount} {t('myCharactersViewsLabel')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteCharacterId !== null} onOpenChange={(open) => !open && setDeleteCharacterId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('myCharactersConfirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('myCharactersConfirmDeleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCharacterId && handleDeleteCharacter(deleteCharacterId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CharacterPreviewModal
        character={previewCharacter}
        isOpen={!!previewCharacter}
        onClose={() => setPreviewCharacter(null)}
        onStartChat={() => {
          /* TODO: hook into chat start flow */
        }}
        onToggleFavorite={() => {
          /* TODO: add favorites support */
        }}
        isFavorite={false}
      />
    </div>
  );

  if (isLoading) {
    return (
      <GlobalLayout>
        <div className="container mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
              <div className="h-48 rounded-xl bg-slate-800/60" />
              <div className="h-6 w-2/3 rounded bg-slate-800/60" />
              <div className="h-4 w-full rounded bg-slate-800/60" />
              <div className="h-4 w-3/4 rounded bg-slate-800/60" />
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded-full bg-slate-800/60" />
                <div className="h-5 w-16 rounded-full bg-slate-800/60" />
              </div>
            </div>
          ))}
        </div>
      </GlobalLayout>
    );
  }

  if (error) {
    return (
      <GlobalLayout>
        <div className="container mx-auto px-4 py-12 text-center text-red-400">
          <p className="font-semibold text-lg">Error loading characters</p>
          <p className="mt-2 text-sm text-red-300/80">{(error as Error).message}</p>
        </div>
      </GlobalLayout>
    );
  }

  return <GlobalLayout>{content}</GlobalLayout>;
}

// Return with app shell
// Keep loading/error states within the same consistent layout
// (Declared outside to minimize diff, but we can inline in function scope)
