import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute, Link } from "wouter";
import { Chat, ChatMessage, Character, EnrichedChat } from "../types";
import ChatBubble from "@/components/chats/ChatBubble";
import ChatInput from "@/components/chats/ChatInput";
import TypingIndicator from "@/components/ui/TypingIndicator";
import { apiRequest } from "@/lib/queryClient";
import { useRolePlay } from "@/contexts/RolePlayContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryClient } from "@/lib/queryClient";
import { invalidateTokenBalance } from "@/services/tokenService";
import { ChevronLeft, MoreVertical } from "lucide-react";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { ImprovedTokenBalance } from "@/components/payment/ImprovedTokenBalance";
import GlobalLayout from "@/components/layout/GlobalLayout";

interface ChatsPageProps {
  chatId?: string;
}

const ChatsPage = ({ chatId }: ChatsPageProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isTyping, setIsTyping } = useRolePlay();
  const { t } = useLanguage();
  const [_, navigate] = useLocation();
  
  // If no chatId is provided, show chat list
  const showChatList = !chatId;
  
  // Fetch chat details if chatId is provided
  const {
    data: chat,
    isLoading: isLoadingChat,
    error: chatError
  } = useQuery<Chat>({
    queryKey: [`/api/chats/${chatId}`],
    enabled: !!chatId,
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
  
  // Fetch character details for the chat
  const {
    data: character,
    isLoading: isLoadingCharacter
  } = useQuery<Character>({
    queryKey: [`/api/characters/${chat?.characterId}`],
    enabled: !!chat?.characterId,
  });
  
  
  // Fetch all chats for the chat list
  const {
    data: chats = [],
    isLoading: isLoadingChats
  } = useQuery<EnrichedChat[]>({
    queryKey: ["/api/chats"],
    enabled: showChatList,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}/messages`] });
      setIsTyping(true);
      
      // Simulate AI response after a delay
      // This would be replaced by the actual streaming response from the API
      setTimeout(() => {
        aiResponse();
      }, 1000);
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
    onError: () => {
      setIsTyping(false);
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
    if (showChatList) {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    }
  }, [showChatList]);
  
  // If we're showing the chat list
  if (showChatList) {
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
            <Link href="/characters">
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
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="px-4 pt-4 pb-3 border-b border-secondary sticky top-0 bg-background z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button 
              className="mr-3 text-gray-400"
              onClick={() => navigate("/chats")}
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
          <button className="w-8 h-8 flex items-center justify-center text-gray-400">
            <MoreVertical className="h-5 w-5" />
          </button>
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
  );
};

export default ChatsPage;
