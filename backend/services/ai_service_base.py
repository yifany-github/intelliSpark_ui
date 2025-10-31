"""
Abstract Base Class for AI Services

This module defines the common interface that all AI services must implement.
It ensures consistency across different AI providers while maintaining flexibility.

Supported AI Models:
- Gemini (Google) - Primary model with advanced caching
- Grok (xAI) - Alternative model for diversity and reliability

Design Principles:
- Abstract interface for easy extension
- Consistent error handling across all providers  
- Unified token counting and usage tracking
- Character prompt compatibility across models
- Graceful fallbacks when services are unavailable
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple
from models import Character, ChatMessage
import logging

logger = logging.getLogger(__name__)

class AIServiceError(Exception):
    """Base exception for AI service errors"""
    pass

class AIServiceBase(ABC):
    """Abstract base class for all AI services"""
    
    def __init__(self, model_name: str, api_key: Optional[str] = None):
        """
        Initialize AI service
        
        Args:
            model_name: Name of the AI model (e.g., 'gemini-2.0-flash-001', 'grok-3-mini')
            api_key: API key for the service
        """
        self.model_name = model_name
        self.api_key = api_key
        self.client = None
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @abstractmethod
    async def initialize(self) -> bool:
        """
        Initialize the AI service client
        
        Returns:
            bool: True if initialization successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def generate_response(
        self,
        character: Character,
        messages: List[ChatMessage],
        user_preferences: Optional[dict] = None,
        state: Optional[Dict[str, str]] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generate AI response for conversation
        
        Args:
            character: Character to roleplay as
            messages: Conversation history
            user_preferences: User settings (temperature, nsfw_level, etc.)
            state: Persisted character state for continuity (optional)
            
        Returns:
            Tuple[str, Dict]: (response_text, token_info)
            
        Raises:
            AIServiceError: If generation fails
        """
        pass
    
    @abstractmethod
    async def generate_opening_line(self, character: Character) -> str:
        """
        Generate opening line for character
        
        Args:
            character: Character to generate opening line for
            
        Returns:
            str: Opening line text
            
        Raises:
            AIServiceError: If generation fails
        """
        pass
    
    @property
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if the AI service is available and properly configured
        
        Returns:
            bool: True if service is available, False otherwise
        """
        pass
    
    @property
    @abstractmethod
    def service_name(self) -> str:
        """
        Get human-readable service name
        
        Returns:
            str: Service display name (e.g., 'Google Gemini', 'xAI Grok')
        """
        pass
    
    def _get_character_prompt(self, character: Character) -> dict:
        """
        Get character prompt configuration (shared implementation)
        
        This method provides a unified way to extract character prompts
        that works across all AI services.
        
        Args:
            character: Character to get prompt for
            
        Returns:
            dict: Character prompt configuration with persona_prompt and few_shot_contents
        """
        # Try to load as hardcoded character first
        hardcoded_prompt = self._load_hardcoded_character(character)
        if hardcoded_prompt:
            return hardcoded_prompt

        # Use PromptEngine for all characters (post-Issue #129)
        if character:
            try:
                from utils.prompt_selector import select_system_prompt
                from .prompt_engine import PromptEngine
                selected_system_prompt, prompt_type = select_system_prompt(character)
                engine = PromptEngine(system_prompt=selected_system_prompt)
                compiled = engine.compile(character)
                return {
                    "persona_prompt": compiled.get("system_text", ""),
                    "few_shot_contents": [],
                    "use_cache": False,  # No caching in simplified architecture
                    "use_few_shot": False
                }
            except Exception as e:
                self.logger.error(f"PromptEngine failed: {e}")
                # Return basic fallback
                return {
                    "persona_prompt": f"你是{character.name}。",
                    "few_shot_contents": []
                }

        # No character provided
        return {
            "persona_prompt": "",
            "few_shot_contents": []
        }
    
    def _load_hardcoded_character(self, character: Character) -> Optional[dict]:
        """
        [DEPRECATED] Hardcoded character loading removed in Issue #129.

        This method is kept for backward compatibility but always returns None.
        All characters now use PromptEngine for dynamic prompt generation.

        Args:
            character: Character to load

        Returns:
            None (always)
        """
        self.logger.debug("Hardcoded character loading removed in Issue #129")
        return None
    
    def _is_hardcoded_character(self, character: Character) -> bool:
        """
        [DEPRECATED] Hardcoded character detection removed in Issue #129.

        This method is kept for backward compatibility but always returns False.
        All characters are now user-created.

        Args:
            character: Character to check

        Returns:
            False (always)
        """
        return False
    
    def _manage_conversation_length(
        self, 
        messages: List[ChatMessage], 
        max_messages: int = 20
    ) -> List[ChatMessage]:
        """
        Manage conversation length to stay within token limits (shared implementation)
        
        Strategy:
        - Keep first 2-3 messages (character establishment)
        - Keep most recent 15-17 messages (current context)
        - Drop middle messages if needed
        
        Args:
            messages: Original message list
            max_messages: Maximum number of messages to keep
            
        Returns:
            List[ChatMessage]: Managed message list
        """
        if len(messages) <= max_messages:
            return messages
        
        # Preserve character establishment (first few messages)
        establishment_messages = messages[:3]
        
        # Keep recent context
        recent_messages = messages[-(max_messages-3):]
        
        self.logger.info(f"📏 Conversation length management: {len(messages)} -> {len(establishment_messages + recent_messages)} messages")
        return establishment_messages + recent_messages
    
    def _extract_character_name(self, character: Optional[Character]) -> str:
        """
        Extract character name for conversation history formatting (shared implementation)
        
        Args:
            character: Character to extract name from
            
        Returns:
            str: Sanitized character name
        """
        if character and character.name:
            # Sanitize character name to prevent prompt injection
            import re
            sanitized_name = re.sub(r'[^\w\s\u4e00-\u9fff]', '', character.name)
            return sanitized_name[:50]  # Limit length
        
        # Fallback to generic name
        return "AI助手"
    
    def _simulate_response(
        self,
        character: Character,
        messages: List[ChatMessage]
    ) -> str:
        """
        Simulate AI response when service is not available (shared implementation)
        
        Args:
            character: Character to simulate response for
            messages: Conversation messages
            
        Returns:
            str: Simulated response
        """
        # Get the last user message
        last_user_message = ""
        for msg in reversed(messages):
            if msg.role == "user":
                last_user_message = msg.content
                break
        
        # Generate fallback response based on character
        if character and character.name:
            return f"*{character.name} 正在思考中...* 抱歉，AI服务暂时不可用。请稍后再试。"
        else:
            return "抱歉，AI服务暂时不可用。请稍后再试。"
