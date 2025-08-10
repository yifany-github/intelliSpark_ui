"""
Service Layer for IntelliSpark AI Chat Application

This package contains business logic services that handle domain-specific operations,
separated from HTTP routing concerns to improve testability and maintainability.

Services:
- CharacterService: Character management and AI enhancement
- ChatService: Chat creation, management, and AI response generation  
- MessageService: Message handling and conversation management
- UploadService: File upload processing and security validation
- AIService: AI integration wrapper for Gemini service
"""

from .character_service import CharacterService
from .chat_service import ChatService
from .message_service import MessageService
from .upload_service import UploadService
from .ai_service import AIService

__all__ = [
    "CharacterService",
    "ChatService", 
    "MessageService",
    "UploadService",
    "AIService"
]