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
        user_preferences: Optional[dict] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generate AI response for conversation
        
        Args:
            character: Character to roleplay as
            messages: Conversation history
            user_preferences: User settings (temperature, nsfw_level, etc.)
            
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

        # Prefer PromptEngine for user-created characters with persona/backstory
        if character and (getattr(character, 'persona_prompt', None) or getattr(character, 'backstory', None)):
            try:
                # For now, use the existing system prompt (NSFW) until Issue #156 wires SAFE/NSFW selection upstream
                from prompts.system import SYSTEM_PROMPT
                from services.prompt_engine import PromptEngine
                engine = PromptEngine(system_prompt=SYSTEM_PROMPT)
                compiled = engine.compile(character)
                return {
                    "persona_prompt": compiled.get("system_text", ""),
                    "few_shot_contents": [],
                    "use_cache": True,
                    "use_few_shot": False
                }
            except Exception as e:
                self.logger.warning(f"PromptEngine unavailable/failed, falling back to enhancer: {e}")

        # Fallback to dynamic enhancer
        if character:
            from utils.character_prompt_enhancer import CharacterPromptEnhancer
            enhancer = CharacterPromptEnhancer()
            return enhancer.enhance_dynamic_prompt(character)

        # No character provided
        return {
            "persona_prompt": "",
            "few_shot_contents": []
        }
    
    def _load_hardcoded_character(self, character: Character) -> Optional[dict]:
        """
        Load hardcoded character data if available using auto-discovery (shared implementation)
        
        Args:
            character: Character to load
            
        Returns:
            Optional[dict]: Character data or None if not hardcoded
        """
        if not character:
            return None

        # Respect config: optionally disable any hardcoded character loading entirely
        try:
            from config import settings
            if not getattr(settings, 'enable_hardcoded_character_loading', False):
                self.logger.debug("Hardcoded character loading disabled via config - using dynamic prompts")
                return None
        except Exception:
            # If settings import fails, be safe and do not load hardcoded characters
            return None

        # Auto-discover characters from prompts/characters/ directory
        from utils.character_discovery import discover_character_files
        
        try:
            hardcoded_characters = discover_character_files()
            module_path = hardcoded_characters.get(character.name)
            
            if module_path:
                import importlib
                module = importlib.import_module(module_path)
                
                # Validate required attributes exist
                if hasattr(module, 'PERSONA_PROMPT') and hasattr(module, 'FEW_SHOT_EXAMPLES'):
                    # Respect character-specific control flags (shared across all AI services)
                    character_data = {
                        "persona_prompt": module.PERSONA_PROMPT,
                        "few_shot_contents": module.FEW_SHOT_EXAMPLES,
                        # Control flags for cache and few-shot behavior
                        "use_cache": getattr(module, 'USE_CACHE', True),
                        "use_few_shot": getattr(module, 'USE_FEW_SHOT', True),
                    }
                    
                    self.logger.debug(f"Loaded character {character.name}: cache={character_data['use_cache']}, few_shot={character_data['use_few_shot']}")
                    return character_data
                else:
                    self.logger.error(f"Character {character.name} missing required attributes (PERSONA_PROMPT, FEW_SHOT_EXAMPLES)")
                    return None
            else:
                self.logger.debug(f"Character {character.name} not found in auto-discovered characters")
                return None
                
        except Exception as e:
            self.logger.error(f"Failed to load character {character.name} via auto-discovery: {e}")
            return None
    
    def _is_hardcoded_character(self, character: Character) -> bool:
        """
        Check if character is hardcoded using auto-discovery (shared implementation)
        
        Args:
            character: Character to check
            
        Returns:
            bool: True if character is hardcoded
        """
        if not character:
            return False
        
        # Respect config: optionally disable any hardcoded character detection entirely
        try:
            from config import settings
            if not getattr(settings, 'enable_hardcoded_character_loading', False):
                return False
        except Exception:
            return False

        from utils.character_discovery import discover_character_files
        
        try:
            hardcoded_characters = discover_character_files()
            return character.name in hardcoded_characters
        except Exception as e:
            self.logger.error(f"Error checking if character {character.name} is hardcoded: {e}")
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
