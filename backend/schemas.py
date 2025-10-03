from pydantic import BaseModel, Field, validator
import bleach
from typing import List, Dict, Optional, Any, Union
from datetime import datetime
from uuid import UUID

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
    memory_enabled: bool = True
    is_admin: bool = False

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
    personaPrompt: Optional[str] = Field(default=None, alias="persona_prompt", description="Optional persona prompt that overrides backstory for LLM")
    voiceStyle: str = Field(alias="voice_style")  # Map database field to frontend field
    traits: List[str]
    personalityTraits: Optional[Dict[str, int]] = Field(default=None, alias="personality_traits")  # Optional for backward compatibility
    category: Optional[str] = None  # 保持向后兼容
    categories: Optional[List[str]] = Field(default=None, description="多个分类标签")  # 新增：多分类标签
    gender: Optional[str] = None
    nsfwLevel: Optional[int] = Field(default=None, ge=0, le=3, description="NSFW level from 0-3")
    age: Optional[int] = Field(None, ge=1, le=200, description="Character age (1-200)")
    conversationStyle: Optional[str] = Field(default=None, alias="conversation_style")
    isPublic: bool = Field(default=True, alias="is_public")

    # Sanitize persona/backstory to prevent XSS if rendered by clients
    @validator('backstory', pre=True)
    def sanitize_backstory(cls, v):
        if v is None:
            return v
        # Strip all HTML tags for safety
        return bleach.clean(v, tags=[], strip=True).strip()

    @validator('personaPrompt', pre=True)
    def sanitize_persona(cls, v):
        if v is None:
            return v
        return bleach.clean(v, tags=[], strip=True).strip()

class CharacterCreate(CharacterBase):
    pass

class CharacterUpdate(BaseSchema):
    """Schema for user character updates (owner or admin only)"""
    name: Optional[str] = None
    description: Optional[str] = None
    avatarUrl: Optional[str] = Field(default=None, alias="avatar_url")
    backstory: Optional[str] = None
    personaPrompt: Optional[str] = Field(default=None, alias="persona_prompt")
    voiceStyle: Optional[str] = Field(default=None, alias="voice_style")
    traits: Optional[List[str]] = None
    category: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = Field(None, ge=1, le=200, description="Character age (1-200)")
    nsfwLevel: Optional[int] = Field(default=None, ge=0, le=1, description="NSFW level (0 or 1 only)")
    conversationStyle: Optional[str] = Field(default=None, alias="conversation_style")
    isPublic: Optional[bool] = Field(default=None, alias="is_public")
    
    # Sanitize and validate string fields
    @validator('name', 'description', 'backstory', 'personaPrompt', 'voiceStyle', 'category', 'gender', 'conversationStyle', pre=True)
    def sanitize_string_fields(cls, v):
        if v is not None:
            # Strip HTML and clean input for security
            sanitized = bleach.clean(str(v), tags=[], strip=True).strip()
            return sanitized if sanitized else None
        return v
    
    # Validate description length
    @validator('description')
    def validate_description(cls, v):
        if v is not None and len(v.strip()) < 10:
            raise ValueError("Description must be at least 10 characters")
        return v
    
    # Validate persona prompt length
    @validator('personaPrompt')
    def validate_persona_prompt(cls, v):
        if v is not None and len(v) > 5000:
            raise ValueError("Persona prompt must be 5000 characters or less")
        return v

class CharacterAdminUpdate(BaseSchema):
    """Schema for admin-only character updates"""
    isFeatured: Optional[bool] = Field(default=None, alias="is_featured")
    viewCount: Optional[int] = Field(default=None, alias="view_count") 
    likeCount: Optional[int] = Field(default=None, alias="like_count")
    chatCount: Optional[int] = Field(default=None, alias="chat_count")
    trendingScore: Optional[float] = Field(default=None, alias="trending_score")
    isPublic: Optional[bool] = Field(default=None, alias="is_public")

