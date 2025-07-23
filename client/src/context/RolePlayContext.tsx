import { createContext, useContext, useState, ReactNode } from 'react';
import { Character, Chat, ChatMessage } from '../types';
import { apiRequest } from '../lib/queryClient';

interface RolePlayContextType {
  // User Preferences
  nsfwLevel: number;
  setNsfwLevel: (level: number) => void;
  contextWindowLength: number;
  setContextWindowLength: (length: number) => void;
  temperature: number;
  setTemperature: (temp: number) => void;
  memoryEnabled: boolean;
  setMemoryEnabled: (enabled: boolean) => void;
  
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
  // User Preferences
  const [nsfwLevel, setNsfwLevel] = useState(1);
  const [contextWindowLength, setContextWindowLength] = useState(10);
  const [temperature, setTemperature] = useState(70);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  
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
      return chat.id;
    } catch (error) {
      console.error('Error starting chat:', error);
      throw error;
    }
  };
  
  return (
    <RolePlayContext.Provider
      value={{
        nsfwLevel,
        setNsfwLevel,
        contextWindowLength,
        setContextWindowLength,
        temperature,
        setTemperature,
        memoryEnabled,
        setMemoryEnabled,
        
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
