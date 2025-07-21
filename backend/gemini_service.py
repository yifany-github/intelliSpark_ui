import google.generativeai as genai
from config import settings
from models import Character, Scene, ChatMessage
from typing import List, Optional
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        """Initialize Gemini service"""
        self.model_name = "gemini-1.5-flash"
        self.model = None
        
        if settings.gemini_api_key:
            try:
                genai.configure(api_key=settings.gemini_api_key)
                self.model = genai.GenerativeModel(self.model_name)
                logger.info("Gemini AI initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini: {e}")
                self.model = None
        else:
            logger.warning("No Gemini API key found. Using simulated responses.")
    
    async def generate_response(
        self,
        character: Character,
        scene: Scene,
        messages: List[ChatMessage],
        user_preferences: Optional[dict] = None
    ) -> str:
        """Generate AI response using Gemini"""
        
        if not self.model:
            return self._simulate_response(character, scene, messages)
        
        try:
            # Load character and scene prompts directly
            character_prompt = ""
            scene_prompt = ""
            
            # Load character prompt
            if character and character.chinese_name == "艾莉丝":
                from prompts.characters.艾莉丝 import PERSONA_PROMPT, FEW_SHOT_EXAMPLES
                character_prompt = f"{PERSONA_PROMPT}\n\n{FEW_SHOT_EXAMPLES}"
            
            # Load scene prompt  
            if scene and scene.slug == "royal_court":
                from prompts.scenes.royal_court import SCENE_PROMPT
                scene_prompt = SCENE_PROMPT
            
            # Build conversation context
            context = self._build_conversation_context(
                character_prompt, scene_prompt, messages, user_preferences
            )
            
            # Generate response
            response = await self.model.generate_content_async(context)
            
            if response and response.text:
                return response.text.strip(), {"tokens_used": 1}
            else:
                logger.warning("Empty response from Gemini, using fallback")
                return self._simulate_response(character, scene, messages), {"tokens_used": 1}
                
        except Exception as e:
            logger.error(f"Error generating Gemini response: {e}")
            return self._simulate_response(character, scene, messages), {"tokens_used": 1}
    
    def _build_conversation_context(
        self,
        character_prompt: dict,
        scene_prompt: dict,
        messages: List[ChatMessage],
        user_preferences: Optional[dict] = None
    ) -> str:
        """Build the full conversation context for Gemini"""
        
        # System instruction
        system_instruction = []
        
        # Add scene context
        if scene_prompt.get("scene_prompt"):
            system_instruction.append(f"Scene: {scene_prompt['scene_prompt']}")
        
        # Add character persona
        if character_prompt.get("persona_prompt"):
            system_instruction.append(f"Character: {character_prompt['persona_prompt']}")
        
        # Add few-shot examples if available
        few_shot = ""
        if character_prompt.get("few_shot_prompt"):
            few_shot = f"\n\nExamples of how you should respond:\n{character_prompt['few_shot_prompt']}"
        
        # Build conversation history (last 10 messages)
        conversation_history = []
        recent_messages = messages[-10:] if len(messages) > 10 else messages
        
        for msg in recent_messages:
            role = "Human" if msg.role == "user" else "Assistant"
            conversation_history.append(f"{role}: {msg.content}")
        
        # Combine everything
        full_context = "\n\n".join(system_instruction)
        full_context += few_shot
        full_context += "\n\nConversation:\n" + "\n".join(conversation_history)
        full_context += "\nAssistant:"
        
        return full_context
    
    def _simulate_response(
        self,
        character: Character,
        scene: Scene,
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
        
        # Replace scene/mood placeholders if any
        selected_response = selected_response.replace("${scene.name}", scene.name)
        selected_response = selected_response.replace("${scene.mood}", scene.mood)
        
        return selected_response