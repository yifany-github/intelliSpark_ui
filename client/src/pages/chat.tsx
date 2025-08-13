import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Chat, ChatMessage, Character, EnrichedChat } from "../types";
import ChatBubble from "@/components/chats/ChatBubble";
import ChatInput from "@/components/chats/ChatInput";
import TypingIndicator from "@/components/ui/TypingIndicator";
import { apiRequest } from "@/lib/queryClient";
import { useRolePlay } from "@/contexts/RolePlayContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { invalidateTokenBalance } from "@/services/tokenService";
import { queryClient } from "@/lib/queryClient";
import { ChevronLeft, MoreVertical, Menu, X, Heart, Star, Share, Bookmark, ArrowLeft } from "lucide-react";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { ImprovedTokenBalance } from "@/components/payment/ImprovedTokenBalance";
import GlobalLayout from "@/components/layout/GlobalLayout";

interface ChatPageProps {
  chatId?: string;
}

const ChatPage = ({ chatId }: ChatPageProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isTyping, setIsTyping } = useRolePlay();
  const { t } = useLanguage();
  const { navigateBack } = useNavigation();
  const [showChatList, setShowChatList] = useState(false);
  const [showCharacterInfo, setShowCharacterInfo] = useState(false);
  
  // If no chatId is provided, show chat list
  const showChatListOnly = !chatId;
  
  // Fetch chat details if chatId is provided
  const {
    data: chat,
    isLoading: isLoadingChat,
    error: chatError
  } = useQuery<Chat>({
    queryKey: [`/api/chats/${chatId}`],
    enabled: !!chatId,
  });
  
  // Fetch all chats for the chat list
  const {
    data: chats = [],
    isLoading: isLoadingChats
  } = useQuery<EnrichedChat[]>({
    queryKey: ["/api/chats"],
  });
  
  // Fetch chat messages if chatId is provided
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    error: messagesError
  } = useQuery<ChatMessage[]>({
    queryKey: [`/api/chats/${chatId}/messages`],
    enabled: !!chatId,
  });
  
  // Get character data from the enriched chats list instead of separate API call
  const character = chats.find(c => c.id === parseInt(chatId || '0'))?.character;
  const isLoadingCharacter = isLoadingChats;
  
  // Mutation for sending messages
  const { mutate: sendMessage, isPending: isSending } = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest(
        "POST",
        `/api/chats/${chatId}/messages`,
        { content, role: "user" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}/messages`] });
      setIsTyping(true);
      
      // Generate AI response after a delay
      setTimeout(() => {
        aiResponse();
      }, 1000);
    },
    onError: (error: any) => {
      console.error("Message sending failed:", error);
      const errorMessage = error?.response?.data?.detail || "Failed to send message";
      
      // Add error message to chat
      queryClient.setQueryData([`/api/chats/${chatId}/messages`], (old: ChatMessage[] | undefined) => {
        if (!old) return old;
        
        const errorMsg: ChatMessage = {
          id: Date.now(), // temporary ID
          content: `Error: ${errorMessage}`,
          role: "system",
          chatId: parseInt(chatId || "0"),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        return [...old, errorMsg];
      });
    },
  });
  
  // Mutation for AI responses
  const { mutate: aiResponse } = useMutation({
    mutationFn: async () => {
      return apiRequest(
        "POST",
        `/api/chats/${chatId}/generate`,
        {}
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}/messages`] });
      setIsTyping(false);
      
      // Invalidate token balance after AI response generation
      invalidateTokenBalance();
    },
    onError: (error: any) => {
      console.error("AI response generation failed:", error);
      setIsTyping(false);
      
      // Show error message to user
      const errorMessage = error?.response?.data?.detail || "Failed to generate AI response";
      
      // Add error message to chat
      queryClient.setQueryData([`/api/chats/${chatId}/messages`], (old: ChatMessage[] | undefined) => {
        if (!old) return old;
        
        const errorMsg: ChatMessage = {
          id: Date.now(), // temporary ID
          content: `Error: ${errorMessage}`,
          role: "system",
          chatId: parseInt(chatId || "0"),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        return [...old, errorMsg];
      });
    },
  });
  
  // Regenerate the last AI message
  const regenerateLastMessage = () => {
    setIsTyping(true);
    aiResponse();
  };
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);
  
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
          <div className="space-y-3">
            {chats.map((chat: EnrichedChat) => (
              <Link 
                key={chat.id} 
                href={`/chat/${chat.id}`}
                className="block bg-secondary hover:bg-secondary/80 rounded-2xl p-4 transition-colors"
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
                      <h3 className="font-medium">{chat.title}</h3>
                      <p className="text-sm text-gray-400">
                        {chat.character?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {chat.updatedAt ? new Date(chat.updatedAt).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-400">
                    {chat.updatedAt ? new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        </div>
      </GlobalLayout>
    );
  }
  
  // If we're showing a specific chat
  return (
    <GlobalLayout showSidebar={false}>
      <div className="h-screen bg-gray-900 text-white flex relative">
        {/* Mobile overlay */}
        {showChatList && (
          <div 
            className="fixed inset-0 bg-black/50 z-5 lg:hidden" 
            onClick={() => setShowChatList(false)}
          />
        )}
        
        {/* Left Sidebar - Recent Chats */}
        <div className={`${showChatList ? 'flex' : 'hidden'} lg:flex w-full lg:w-64 bg-gray-800 border-r border-gray-700 flex-shrink-0 flex-col absolute lg:relative z-10 h-full lg:h-auto`}>
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">{t('chats')}</h2>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={navigateBack}
                  className="hidden lg:block p-1 hover:bg-gray-700 rounded transition-colors"
                  title="Back to previous page"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setShowChatList(false)}
                  className="lg:hidden p-1 hover:bg-gray-700 rounded transition-colors"
                  title="Close chat list"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {/* Current Active Chat */}
            {character && (
              <div className="p-3 bg-brand-accent/20 border-l-4 border-brand-accent">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <ImageWithFallback
                      src={character?.avatarUrl}
                      alt={character?.name}
                      fallbackText={character?.name}
                      size="md"
                      showSpinner={true}
                      className="w-10 h-10"
                    />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-blue-200 truncate">{character?.name}</p>
                    <p className="text-sm text-blue-300 truncate">{t('currentlyChatting')}</p>
                  </div>
                  <div className="w-2 h-2 bg-brand-accent rounded-full animate-pulse"></div>
                </div>
              </div>
            )}
            
            {/* Other Chats */}
            <div className="p-4">
              <h3 className="text-sm text-gray-400 mb-3">{t('recentConversations')}</h3>
              <div className="space-y-2">
                {chats.filter(c => c.id !== parseInt(chatId || '0')).map((chat) => (
                  <Link 
                    key={chat.id} 
                    href={`/chat/${chat.id}`}
                    className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <ImageWithFallback
                      src={chat.character?.avatarUrl}
                      alt={chat.character?.name || "Character"}
                      fallbackText={chat.character?.name || "?"}
                      size="sm"
                      showSpinner={true}
                      className="w-8 h-8"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{chat.character?.name}</p>
                      <p className="text-xs text-gray-400 truncate">{chat.title}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {chat.updatedAt ? new Date(chat.updatedAt).toLocaleDateString() : ''}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Header */}
          <div className="bg-gray-800 border-b border-gray-700 p-2 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                {/* Back button for mobile */}
                <button 
                  onClick={navigateBack}
                  className="lg:hidden p-1 hover:bg-gray-700 rounded transition-colors"
                  title="Back to previous page"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                
                {/* Mobile menu button */}
                <button 
                  onClick={() => setShowChatList(!showChatList)}
                  className="lg:hidden p-1 hover:bg-gray-700 rounded transition-colors"
                >
                  {showChatList ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
                
                {character && (
                  <ImageWithFallback
                    src={character?.avatarUrl}
                    alt={character?.name}
                    fallbackText={character?.name}
                    size="md"
                    showSpinner={true}
                    className="w-8 h-8 sm:w-10 sm:h-10"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="font-semibold truncate">
                    {isLoadingCharacter ? t('loading') : character?.name}
                  </h1>
                  <div className="flex items-center text-xs text-gray-400">
                    <ImprovedTokenBalance compact={true} showTitle={false} />
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                <button 
                  onClick={() => setShowCharacterInfo(!showCharacterInfo)}
                  className="xl:hidden p-2 hover:bg-gray-700 rounded transition-colors"
                  title={t('characterInfo')}
                >
                  <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoadingMessages ? (
              <div className="text-center py-4">
                <p className="text-gray-400">{t('loadingMessages')}</p>
              </div>
            ) : messagesError ? (
              <div className="text-center py-4">
                <p className="text-red-500">{t('errorLoading')}</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">{t('noMessagesYet')}</p>
              </div>
            ) : (
              messages.map(message => (
                <ChatBubble 
                  key={message.id} 
                  message={message} 
                  avatarUrl={character?.avatarUrl}
                  onRegenerate={message.role === 'assistant' ? regenerateLastMessage : undefined}
                />
              ))
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
          <ChatInput onSendMessage={sendMessage} isLoading={isSending || isTyping} />
        </div>

        {/* Character Info Modal for mobile/tablet */}
        {showCharacterInfo && character && (
          <div className="fixed inset-0 bg-black/50 z-20 xl:hidden flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">{t('characterInfo')}</h3>
                <button 
                  onClick={() => setShowCharacterInfo(false)}
                  className="p-1 hover:bg-gray-700 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <div className="text-center mb-4">
                  <ImageWithFallback
                    src={character?.avatarUrl}
                    alt={character?.name}
                    fallbackText={character?.name}
                    size="lg"
                    showSpinner={true}
                    className="w-32 h-48 mx-auto mb-3"
                  />
                  <h4 className="font-semibold text-lg mb-2">{character?.name}</h4>
                  <p className="text-sm text-gray-300 mb-4">{character?.backstory}</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {character?.traits?.map((trait, index) => (
                      <span 
                        key={index}
                        className="px-2 py-1 rounded-full text-xs font-medium bg-gray-600 text-white"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Sidebar - Character Info */}
        {character && (
          <div className="w-full lg:w-80 bg-gray-800 border-l border-gray-700 flex-shrink-0 hidden xl:flex xl:flex-col">
            {/* Character Image */}
            <div className="relative">
              <ImageWithFallback
                src={character?.avatarUrl}
                alt={character?.name}
                fallbackText={character?.name}
                size="lg"
                showSpinner={true}
                className="w-full h-96 object-cover"
              />
              <div className="absolute top-4 right-4 flex space-x-2">
                <button className="p-2 bg-black/50 hover:bg-black/70 rounded-full">
                  <Heart className="w-4 h-4" />
                </button>
                <button className="p-2 bg-black/50 hover:bg-black/70 rounded-full">
                  <Bookmark className="w-4 h-4" />
                </button>
                <button className="p-2 bg-black/50 hover:bg-black/70 rounded-full">
                  <Share className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Character Info */}
            <div className="flex-1 p-4">
              <h3 className="font-semibold text-lg mb-2">{character?.name}</h3>
              
              {/* Description */}
              <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                {character?.backstory}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {character?.traits?.map((trait, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-gray-600 text-white"
                  >
                    {trait}
                  </span>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Link href="/" className="block">
                  <button className="w-full bg-brand-accent hover:bg-indigo-500 text-white py-2 px-4 rounded-lg font-medium transition-colors shadow-surface">
                    {t('startNewChat')}
                  </button>
                </Link>
                <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors">
                  {t('chatSettings')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </GlobalLayout>
  );
};

export default ChatPage;