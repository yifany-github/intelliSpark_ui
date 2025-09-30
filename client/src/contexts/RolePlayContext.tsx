import { createContext, useContext, useState, ReactNode } from 'react';
import { Character, Chat, ChatMessage } from '../types';
import { apiRequest, queryClient } from '../lib/queryClient';

interface RolePlayContextType {
  // User Preferences
  memoryEnabled: boolean;
  setMemoryEnabled: (enabled: boolean) => void;
  nsfwEnabled: boolean;
  setNsfwEnabled: (enabled: boolean) => void;

  // Active Selections
  selectedCharacter: Character | null;
  setSelectedCharacter: (character: Character | null) => void;
  currentChat: Chat | null;
  setCurrentChat: (chat: Chat | null) => void;

  // Active Chat State
  isTyping: boolean;
  setIsTyping: (isTyping: boolean) => void;


  // Auth Modal State
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (isOpen: boolean) => void;
  pendingMessage: string | null;
  setPendingMessage: (message: string | null) => void;
  pendingChatAction: (() => Promise<string>) | null;
  setPendingChatAction: (action: (() => Promise<string>) | null) => void;

  // Start Chat Function
  startChat: (character: Character) => Promise<string>;
  startChatPreview: (character: Character) => void;
  requestAuthForMessage: (message: string, chatId?: string) => void;
}

const RolePlayContext = createContext<RolePlayContextType | undefined>(undefined);

export const RolePlayProvider = ({ children }: { children: ReactNode }) => {
  // User Preferences - persist NSFW state in localStorage
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [nsfwEnabled, setNsfwEnabledState] = useState(() => {
    try {
      const stored = localStorage.getItem('nsfw_enabled');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const setNsfwEnabled = (enabled: boolean) => {
    setNsfwEnabledState(enabled);
    try {
      localStorage.setItem('nsfw_enabled', String(enabled));
    } catch (error) {
      console.error('Failed to save NSFW preference:', error);
    }
  };

  // Active Selections
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);

  // Active Chat State
  const [isTyping, setIsTyping] = useState(false);

  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingChatAction, setPendingChatAction] = useState<(() => Promise<string>) | null>(null);
  
  // Start chat preview (without authentication) - sets up character context
  const startChatPreview = (character: Character) => {
    setSelectedCharacter(character);
    // Don't create actual chat yet - will be created when user sends first message
  };

  // Request authentication for sending message
  const requestAuthForMessage = (message: string, chatId?: string) => {
    const messageAction = async () => {
      if (!selectedCharacter) {
        throw new Error('No character selected');
      }
      
      let actualChatId = chatId;
      
      // Create chat if it doesn't exist yet
      if (!actualChatId) {
        actualChatId = await startChat(selectedCharacter);
      }
      
      // Send the pending message
      // This will be handled by the chat component after auth
      return actualChatId;
    };
    
    setPendingMessage(message);
    setPendingChatAction(() => messageAction);
    setIsAuthModalOpen(true);
  };

  // Start a new chat (only call this when authenticated)
  const startChat = async (character: Character): Promise<string> => {
    try {
      const response = await apiRequest('POST', '/api/chats', {
        characterId: character.id,
        title: `Chat with ${character.name}`,
      });
      
      const chat = await response.json();
      setCurrentChat(chat);
      
      // Invalidate chats query to refresh enriched chats list
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      
      // SECURITY: Always use UUID for privacy - no fallback to integer ID
      if (!chat.uuid || typeof chat.uuid !== 'string' || chat.uuid.length === 0) {
        throw new Error('Security error: Chat UUID is required but missing from API response');
      }
      return chat.uuid;
    } catch (error) {
      console.error('Error starting chat:', error);
      throw error;
    }
  };
  
  return (
    <RolePlayContext.Provider
      value={{
        memoryEnabled,
        setMemoryEnabled,
        nsfwEnabled,
        setNsfwEnabled,

        selectedCharacter,
        setSelectedCharacter,
        currentChat,
        setCurrentChat,

        isTyping,
        setIsTyping,

        isAuthModalOpen,
        setIsAuthModalOpen,
        pendingMessage,
        setPendingMessage,
        pendingChatAction,
        setPendingChatAction,

        startChat,
        startChatPreview,
        requestAuthForMessage,
      }}
    >
      {children}
    </RolePlayContext.Provider>
  );
};

export const useRolePlay = () => {
  const context = useContext(RolePlayContext);
  if (context === undefined) {
    throw new Error('useRolePlay must be used within a RolePlayProvider');
  }
  return context;
};
