import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { Link } from "wouter";
import { Chat, ChatMessage, Character, EnrichedChat } from "../types";
import ChatBubble from "@/components/chats/ChatBubble";
import ChatInput from "@/components/chats/ChatInput";
import TypingIndicator from "@/components/ui/TypingIndicator";
import { apiRequest } from "@/lib/queryClient";
import { useRolePlay } from "@/contexts/RolePlayContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { queryClient } from "@/lib/queryClient";
import { invalidateTokenBalance } from "@/services/tokenService";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useRealtimeChatList } from "@/hooks/useRealtimeChatList";
import { ChevronLeft, MoreVertical, Trash2, Filter, Pin, Sparkles, Clock, Star } from "lucide-react";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { ImprovedTokenBalance } from "@/components/payment/ImprovedTokenBalance";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { useToast } from "@/hooks/use-toast";
import ChatList from "@/components/chats/ChatList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChatsPageProps {
  chatId?: string;
}

const ChatsPage = ({ chatId }: ChatsPageProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();
  const { location, navigateToPath } = useNavigation();
  const { toast } = useToast();
  const [recentSearch, setRecentSearch] = useState("");
  const [pinnedChatIds, setPinnedChatIds] = useState<number[]>([]);
  const [sortMode, setSortMode] = useState<"recent" | "alphabetical">("recent");
  const [isInitialized, setIsInitialized] = useState(false);
  
  // If no chatId is provided, show chat list
  const showChatList = !chatId;
  
  const { isReady: authReady } = useAuth();

  const chatEnabled = authReady && !!chatId;

  // Fetch chat details if chatId is provided - backend accepts both numeric and UUID
  const {
    data: chat,
    isLoading: isLoadingChat,
    error: chatError
  } = useQuery<Chat>({
    queryKey: [`/api/chats/${chatId}`],
    enabled: chatEnabled,
    staleTime: 30 * 1000,
  });

  // Extract canonical UUID from chat response
  const canonicalUuid = chat?.uuid ?? null;

  // Fetch chat messages - use canonical UUID if available, fallback to chatId
  const messagesCacheKey = canonicalUuid ?? chatId;
  const messagesEnabled = authReady && !!messagesCacheKey;

  type ChatStateResponse = {
    chat_id: number;
    state: Record<string, string | { value: number; description: string }>;
    updated_at: string | null;
  };

  const { data: remoteState } = useQuery<ChatStateResponse>({
    queryKey: [`/api/chats/${messagesCacheKey}/state`],
    enabled: messagesEnabled,
    staleTime: 10_000,
  });

  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    error: messagesError
  } = useQuery<ChatMessage[]>({
    queryKey: [`/api/chats/${messagesCacheKey}/messages`],
    enabled: messagesEnabled,
  });

  const characterId = chat?.characterId ?? (chat as any)?.character_id;

  const {
    data: character,
    isLoading: isLoadingCharacter
  } = useQuery<Character>({
    queryKey: [`/api/characters/${characterId}`],
    enabled: authReady && !!characterId,
  });

  const displayMessages = useMemo<ChatMessage[]>(() => {
    if (!messages.length) {
      if (character?.openingLine) {
        const timestamp = new Date().toISOString();
        const placeholder: ChatMessage = {
          id: -1,
          chatId: chat?.id ?? 0,
          role: "assistant",
          content: character.openingLine,
          timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        } as ChatMessage;
        if (remoteState?.state) {
          (placeholder as any).stateSnapshot = remoteState.state;
        }
        return [placeholder];
      }
      return [];
    }
    return messages;
  }, [messages, character?.openingLine, chat?.id, remoteState?.state]);

  const extractStateSnapshot = (message: ChatMessage | (ChatMessage & { state_snapshot?: Record<string, string | { value: number; description: string }> })) => {
    const snapshot = (message as any)?.stateSnapshot ?? (message as any)?.state_snapshot;
    if (snapshot && typeof snapshot === "object") {
      return snapshot as Record<string, string | { value: number; description: string }>;
    }
    return undefined;
  };

  // Subscribe to realtime messages using canonical UUID
  // Note: If UUID is null, realtime won't work (backend data issue)
  useRealtimeMessages(canonicalUuid ?? undefined);

  // Subscribe to realtime chat list updates (multi-device sync, live updates)
  useRealtimeChatList();
  
  // Fetch character details for the chat (backend uses snake_case character_id)
  
  // Fetch all chats for the chat list
  const {
    data: chats = [],
    isLoading: isLoadingChats
  } = useQuery<EnrichedChat[]>({
    queryKey: ["/api/chats"],
    enabled: authReady && showChatList,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData, // Show cached data instantly while loading fresh data
  });
  
  // Mutation for sending messages
  const { mutate: sendMessage, isPending: isSending } = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest(
        "POST",
        `/api/chats/${chatId}/messages`,
        { content, role: "user" }
      );
    },
    onSuccess: async () => {
      // Invalidate to show user's message
      queryClient.invalidateQueries({
        queryKey: [`/api/chats/${messagesCacheKey}/messages`],
      });

      // Kick off AI response
      aiResponse();
    },
  });
  
  // Mutation for AI responses
  const { mutate: aiResponse, isPending: isGeneratingResponse } = useMutation({
    mutationFn: async () => {
      return apiRequest(
        "POST",
        `/api/chats/${chatId}/generate`,
        {}
      );
    },
    onSuccess: () => {
      // Invalidate messages to show AI response
      queryClient.invalidateQueries({
        queryKey: [`/api/chats/${messagesCacheKey}/messages`],
      });

      // Invalidate token balance after AI response generation
      invalidateTokenBalance();
    },
  });
  
  // Reusable delete mutation hook
  const useDeleteMutation = (endpoint: string, successMessage: string, errorMessage: string, onSuccessExtra?: () => void) => {
    return useMutation({
      mutationFn: async (id?: number) => {
        const url = id ? `${endpoint}/${id}` : endpoint;
        const response = await apiRequest('DELETE', url);
        if (!response.ok) {
          throw new Error('Delete operation failed');
        }
        return response.json();
      },
      onSuccess: () => {
        onSuccessExtra?.();
        queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
        toast({
          title: t('success'),
          description: successMessage,
        });
      },
      onError: (error) => {
        toast({
          title: t('error'),
          description: errorMessage,
          variant: "destructive",
        });
        console.error('Delete operation error:', error);
      },
    });
  };

  // Clear all chats mutation
  const { mutate: clearAllChats, isPending: isClearingChats } = useDeleteMutation(
    '/api/chats',
    t('chatHistoryCleared'),
    t('failedToClearAllChats'),
  );

  // Delete single chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/chats/${id}`);
      if (!response.ok) {
        throw new Error('Delete operation failed');
      }
      return response.json();
    },
    onMutate: async (deletedChatId) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/chats"] });

      // Snapshot previous value for rollback
      const previousChats = queryClient.getQueryData(["/api/chats"]);

      // Optimistically remove from chat cache
      queryClient.setQueryData(["/api/chats"], (old: any) =>
        old?.filter((chat: any) => chat.id !== deletedChatId)
      );

      // Navigate away immediately if deleting current chat
      const isNumericMatch = chatId ? Number.isFinite(Number(chatId)) && Number(chatId) === deletedChatId : false;
      const isChatMatch = chat?.id === deletedChatId || (chat?.uuid && chatId === String(chat.uuid));
      if (isNumericMatch || isChatMatch) {
        navigateToPath('/chats');
      }

      // Return context for potential rollback
      return { previousChats, deletedChatId };
    },
    onError: (error, deletedChatId, context) => {
      // Rollback optimistic update on error
      if (context?.previousChats) {
        queryClient.setQueryData(["/api/chats"], context.previousChats);
      }

      toast({
        title: t('error'),
        description: t('failedToDeleteChat'),
        variant: "destructive",
      });
      console.error('Delete operation error:', error);
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: t('chatDeleted'),
      });
    },
    onSettled: () => {
      // Always refetch to sync with server (whether success or error)
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    },
  });

  const { mutate: deleteSingleChat, isPending: isDeletingChat } = deleteChatMutation;
  
  // Regenerate the last AI message
  const regenerateLastMessage = () => {
    aiResponse();
  };

  // Derive typing indicator from AI mutation state
  const isTyping = isGeneratingResponse;
  
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem("pinnedChats");
      if (stored) {
        const parsed = JSON.parse(stored) as number[];
        if (Array.isArray(parsed)) {
          setPinnedChatIds(parsed.slice(0, 20));
        }
      }
    } catch (error) {
      console.warn("Failed to restore pinned chats", error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const getTimestamp = (value?: string) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const normalizedSearch = useMemo(() => recentSearch.trim().toLowerCase(), [recentSearch]);

  const pinnedChats = useMemo(() => {
    return chats
      .filter((chat) => {
        if (!pinnedChatIds.includes(chat.id)) return false;
        if (!normalizedSearch) return true;
        const name = chat.character?.name?.toLowerCase() ?? "";
        const title = chat.title?.toLowerCase() ?? "";
        return name.includes(normalizedSearch) || title.includes(normalizedSearch);
      })
      .sort((a, b) => getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt));
  }, [chats, pinnedChatIds, normalizedSearch]);

  const filteredChats = useMemo(() => {
    const available = chats.filter((chat) => !pinnedChatIds.includes(chat.id));

    const filtered = available.filter((chat) => {
      if (!normalizedSearch) return true;
      const name = chat.character?.name?.toLowerCase() ?? "";
      const title = chat.title?.toLowerCase() ?? "";
      return name.includes(normalizedSearch) || title.includes(normalizedSearch);
    });

    return filtered.sort((a, b) => {
      if (sortMode === "alphabetical") {
        const nameA = a.character?.name ?? "";
        const nameB = b.character?.name ?? "";
        return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      }

      return getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt);
    });
  }, [chats, pinnedChatIds, normalizedSearch, sortMode]);

  const getLatestMessagePreview = useCallback((chat: EnrichedChat) => {
    const baseText = chat.latestMessagePreview?.trim() || chat.title?.trim();

    if (!baseText) {
      return t('noMessagesYet');
    }

    if (baseText.length <= 80) {
      return baseText;
    }

    return `${baseText.slice(0, 77)}…`;
  }, [t]);

  type GroupKey = "today" | "yesterday" | "earlier";

  const getDateGroup = (timestamp?: string): GroupKey => {
    if (!timestamp) return "earlier";

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "earlier";

    const now = new Date();
    const todayString = now.toDateString();
    const targetString = date.toDateString();

    if (targetString === todayString) {
      return "today";
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (targetString === yesterday.toDateString()) {
      return "yesterday";
    }

    return "earlier";
  };

  const groupedChats = useMemo(() => {
    const groups: Record<GroupKey, EnrichedChat[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };

    filteredChats.forEach((chat) => {
      const group = getDateGroup(chat.updatedAt);
      groups[group].push(chat);
    });

    return groups;
  }, [filteredChats]);

  const totalVisibleChats = pinnedChats.length + filteredChats.length;

  const togglePinChat = (chatId: number) => {
    setPinnedChatIds((previous) => {
      const next = previous.includes(chatId)
        ? previous.filter((id) => id !== chatId)
        : [chatId, ...previous].slice(0, 20);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("pinnedChats", JSON.stringify(next));
        } catch (error) {
          console.warn("Failed to persist pinned chats", error);
        }
      }

      return next;
    });
  };

  const formatRelativeTime = (value?: string) => {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff <= 0) {
      return t('justNow');
    }

    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;

    if (diff < minute) {
      return t('justNow');
    }

    if (diff < hour) {
      const minutes = Math.floor(diff / minute);
      return `${minutes} ${t('minutesAgo')}`;
    }

    if (diff < day) {
      const hours = Math.floor(diff / hour);
      return `${hours} ${t('hoursAgo')}`;
    }

    const days = Math.floor(diff / day);
    if (days === 1) {
      return t('yesterday');
    }

    return `${days} ${t('daysAgo')}`;
  };

  const formatAbsoluteTime = (value?: string, group?: GroupKey) => {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    if (group === "today") {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderChatCard = (chat: EnrichedChat, options: { pinned?: boolean; group?: GroupKey } = {}) => {
    const isPinned = options.pinned ?? pinnedChatIds.includes(chat.id);
    const relativeTime = formatRelativeTime(chat.updatedAt);
    const absoluteTime = formatAbsoluteTime(chat.updatedAt, options.group);

    return (
      <div
        key={`${options.pinned ? "pinned" : "chat"}-${chat.id}`}
        className="rounded-3xl p-5 transition-all hover:border-brand-accent/40 shadow-lg shadow-black/20 liquid-glass-hero-dark"
      >
        <div className="flex items-center gap-6">
          <Link
            href={`/chat/${chat.uuid ?? chat.id}`}
            className="flex min-w-0 flex-1 items-center gap-5"
          >
            <div className="relative h-[108px] w-[108px] flex-shrink-0 overflow-hidden rounded-[28px] border border-gray-800/70 bg-gray-950/60">
              <ImageWithFallback
                src={chat.character?.avatarUrl}
                alt={chat.character?.name || "Character"}
                fallbackText={chat.character?.name || "?"}
                size="lg"
                showSpinner={true}
                className="h-full w-full"
                roundedClass="rounded-[28px]"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="truncate font-semibold text-white">
                    {chat.character?.name || t('unknownCharacter')}
                  </h3>
                  {isPinned && (
                    <Badge variant="secondary" className="border-brand-accent/50 bg-brand-accent/20 text-[10px] text-brand-accent">
                      <Pin className="mr-1 h-3 w-3" />
                      {t('pinned')}
                    </Badge>
                  )}
                </div>
                {relativeTime && (
                  <span className="shrink-0 text-xs text-gray-400">{relativeTime}</span>
                )}
              </div>
              <p className="line-clamp-2 text-[15px] font-medium text-gray-200">
                {chat.title || t('untitledChat')}
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                  <span>{t('lastMessage')}</span>
                  <span className="h-1 w-1 rounded-full bg-gray-600"></span>
                  {relativeTime && <span>{relativeTime}</span>}
                </div>
                <p className="line-clamp-3 text-sm text-gray-400">
                  {getLatestMessagePreview(chat)}
                </p>
              </div>
              {absoluteTime && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>{absoluteTime}</span>
                </div>
              )}
            </div>
          </Link>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => togglePinChat(chat.id)}
              className={cn(
                "flex items-center gap-1 rounded-full border border-gray-700/70 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-brand-accent/60 hover:text-brand-accent",
                isPinned && "border-brand-accent/60 text-brand-accent"
              )}
              title={isPinned ? t('unpinChat') : t('pinChat')}
            >
              <Pin className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isPinned ? t('unpin') : t('pinChatAction')}</span>
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-800 border-gray-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">{t('deleteChat')}</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400">
                    {t('areYouSure')} {t('deleteThisChat')} {t('cannotUndone')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-700 text-white border-gray-600">{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Deleting chat from list:', chat.id);
                      deleteSingleChat(chat.id);
                    }}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isDeletingChat}
                  >
                    {isDeletingChat ? t('deleting') : t('delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    );
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, isTyping]);
  
  // If we're showing the chat list
  if (showChatList) {
    return (
      <GlobalLayout>
        <div className="space-y-6 px-4 pt-4 pb-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-poppins text-2xl font-bold text-white">{t('chats')}</h1>
              <p className="text-sm text-gray-400">{t('recentChats')}</p>
            </div>
            {chats.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 rounded-full border-red-500/70 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    disabled={isClearingChats}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{t('clearAll')}</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border border-gray-700 bg-gray-900">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-lg font-semibold text-white">
                      {t('clearAllChats')}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-gray-400">
                      {t('thisActionCannotBeUndone')}. {t('allConversationsWillBeDeleted')}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full bg-gray-800 text-white hover:bg-gray-700">
                      {t('cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearAllChats(undefined)}
                      className="rounded-full bg-red-600 hover:bg-red-700"
                      disabled={isClearingChats}
                    >
                      {isClearingChats ? t('clearing') : t('clearAll')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="rounded-3xl border border-gray-800/80 bg-gray-900/60 p-4 shadow-lg shadow-black/20 sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  {t('recentChatsTitle')}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <Badge variant="secondary" className="bg-gray-800/80 text-gray-200">
                    {t('recentChats')}: {totalVisibleChats}
                  </Badge>
                  <Badge variant="outline" className="border-brand-accent/40 text-brand-accent">
                    <Pin className="mr-1 h-3 w-3" />
                    {t('pinnedChatsLabel')}: {pinnedChats.length}
                  </Badge>
                  <Badge variant="outline" className="border-gray-700/60 text-gray-400">
                    {t('chatHistoryCleared')}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative md:w-72">
                  <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <Input
                    value={recentSearch}
                    onChange={(event) => setRecentSearch(event.target.value)}
                    placeholder={t('searchChatsPlaceholder')}
                    className="rounded-full border-gray-700/70 bg-gray-900/70 pl-10 text-sm placeholder:text-gray-500 focus-visible:ring-brand-accent/60"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-gray-700/60 text-gray-300 hover:border-brand-accent/60 hover:text-brand-accent"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/chats"] })}
                  >
                    <Sparkles className="mr-1 h-4 w-4" />
                    {t('refreshChats')}
                  </Button>
                  <Button
                    type="button"
                    variant={sortMode === "recent" ? "default" : "outline"}
                    className="rounded-full border-gray-700/60 bg-gray-800/80 text-sm hover:border-brand-accent/60 hover:text-brand-accent"
                    onClick={() => setSortMode("recent")}
                  >
                    <Clock className="mr-1 h-4 w-4" />
                    {t('sortByDate')}
                  </Button>
                  <Button
                    type="button"
                    variant={sortMode === "alphabetical" ? "default" : "outline"}
                    className="rounded-full border-gray-700/60 bg-gray-800/80 text-sm hover:border-brand-accent/60 hover:text-brand-accent"
                    onClick={() => setSortMode("alphabetical")}
                  >
                    <Star className="mr-1 h-4 w-4" />
                    {t('sortByName')}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {isLoadingChats ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-2xl border border-gray-800/80 bg-gray-900/60 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-gray-800/80" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 rounded bg-gray-800/80" />
                      <div className="h-3 w-2/3 rounded bg-gray-800/60" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : chats.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-700/70 bg-gray-900/60 p-10 text-center">
              <p className="text-gray-400">{t('noChatsYet')}</p>
              <p className="mt-2 text-sm text-gray-500">{t('searchHint')}</p>
              <Link href="/characters" className="mt-4 inline-flex">
                <Button className="rounded-full bg-primary px-6 py-2 text-white hover:bg-accent">
                  {t('startNewChat')}
                </Button>
              </Link>
            </div>
          ) : totalVisibleChats === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-700/70 bg-gray-900/60 p-10 text-center">
              <p className="text-gray-400">{t('noMatches')}</p>
              <p className="mt-2 text-sm text-gray-500">{t('searchHint')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pinnedChats.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2 font-medium text-gray-300">
                      <Star className="h-4 w-4 text-brand-accent" />
                      <span>{t('pinnedChatsLabel')}</span>
                    </div>
                    <span>{pinnedChats.length}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {pinnedChats.map((chat) => renderChatCard(chat, { pinned: true }))}
                  </div>
                </div>
              )}

              {(['today', 'yesterday', 'earlier'] as GroupKey[]).map((group) => {
                const items = groupedChats[group];
                if (!items.length) return null;

                return (
                  <div key={group} className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-medium text-gray-300">{t(group)}</span>
                      <span>{items.length}</span>
                    </div>
                    <ChatList
                      items={items}
                      renderItem={(chat) => renderChatCard(chat, { group })}
                      initialBatchSize={9}
                      batchIncrement={6}
                      className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </GlobalLayout>
    );
  }
  
  // If we're showing a specific chat
  return (
    <GlobalLayout>
      <div className="h-full flex flex-col pb-20 sm:pb-0">
        {/* Chat Header */}
        <div className="px-4 pt-4 pb-3 border-b border-secondary sticky top-0 bg-background z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button 
              className="mr-3 text-gray-400"
              onClick={() => navigateToPath("/chats")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center">
              {character && (
                <ImageWithFallback
                  src={character.avatarUrl}
                  alt={character.name}
                  fallbackText={character.name}
                  size="md"
                  showSpinner={true}
                  className="w-10 h-10"
                />
              )}
              <div className="ml-3">
                <h2 className="font-medium text-white">
                  {isLoadingCharacter ? "Loading..." : character?.name}
                </h2>
                <div className="flex items-center text-xs text-gray-400">
                  <ImprovedTokenBalance compact={true} showTitle={false} />
                </div>
              </div>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors">
                <Trash2 className="h-5 w-5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-gray-800 border-gray-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">{t('deleteChat')}</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-400">
                  {t('areYouSure')} {t('deleteThisChat')} {t('cannotUndone')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-gray-700 text-white border-gray-600">{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    console.log('Delete button clicked, chatId:', chatId);
                    if (chatId) {
                      const numericChatId = parseInt(chatId);
                      console.log('Deleting chat with ID:', numericChatId);
                      deleteSingleChat(numericChatId);
                    } else {
                      console.error('No chatId available');
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeletingChat ? t('deleting') : t('delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages ? (
          <div className="text-center py-4">
            <p className="text-gray-400">{t('loadingMessages')}</p>
          </div>
        ) : messagesError ? (
          <div className="text-center py-4">
            <p className="text-red-500">{t('errorLoading')}</p>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">{t('noMessagesYet')}</p>
          </div>
        ) : (
          (() => {
            let lastAssistantSnapshot: Record<string, string | { value: number; description: string }> | undefined =
              remoteState?.state && Object.keys(remoteState.state).length > 0 ? remoteState.state : undefined;

            return displayMessages.map((message) => {
              const isAssistant = message.role === "assistant";
              const isSynthetic = message.id === -1;
              const snapshot = extractStateSnapshot(message);
              const hasSnapshot = snapshot && Object.keys(snapshot).length > 0;
              let stateSnapshot: Record<string, string | { value: number; description: string }> | undefined;

              if (hasSnapshot) {
                stateSnapshot = snapshot;
              } else if (isAssistant && !isSynthetic) {
                stateSnapshot = lastAssistantSnapshot;
              } else if (isSynthetic && remoteState?.state) {
                stateSnapshot = remoteState.state;
              }

              if (isAssistant && stateSnapshot) {
                lastAssistantSnapshot = stateSnapshot;
              }

              return (
                <ChatBubble 
                  key={message.id} 
                  message={message} 
                  avatarUrl={character?.avatarUrl}
                  onRegenerate={isAssistant && !isSynthetic ? regenerateLastMessage : undefined}
                  stateSnapshot={stateSnapshot}
                />
              );
            });
          })()
        )}
        
        {isTyping && (
          <div className="flex items-end mb-4">
            <ImageWithFallback
              src={character?.avatarUrl}
              alt={character?.name || "Character"}
              fallbackText={character?.name || "AI"}
              size="sm"
              showSpinner={true}
              className="mr-2"
            />
            <div className="max-w-[80%]">
              <div className="chat-bubble-ai">
                <TypingIndicator />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

        {/* Chat Input */}
        <ChatInput
          onSendMessage={sendMessage}
          isLoading={isSending || isTyping}
          showAvatar={!!character}
          avatarUrl={character?.avatarUrl ?? null}
          avatarAlt={character?.name ?? 'Character'}
          avatarFallbackText={character?.name ?? 'AI'}
        />
      </div>
    </GlobalLayout>
  );
};

export default ChatsPage;
