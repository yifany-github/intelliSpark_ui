import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Chat, ChatMessage, Character, EnrichedChat } from "../types";
import ChatBubble from "@/components/chats/ChatBubble";
import ChatInput from "@/components/chats/ChatInput";
import ChatModelSelector from "@/components/chats/ChatModelSelector";
import { CharacterGallery } from "@/components/chats/CharacterGallery";
import QuickReplies from "@/components/chats/QuickReplies";
import { ChatErrorBanner } from "@/components/chats/ChatErrorBanner";
import TypingIndicator from "@/components/ui/TypingIndicator";
import { apiRequest } from "@/lib/queryClient";
import { useRolePlay } from "@/contexts/RolePlayContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useAuth } from "@/contexts/AuthContext";
import { invalidateTokenBalance } from "@/services/tokenService";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useChatGeneration } from "@/hooks/useChatGeneration";
import { ChevronLeft, MoreVertical, Menu, X, Heart, Star, Share, Bookmark, ArrowLeft, Sparkles, Filter, Pin, Trash2, Info } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { ImprovedTokenBalance } from "@/components/payment/ImprovedTokenBalance";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import ChatList from "@/components/chats/ChatList";

const createTempMessageId = () => -Math.floor(Date.now() + Math.random() * 1000);

interface ChatPageProps {
  chatId?: string;
}

