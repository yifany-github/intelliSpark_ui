import { createContext, useContext, useState, ReactNode } from 'react';
import { Scene, Character, Chat, ChatMessage } from '@shared/schema';

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
  
  // Start Chat Function
  startChat: (scene: Scene, character: Character) => Promise<string>;
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
  
  // Start a new chat
  const startChat = async (scene: Scene, character: Character): Promise<string> => {
    try {
      const response = await fetch('/api/chats', {
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
        
        startChat,
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
