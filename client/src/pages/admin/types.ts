export interface AdminStats {
  totals: {
    users: number;
    characters: number;
    chats: number;
    messages: number;
  };
  recent_activity: {
    chats_last_30_days: number;
  };
  popular_content: {
    characters: { name: string; chat_count: number }[];
  };
}

export interface Character {
  id: number;
  name: string;
  description?: string;
  avatarUrl: string;
  backstory: string;
  personaPrompt?: string;
  voiceStyle: string;
  traits: string[];
  personalityTraits: { [key: string]: number };
  category?: string;
  categories?: string[];
  gender?: string;
  nsfwLevel?: number;
  age?: number;
  conversationStyle?: string;
  isPublic?: boolean;
  galleryEnabled?: boolean;
  createdAt: string;
  isFeatured?: boolean;
  viewCount?: number;
  likeCount?: number;
  chatCount?: number;
  trendingScore?: number;
  lastActivity?: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: number | null;
  deleteReason?: string | null;
  createdBy?: number | null;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  provider: string | null;
  memory_enabled: boolean;
  email_verified: boolean;
  created_at: string;
  last_login_at?: string | null;
  last_login_ip?: string | null;
  token_balance: number;
  total_chats: number;
  is_suspended: boolean;
  suspended_at?: string | null;
  suspension_reason?: string | null;
}

export interface AdminUsersResponse {
  data: AdminUser[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface AdminUserDetail extends AdminUser {
  recent_chats: Array<{
    id: number;
    uuid?: string | null;
    title: string;
    character_id: number;
    character_name?: string | null;
    created_at: string;
    updated_at: string;
  }>;
  recent_token_transactions: Array<{
    id: number;
    transaction_type: string;
    amount: number;
    description?: string | null;
    created_at: string;
  }>;
  unread_notifications: number;
}

export interface AdminChatDetail {
  chat: {
    id: number;
    uuid?: string | null;
    title: string;
    character_id: number;
    character_name?: string | null;
    created_at: string;
    updated_at: string;
  };
  character?: {
    id: number;
    name: string;
  } | null;
  messages: Array<{
    id: number;
    role: string;
    content: string;
    timestamp?: string | null;
  }>;
}

export interface AdminNotificationBatchSummary {
  batchId: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  targetScope: "all" | "specific";
  targetCount: number;
  deliveredCount: number;
  readCount: number;
  createdAt: string;
}

export interface AdminNotificationAnalytics {
  totalNotifications: number;
  totalAdminNotifications: number;
  adminLast7Days: number;
  activeUsers: number;
  recentBatches: AdminNotificationBatchSummary[];
}

export type AdminTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
};
