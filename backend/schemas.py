from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

# Base schemas
class BaseSchema(BaseModel):
    class Config:
        from_attributes = True
        populate_by_name = True  # Allow using field aliases
        alias_generator = None  # Disable automatic alias generation
        by_alias = True  # Use aliases in serialization

# User schemas
class UserBase(BaseSchema):
    username: str
    email: Optional[str] = None
    provider: str = 'email'
    nsfw_level: int = 1
    context_window_length: int = 10
    temperature: int = 70
    memory_enabled: bool = True

class UserCreate(BaseSchema):
    username: str
    password: str

class User(UserBase):
    id: int
    created_at: datetime

# Authentication schemas
class UserLogin(BaseSchema):
    email: str
    password: str

class UserLoginLegacy(BaseSchema):
    username: str
    password: str

class UserRegister(BaseSchema):
    email: str
    password: str
    username: Optional[str] = None

class FirebaseAuthRequest(BaseSchema):
    firebase_token: str

class Token(BaseSchema):
    access_token: str
    token_type: str

class TokenData(BaseSchema):
    username: Optional[str] = None
    email: Optional[str] = None


# Character schemas  
class CharacterBase(BaseSchema):
    name: str
    description: Optional[str] = None
    avatarUrl: Optional[str] = Field(default=None, alias="avatar_url")  # Map database field to frontend field
    backstory: str
    voiceStyle: str = Field(alias="voice_style")  # Map database field to frontend field
    traits: List[str]
    personalityTraits: Dict[str, int] = Field(alias="personality_traits")  # Map database field to frontend field
    category: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[str] = None
    occupation: Optional[str] = None
    hobbies: Optional[List[str]] = None
    catchphrase: Optional[str] = None
    conversationStyle: Optional[str] = Field(default=None, alias="conversation_style")
    isPublic: bool = Field(default=True, alias="is_public")
    nsfwLevel: int = Field(default=0, alias="nsfw_level")

class CharacterCreate(CharacterBase):
    pass

class Character(CharacterBase):
    id: int
    createdBy: Optional[int] = Field(default=None, alias="created_by")
    createdAt: datetime = Field(alias="created_at")  # Map database field to frontend field

# Chat schemas
class ChatBase(BaseSchema):
    user_id: int
    character_id: int
    title: str

class ChatCreate(BaseSchema):
    characterId: int  # Frontend sends characterId, not character_id  
    title: str

class Chat(ChatBase):
    id: int
    created_at: datetime
    updated_at: datetime

# Enriched chat for API responses (includes character info)
class EnrichedChat(BaseSchema):
    id: int
    user_id: int
    character_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    character: Optional[Dict[str, Any]] = None

# Chat message schemas
class ChatMessageBase(BaseSchema):
    chat_id: int
    role: str = Field(..., description="Either 'user' or 'assistant'")
    content: str

class ChatMessageCreate(BaseSchema):
    role: str = Field(..., description="Either 'user' or 'assistant'")
    content: str

class ChatMessage(ChatMessageBase):
    id: int
    timestamp: datetime

# API response schemas
class MessageResponse(BaseSchema):
    message: str

class HealthResponse(BaseSchema):
    status: str

# Request schemas for generating AI responses
class GenerateRequest(BaseSchema):
    """Request body for generating AI responses"""
    pass  # No additional fields needed, we get context from chat_id

# Chat context for AI generation (internal use)
class ChatContext(BaseSchema):
    character: Character
    messages: List[ChatMessage]
    user_preferences: Optional[Dict[str, Any]] = None

# Token and Payment schemas
class UserTokenBalance(BaseSchema):
    user_id: int
    balance: int
    created_at: datetime
    updated_at: datetime

class TokenPurchaseRequest(BaseSchema):
    amount: int = Field(..., description="Number of tokens to purchase")
    tier: str = Field(..., description="Pricing tier (starter, standard, premium)")

class TokenPurchaseResponse(BaseSchema):
    client_secret: str
    payment_intent_id: str
    amount: int
    tokens: int

class TokenTransaction(BaseSchema):
    id: int
    user_id: int
    transaction_type: str
    amount: int
    description: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    created_at: datetime

# Notification schemas
class NotificationBase(BaseSchema):
    title: str
    content: str
    type: str = Field(..., description="Type of notification: system, payment, admin, achievement")
    priority: str = Field(default='normal', description="Priority: low, normal, high, urgent")
    action_type: Optional[str] = Field(default=None, description="Action type: redirect, dismiss, acknowledge")
    action_data: Optional[Dict[str, Any]] = None
    meta_data: Optional[Dict[str, Any]] = None
    expires_at: Optional[datetime] = None

class NotificationCreate(NotificationBase):
    user_id: int

class Notification(NotificationBase):
    id: int
    user_id: int
    is_read: bool = False
    created_at: datetime
    read_at: Optional[datetime] = None

class NotificationUpdate(BaseSchema):
    is_read: Optional[bool] = None
    read_at: Optional[datetime] = None

class NotificationStats(BaseSchema):
    total: int
    unread: int
    by_type: Dict[str, int]
    by_priority: Dict[str, int]

# Notification Template schemas
class NotificationTemplateBase(BaseSchema):
    name: str
    title_template: str
    content_template: str
    type: str
    priority: str = 'normal'
    action_type: Optional[str] = None
    is_active: bool = True

class NotificationTemplateCreate(NotificationTemplateBase):
    pass

class NotificationTemplate(NotificationTemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime

# Bulk notification schemas
class BulkNotificationCreate(BaseSchema):
    user_ids: List[int]
    template_name: str
    variables: Optional[Dict[str, Any]] = None

class AdminNotificationCreate(BaseSchema):
    title: str
    content: str
    user_ids: Optional[List[int]] = None  # If None, send to all users
    priority: str = 'normal'
    action_type: Optional[str] = None
    action_data: Optional[Dict[str, Any]] = None
    expires_at: Optional[datetime] = None