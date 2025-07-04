import { createContext, useContext, useState, ReactNode } from 'react';
import { Scene, Character, Chat, ChatMessage } from '../types';

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
  selectedScene: Scene | null;
  setSelectedScene: (scene: Scene | null) => void;
  selectedCharacter: Character | null;
  setSelectedCharacter: (character: Character | null) => void;
  currentChat: Chat | null;
  setCurrentChat: (chat: Chat | null) => void;
  
  // Active Chat State
  isTyping: boolean;
  setIsTyping: (isTyping: boolean) => void;
  
  // Preview Modal State
  isPreviewModalOpen: boolean;
  setIsPreviewModalOpen: (isOpen: boolean) => void;
  previewScene: Scene | null;
  setPreviewScene: (scene: Scene | null) => void;
  
  // Auth Modal State
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (isOpen: boolean) => void;
  pendingChatAction: (() => Promise<void>) | null;
  setPendingChatAction: (action: (() => Promise<void>) | null) => void;
  
  // Start Chat Function
  startChat: (scene: Scene, character: Character) => Promise<string>;
  requestAuthForChat: (scene: Scene, character: Character) => void;
}

const RolePlayContext = createContext<RolePlayContextType | undefined>(undefined);

export const RolePlayProvider = ({ children }: { children: ReactNode }) => {
  // User Preferences
  const [nsfwLevel, setNsfwLevel] = useState(1);
  const [contextWindowLength, setContextWindowLength] = useState(10);
  const [temperature, setTemperature] = useState(70);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  
  // Active Selections
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  
  // Active Chat State
  const [isTyping, setIsTyping] = useState(false);
  
  // Preview Modal State
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewScene, setPreviewScene] = useState<Scene | null>(null);
  
  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingChatAction, setPendingChatAction] = useState<(() => Promise<void>) | null>(null);
  
  // Request authentication for chat - shows auth modal
  const requestAuthForChat = (scene: Scene, character: Character) => {
    const chatAction = async () => {
      // This will be called after successful authentication
      const chatId = await startChat(scene, character);
      // The navigation will be handled by the component that called requestAuthForChat
      return chatId;
    };
    
    setPendingChatAction(() => chatAction);
    setIsAuthModalOpen(true);
  };

  // Start a new chat (only call this when authenticated)
  const startChat = async (scene: Scene, character: Character): Promise<string> => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const response = await fetch(`${API_BASE_URL}/api/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sceneId: scene.id,
          characterId: character.id,
          title: `${character.name} in ${scene.name}`,
        }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create chat');
      }
      
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
        
        selectedScene,
        setSelectedScene,
        selectedCharacter,
        setSelectedCharacter,
        currentChat,
        setCurrentChat,
        
        isTyping,
        setIsTyping,
        
        isPreviewModalOpen,
        setIsPreviewModalOpen,
        previewScene,
        setPreviewScene,
        
        isAuthModalOpen,
        setIsAuthModalOpen,
        pendingChatAction,
        setPendingChatAction,
        
        startChat,
        requestAuthForChat,
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
