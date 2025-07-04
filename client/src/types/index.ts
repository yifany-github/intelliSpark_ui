// Frontend types to replace @shared/schema imports

export interface User {
  id: number;
  username: string;
  nsfw_level: number;
  context_window_length: number;
  temperature: number;
  memory_enabled: boolean;
  created_at: string;
}

export interface Scene {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  location: string;
  mood: string;
  rating: string;
  createdAt: string;
}

export interface Character {
  id: number;
  name: string;
  avatarUrl: string;
  backstory: string;
  voiceStyle: string;
  traits: string[];
  personalityTraits: Record<string, number>;
  createdAt: string;
}

export interface Chat {
  id: number;
  userId: number;
  sceneId: number;
  characterId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: number;
  chatId: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// Enriched chat type with character and scene data
export interface EnrichedChat extends Chat {
  character: {
    id: number;
    name: string;
    avatarUrl: string;
  } | null;
  scene: {
    id: number;
    name: string;
  } | null;
}