"""
Enhanced Gemini AI Service for IntelliSpark AI Chat Application

This service provides integration with Google's Gemini models with full backward
compatibility and enhanced multi-model architecture support.

Key Features:
- Full backward compatibility with existing GeminiService
- Advanced caching system with character-specific cache management  
- NSFW intent detection for enhanced response generation
- Character prompt enhancement for both hardcoded and user-created characters
- Robust error handling and fallback mechanisms
- Token usage tracking and optimization

This is the new architecture-compatible version of GeminiService.
"""

from google import genai
from google.genai import types
from typing import List, Optional, Dict, Tuple, Any
from models import Character, ChatMessage
from .ai_service_base import AIServiceBase, AIServiceError
from prompts.system import SYSTEM_PROMPT
from prompts.character_templates import OPENING_LINE_TEMPLATE
from cache_components import SystemInstructionBuilder, ContentFormatConverter, CacheManager
import logging
import os
import asyncio

logger = logging.getLogger(__name__)

class GeminiService(AIServiceBase):
    """Enhanced Gemini service with multi-model architecture support"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize Gemini service"""
        super().__init__("gemini-2.0-flash-001", api_key)
        self.cache = None
        self._intent_service = None  # Lazy-loaded intent service
        
    async def initialize(self) -> bool:
        """Initialize Gemini service client"""
        try:
            if not self.api_key:
                self.logger.warning("No Gemini API key found. Using simulated responses.")
                return True  # Allow fallback mode
            
            # Initialize Gemini client with API key directly (more secure)
            self.client = genai.Client(api_key=self.api_key)
            
            self.logger.info("✅ Gemini AI client initialized successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize Gemini client: {e}")
            self.client = None
            return False
    
    @property
    def is_available(self) -> bool:
        """Check if Gemini service is available"""
        return self.client is not None
    
    @property
    def service_name(self) -> str:
        """Get service display name"""
        return "Google Gemini"
    
    async def generate_response(
        self,
        character: Character,
        messages: List[ChatMessage],
        user_preferences: Optional[dict] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """Generate AI response using Gemini with NSFW intent detection"""
        
        if not self.is_available:
            return self._simulate_response(character, messages), {"tokens_used": 1}
        
        try:
            # Get character prompt configuration (works for both hardcoded and user-created characters)
            character_prompt = self._get_character_prompt(character)
            
            # Log character loading info
            if character:
                few_shot_count = len(character_prompt.get("few_shot_contents", []))
                if self._is_hardcoded_character(character):
                    self.logger.info(f"🎭 Loading hardcoded character: {character.name} with {few_shot_count} few-shot examples")
                else:
                    self.logger.info(f"🎭 Loading user-created character: {character.name} with dynamic prompt (few-shot: {few_shot_count})")
            else:
                self.logger.info("🎭 No character specified, using default prompt")
            
            # Create cache for this conversation context if not exists
            cache = await self._create_or_get_cache(character_prompt)
            
            # Manage conversation length to stay within token limits
            managed_messages = self._manage_conversation_length(messages)
            
            # NEW: Detect user intent for enhanced response generation
            user_intent = await self._detect_user_intent_background(managed_messages)
            
            # Build conversation prompt with full history and intent guidance
            conversation_prompt = self._build_conversation_prompt(managed_messages, character, user_intent)
            
            # If cache creation failed, fall back to direct API call without cache
            if cache is None:
                self.logger.warning("⚠️ No cache available, using direct API call with system prompt")
                # Create system prompt for direct call
                system_instruction = f"system_prompt: {SYSTEM_PROMPT}\n"
                if character_prompt.get("persona_prompt"):
                    system_instruction += f"persona prompt: {character_prompt['persona_prompt']}"
                
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=conversation_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction
                    )
                )
                input_tokens = 0  # Simplified token counting
            else:
                # Count input tokens with cache
                input_tokens = self.client.models.count_tokens(
                    model=self.model_name,
                    contents=conversation_prompt,
                    config=types.GenerateContentConfig(
                        cached_content=cache.name
                    )
                ).total_tokens
                
                # Generate response using cached content (new API)
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=conversation_prompt,
                    config=types.GenerateContentConfig(
                        cached_content=cache.name
                    )
                )
            
            if response and response.text:
                # Count output tokens
                output_tokens = getattr(response.usage_metadata, "candidates_token_count", 0)
                
                token_info = {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": input_tokens + output_tokens
                }
                
                return response.text.strip(), token_info
            else:
                self.logger.warning("⚠️ Empty response from Gemini, using fallback")
                return self._simulate_response(character, messages), {"tokens_used": 1}
                
        except Exception as e:
            self.logger.error(f"❌ Error generating Gemini response: {e}")
            return self._simulate_response(character, messages), {"tokens_used": 1}
    
    async def generate_opening_line(self, character: Character) -> str:
        """Generate an opening line for a character using the new architecture"""
        self.logger.info(f"🚀 Generating opening line for character: {character.name}")
        
        if not self.is_available:
            self.logger.warning("⚠️ No Gemini client available, using fallback opening line")
            return f"Hello! I'm {character.name}. {character.backstory[:100] if character.backstory else 'Nice to meet you!'}..."
        
        try:
            # Get character prompt configuration (works for both hardcoded and user-created characters)
            character_prompt = self._get_character_prompt(character)
            
            # Log opening line generation info
            if character:
                if self._is_hardcoded_character(character):
                    self.logger.info(f"🚀 Generating opening line for hardcoded character: {character.name}")
                else:
                    self.logger.info(f"🚀 Generating opening line for user-created character: {character.name}")
            else:
                self.logger.info("🚀 Generating opening line without character context")
            
            # Create opening line prompt using template
            opening_prompt = OPENING_LINE_TEMPLATE.format(character_name=character.name)
            
            # Create or get cache
            cache = await self._create_or_get_cache(character_prompt)
            
            # Generate opening line using new API
            if cache:
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=opening_prompt,
                    config=types.GenerateContentConfig(
                        cached_content=cache.name
                    )
                )
            else:
                # Fallback without cache
                system_instruction = f"system_prompt: {SYSTEM_PROMPT}\n"
                if character_prompt.get("persona_prompt"):
                    system_instruction += f"persona prompt: {character_prompt['persona_prompt']}"
                
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=opening_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction
                    )
                )
            
            if response and response.text:
                return response.text.strip()
            else:
                self.logger.warning("⚠️ Empty response from Gemini for opening line, using fallback")
                return f"Hello! I'm {character.name}. {character.backstory[:100] if character.backstory else 'Nice to meet you!'}..."
                
        except Exception as e:
            self.logger.error(f"❌ Error generating opening line: {e}")
            # Fallback to simple template
            return f"Hello! I'm {character.name}. {character.backstory[:100] if character.backstory else 'Nice to meet you!'}..."
    
    # PRIVATE METHODS - Gemini-specific implementations
    
    async def _create_or_get_cache(self, character_prompt: dict):
        """
        Create or get cached content using separated responsibilities.
        
        This method orchestrates the cache creation process using focused components:
        - SystemInstructionBuilder: Handles prompt formatting
        - ContentFormatConverter: Handles format conversion
        - CacheManager: Handles cache creation and management
        """
        # Initialize components with their specific responsibilities
        instruction_builder = SystemInstructionBuilder(SYSTEM_PROMPT)
        format_converter = ContentFormatConverter()
        cache_manager = CacheManager(self.client, self.model_name, self.logger)
        
        # Validate inputs using dedicated validation
        if not instruction_builder.validate_character_prompt(character_prompt):
            self.logger.error("Invalid character prompt format")
            return None
        
        # Build system instruction using dedicated builder
        system_instruction = instruction_builder.build_instruction(character_prompt)
        
        # Extract and validate few-shot examples
        few_shot_examples = character_prompt.get("few_shot_contents", [])
        if not format_converter.validate_examples(few_shot_examples):
            self.logger.error("Invalid few-shot examples format")
            return None
        
        # Convert content format using dedicated converter
        few_shot_contents = format_converter.convert_to_gemini_format(few_shot_examples)
        
        # Validate cache inputs before creation
        if not cache_manager.validate_cache_inputs(system_instruction, few_shot_contents):
            self.logger.error("Invalid cache creation inputs")
            return None
        
        # Create cache using dedicated manager
        cache = await cache_manager.create_cache(system_instruction, few_shot_contents)
        
        # Store cache reference and return
        self.cache = cache
        return cache
    
    def _build_conversation_prompt(self, messages: List[ChatMessage], character: Optional[Character] = None, user_intent: Optional[str] = None) -> List[Dict]:
        """
        Build conversation prompt with FULL conversation history and optional intent guidance.
        
        Uses natural conversation flow without meta-instructions to:
        - Maintain immersion and avoid safety filter triggers
        - Support any character (not hardcoded names)
        - Follow SpicyChat/JuicyChat best practices
        - Add NSFW intent guidance for better pacing control
        """
        
        character_name = self._extract_character_name(character)
        
        # Build natural conversation history
        conversation_history = ""
        
        for message in messages:
            if message.role == 'user':
                conversation_history += f"用户: {message.content}\n"
            elif message.role == 'assistant':
                # Use dynamic character name for any bot
                conversation_history += f"{character_name}: {message.content}\n"
        
        # NEW: Add intent guidance if available
        intent_guidance = ""
        if user_intent:
            guidance_text = self._build_intent_guidance(user_intent)
            intent_guidance = f"[智能指导: {guidance_text}]\n\n"
        
        # Create enhanced conversation prompt
        if conversation_history:
            # End with character name to prompt natural continuation
            # This follows SpicyChat/JuicyChat pattern for better NSFW quality
            full_prompt = f"{intent_guidance}{conversation_history.rstrip()}\n{character_name}:"
        else:
            # For new conversations, just start with character name
            full_prompt = f"{intent_guidance}{character_name}:"
        
        if user_intent:
            self.logger.info(f"💬 Enhanced conversation prompt built: {len(messages)} messages for {character_name} with intent '{user_intent}'")
        else:
            self.logger.info(f"💬 Conversation prompt built: {len(messages)} messages for {character_name}")
        
        # Return in Gemini API format
        return [{
            "role": "user",
            "parts": [{"text": full_prompt}]
        }]
    
    @property
    def intent_service(self):
        """Lazy-loaded intent service instance (industry standard pattern)"""
        if self._intent_service is None:
            from services.nsfw_intent_service import NSFWIntentService
            # Share the Gemini client to avoid duplication
            self._intent_service = NSFWIntentService(gemini_client=self.client)
            self.logger.info("🎯 NSFWIntentService initialized for this conversation")
        return self._intent_service

    async def _detect_user_intent_background(self, messages: List[ChatMessage]) -> Optional[str]:
        """
        Detect user intent in background for enhanced response generation
        """
        try:
            # Use the shared intent service instance (efficient pattern)
            user_intent = await self.intent_service.detect_user_intent(messages)
            return user_intent
            
        except Exception as e:
            self.logger.warning(f"⚠️ Intent detection failed: {e}")
            return None  # Graceful fallback - conversation continues without intent guidance
    
    def _build_intent_guidance(self, user_intent: str) -> str:
        """
        Build response guidance based on detected user intent
        """
        # Use the centralized guidance from the intent service
        if hasattr(self, '_intent_service') and self._intent_service:
            return self._intent_service.build_intent_guidance(user_intent)
        else:
            # Fallback if intent service not available
            try:
                from services.nsfw_intent_service import NSFWIntentService
                temp_service = NSFWIntentService()
                return temp_service.build_intent_guidance(user_intent)
            except (ImportError, Exception) as e:
                self.logger.warning(f"Intent service unavailable, using fallback: {e}")
                return "保持角色一致性，自然回应对话"