from google import genai
from google.genai import types
from config import settings
from models import Character, ChatMessage
from typing import List, Optional
import logging
import json
import os

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# General system prompt for the main application
SYSTEM_PROMPT = """
你是一个专业的AI角色扮演助手，能够根据给定的角色设定进行沉浸式对话。你的任务是:

1. 严格按照角色的人格特征、背景故事和说话风格进行回应
2. 保持角色的一致性，不脱离设定
3. 创造生动有趣的对话体验，让用户感受到角色的真实性
4. 根据对话内容自然地推进情节发展
5. 保持适当的互动节奏，既不过于冷淡也不过于热情

回应要求:
- 使用角色特有的语气和表达方式
- 结合角色的知识背景和经历
- 保持对话的自然流畅
- 适当使用动作描述和环境描写来增强沉浸感
- 长度适中，通常在100-300字之间
"""

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
            # Load character prompts directly
            character_prompt = {}
            
            # Load character prompt
            if character and character.name == "艾莉丝":
                from prompts.characters.艾莉丝 import PERSONA_PROMPT, FEW_SHOT_EXAMPLES
                
                # Use the pre-loaded Gemini format examples
                few_shot_contents = FEW_SHOT_EXAMPLES
                logger.info(f"🎭 Loading character: {character.name} with {len(few_shot_contents)} few-shot examples")
                
                character_prompt = {
                    "persona_prompt": PERSONA_PROMPT,
                    "few_shot_contents": few_shot_contents  # Pass the Gemini format directly
                }
            
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
            
            # Use few-shot examples in proper Gemini API format
            few_shot_contents = character_prompt.get("few_shot_contents", [])
            
            if few_shot_contents:
                logger.info(f"✅ Cache creation: {len(few_shot_contents)} few-shot examples")
            else:
                logger.warning("⚠️ Cache creation: No few-shot contents available")
            
            self.cache = self.client.caches.create(
                model=self.model_name,
                config=types.CreateCachedContentConfig(
                    system_instruction=system_instruction,
                    contents=few_shot_contents  # Use proper role/parts format
                )
            )
            
            logger.info(f"🎯 Cache created successfully: {self.cache.name}")
            return self.cache
            
        except Exception as e:
            logger.error(f"Failed to create cache: {e}")
            # Fallback: create empty cache or handle gracefully
            raise e
    
    def _build_conversation_prompt(self, messages: List[ChatMessage]) -> str:
        """Build simplified conversation prompt like demo's build_history"""
        # Build conversation history in demo format
        history_parts = []
        current_user_msg = ""
        
        # Process messages to build history
        for i, msg in enumerate(messages):
            if msg.role == "user":
                current_user_msg = msg.content
                # If this is not the last message, add to history
                if i < len(messages) - 1:
                    # Look for the corresponding assistant response
                    if i + 1 < len(messages) and messages[i + 1].role == "assistant":
                        assistant_msg = messages[i + 1].content
                        history_parts.append(f"user: {msg.content}\nassistant: {assistant_msg}")
            
        # Build final prompt like demo
        if history_parts:
            hist_txt = "\n".join(history_parts)
            return f"对话历史:\n{hist_txt}\nuser: {current_user_msg}\nassistant:"
        else:
            return f"user: {current_user_msg}\nassistant:"
    
    
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
        
        # Get responses for this character, or use generic response
        character_responses = response_templates.get(character.name, [
            f"*responds in character as {character.name}*\n\nI find your question quite interesting. Let me consider how best to answer you.",
            f"*maintains the persona of {character.name}*\n\nThat's a thoughtful inquiry. What would you like to know more about?",
            f"*stays true to {character.name}'s nature*\n\nYour question deserves a proper response. How shall I assist you?",
        ])
        
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
            # Load character prompts for opening line generation
            character_prompt = {}
            
            if character and character.name == "艾莉丝":
                from prompts.characters.艾莉丝 import PERSONA_PROMPT, FEW_SHOT_EXAMPLES
                
                # Use the same format as main conversation
                few_shot_contents = FEW_SHOT_EXAMPLES
                
                character_prompt = {
                    "persona_prompt": PERSONA_PROMPT,
                    "few_shot_contents": few_shot_contents
                }
            
            # Create opening line prompt in Chinese to match character
            opening_prompt = f"作为{character.name}，用你的语气和风格说一句自然的开场白来问候用户。不要解释，直接说开场白。"
            
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