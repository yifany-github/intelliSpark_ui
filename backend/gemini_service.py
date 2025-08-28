from google import genai
from google.genai import types
from config import settings
from models import Character, ChatMessage
from prompts.system import SYSTEM_PROMPT
from prompts.character_templates import DYNAMIC_CHARACTER_TEMPLATE, OPENING_LINE_TEMPLATE
from cache_components import SystemInstructionBuilder, ContentFormatConverter, CacheManager
from typing import List, Optional, Dict
import logging
import json
import os
import importlib
import asyncio

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        """Initialize Gemini service"""
        self.model_name = "gemini-2.0-flash-001"
        self.client = None
        self.cache = None
        self._intent_service = None  # Lazy-loaded intent service
        
        if settings.gemini_api_key:
            try:
                # Set environment variable for the new SDK
                os.environ['GEMINI_API_KEY'] = settings.gemini_api_key
                # Initialize Gemini client (new API style)
                self.client = genai.Client()
                logger.info("Gemini AI client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
                self.client = None
        else:
            logger.warning("No Gemini API key found. Using simulated responses.")
    
    def _get_character_prompt(self, character: Character) -> dict:
        """Get character prompt configuration with unified loading mechanism"""
        
        # Try to load as hardcoded character first
        hardcoded_prompt = self._load_hardcoded_character(character)
        if hardcoded_prompt:
            return hardcoded_prompt
        
        # Fallback to dynamic character generation
        elif character:
            from utils.character_prompt_enhancer import CharacterPromptEnhancer
            enhancer = CharacterPromptEnhancer()
            return enhancer.enhance_dynamic_prompt(character)
        
        # No character fallback
        else:
            return {
                "persona_prompt": "",
                "few_shot_contents": []
            }
    
    def _load_hardcoded_character(self, character: Character) -> Optional[dict]:
        """Load hardcoded character data if available using auto-discovery"""
        if not character:
            return None
        
        # Auto-discover characters from prompts/characters/ directory
        from utils.character_discovery import discover_character_files
        
        try:
            hardcoded_characters = discover_character_files()
            module_path = hardcoded_characters.get(character.name)
            
            if module_path:
                module = importlib.import_module(module_path)
                
                # Validate required attributes exist
                if hasattr(module, 'PERSONA_PROMPT') and hasattr(module, 'FEW_SHOT_EXAMPLES'):
                    # Respect character-specific control flags
                    character_data = {
                        "persona_prompt": module.PERSONA_PROMPT,
                        "few_shot_contents": module.FEW_SHOT_EXAMPLES,
                        # NEW: Control flags for cache and few-shot behavior
                        "use_cache": getattr(module, 'USE_CACHE', True),
                        "use_few_shot": getattr(module, 'USE_FEW_SHOT', True),
                    }
                    
                    logger.debug(f"Loaded character {character.name}: cache={character_data['use_cache']}, few_shot={character_data['use_few_shot']}")
                    return character_data
                else:
                    logger.error(f"Character {character.name} missing required attributes (PERSONA_PROMPT, FEW_SHOT_EXAMPLES)")
                    return None
            else:
                logger.debug(f"Character {character.name} not found in auto-discovered characters")
                return None
                
        except Exception as e:
            logger.error(f"Failed to load character {character.name} via auto-discovery: {e}")
            return None
    
    def _is_hardcoded_character(self, character: Character) -> bool:
        """Check if character is hardcoded using auto-discovery (for logging purposes)"""
        if not character:
            return False
            
        from utils.character_discovery import discover_character_files
        
        try:
            hardcoded_characters = discover_character_files()
            return character.name in hardcoded_characters
        except Exception as e:
            logger.error(f"Error checking if character {character.name} is hardcoded: {e}")
            return False
    
    async def generate_response(
        self,
        character: Character,
        messages: List[ChatMessage],
        user_preferences: Optional[dict] = None
    ) -> str:
        """Generate AI response using Gemini with NSFW intent detection"""
        
        if not self.client:
            return self._simulate_response(character, messages), {"tokens_used": 1}
        
        try:
            # Get character prompt configuration (works for both hardcoded and user-created characters)
            character_prompt = self._get_character_prompt(character)
            
            # Log character loading info
            if character:
                few_shot_count = len(character_prompt.get("few_shot_contents", []))
                if self._is_hardcoded_character(character):
                    logger.info(f"🎭 Loading hardcoded character: {character.name} with {few_shot_count} few-shot examples")
                else:
                    logger.info(f"🎭 Loading user-created character: {character.name} with dynamic prompt (few-shot: {few_shot_count})")
            else:
                logger.info("🎭 No character specified, using default prompt")
            
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
                logger.warning("⚠️ No cache available, using direct API call with system prompt")
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
                logger.warning("Empty response from Gemini, using fallback")
                return self._simulate_response(character, messages), {"tokens_used": 1}
                
        except Exception as e:
            logger.error(f"Error generating Gemini response: {e}")
            return self._simulate_response(character, messages), {"tokens_used": 1}
    
    async def _create_or_get_cache(self, character_prompt: dict):
        """
        Create or get cached content using separated responsibilities.
        
        This method orchestrates the cache creation process using focused components:
        - SystemInstructionBuilder: Handles prompt formatting
        - ContentFormatConverter: Handles format conversion
        - CacheManager: Handles cache creation and management
        
        Args:
            character_prompt: Dictionary containing persona_prompt, few_shot_contents, and control flags
            
        Returns:
            Cache object if successful, None if failed (triggers direct API fallback)
        """
        # NEW: Respect character's cache preference
        if character_prompt.get("use_cache") == False:
            logger.info("Character configured to skip cache, using direct API")
            return None  # Triggers existing fallback path (lines 152-165)
        
        # Initialize components with their specific responsibilities
        instruction_builder = SystemInstructionBuilder(SYSTEM_PROMPT)
        format_converter = ContentFormatConverter()
        cache_manager = CacheManager(self.client, self.model_name, logger)
        
        # Validate inputs using dedicated validation
        if not instruction_builder.validate_character_prompt(character_prompt):
            logger.error("Invalid character prompt format")
            return None
        
        # Build system instruction using dedicated builder
        system_instruction = instruction_builder.build_instruction(character_prompt)
        
        # Extract and validate few-shot examples
        few_shot_examples = character_prompt.get("few_shot_contents", [])
        if not format_converter.validate_examples(few_shot_examples):
            logger.error("Invalid few-shot examples format")
            return None
        
        # Convert content format using dedicated converter
        few_shot_contents = format_converter.convert_to_gemini_format(few_shot_examples)
        
        # Validate cache inputs before creation
        if not cache_manager.validate_cache_inputs(system_instruction, few_shot_contents):
            logger.error("Invalid cache creation inputs")
            return None
        
        # Create cache using dedicated manager
        cache = await cache_manager.create_cache(system_instruction, few_shot_contents)
        
        # Store cache reference and return
        self.cache = cache
        return cache
    
    def _manage_conversation_length(self, messages: List[ChatMessage], max_messages: int = 20) -> List[ChatMessage]:
        """
        Manage conversation length to stay within token limits while preserving context.
        
        Strategy:
        - Keep first 2-3 messages (character establishment)
        - Keep most recent 15-17 messages (current context)
        - Drop middle messages if needed
        """
        if len(messages) <= max_messages:
            return messages
        
        # Preserve character establishment (first few messages)
        establishment_messages = messages[:3]
        
        # Keep recent context
        recent_messages = messages[-(max_messages-3):]
        
        logger.info(f"📏 Conversation length management: {len(messages)} -> {len(establishment_messages + recent_messages)} messages")
        return establishment_messages + recent_messages
    
    def _extract_character_name(self, character: Optional[Character]) -> str:
        """Extract character name for conversation history formatting"""
        if character and character.name:
            # Sanitize character name to prevent prompt injection
            import re
            sanitized_name = re.sub(r'[^\w\s\u4e00-\u9fff]', '', character.name)
            return sanitized_name[:50]  # Limit length
        
        # Fallback to generic name
        return "AI助手"
    
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
            logger.info(f"💬 Enhanced conversation prompt built: {len(messages)} messages for {character_name} with intent '{user_intent}'")
        else:
            logger.info(f"💬 Conversation prompt built: {len(messages)} messages for {character_name}")
        
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
            logger.info("🎯 NSFWIntentService initialized for this conversation")
        return self._intent_service

    async def _detect_user_intent_background(self, messages: List[ChatMessage]) -> Optional[str]:
        """
        Detect user intent in background for enhanced response generation
        
        Args:
            messages: Recent conversation messages
            
        Returns:
            Detected intent or None if detection fails
        """
        try:
            # Use the shared intent service instance (efficient pattern)
            user_intent = await self.intent_service.detect_user_intent(messages)
            return user_intent
            
        except Exception as e:
            logger.warning(f"⚠️ Intent detection failed: {e}")
            return None  # Graceful fallback - conversation continues without intent guidance
    
    def _build_intent_guidance(self, user_intent: str) -> str:
        """
        Build response guidance based on detected user intent
        
        Args:
            user_intent: Detected intent category
            
        Returns:
            Guidance text for enhanced response generation
        """
        
        # Use the centralized guidance from the intent service
        if hasattr(self, '_intent_service') and self._intent_service:
            return self._intent_service.build_intent_guidance(user_intent)
        else:
            # Fallback if intent service not available
            from services.nsfw_intent_service import NSFWIntentService
            temp_service = NSFWIntentService()
            return temp_service.build_intent_guidance(user_intent)
    
    def _simulate_response(
        self,
        character: Character,
        messages: List[ChatMessage]
    ) -> str:
        """Simulate AI response when Gemini is not available"""
        
        # Get the last user message
        last_user_message = ""
        for msg in reversed(messages):
            if msg.role == "user":
                last_user_message = msg.content
                break
        
        # Simple response templates based on character
        response_templates = {
            "艾莉丝": [
                "*gazes at you with ancient eyes that have seen centuries pass*\n\nThe arcane energies whisper of your curiosity... What knowledge do you seek from the old ways?",
                "*adjusts her ornate amulet thoughtfully*\n\nYour question touches upon mysteries that few dare to explore. I sense wisdom in your inquiry.",
                "Few who walk these halls show such genuine interest in the deeper truths. Tell me, what draws you to seek such knowledge?",
                "*traces an ancient symbol in the air*\n\nThe threads of fate have brought you here for a reason. What would you know?"
            ],
            "Kravus": [
                "*pounds his fist on a nearby table*\n\nHah! Now that's a question worthy of discussion! In my homeland, we'd settle this over ale and perhaps crossed swords!",
                "*eyes you with grudging respect*\n\nYou don't look like much, but you ask the right questions. That's more than I can say for most of these soft courtiers.",
                "Enough talk! Let's get to the heart of the matter. What do you really want to know?",
                "*grins fiercely*\n\nI like your spirit! Few have the courage to speak so directly to a warrior of the northern clans."
            ],
            "Lyra": [
                "*leans against the wall, twirling a dagger casually*\n\nInteresting question... The answer might be valuable to the right person. What's it worth to you?",
                "*glances around cautiously before speaking in a hushed tone*\n\nCareful who you ask such things around here. These walls have ears, and not all of them are friendly.",
                "You're not as naive as you look. That could be useful... or dangerous. Which will it be?",
                "*smirks knowingly*\n\nSmart question. I might have some information about that... if you can prove you're trustworthy."
            ],
            "XN-7": [
                "*tilts head at a precise 23.5 degree angle*\n\nAnalyzing your query... Processing... I find your question logically sound and worthy of detailed consideration.",
                "*artificial eyes glow with subtle light*\n\nFascinating. Your inquiry demonstrates higher-order thinking patterns. I am compelled to provide comprehensive data.",
                "My databases contain 1,247 relevant data points on this subject. Shall I provide a summary or detailed analysis?",
                "*processes for 0.3 seconds*\n\nYour question exhibits complexity that suggests non-standard human behavioral patterns. This is... intriguing."
            ]
        }
        
        # Get responses for this character, or generate dynamic response for user-created characters
        if character.name in response_templates:
            character_responses = response_templates[character.name]
        else:
            # Generate dynamic fallback responses for user-created characters
            if character.description:
                character_responses = [
                    f"*responds as {character.name}* {character.description}. How can I help you today?",
                    f"*maintains {character.name}'s personality* Based on my background: {character.backstory[:100] if character.backstory else 'I have a unique story'}... What would you like to know?",
                    f"*stays true to {character.name}'s nature* I'm here to chat with you in my own special way. What's on your mind?",
                ]
            else:
                # Basic fallback if no character description
                character_responses = [
                    f"*responds in character as {character.name}*\n\nI find your question quite interesting. Let me consider how best to answer you.",
                    f"*maintains the persona of {character.name}*\n\nThat's a thoughtful inquiry. What would you like to know more about?",
                    f"*stays true to {character.name}'s nature*\n\nYour question deserves a proper response. How shall I assist you?",
                ]
        
        # Select a response (in a real implementation, you might use randomization or context)
        import random
        selected_response = random.choice(character_responses)
        
        return selected_response
    
    async def generate_opening_line(self, character: Character) -> str:
        """Generate an opening line for a character using the new architecture"""
        logger.info(f"🚀 Generating opening line for character: {character.name}")
        
        if not self.client:
            logger.warning("⚠️ No Gemini client available, using fallback opening line")
            return f"Hello! I'm {character.name}. {character.backstory[:100]}... How can I help you today?"
        
        try:
            # Get character prompt configuration (works for both hardcoded and user-created characters)
            character_prompt = self._get_character_prompt(character)
            
            # Log opening line generation info
            if character:
                if self._is_hardcoded_character(character):
                    logger.info(f"🚀 Generating opening line for hardcoded character: {character.name}")
                else:
                    logger.info(f"🚀 Generating opening line for user-created character: {character.name}")
            else:
                logger.info("🚀 Generating opening line without character context")
            
            # Create opening line prompt using template
            opening_prompt = OPENING_LINE_TEMPLATE.format(character_name=character.name)
            
            # Create or get cache
            cache = await self._create_or_get_cache(character_prompt)
            
            # Generate opening line using new API
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=opening_prompt,
                config=types.GenerateContentConfig(
                    cached_content=cache.name
                )
            )
            
            if response and response.text:
                return response.text.strip()
            else:
                logger.warning("⚠️ Empty response from Gemini for opening line, using fallback")
                return f"Hello! I'm {character.name}. {character.backstory[:100]}... How can I help you today?"
                
        except Exception as e:
            logger.error(f"Error generating opening line: {e}")
            # Fallback to simple template
            return f"Hello! I'm {character.name}. {character.backstory[:100]}... How can I help you today?"