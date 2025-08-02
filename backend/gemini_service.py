from google import genai
from google.genai import types
from config import settings
from models import Character, ChatMessage
from prompts.system import SYSTEM_PROMPT
from prompts.character_templates import DYNAMIC_CHARACTER_TEMPLATE, OPENING_LINE_TEMPLATE
from typing import List, Optional, Dict
import logging
import json
import os

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        """Initialize Gemini service"""
        self.model_name = "gemini-2.0-flash-001"
        self.client = None
        self.cache = None
        
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
        """Get character prompt configuration for both hardcoded and user-created characters"""
        # Keep existing hardcoded characters unchanged
        if character and character.name == "艾莉丝":
            from prompts.characters.艾莉丝 import PERSONA_PROMPT, FEW_SHOT_EXAMPLES
            return {
                "persona_prompt": PERSONA_PROMPT,
                "few_shot_contents": FEW_SHOT_EXAMPLES
            }
        
        # Generate enhanced prompt for user-created characters
        elif character:
            from utils.character_prompt_enhancer import CharacterPromptEnhancer
            enhancer = CharacterPromptEnhancer()
            return enhancer.enhance_dynamic_prompt(character)
        
        # Fallback for no character
        else:
            return {
                "persona_prompt": "",
                "few_shot_contents": []
            }
    
    async def generate_response(
        self,
        character: Character,
        messages: List[ChatMessage],
        user_preferences: Optional[dict] = None
    ) -> str:
        """Generate AI response using Gemini"""
        
        if not self.client:
            return self._simulate_response(character, messages), {"tokens_used": 1}
        
        try:
            # Get character prompt configuration (works for both hardcoded and user-created characters)
            character_prompt = self._get_character_prompt(character)
            
            # Log character loading info
            if character:
                few_shot_count = len(character_prompt.get("few_shot_contents", []))
                if character.name == "艾莉丝":
                    logger.info(f"🎭 Loading hardcoded character: {character.name} with {few_shot_count} few-shot examples")
                else:
                    logger.info(f"🎭 Loading user-created character: {character.name} with dynamic prompt (few-shot: {few_shot_count})")
            else:
                logger.info("🎭 No character specified, using default prompt")
            
            # Create cache for this conversation context if not exists
            cache = await self._create_or_get_cache(character_prompt)
            
            # Build simplified conversation prompt
            conversation_prompt = self._build_conversation_prompt(messages)
            
            # Count input tokens
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
        """Create or get cached content for character context"""
        try:
            # Prepare system instruction combining general system prompt and persona
            system_instruction = f"system_prompt: {SYSTEM_PROMPT}\n"
            if character_prompt.get("persona_prompt"):
                system_instruction += f"persona prompt: {character_prompt['persona_prompt']}"
            
            # Get few-shot examples - they should already be in proper Gemini API format
            few_shot_examples = character_prompt.get("few_shot_contents", [])
            
            # Check if examples are already in Gemini format or need conversion
            few_shot_contents = []
            for example in few_shot_examples:
                if "parts" in example:
                    # Already in Gemini format (like 艾莉丝)
                    few_shot_contents.append(example)
                else:
                    # Need conversion (like user-created characters)
                    few_shot_contents.append({
                        "role": example.get("role", "user"),
                        "parts": [{"text": example.get("content", "")}]
                    })
            
            if few_shot_contents:
                logger.info(f"✅ Cache creation: {len(few_shot_contents)} few-shot examples")
            else:
                logger.warning("⚠️ Cache creation: No few-shot contents available")
            
            self.cache = self.client.caches.create(
                model=self.model_name,
                config=types.CreateCachedContentConfig(
                    system_instruction=system_instruction,
                    contents=few_shot_contents
                )
            )
            
            logger.info(f"🎯 Cache created successfully: {self.cache.name}")
            return self.cache
            
        except Exception as e:
            logger.warning(f"⚠️ Cache creation failed (likely due to minimum token requirement): {e}")
            # Return None to indicate no cache should be used
            return None
    
    def _build_conversation_prompt(self, messages: List[ChatMessage]) -> List[Dict]:
        """Build conversation prompt in proper Gemini API format"""
        # Get the last user message
        last_user_message = ""
        for msg in reversed(messages):
            if msg.role == "user":
                last_user_message = msg.content
                break
        
        # Return in Gemini API format
        return [{
            "role": "user",
            "parts": [{"text": last_user_message}]
        }]
    
    
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
                if character.name == "艾莉丝":
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