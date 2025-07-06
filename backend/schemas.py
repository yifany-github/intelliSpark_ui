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

# Scene schemas
class SceneBase(BaseSchema):
    name: str
    description: str
    imageUrl: str = Field(alias="image_url")  # Map database field to frontend field
    location: str
    mood: str
    rating: str

class SceneCreate(SceneBase):
    pass

class Scene(SceneBase):
    id: int
    createdAt: datetime = Field(alias="created_at")  # Map database field to frontend field

# Character schemas  
class CharacterBase(BaseSchema):
    name: str
    avatarUrl: str = Field(alias="avatar_url")  # Map database field to frontend field
    backstory: str
    voiceStyle: str = Field(alias="voice_style")  # Map database field to frontend field
    traits: List[str]
    personalityTraits: Dict[str, int] = Field(alias="personality_traits")  # Map database field to frontend field

class CharacterCreate(CharacterBase):
    pass

class Character(CharacterBase):
    id: int
    createdAt: datetime = Field(alias="created_at")  # Map database field to frontend field

# Chat schemas
class ChatBase(BaseSchema):
    user_id: int
    scene_id: int
    character_id: int
    title: str

class ChatCreate(BaseSchema):
    sceneId: int  # Frontend sends sceneId, not scene_id
    characterId: int  # Frontend sends characterId, not character_id  
    title: str

class Chat(ChatBase):
    id: int
    created_at: datetime
    updated_at: datetime

# Enriched chat for API responses (includes character and scene info)
class EnrichedChat(BaseSchema):
    id: int
    user_id: int
    scene_id: int
    character_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    character: Optional[Dict[str, Any]] = None
    scene: Optional[Dict[str, Any]] = None

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
    scene: Scene
    messages: List[ChatMessage]
    user_preferences: Optional[Dict[str, Any]] = None