class Character(CharacterBase):
    id: int
    createdBy: Optional[int] = Field(default=None, alias="created_by")
    createdAt: datetime = Field(alias="created_at")  # Map database field to frontend field
    
    # Admin management and analytics fields
    isFeatured: bool = Field(default=False, alias="is_featured")
    viewCount: int = Field(default=0, alias="view_count")
    likeCount: int = Field(default=0, alias="like_count")
    chatCount: int = Field(default=0, alias="chat_count")
    trendingScore: float = Field(default=0.0, alias="trending_score")
    lastActivity: Optional[datetime] = Field(default=None, alias="last_activity")
    
    # Soft delete fields (Issue #162)
    isDeleted: Optional[bool] = Field(default=False, alias="is_deleted")
    deletedAt: Optional[datetime] = Field(default=None, alias="deleted_at")
    deletedBy: Optional[int] = Field(default=None, alias="deleted_by")
    deleteReason: Optional[str] = Field(default=None, alias="delete_reason")

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
    uuid: Optional[UUID] = None  # UUID field for new security model
    created_at: datetime
    updated_at: datetime

# Enriched chat for API responses (includes character info)
class EnrichedChat(BaseSchema):
    id: int
    uuid: Optional[UUID] = None  # UUID field for new security model
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
    content: str = Field(..., max_length=10000, description="Message content, max 10KB")
    
    @validator('content')
    def validate_and_sanitize_content(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Message content cannot be empty')
        
        # Sanitize content to prevent XSS attacks
        # Allow basic markdown formatting but strip dangerous HTML
        allowed_tags = []  # No HTML tags allowed for security
        sanitized = bleach.clean(v, tags=allowed_tags, strip=True)
        
        # Check byte size after sanitization
        if len(sanitized.encode('utf-8')) > 10000:  # Check byte size for UTF-8
            raise ValueError('Message content exceeds 10KB limit')
            
        return sanitized.strip()

class ChatMessage(ChatMessageBase):
    id: int
    uuid: Optional[UUID] = None  # UUID field for new security model
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
    payment_method: str = Field(default="card", description="Stripe payment method type: card, wechat_pay, alipay")
    return_url: Optional[str] = Field(default=None, description="Optional return URL for redirect-based payments like Alipay")
    save_payment_method: Optional[bool] = Field(default=True, description="Save payment method for future use (card only)")


class SavedPaymentMethod(BaseSchema):
    id: str
    brand: str
    last4: str
    exp_month: int
    exp_year: int
    is_default: bool = False

class TokenPurchaseResponse(BaseSchema):
    client_secret: str
    payment_intent_id: str
    amount: int
    tokens: int
    currency: str
    payment_method: str
    next_action: Optional[Dict[str, Any]] = None

class TokenTransaction(BaseSchema):
    id: int
    user_id: int
    transaction_type: str
    amount: int
    description: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime


# Subscription schemas
class SubscriptionPlan(BaseSchema):
    name: str
    monthly_tokens: int
    price: int
    price_cny: Optional[int] = None
    fx_rate: Optional[float] = None
    description: str
    stripe_price_id: Optional[str] = None


class CreateSubscriptionRequest(BaseSchema):
    tier: str = Field(..., description="Subscription tier: basic, pro, premium")
    price_id: str = Field(..., description="Stripe Price ID for the subscription")


class CreateSubscriptionResponse(BaseSchema):
    client_secret: Optional[str] = None
    subscription_id: str
    status: str


class SubscriptionInfo(BaseSchema):
    id: int
    plan_tier: str
    status: str
    monthly_token_allowance: int
    tokens_allocated_this_period: int
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool


class UserSubscriptionResponse(BaseSchema):
    has_subscription: bool
    subscription: Optional[SubscriptionInfo] = None


class CancelSubscriptionRequest(BaseSchema):
    cancel_immediately: bool = Field(default=False, description="Cancel immediately vs at period end")


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
