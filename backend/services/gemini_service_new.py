"""
Simplified Gemini AI Service for IntelliSpark AI Chat Application

This service provides integration with Google's Gemini models with a clean,
simple architecture focused on quality responses.

Key Features:
- Full backward compatibility with existing GeminiService
- Single unified character prompt path using PromptEngine
- Direct API calls without caching complexity
- Clean error handling and fallback mechanisms
- Token usage tracking and optimization

This is the simplified architecture version post-Issue #129.
"""

from google import genai
from google.genai import types
from typing import List, Optional, Dict, Tuple, Any, Iterable
import json
import re
from models import Character, ChatMessage
from .ai_service_base import AIServiceBase, AIServiceError
from utils.prompt_selector import select_system_prompt
from .prompt_engine import PromptEngine
from prompts.opening_line import build_opening_line_prompt
from prompts.state_initialization import (
    STATE_KEYS as NSFW_STATE_KEYS,
    build_state_initialization_prompt,
)
from prompts.state_initialization_safe import (
    SAFE_STATE_KEYS,
    build_state_initialization_prompt_safe,
)
import logging

logger = logging.getLogger(__name__)

class GeminiService(AIServiceBase):
    """Simplified Gemini service with clean architecture (post-Issue #129)"""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize Gemini service"""
        super().__init__("gemini-2.0-flash-001", api_key)
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
        user_preferences: Optional[dict] = None,
        state: Optional[Dict[str, str]] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """Generate AI response using Gemini with simplified direct flow"""

        if not self.is_available:
            return self._simulate_response(character, messages), {"tokens_used": 1}

        try:
            # Get character prompt using PromptEngine (unified path for all characters)
            character_prompt = self._get_character_prompt(character)

            self.logger.info(f"🎭 Generating response for character: {character.name if character else 'default'}")

            # Manage conversation length to stay within token limits
            managed_messages = self._manage_conversation_length(messages)

            # Detect sexual activity stage for targeted user-agency protection
            stage = await self._detect_user_intent_background(managed_messages)

            # Build conversation prompt with full history, state, and stage reminder
            conversation_prompt = self._build_conversation_prompt(managed_messages, character, state, stage)

            # Get selected system prompt (SAFE vs NSFW)
            selected_system_prompt, prompt_type = select_system_prompt(character)
            self.logger.info(f"🧭 Using {prompt_type} system prompt")

            # Build system instruction
            system_instruction = f"{selected_system_prompt}\n\n{character_prompt}"

            # Direct API call (no caching)
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=conversation_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction
                )
            )

            if response and response.text:
                # Count tokens from usage metadata
                input_tokens = getattr(response.usage_metadata, "prompt_token_count", 0)
                output_tokens = getattr(response.usage_metadata, "candidates_token_count", 0)

                token_info = {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": input_tokens + output_tokens
                }
                clean_text, state_update = self._extract_state_update(response.text.strip())

                # Remove character name prefix if LLM echoed it
                clean_text = self._remove_character_name_prefix(clean_text, character)

                if state_update:
                    token_info["state_update"] = state_update

                return clean_text, token_info
            else:
                self.logger.warning("⚠️ Empty response from Gemini, using fallback")
                return self._simulate_response(character, messages), {"tokens_used": 1}

        except Exception as e:
            self.logger.error(f"❌ Error generating Gemini response: {e}")
            return self._simulate_response(character, messages), {"tokens_used": 1}

    async def generate_opening_line(self, character: Character) -> str:
        """Generate an opening line for a character"""
        self.logger.info(f"🚀 Generating opening line for character: {character.name}")

        fallback_line = (
            f"你好，我是{character.name}，期待与你开始这段故事。"
            if character and character.name
            else "你好，我是你的专属向导。"
        )

        if not self.is_available:
            self.logger.warning("⚠️ No Gemini client available, using fallback opening line")
            return fallback_line

        try:
            prompt_bundle = build_opening_line_prompt(
                character.name,
                character.description or "",
            )

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt_bundle.user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=prompt_bundle.system_instruction
                )
            )

            if response and response.text:
                return response.text.strip()
            else:
                self.logger.warning("⚠️ Empty response from Gemini for opening line, using fallback")
                return fallback_line

        except Exception as e:
            self.logger.error(f"❌ Error generating opening line: {e}")
            return fallback_line

    async def generate_state_seed(self, character: Character, *, safe_mode: bool) -> Dict[str, str]:
        """Generate a default state seed for a character."""

        allowed_keys: Iterable[str] = SAFE_STATE_KEYS if safe_mode else NSFW_STATE_KEYS
        fallback_state = self._simulate_state_seed(allowed_keys, safe_mode=safe_mode)

        if not self.is_available:
            self.logger.warning("⚠️ No Gemini client available, using fallback state seed")
            return fallback_state

        persona_text = (
            character.persona_prompt
            or character.backstory
            or character.description
            or ""
        )

        try:
            if safe_mode:
                prompt_bundle = build_state_initialization_prompt_safe(
                    character_name=character.name,
                    persona_prompt=persona_text,
                    avatar_url=character.avatar_url,
                )
            else:
                prompt_bundle = build_state_initialization_prompt(
                    character_name=character.name,
                    persona_prompt=persona_text,
                    avatar_url=character.avatar_url,
                )

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt_bundle.user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=prompt_bundle.system_instruction
                ),
            )

            if response and response.text:
                parsed = self._parse_state_seed(response.text, allowed_keys)
                if parsed:
                    return parsed
                self.logger.warning("⚠️ Unable to parse state seed from Gemini response; using fallback")
            else:
                self.logger.warning("⚠️ Empty response when generating state seed; using fallback")

        except Exception as exc:
            self.logger.error(f"❌ Error generating state seed: {exc}")

        return fallback_state

    # PRIVATE METHODS - Simplified implementations

    def _get_character_prompt(self, character: Optional[Character]) -> str:
        """
        Get character prompt using PromptEngine (unified path for all characters).

        Returns the persona text that will be appended to system prompt.
        """
        if not character:
            return ""

        try:
            # Use PromptEngine for all characters
            selected_system_prompt, _ = select_system_prompt(character)
            engine = PromptEngine(system_prompt=selected_system_prompt)
            compiled = engine.compile(character)

            # Extract persona text from compiled result
            persona_source = compiled['used_fields'].get('persona_source', 'unknown')
            self.logger.info(f"📝 Character prompt source: {persona_source}")

            # Return the assembled system text (without the system_header which is already in selected_system_prompt)
            sections = compiled.get('sections', {})
            persona_parts = []

            if 'persona' in sections:
                persona_parts.append(sections['persona'])
            if 'gender_hint' in sections:
                persona_parts.append(sections['gender_hint'])

            return '\n\n'.join(persona_parts) if persona_parts else ""

        except Exception as e:
            self.logger.error(f"Error getting character prompt: {e}")
            # Fallback to basic character info
            return f"角色设定：\n你是{character.name}。{character.backstory or character.description or ''}"

    def _manage_conversation_length(self, messages: List[ChatMessage], max_messages: int = 50) -> List[ChatMessage]:
        """
        Manage conversation length to stay within token limits while preserving context.

        Strategy (increased from 20 to 50 for better context):
        - Keep first 3 messages (character establishment)
        - Keep most recent 47 messages (current context)
        - Drop middle messages if needed
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
        """Extract character name for conversation history formatting"""
        if character and character.name:
            # Sanitize character name to prevent prompt injection
            import re
            sanitized_name = re.sub(r'[^\w\s\u4e00-\u9fff]', '', character.name)
            return sanitized_name[:50]  # Limit length

        # Fallback to generic name
        return "AI助手"

    def _remove_character_name_prefix(self, text: str, character: Optional[Character]) -> str:
        """Remove character name prefix if LLM echoed it from the prompt"""
        if not text or not character:
            return text

        character_name = self._extract_character_name(character)

        # Check for patterns like "恩爱 秘密教学: " or "恩爱: " at the start
        import re
        # Normalize whitespace in character name for flexible matching
        name_pattern = re.escape(character_name).replace(r'\ ', r'\s+')
        # Pattern: character name followed by optional colon and space
        pattern = rf'^{name_pattern}\s*[:：]\s*'
        cleaned = re.sub(pattern, '', text, count=1)

        if cleaned != text:
            self.logger.debug(f"🧹 Removed character name prefix from response")

        return cleaned

    @property
    def intent_service(self):
        """Lazy-loaded intent service instance (industry standard pattern)"""
        if self._intent_service is None:
            try:
                from .nsfw_intent_service import NSFWIntentService
                # Share the Gemini client to avoid duplication
                self._intent_service = NSFWIntentService(gemini_client=self.client)
                self.logger.info("🎯 NSFWIntentService initialized for this conversation")
            except (ImportError, Exception) as e:
                self.logger.warning(f"⚠️ Intent service unavailable: {e}")
                return None
        return self._intent_service

    async def _detect_user_intent_background(self, messages: List[ChatMessage]) -> Optional[str]:
        """
        Detect sexual activity stage in background for user-agency protection

        Returns stage (e.g., "抽插时") or None if detection fails
        """
        try:
            # Use the shared stage detection service
            if self.intent_service:
                stage = await self.intent_service.detect_user_intent(messages)
                return stage
            else:
                return None
        except Exception as e:
            self.logger.warning(f"⚠️ Stage detection failed: {e}")
            return None  # Graceful fallback - conversation continues without stage reminder

    def _build_intent_guidance(self, stage: str) -> str:
        """
        Build SHORT stage-specific reminder based on detected stage

        Returns empty string for low-risk stages, short reminder for high-risk stages
        """
        # Use the centralized reminder from the stage detection service
        if self.intent_service:
            return self.intent_service.build_intent_guidance(stage)
        else:
            # No fallback needed - empty string is fine
            return ""

    def _parse_state_seed(self, text: str, allowed_keys: Iterable[str]) -> Dict[str, str]:
        if not text:
            return {}

        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()

        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or start >= end:
            return {}

        candidate_text = cleaned[start : end + 1]

        try:
            parsed = json.loads(candidate_text)
        except json.JSONDecodeError:
            return {}

        if not isinstance(parsed, dict):
            return {}

        result: Dict[str, str] = {}
        for key in allowed_keys:
            value = parsed.get(key)
            if isinstance(value, str) and value.strip():
                result[str(key)] = value.strip()
        return result

    def _simulate_state_seed(self, allowed_keys: Iterable[str], *, safe_mode: bool) -> Dict[str, str]:
        if safe_mode:
            base = {
                "衣着": "穿搭整洁得体，色调温和",
                "仪态": "站姿放松，自信自然",
                "情绪": "心情愉悦，对交流充满期待",
                "环境": "温暖明亮的室内空间，布置舒适",
                "动作": "双手自然垂放，偶尔整理袖口",
                "语气": "亲切柔和，带着一丝兴奋",
            }
        else:
            base = {
                "胸部": "柔软饱满，布料轻贴，伴随呼吸微微起伏",
                "下体": "带着余热与敏感，隐约透出渴望",
                "衣服": "贴身衣物略显凌乱，勾勒出诱人曲线",
                "姿势": "身体微微前倾，呈现出主动亲近的姿态",
                "情绪": "期待、雀跃并带着羞怯的悸动",
                "环境": "私密空间光线暖柔，空气中弥漫甜香",
            }

        return {str(key): base.get(str(key), "未设定") for key in allowed_keys}

    def _build_conversation_prompt(
        self,
        messages: List[ChatMessage],
        character: Optional[Character] = None,
        state: Optional[Dict[str, str]] = None,
        stage: Optional[str] = None,
    ) -> List[Dict]:
        """
        Build conversation prompt with FULL conversation history, state tracking, and stage reminder.

        Combines:
        - Stage reminder (SHORT negative constraint, only for high-risk stages)
        - State tracking (character state persistence)
        - Natural conversation flow
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

        # Build context sections
        stage_reminder = ""
        if stage:
            reminder_text = self._build_intent_guidance(stage)
            if reminder_text:  # Only inject if there's a reminder (high-risk stage)
                stage_reminder = f"{reminder_text}\n\n"

        state_context = ""
        if state:
            try:
                state_json = json.dumps(state, ensure_ascii=False)
            except (TypeError, ValueError):
                state_json = ""
            if state_json:
                state_context = f"[当前状态: {state_json}]\n\n"

        # Create conversation prompt with stage reminder and state
        if conversation_history:
            # End with character name to prompt natural continuation
            full_prompt = f"{stage_reminder}{state_context}{conversation_history.rstrip()}\n{character_name}:"
        else:
            # For new conversations, just start with character name
            full_prompt = f"{stage_reminder}{state_context}{character_name}:"

        if stage_reminder:
            self.logger.info(f"💬 Conversation prompt with stage reminder: {len(messages)} messages for {character_name}, stage '{stage}'")
        else:
            self.logger.info(f"💬 Conversation prompt built: {len(messages)} messages for {character_name}")

        # Return in Gemini API format
        return [{
            "role": "user",
            "parts": [{"text": full_prompt}]
        }]

    def _extract_state_update(self, response_text: str) -> Tuple[str, Dict[str, str]]:
        pattern = r"\[\[STATE_UPDATE\]\](?P<json>{.*?})\[\[/STATE_UPDATE\]\]"
        match = re.search(pattern, response_text, re.DOTALL)
        if not match:
            return response_text, {}

        raw_block = match.group(0)
        raw_json = match.group("json")
        try:
            state_update = json.loads(raw_json)
            if not isinstance(state_update, dict):
                state_update = {}
        except json.JSONDecodeError:
            self.logger.warning("⚠️ Failed to parse state update block: %s", raw_json)
            state_update = {}

        cleaned = response_text.replace(raw_block, "").strip()
        return cleaned, state_update

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

        # Simple fallback response
        if character and character.name:
            return f"*responds as {character.name}*\n\nI find your question quite interesting. Let me consider how best to answer you."
        else:
            return "I understand. How can I help you today?"
