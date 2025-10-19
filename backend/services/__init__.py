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

__all__ = [
    "CharacterService",
    "ChatService",
    "MessageService",
    "UploadService",
    "AIService",
    "CircuitBreaker",
    "log_chat_generation_attempt",
]


def __getattr__(name):
    if name == "CharacterService":
        from .character_service import CharacterService
        return CharacterService
    if name == "ChatService":
        from .chat_service import ChatService
        return ChatService
    if name == "MessageService":
        from .message_service import MessageService
        return MessageService
    if name == "UploadService":
        from .upload_service import UploadService
        return UploadService
    if name == "AIService":
        from .ai_service import AIService
        return AIService
    if name == "CircuitBreaker":
        from .circuit_breaker import CircuitBreaker
        return CircuitBreaker
    if name == "log_chat_generation_attempt":
        from .telemetry import log_chat_generation_attempt
        return log_chat_generation_attempt
    raise AttributeError(f"module 'backend.services' has no attribute {name}")
