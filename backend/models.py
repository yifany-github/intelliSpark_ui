from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, Numeric
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=True, index=True)  # nullable for existing users
    provider = Column(String(50), default='email')  # 'email', 'google', 'apple'
    firebase_uid = Column(String(255), unique=True, nullable=True)  # Firebase user ID
    nsfw_level = Column(Integer, default=1)
    context_window_length = Column(Integer, default=10)
    temperature = Column(Integer, default=70)
    memory_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    chats = relationship("Chat", back_populates="user")
    token_balance = relationship("UserToken", back_populates="user", uselist=False)
    token_transactions = relationship("TokenTransaction", back_populates="user")
    notifications = relationship("Notification", back_populates="user")

class Scene(Base):
    __tablename__ = "scenes"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=False)
    location = Column(String(255), nullable=False)
    mood = Column(String(255), nullable=False)
    rating = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    chats = relationship("Chat", back_populates="scene")

class Character(Base):
    __tablename__ = "characters"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)  # Short description
    avatar_url = Column(String(500), nullable=True)
    backstory = Column(Text, nullable=False)
    voice_style = Column(String(500), nullable=False)
    traits = Column(JSON, nullable=False)  # List of strings
    personality_traits = Column(JSON, nullable=False)  # Dict of trait: percentage
    category = Column(String(100), nullable=True)
    gender = Column(String(100), nullable=True)
    age = Column(String(100), nullable=True)
    occupation = Column(String(255), nullable=True)
    hobbies = Column(JSON, nullable=True)  # List of strings
    catchphrase = Column(String(500), nullable=True)
    conversation_style = Column(String(255), nullable=True)
    is_public = Column(Boolean, default=True)
    nsfw_level = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    chats = relationship("Chat", back_populates="character")
    creator = relationship("User", foreign_keys=[created_by])

class Chat(Base):
    __tablename__ = "chats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    scene_id = Column(Integer, ForeignKey("scenes.id"), nullable=False)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    title = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="chats")
    scene = relationship("Scene", back_populates="chats")
    character = relationship("Character", back_populates="chats")
    messages = relationship("ChatMessage", back_populates="chat")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    role = Column(String(50), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=func.now())
    
    # Relationships
    chat = relationship("Chat", back_populates="messages")

class UserToken(Base):
    __tablename__ = "user_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    balance = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="token_balance")

class TokenTransaction(Base):
    __tablename__ = "token_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    transaction_type = Column(String(50), nullable=False)  # 'purchase', 'deduction', 'refund'
    amount = Column(Integer, nullable=False)  # positive for purchase/refund, negative for deduction
    description = Column(String(500), nullable=True)
    stripe_payment_intent_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="token_transactions")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)  # 'system', 'payment', 'admin', 'achievement'
    priority = Column(String(20), default='normal')  # 'low', 'normal', 'high', 'urgent'
    is_read = Column(Boolean, default=False)
    action_type = Column(String(50), nullable=True)  # 'redirect', 'dismiss', 'acknowledge'
    action_data = Column(JSON, nullable=True)  # Additional data for actions
    meta_data = Column(JSON, nullable=True)  # Additional metadata
    expires_at = Column(DateTime, nullable=True)  # Optional expiration
    created_at = Column(DateTime, default=func.now())
    read_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="notifications")

class NotificationTemplate(Base):
    __tablename__ = "notification_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    title_template = Column(String(255), nullable=False)
    content_template = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)
    priority = Column(String(20), default='normal')
    action_type = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())