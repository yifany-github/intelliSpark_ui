// Frontend types to replace @shared/schema imports

export interface User {
  id: number;
  username: string;
  email?: string;
  memory_enabled: boolean;
  created_at: string;
}


export interface Character {
  id: number;
  name: string;
  avatarUrl: string;
  image?: string;
  backstory: string;
  description?: string;
  voiceStyle: string;
  traits: string[];
  gender?: string;
  category?: string;
  createdAt: string;
  // Admin management and analytics fields
  isFeatured?: boolean;
  viewCount?: number;
  likeCount?: number;
  chatCount?: number;
  trendingScore?: number;
  lastActivity?: string;
}

export interface Chat {
  id: number;
  userId: number;
  characterId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: number;
  chatId: number;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  createdAt: string;
  updatedAt: string;
}

// Enriched chat type with character data
export interface EnrichedChat extends Chat {
  character: {
    id: number;
    name: string;
    avatarUrl: string;
  } | null;
}