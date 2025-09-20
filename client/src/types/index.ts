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
  personaPrompt?: string;
  description?: string;
  voiceStyle: string;
  traits: string[];
  personalityTraits?: { [key: string]: number };
  gender?: string;
  category?: string;
  categories?: string[];  // Multi-category tags from Issue #146
  age?: number;           // Age field from Issue #146
  nsfwLevel?: number;     // NSFW level from Issue #146
  conversationStyle?: string;  // Conversation style from Issue #146
  isPublic?: boolean;     // Public/private toggle from Issue #146
  galleryEnabled?: boolean; // Gallery feature toggle from Issue #146
  createdBy?: number;     // User ID of character creator (for ownership checks)
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
  character_id?: number; // Legacy field from backend responses
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

export interface StoryRole {
  id: string;
  name: string;
  traits: string[];
  inventory: string[];
}

export interface StoryMetadata {
  id: string;
  title: string;
  locale?: string;
  startScene: string;
  summary?: string;
  coverImage?: string;
  roles: StoryRole[];
}

export interface StorySession {
  id: string;
  storyId: string;
  userRole?: string;
  state: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  choices: StoryChoice[];
}

export interface StoryTurnResponse {
  state: Record<string, any>;
  narration?: string;
  actionsLog: Record<string, any>[];
  choices: StoryChoice[];
}

export interface StoryChoice {
  id: string;
  prompt: string;
  goto?: string | null;
}