const ChatPage = ({ chatId }: ChatPageProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isReady: authReady } = useAuth();
  const { t } = useLanguage();
  const { navigateBack, navigateToPath } = useNavigation();
  const { toast } = useToast();
  const [showChatList, setShowChatList] = useState(false);
  const [showCharacterInfo, setShowCharacterInfo] = useState(false);
  const [recentSearch, setRecentSearch] = useState("");
  const [pinnedChatIds, setPinnedChatIds] = useState<number[]>([]);
  const [isBrowserMounted, setIsBrowserMounted] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);

  // If no chatId is provided, show chat list
  const showChatListOnly = !chatId;

  // Fetch chat details - backend accepts both numeric and UUID
  // Backend resolves to canonical chat and returns chat.uuid in response
  const chatEnabled = authReady && !!chatId;

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
  // This is our single source of truth for realtime, cache keys, navigation
  const canonicalUuid = chat?.uuid ?? null;

  // Critical check: If chat exists but has no UUID, this is a backend data integrity issue
  if (chat && !canonicalUuid) {
    console.error('[Chat] Chat loaded but UUID is missing:', chat);
    return (
      <GlobalLayout>
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-lg font-semibold">Data Error</p>
          <p className="text-sm text-gray-400">
            This chat is missing required UUID. Please contact support or try creating a new chat.
          </p>
          <button
            onClick={() => navigateToPath("/chats")}
            className="rounded-full bg-brand-secondary px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-secondary/80"
          >
            Back to chats
          </button>
        </div>
      </GlobalLayout>
    );
  }

  const isInitializing = Boolean(chatId && chatEnabled && !chat && !chatError && !isLoadingChat);
  const showPlaceholderMessage = isInitializing;

  if (chatError) {
    console.error("[Chat] Failed to load chat:", chatError);
    return (
      <GlobalLayout>
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-lg font-semibold">{t("chatNotFound") || "Chat not found"}</p>
          <p className="text-sm text-gray-400">
            {t("chatUnavailable") || "This chat may have been removed or is no longer accessible."}
          </p>
          <button
            onClick={() => navigateToPath("/chat")}
            className="rounded-full bg-brand-secondary px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-secondary/80"
          >
            {t("backToChats") || "Back to chats"}
          </button>
        </div>
      </GlobalLayout>
    );
  }

  // Fetch all chats for the chat list
  const {
    data: chats = [],
    isLoading: isLoadingChats
  } = useQuery<EnrichedChat[]>({
    queryKey: ["/api/chats"],
    enabled: authReady,
  });

  // Fetch chat messages - use canonical UUID for cache key
  // Fallback to chatId for backward compat with old chats missing UUID
  const messagesCacheKey = canonicalUuid ?? chatId;
  const messagesEnabled = authReady && !!messagesCacheKey;

  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    error: messagesError
  } = useQuery<ChatMessage[]>({
    queryKey: [`/api/chats/${messagesCacheKey}/messages`],
    enabled: messagesEnabled,
    refetchInterval: (query) => {
      const data = query.state.data as ChatMessage[] | undefined;
      if (!messagesEnabled) {
        return false;
      }
      if (!data || data.length === 0) {
        return 2000;
      }
      return false;
    },
    refetchIntervalInBackground: true,
  });

  // Extract character_id from chat (backend uses snake_case, frontend expects camelCase)
  const characterId = chat?.characterId ?? (chat as any)?.character_id;

  const {
    data: character,
    isLoading: isLoadingCharacter
  } = useQuery<Character>({
    queryKey: [`/api/characters/${characterId}`],
    enabled: authReady && !!characterId,
  });

  type ChatStateResponse = {
    chat_id: number;
    state: Record<string, string>;
    updated_at: string | null;
  };

  const { data: remoteState } = useQuery<ChatStateResponse>({
    queryKey: [`/api/chats/${messagesCacheKey}/state`],
    enabled: messagesEnabled,
    staleTime: 10_000,
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

  const extractStateSnapshot = (message: ChatMessage | (ChatMessage & { state_snapshot?: Record<string, string> })) => {
    const snapshot = (message as any)?.stateSnapshot ?? (message as any)?.state_snapshot;
    if (snapshot && typeof snapshot === "object") {
      return snapshot as Record<string, string>;
    }
    return undefined;
  };

  const generateQuickReplies = useCallback(() => {
    if (!character) return;

    const baseSuggestions = [
      t('tellMeMore') || "Tell me more",
      t('howAreYou') || "How are you?",
      t('thatsInteresting') || "That's interesting!",
      t('whatHappensNext') || "What happens next?",
    ];

    const characterSuggestions: Record<string, string[]> = {
      default: baseSuggestions,
      艾莉丝: [
        "告诉我更多",
        "你今天怎么样？",
        "我想知道...",
        "有什么建议吗？"
      ],
    };

    const suggestions = characterSuggestions[character.name] || characterSuggestions.default;
    setQuickReplies(suggestions.slice(0, 4));
  }, [character, t]);

  const generationInvalidateKeys = ["/api/chats"];
  if (chatId) {
    generationInvalidateKeys.push(`/api/chats/${chatId}`);
  }

  const generation = useChatGeneration({
    chatId,
    messagesQueryKey: messagesCacheKey ? `/api/chats/${messagesCacheKey}/messages` : undefined,
    invalidateKeys: generationInvalidateKeys,
    onSuccess: () => {
      invalidateTokenBalance();
      generateQuickReplies();
    },
  });

  useRealtimeMessages(canonicalUuid ?? undefined, {
    onAssistantMessage: generation.handleAssistantMessage,
  });

  useEffect(() => {
    generateQuickReplies();
  }, [generateQuickReplies]);

  const renderTypingBubble = ({
    message,
    showIndicator = true,
  }: {
    message?: string;
    showIndicator?: boolean;
  } = {}) => (
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
          {showIndicator && <TypingIndicator />}
          {message && (
            <p className="mt-2 text-xs text-white/75">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // Mutation for sending messages
  const { mutate: sendMessage, isPending: isSending, error: sendMessageError, reset: resetSendError } = useMutation({
    mutationFn: async (content: string) => {
      if (!chatId || !chat) {
        throw new Error("Chat not ready");
      }
      // Use chatId from route - backend accepts both numeric and UUID
      return apiRequest(
        "POST",
        `/api/chats/${chatId}/messages`,
        { content, role: "user" }
      );
    },
    onMutate: () => {
      generation.clearError();
      generation.cancelGeneration();
    },
    onSuccess: async () => {
      if (!canonicalUuid) return;

      // Invalidate to show user's message immediately
      queryClient.invalidateQueries({
        queryKey: [`/api/chats/${messagesCacheKey}/messages`],
      });

      // Kick off AI response
      generation.triggerGeneration();
    },
    onError: (error: any) => {
      console.error("Message sending failed:", error);
      // Error state is now handled by mutation state, not cache mutation
      // This prevents React Query state conflicts that cause crashes
    },
  });
  
  // Delete single chat mutation
  const { mutate: deleteSingleChat, isPending: isDeletingChat } = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/chats/${id}`);
      if (!response.ok) {
        throw new Error('Delete operation failed');
      }
      return response.json();
    },
    onSuccess: (data, deletedChatId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({
        title: t('success'),
        description: t('chatDeleted'),
      });

      // Only navigate away if we deleted the current chat
      if (chat?.id === deletedChatId) {
        navigateToPath('/chats');
      }
    },
    onError: (error) => {
      toast({
        title: t('error'),
        description: t('failedToDeleteChat'),
        variant: "destructive",
      });
      console.error('Delete operation error:', error);
    },
  });

  // Derive typing indicator from AI mutation state
  const isTyping = generation.typing;

  // Derive loading states
  const waitingForFirstMessage = !!chat && messages.length === 0;
  const showTypingPlaceholder =
    (isLoadingChat && !showPlaceholderMessage) ||
    waitingForFirstMessage ||
    isLoadingMessages ||
    isLoadingCharacter ||
    isInitializing;
  const showEmptyState = !messagesError && !showTypingPlaceholder && displayMessages.length === 0 && !!chat;

  // Regenerate the last AI message
  const regenerateLastMessage = () => {
    generation.triggerGeneration();
  };

  const handleQuickReply = (reply: string) => {
    sendMessage(reply);
    setQuickReplies([]); // Clear after selection
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsBrowserMounted(true);
      try {
        const stored = localStorage.getItem("pinnedChats");
        if (stored) {
          const parsed = JSON.parse(stored) as number[];
          if (Array.isArray(parsed)) {
            setPinnedChatIds(parsed.slice(0, 12));
          }
        }
      } catch (error) {
        console.warn("Failed to read pinned chats from storage", error);
      }
    }
  }, []);
  
  // Derived recent chat lists
  const pinnedChats = useMemo(() => {
    return chats.filter((chat) => pinnedChatIds.includes(chat.id));
  }, [chats, pinnedChatIds]);

  const filteredChats = useMemo(() => {
    const normalized = recentSearch.trim().toLowerCase();
    return chats.filter((chat) => {
      if (pinnedChatIds.includes(chat.id)) return false;
      if (!normalized) return true;
      const name = chat.character?.name?.toLowerCase() || "";
      const title = chat.title?.toLowerCase() || "";
      return name.includes(normalized) || title.includes(normalized);
    });
  }, [chats, pinnedChatIds, recentSearch]);

  const togglePinChat = (chatId: number) => {
    setPinnedChatIds((prev) => {
      const next = prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [chatId, ...prev].slice(0, 12);

      if (isBrowserMounted) {
        try {
          localStorage.setItem("pinnedChats", JSON.stringify(next));
        } catch (error) {
          console.warn("Failed to persist pinned chats", error);
        }
      }

      return next;
    });
  };

  const formattedRelativeTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;

    if (diff < minute) {
      return t("justNow");
    }
    if (diff < hour) {
      const count = Math.floor(diff / minute);
      return t("minutesAgo", { count });
    }
    if (diff < day) {
      const count = Math.floor(diff / hour);
      return t("hoursAgo", { count });
    }

    const count = Math.floor(diff / day);
    if (count === 1) {
      return t("yesterday");
    }

    return t("daysAgo", { count });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, isTyping]);
  
  // Refresh chat list when returning to it
  useEffect(() => {
    if (showChatListOnly) {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    }
  }, [showChatListOnly]);
  
  // If we're showing the chat list only
  if (showChatListOnly) {
    return (
      <GlobalLayout>
        <div className="px-4 pt-4 pb-16">
          <h1 className="font-poppins font-bold text-2xl mb-4">{t('chats')}</h1>
        
        {isLoadingChats ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse bg-secondary rounded-2xl p-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-secondary/50 rounded-full"></div>
                  <div className="ml-3 flex-1">
                    <div className="h-5 bg-secondary/50 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-secondary/50 rounded w-3/4"></div>
                  </div>
                  <div className="h-4 w-16 bg-secondary/50 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">{t('noChatsYet')}</p>
            <Link href="/">
              <button className="bg-primary hover:bg-accent text-white px-4 py-2 rounded-full transition-colors">
                {t('startNewChat')}
              </button>
            </Link>
          </div>
        ) : (
          <ChatList
            items={chats}
            initialBatchSize={12}
            batchIncrement={6}
            className="space-y-3"
            renderItem={(chat: EnrichedChat) => {
              const chatLink = chat.uuid ?? chat.id;
              return (
                <Link
                  key={chat.uuid ?? `chat-${chat.id}`}
                  href={`/chat/${chatLink}`}
                  className="block rounded-2xl bg-secondary p-4 transition-colors hover:bg-secondary/80"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <ImageWithFallback
                        src={chat.character?.avatarUrl}
                        alt={chat.character?.name || "Character"}
                        fallbackText={chat.character?.name || "?"}
                        size="md"
                        showSpinner={true}
                      />
                      <div className="ml-3">
                        <h3 className="font-medium">{chat.character?.name}</h3>
                        <p className="text-sm text-gray-400">{chat.title}</p>
                        <p className="text-xs text-gray-500">
                          {chat.updatedAt
                            ? new Date(chat.updatedAt).toLocaleDateString()
                            : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">
                      {chat.updatedAt
                        ? new Date(chat.updatedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                </Link>
              );
            }}
          />
        )}
        </div>
      </GlobalLayout>
    );
  }
 
  if (isLoadingChat || (!chat && chatId)) {
    return (
      <GlobalLayout>
        <div className="flex h-full flex-col items-center justify-center gap-3 text-white">
          <span className="inline-flex h-8 w-8 animate-spin rounded-full border-2 border-brand-secondary/40 border-t-brand-secondary" />
          <p className="text-sm text-gray-300">{t("loadingChat") || "Loading chat…"}</p>
        </div>
      </GlobalLayout>
    );
  }

  if (!chat) {
    return (
      <GlobalLayout>
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-lg font-semibold">{t("chatUnavailable") || "This chat is no longer available."}</p>
          <button
            onClick={() => navigateToPath("/chat")}
            className="rounded-full bg-brand-secondary px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-secondary/80"
          >
            {t("backToChats") || "Back to chats"}
          </button>
        </div>
      </GlobalLayout>
    );
  }

  // If we're showing a specific chat
  return (
    <>
    <GlobalLayout
      showSidebar={false}
      showTopNavOnMobile={false}
      contentTopPadding={false}
      contentPaddingClass="flex min-h-0 h-full flex-1 flex-col p-0"
      maxContentWidthClass="max-w-full"
      mainClassName="flex flex-1 flex-col min-h-0 md:pt-[76px] md:h-screen"
      mainScrollable={false}
    >
      <div className="flex flex-1 min-h-0 flex-col fixed md:relative inset-0 md:inset-auto md:h-[calc(100vh-76px)] pt-safe pb-[calc(env(safe-area-inset-bottom)+3.5rem)] md:pt-0 md:pb-0">
        <div className="flex flex-1 min-h-0 overflow-hidden text-white relative bg-gradient-to-br from-slate-950/98 via-slate-900/95 to-slate-950/98">
          {/* Mobile overlay */}
          {showChatList && (
            <div
              className="fixed inset-0 bg-black/50 z-5 lg:hidden"
              onClick={() => setShowChatList(false)}
            />
          )}

          {/* Left Sidebar - Recent Chats - Hidden on mobile */}
          <div
            className={cn(
              "transition-all duration-300 relative",
              "bg-slate-900/70 backdrop-blur-2xl",
              "border border-pink-500/20 rounded-r-3xl lg:rounded-none",
              "flex-shrink-0 flex-col absolute lg:relative z-10 h-full",
              "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_20px_60px_rgba(236,72,153,0.15)]",
              "lg:ml-4 lg:my-4 lg:h-[calc(100%-2rem)] lg:rounded-3xl",
              "hidden lg:flex lg:w-[19rem] xl:w-[20rem]"
            )}
          >
          {/* Left sidebar header matching main chat header height */}
          <div className="px-4 py-3 sm:py-4 border-b border-pink-500/10 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowChatList(false)}
                  className="lg:hidden p-1 rounded-lg hover:bg-gray-700/70 transition-colors"
                  title={t('collapseSidebar')}
                >
                  <X className="w-5 h-5" />
                </button>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">
                    {t('recentChats')}
                  </p>
                  <h2 className="text-base sm:text-lg font-semibold text-white">
                    {t('chats')}
                  </h2>
                </div>
              </div>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/chats"] })}
                className="p-2 rounded-full hover:bg-gray-700/70 transition-colors"
                title={t('refreshChats')}
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search and filter section */}
          <div className="px-4 pt-3 pb-3 border-b border-gray-700/60">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={recentSearch}
                onChange={(event) => setRecentSearch(event.target.value)}
                placeholder={t('searchChatsPlaceholder')}
                className="bg-gray-900/60 border-gray-700/70 text-sm pl-10 placeholder:text-gray-500 focus-visible:ring-brand-accent/70"
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
              <span>{t('pinnedConversations')}</span>

            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {character && (
              <div className="px-4 pt-4">
                <div className="rounded-2xl border-2 border-pink-400/60 bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-indigo-500/20 p-3 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <ImageWithFallback
                        src={character?.avatarUrl}
                        alt={character?.name}
                        fallbackText={character?.name}
                        size="md"
                        showSpinner={true}
                        className="w-10 h-10 ring-2 ring-pink-400/50"
                      />
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 border-2 border-gray-900 rounded-full shadow-glow" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white drop-shadow-sm truncate">
                        {character?.name}
                      </p>
                      <p className="text-xs text-pink-100 font-medium truncate">
                        {t('currentlyChatting')}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-pink-500/80 text-white font-semibold text-[10px] border border-pink-300/50 shadow-md">
                      {t('activeNow')}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {pinnedChats.length > 0 && (
              <div className="px-4 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t('pinnedConversations')}
                  </p>
                  <span className="text-xs text-gray-500">{pinnedChats.length}</span>
                </div>
                <div className="space-y-2">
                  {pinnedChats.map((chat) => (
                    <Link
                      key={chat.uuid ?? `pinned-${chat.id}`}
                      href={`/chat/${chat.uuid ?? chat.id}`}
                      className="group flex items-center gap-3 rounded-2xl border border-gray-700/70 bg-gray-800/60 p-3 transition-all hover:border-brand-accent/50 hover:bg-gray-800"
                    >
                      <ImageWithFallback
                        src={chat.character?.avatarUrl}
                        alt={chat.character?.name || "Character"}
                        fallbackText={chat.character?.name || "?"}
                        size="sm"
                        showSpinner={true}
                        className="w-9 h-9"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white truncate">
                            {chat.character?.name}
                          </p>
                          <span className="text-[11px] text-gray-400">
                            {formattedRelativeTime(chat.updatedAt)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {chat.title || t('untitledChat')}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                          <Badge variant="outline" className="border-gray-700/70 text-gray-400">
                            {t('pinned')}
                          </Badge>
                          <button
                            onClick={(event) => {
                              event.preventDefault();
                              togglePinChat(chat.id);
                            }}
                            className="hidden items-center gap-1 rounded-full border border-gray-700/60 px-2 py-0.5 text-xs text-gray-400 transition-colors group-hover:flex hover:border-brand-accent/60 hover:text-brand-accent"
                          >
                            <Pin className="w-3 h-3" />
                            {t('unpin')}
                          </button>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 pt-4 pb-6">
              <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
                <p className="uppercase tracking-wide">{t('recentConversations')}</p>
                <span>{filteredChats.length}</span>
              </div>

              {filteredChats.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-700/70 bg-gray-900/40 p-4 text-center text-sm text-gray-500">
                  <p>{recentSearch ? t('noMatches') : t('noChatsYet')}</p>
                  <p className="mt-1 text-xs text-gray-600">{t('searchHint')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredChats
                    .filter((item) => item.uuid !== canonicalUuid)
                    .map((chat) => (
                      <Link
                        key={chat.uuid ?? `recent-${chat.id}`}
                        href={`/chat/${chat.uuid ?? chat.id}`}
                        className="group flex items-center gap-3 rounded-2xl border border-transparent bg-gray-900/40 p-3 transition-all hover:border-brand-accent/40 hover:bg-gray-900/70"
                      >
                        <ImageWithFallback
                          src={chat.character?.avatarUrl}
                          alt={chat.character?.name || "Character"}
                          fallbackText={chat.character?.name || "?"}
                          size="sm"
                          showSpinner={true}
                          className="w-9 h-9"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-white truncate">
                              {chat.character?.name || t('unknownCharacter')}
                            </p>
                            <span className="text-[11px] text-gray-500">
                              {formattedRelativeTime(chat.updatedAt)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate">
                            {chat.title || t('untitledChat')}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={(event) => {
                                event.preventDefault();
                                togglePinChat(chat.id);
                              }}
                              className="flex items-center gap-1 rounded-full border border-gray-700/70 px-2 py-0.5 transition-colors hover:border-brand-accent/50 hover:text-brand-accent"
                            >
                              <Pin className="w-3 h-3" />
                              {t('pinChatAction')}
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={(event) => {
                            event.preventDefault();
                            deleteSingleChat(chat.id);
                          }}
                          className="hidden rounded-full p-2 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400 group-hover:block"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Link>
                    ))}
                </div>
              )}
            </div>
          </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex flex-1 min-h-0 flex-col min-w-0 overflow-hidden relative">
            {/* Subtle gradient background for messages area */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/20 to-transparent pointer-events-none"></div>

            {/* Chat header matching sidebar header height */}
            <div className="px-3 py-3 sm:px-6 sm:py-4 border-b border-pink-500/10 flex-shrink-0 relative z-10">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0">
                  {/* Back button for mobile */}
                  <button
                    onClick={navigateBack}
                    className="lg:hidden rounded-lg p-1 text-gray-300 transition-colors hover:bg-gray-800"
                    title="Back to previous page"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  {/* Mobile menu button - Hidden on mobile, sidebar not available */}

                  {character && (
                    <ImageWithFallback
                      src={character?.avatarUrl}
                      alt={character?.name}
                      fallbackText={character?.name}
                      size="md"
                      showSpinner={true}
                      className="h-9 w-9 rounded-2xl sm:h-11 sm:w-11"
                    />
                  )}
                  <div className="min-w-0">
                    <h1 className="truncate text-base font-semibold sm:text-lg">
                      {isLoadingCharacter ? t('loading') : character?.name}
                    </h1>
                    <p className="text-xs text-gray-400 sm:text-sm">
                      {chat
                        ? (chat.title || t('untitledChat'))
                        : isInitializing
                          ? t('creatingChat')
                          : t('loading')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <ChatModelSelector />
                  <button
                    onClick={() => setShowCharacterInfo(!showCharacterInfo)}
                    className="xl:hidden rounded-lg p-2 text-gray-300 transition-colors hover:bg-gray-800"
                    title={t('characterInfo')}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Error Banners */}
            {sendMessageError && (
              <div className="mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-400">Failed to send message</p>
                    <p className="mt-1 text-xs text-red-300/80">
                      {(sendMessageError as any)?.message || 'Please try again'}
                    </p>
                  </div>
                  <button
                    onClick={() => resetSendError()}
                    className="rounded-md bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {generation.error && (
              <ChatErrorBanner
                error={generation.error}
                retryCountdown={generation.retryCountdown}
                onRetry={() => generation.retryGeneration()}
                onReload={() => {
                  if (messagesCacheKey) {
                    queryClient.invalidateQueries({ queryKey: [`/api/chats/${messagesCacheKey}/messages`] });
                  }
                  if (chatId) {
                    queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}`] });
                  }
                }}
                onDismiss={() => generation.clearError()}
                onReport={() => window.open('mailto:support@productinsight.ai?subject=Chat%20issue', '_blank')}
                retryDisabled={generation.isPending}
                isRetrying={generation.isPending}
              />
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scrollbar-thin relative z-10">
              {messagesError ? (
                <div className="text-center py-4">
                  <p className="text-red-500">{t('errorLoading')}</p>
                </div>
              ) : (
                <>
                  {showTypingPlaceholder &&
                    renderTypingBubble({
                      message: isInitializing
                        ? t('creatingChat')
                        : character?.name
                          ? `${character.name} ${t('isPreparingMessage')}`
                          : t('loadingMessages'),
                    })}

                  {!showTypingPlaceholder && showEmptyState &&
                    renderTypingBubble({
                      message: t('noMessagesYet'),
                      showIndicator: false,
                    })}

                  {!showTypingPlaceholder &&
                    displayMessages.length > 0 &&
                    (() => {
                      let lastAssistantSnapshot: Record<string, string> | undefined =
                        remoteState?.state && Object.keys(remoteState.state).length > 0 ? remoteState.state : undefined;

                      return displayMessages.map((message) => {
                        const isAssistant = message.role === "assistant";
                        const isSynthetic = message.id === -1;
                        const snapshot = extractStateSnapshot(message);
                        const hasSnapshot = snapshot && Object.keys(snapshot).length > 0;
                        let stateSnapshot: Record<string, string> | undefined;

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
                  }
                </>
              )}

              {isTyping && !showTypingPlaceholder && renderTypingBubble()}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            <QuickReplies
              suggestions={quickReplies}
              onSelect={handleQuickReply}
              isLoading={isSending || isTyping}
            />

            {/* Chat Input */}
            <ChatInput
              onSendMessage={sendMessage}
              isLoading={isSending || isTyping}
              disabled={!chat}
              placeholder={!chat ? t('creatingChat') : undefined}
              className="border-t border-pink-500/10 bg-slate-900/80 backdrop-blur-xl relative z-10"
              showAvatar={!!character}
              avatarUrl={character?.avatarUrl ?? null}
              avatarAlt={character?.name ?? 'Character'}
              avatarFallbackText={character?.name ?? 'AI'}
            />
          </div>

          {/* Character Info Sheet for mobile/tablet */}
          <Sheet open={showCharacterInfo} onOpenChange={setShowCharacterInfo}>
            <SheetContent side="bottom" className="xl:hidden bg-gray-900 border-gray-700 rounded-t-3xl overflow-y-auto max-h-[70vh]">
              <SheetHeader className="pb-2 pt-2 sticky top-0 bg-gray-900 z-10 border-b border-gray-700">
                <SheetTitle className="text-white text-base">{t('characterInfo')}</SheetTitle>
              </SheetHeader>
              <div className="pb-4 pt-3">
                <div className="w-full max-h-[35vh] mb-3 overflow-hidden rounded-lg mx-auto max-w-sm">
                  <CharacterGallery
                    characterId={character?.id || 0}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="px-4">
                  <h4 className="font-bold text-lg mb-2 text-center">{character?.name}</h4>
                  <p className="text-xs text-gray-300 mb-3 leading-relaxed">{character?.description}</p>

                  {character?.traits && character.traits.length > 0 && (
                    <div className="mb-3">
                      <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('traits') || 'Traits'}</h5>
                      <div className="flex flex-wrap gap-1.5">
                        {character.traits.map((trait, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-white"
                          >
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>

        {/* Right Sidebar - Character Info */}
          {character && (
            <div className="w-full lg:w-80 bg-slate-900/70 backdrop-blur-2xl border border-pink-500/20 rounded-l-3xl xl:rounded-3xl flex-shrink-0 hidden lg:flex lg:flex-col scrollbar-thin relative shadow-[0_8px_32px_rgba(0,0,0,0.5),0_20px_60px_rgba(236,72,153,0.15)] lg:mr-4 lg:my-4 lg:h-[calc(100%-2rem)]">
            {/* Right sidebar header matching other headers */}
            <div className="px-4 py-3 sm:py-4 border-b border-pink-500/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">
                    {t('characterInfo')}
                  </p>
                  <h2 className="text-base sm:text-lg font-semibold text-white truncate">
                    {character?.name}
                  </h2>
                </div>
              </div>
            </div>

            {/* Scrollable character content */}
            <div className="flex-1 overflow-y-auto">
            {/* Character Gallery */}
            <div className="relative p-4 flex-shrink-0">
              <CharacterGallery 
                characterId={character.id}
                className="mb-3"
              />
              <div className="flex justify-center space-x-2 mt-2">
                <button className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors">
                  <Heart className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors">
                  <Bookmark className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors">
                  <Share className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Character Info */}
            <div className="px-4 pb-4">
              <h3 className="font-semibold text-lg mb-3">{character?.name}</h3>
              
              {/* Description */}
              <div className="mb-4">
                <p className="text-sm text-gray-300 leading-relaxed">
                  {character?.description}
                </p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {character?.traits?.map((trait, index) => (
                  <span 
                    key={index}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-600 text-white"
                  >
                    {trait}
                  </span>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 border-t border-gray-700/50 pt-4">
                <Link href="/" className="block">
                  <button className="w-full bg-brand-accent hover:bg-indigo-500 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors shadow-surface">
                    {t('startNewChat')}
                  </button>
                </Link>
                <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors">
                  {t('chatSettings')}
                </button>
              </div>
            </div>
            </div>
            </div>
          )}
        </div>
      </div>
    </GlobalLayout>
    </>
  );
};

export default ChatPage;
