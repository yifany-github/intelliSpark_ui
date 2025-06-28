from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
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
    nsfw_level = Column(Integer, default=1)
    context_window_length = Column(Integer, default=10)
    temperature = Column(Integer, default=70)
    memory_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    chats = relationship("Chat", back_populates="user")

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
    avatar_url = Column(String(500), nullable=False)
    backstory = Column(Text, nullable=False)
    voice_style = Column(String(500), nullable=False)
    traits = Column(JSON, nullable=False)  # List of strings
    personality_traits = Column(JSON, nullable=False)  # Dict of trait: percentage
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    chats = relationship("Chat", back_populates="character")

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