"""
AI Service for IntelliSpark AI Chat Application

This service provides a clean interface for AI integration with multi-model support.
It maintains backward compatibility while enabling advanced multi-model features.

Features:
- Multi-model AI integration (Gemini, Grok, future models)
- Intelligent model selection and fallback
- Character prompt enhancement
- Conversation generation with model optimization
- Error handling and retries
- Response formatting and validation
"""

from typing import Dict, Any, List, Optional
import json
import logging

# Import multi-model manager
from .ai_model_manager import get_ai_model_manager
from .gemini_service_new import GeminiService  # Simplified service (Issue #129)


class AIServiceError(Exception):
    """AI service specific errors"""
    pass


class AIService:
    """Enhanced AI service with multi-model support and backward compatibility"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._ai_manager = None
        self._fallback_service = None  # Fallback to old GeminiService if needed

    def log_opening_line_usage(
        self,
        *,
        character_id: Optional[int],
        character_name: Optional[str],
        chat_id: Optional[int],
        reused: bool,
    ) -> None:
        """Emit structured log for opening-line generation vs reuse."""

        status = "reused" if reused else "generated"
        self.logger.info(
            "analytics.opening_line.%s | character_id=%s chat_id=%s character_name=%s",
            status,
            character_id if character_id is not None else "unknown",
            chat_id if chat_id is not None else "unknown",
            character_name or "unknown",
        )
        
    async def _get_ai_manager(self):
        """Get initialized AI model manager"""
        if self._ai_manager is None:
            try:
                self._ai_manager = await get_ai_model_manager()
                self.logger.info("✅ AIService using multi-model manager")
            except Exception as e:
                self.logger.warning(f"⚠️ Failed to initialize AI manager, falling back to GeminiService: {e}")
                if self._fallback_service is None:
                    self._fallback_service = GeminiService()
        return self._ai_manager
    
    async def enhance_character_prompts(
        self,
        name: str,
        description: str,
        traits: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Enhance character with AI-generated prompts and conversation starters
        
        Args:
            name: Character name
            description: Character description
            traits: Character traits
            
        Returns:
            Dictionary with enhanced prompts and conversation starters
        """
        # TODO: Implement character enhancement
        # This will be implemented in Phase 2
        return {
            'enhanced_prompt': f"Enhanced prompt for {name}",
            'starters': [f"Hello, I'm {name}. How can I help you today?"]
        }
    
    async def generate_chat_response(
        self,
        character_name: str,
        character_prompt: str,
        conversation_history: List[Dict[str, Any]],
        user_message: str,
        user_preferences: Optional[Dict[str, Any]] = None,
        state: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Generate AI response for chat conversation
        
        Args:
            character_name: Name of the character responding
            character_prompt: Character's personality and behavior prompt
            conversation_history: Previous messages in the conversation
            user_message: Current user message to respond to
            user_preferences: User preferences (temperature, NSFW level, etc.)
            
        Returns:
            Dictionary with AI response and metadata
        """
        # TODO: Implement chat response generation using Gemini service
        # This will be implemented in Phase 2
        state_context = json.dumps(state, ensure_ascii=False) if state else None

        return {
            'response': f"[{character_name}]: This is a placeholder response.",
            'tokens_used': 1,
            'model': 'gemini-pro',
            'success': True,
            'state_context': state_context,
        }
    
    async def generate_opening_line(
        self,
        character_name: str,
        character_prompt: str
    ) -> str:
        """
        Generate opening line for new chat
        
        Args:
            character_name: Name of the character
            character_prompt: Character's personality and behavior prompt
            
        Returns:
            Generated opening line
        """
        # TODO: Implement opening line generation using Gemini service
        # This will be implemented in Phase 2
        return f"Hello! I'm {character_name}. How can I help you today?"
