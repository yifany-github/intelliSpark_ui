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
import base64
import io
import wave
import json
import re
import os
from models import Character, ChatMessage
from .ai_service_base import AIServiceBase, AIServiceError
from utils.prompt_selector import select_system_prompt
from .prompt_engine import PromptEngine
from prompts.opening_line import build_opening_line_prompt
from prompts.beat_progression import (
    build_beat_hint,
    detect_beat_mode,
    last_assistant_text,
    last_user_text,
    reply_needs_quality_retry,
)
from prompts.turn_contract import (
    build_turn_contract,
    contract_violated,
    detect_location_from_recent,
)
from prompts.scene_bootstrap import (
    build_scene_bootstrap_prompt,
    parse_scene_bootstrap_response,
    scene_pair_looks_coherent,
)
from prompts.state_initialization import (
    STATE_KEYS as NSFW_STATE_KEYS,
    build_state_initialization_prompt,
)
from prompts.state_initialization_safe import (
    SAFE_STATE_KEYS,
    build_state_initialization_prompt_safe,
)
from utils.language_utils import get_language_labels, normalize_language_code
from utils.gemini_response import extract_text_parts
import logging

logger = logging.getLogger(__name__)

QUANTIFIABLE_KEYS = {"情绪", "好感度", "信任度", "兴奋度", "疲惫度", "欲望值", "敏感度"}

class GeminiService(AIServiceBase):
    """Simplified Gemini service with clean architecture (post-Issue #129)"""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize Gemini service"""
        default_model = "gemini-2.0-flash-001"
        model_name = os.getenv("GEMINI_MODEL", "").strip() or default_model
        super().__init__(model_name, api_key)
        self._intent_service = None  # Lazy-loaded intent service
        self.last_audio_mime_type: Optional[str] = None

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
        state: Optional[Dict[str, Any]] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """Generate AI response using Gemini with simplified direct flow"""

        if not self.is_available:
            raise AIServiceError("Gemini service unavailable")

        try:
            # Extract chat_language from user_preferences for prompt generation
            target_language = None
            if user_preferences and 'chat_language' in user_preferences:
                target_language = normalize_language_code(user_preferences['chat_language'])

            # Get character prompt using PromptEngine (unified path for all characters)
            character_prompt = self._get_character_prompt(character, chat_language=target_language)

            self.logger.info(f"🎭 Generating response for character: {character.name if character else 'default'}")

            # Manage conversation length to stay within token limits
            managed_messages = self._manage_conversation_length(messages)

            # Detect sexual activity stage for targeted user-agency protection
            stage = await self._detect_user_intent_background(managed_messages)
            beat_mode = detect_beat_mode(managed_messages)
            persona_for_contract = (
                (getattr(character, "persona_prompt", None) or "").strip()
                or (getattr(character, "backstory", None) or "").strip()
                or (getattr(character, "description", None) or "").strip()
            )
            turn_contract = build_turn_contract(
                managed_messages,
                state,
                language=target_language or "zh",
                persona_text=persona_for_contract,
            )
            # Align beat hint with director contract when intimacy / conflict / execute / lead fires
            if turn_contract.mode in {"intimacy", "conflict", "execute", "lead"}:
                beat_mode = turn_contract.mode

            # Build conversation prompt with full history, state, and stage reminder
            conversation_prompt = self._build_conversation_prompt(
                managed_messages,
                character,
                state,
                stage,
                language=target_language,
                beat_mode=beat_mode,
                turn_contract=turn_contract,
            )

            # Get selected system prompt (SAFE vs NSFW)
            selected_system_prompt, prompt_type = select_system_prompt(character)
            self.logger.info(
                f"🧭 Using {prompt_type} system prompt (beat={beat_mode}, contract={turn_contract.mode})"
            )

            # Build system instruction
            system_instruction = f"{selected_system_prompt}\n\n{character_prompt}"

            is_nsfw = prompt_type == "NSFW"
            thinking_config = self._build_thinking_config()
            generate_config = self._build_generate_config(
                system_instruction=system_instruction,
                thinking_config=thinking_config,
                is_nsfw=is_nsfw,
            )
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=conversation_prompt,
                config=generate_config,
            )

            response_text = extract_text_parts(response)
            if response_text:
                clean_text, state_update = self._extract_state_update(response_text.strip())
                clean_text = self._remove_character_name_prefix(clean_text, character)

                needs_retry = reply_needs_quality_retry(
                    reply=clean_text,
                    mode=beat_mode,
                    previous_assistant=last_assistant_text(managed_messages),
                    last_user=last_user_text(managed_messages),
                ) or contract_violated(
                    clean_text,
                    turn_contract,
                    state_update,
                    location_hint=detect_location_from_recent(managed_messages),
                    messages=managed_messages,
                    prior_state=state if isinstance(state, dict) else None,
                )

                if needs_retry:
                    self.logger.warning(
                        "⚠️ Quality retry (beat=%s, contract=%s)",
                        beat_mode,
                        turn_contract.mode,
                    )
                    retry_prompt = self._build_conversation_prompt(
                        managed_messages,
                        character,
                        state,
                        stage,
                        language=target_language,
                        beat_mode=beat_mode,
                        turn_contract=turn_contract,
                        force_pass_ball=(beat_mode == "pass_ball" or turn_contract.mode == "execute"),
                        force_quality_retry=True,
                    )
                    retry_response = self.client.models.generate_content(
                        model=self.model_name,
                        contents=retry_prompt,
                        config=generate_config,
                    )
                    retry_text = extract_text_parts(retry_response)
                    if retry_text:
                        clean_text, state_update = self._extract_state_update(
                            retry_text.strip()
                        )
                        clean_text = self._remove_character_name_prefix(clean_text, character)
                        response = retry_response

                input_tokens = getattr(response.usage_metadata, "prompt_token_count", 0)
                output_tokens = getattr(response.usage_metadata, "candidates_token_count", 0)

                token_info = {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": input_tokens + output_tokens,
                    "beat_mode": beat_mode,
                    "turn_contract": turn_contract.mode,
                }
                if getattr(turn_contract, "active_dynamic", ""):
                    token_info["active_dynamic"] = turn_contract.active_dynamic
                if state_update:
                    token_info["state_update"] = state_update

                return clean_text, token_info

            block_reason = self._get_block_reason(response)
            if block_reason:
                self.logger.warning("⚠️ Gemini blocked response: %s", block_reason)
                raise AIServiceError(f"Gemini blocked response: {block_reason}")

            self.logger.warning("⚠️ Empty response from Gemini")
            raise AIServiceError("Empty response from Gemini")

        except Exception as e:
            self.logger.error(f"❌ Error generating Gemini response: {e}")
            raise AIServiceError(str(e))

    async def generate_opening_line(self, character: Character) -> str:
        """Generate an opening line for a character"""
        self.logger.info(f"🚀 Generating opening line for character: {character.name}")

        fallback_line = (
            f"你好，我是{character.name}，期待与你开始这段故事。"
            if character and character.name
            else "你好，我是你的专属向导。"
        )

        if not self.is_available:
            raise AIServiceError("Gemini service unavailable")

        try:
            persona_for_opener = (
                (getattr(character, "persona_prompt", None) or "").strip()
                or (getattr(character, "backstory", None) or "").strip()
                or (character.description or "")
            )
            prompt_bundle = build_opening_line_prompt(
                character.name,
                persona_for_opener,
            )

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt_bundle.user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=prompt_bundle.system_instruction,
                    thinking_config=self._build_thinking_config(),
                ),
            )

            response_text = extract_text_parts(response)
            if response_text:
                return response_text.strip()

            block_reason = self._get_block_reason(response)
            if block_reason:
                self.logger.warning("⚠️ Gemini blocked opening line: %s", block_reason)
                raise AIServiceError(f"Gemini blocked opening line: {block_reason}")

            self.logger.warning("⚠️ Empty response from Gemini for opening line")
            raise AIServiceError("Empty response from Gemini for opening line")

        except Exception as e:
            self.logger.error(f"❌ Error generating opening line: {e}")
            raise AIServiceError(str(e))

    async def generate_scene_bootstrap(
        self,
        character: Character,
        *,
        safe_mode: bool,
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Atomically generate opening_line + default state for ONE shared scene.

        Returns:
            {"opening_line": str, "state": dict, "scene_summary": str}
        """
        allowed_keys: Iterable[str] = SAFE_STATE_KEYS if safe_mode else NSFW_STATE_KEYS
        raw_language = normalize_language_code(language or "zh")
        target_language = "zh" if raw_language == "zh" else "en"
        fallback_state = self._simulate_state_seed(
            allowed_keys,
            safe_mode=safe_mode,
            language=target_language,
        )
        fallback_opening = (
            f"你好，我是{character.name}，期待与你开始这段故事。"
            if character and character.name
            else "你好，我是你的专属向导。"
        )
        # Empty dict = hard failure so AIModelManager can try another provider
        if not self.is_available:
            self.logger.warning("⚠️ No Gemini client available for scene bootstrap")
            return {}

        persona_text = (
            (getattr(character, "persona_prompt", None) or "").strip()
            or (getattr(character, "backstory", None) or "").strip()
            or (character.description or "")
            or ""
        )
        prompt_bundle = build_scene_bootstrap_prompt(
            character_name=character.name or "",
            description=character.description or "",
            persona_text=persona_text,
            voice_style=getattr(character, "voice_style", None) or "",
            safe_mode=safe_mode,
            state_keys=list(allowed_keys),
            language=target_language,
        )

        try:
            result = await self._request_scene_bootstrap(
                prompt_bundle=prompt_bundle,
                allowed_keys=allowed_keys,
                fallback_state=fallback_state,
                fallback_opening=fallback_opening,
            )
            if result and scene_pair_looks_coherent(
                result["opening_line"], result["state"], safe_mode=safe_mode
            ):
                return result

            self.logger.warning(
                "⚠️ Scene bootstrap incomplete/incoherent for %s; retrying once",
                getattr(character, "name", "?"),
            )
            missing_hint = (
                "补全非空：环境、衣服、姿势、胸部、下体"
                if not safe_mode
                else "补全非空：环境、衣着、仪态、动作、语气"
            )
            retry_user = (
                prompt_bundle.user_prompt
                + f"\n\n【重试强调】上一版不合格。{missing_hint}。opening_line 必须与这些字段同一现场。"
            )
            retry_bundle = type(prompt_bundle)(
                system_instruction=prompt_bundle.system_instruction,
                user_prompt=retry_user,
            )
            result = await self._request_scene_bootstrap(
                prompt_bundle=retry_bundle,
                allowed_keys=allowed_keys,
                fallback_state=fallback_state,
                fallback_opening=fallback_opening,
            )
            if result and result.get("opening_line") and result.get("state"):
                return result
        except Exception as exc:
            self.logger.error(f"❌ Error generating scene bootstrap: {exc}")

        return {}

    async def _request_scene_bootstrap(
        self,
        *,
        prompt_bundle,
        allowed_keys: Iterable[str],
        fallback_state: Dict[str, Any],
        fallback_opening: str,
    ) -> Optional[Dict[str, Any]]:
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt_bundle.user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=prompt_bundle.system_instruction,
                thinking_config=self._build_thinking_config(),
            ),
        )
        response_text = extract_text_parts(response)
        if not response_text:
            block_reason = self._get_block_reason(response)
            if block_reason:
                self.logger.warning("⚠️ Gemini blocked scene bootstrap: %s", block_reason)
            return None

        parsed = parse_scene_bootstrap_response(response_text, allowed_keys)
        if not parsed:
            return None

        opening = (parsed.get("opening_line") or "").strip() or fallback_opening
        state = fallback_state.copy()
        state.update(parsed.get("state") or {})
        return {
            "opening_line": opening,
            "state": state,
            "scene_summary": (parsed.get("scene_summary") or "").strip(),
        }

    async def generate_speech(
        self,
        text: str,
        voice_config: Optional[dict] = None,
        safety_settings: Optional[list[types.SafetySetting]] = None,
    ) -> bytes:
        """Generate speech audio bytes for the provided text."""
        if not text or not text.strip():
            raise AIServiceError("Text input for speech generation is empty")

        if not self.is_available:
            raise AIServiceError("Gemini service unavailable")

        tts_model = os.getenv("GEMINI_TTS_MODEL", "").strip() or "gemini-2.5-flash-preview-tts"
        tts_api_version = os.getenv("GEMINI_TTS_API_VERSION", "").strip()
        self.last_audio_mime_type = None

        try:
            tts_client = self.client
            if tts_api_version:
                tts_client = genai.Client(
                    api_key=self.api_key,
                    http_options=types.HttpOptions(api_version=tts_api_version),
                )

            default_voice = os.getenv("GEMINI_TTS_VOICE", "").strip() or "Kore"
            voice_name = default_voice
            language_code = None
            if voice_config:
                voice_name = (
                    voice_config.get("voice_name")
                    or voice_config.get("voiceName")
                    or voice_name
                )
                language_code = voice_config.get("language_code") or voice_config.get("languageCode")

            speech_config = None
            if voice_name or language_code:
                voice_config_obj = (
                    types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice_name
                        )
                    )
                    if voice_name
                    else None
                )
                speech_config = types.SpeechConfig(
                    voice_config=voice_config_obj,
                    language_code=language_code,
                )

            response = tts_client.models.generate_content(
                model=tts_model,
                contents=text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=speech_config,
                    safety_settings=safety_settings,
                ),
            )

            audio_bytes, mime_type = self._extract_audio_response(response)
            wav_bytes = self._ensure_wav_bytes(audio_bytes)
            self.last_audio_mime_type = "audio/wav"
            return wav_bytes

        except Exception as e:
            self.logger.error(f"❌ Error generating Gemini speech: {e}")
            raise AIServiceError(str(e))

    @staticmethod
    def _extract_audio_response(response) -> Tuple[bytes, Optional[str]]:
        if not response:
            raise AIServiceError("Gemini TTS returned no response")

        prompt_feedback = getattr(response, "prompt_feedback", None)
        if prompt_feedback and getattr(prompt_feedback, "block_reason", None):
            block_reason = prompt_feedback.block_reason
            block_message = getattr(prompt_feedback, "block_reason_message", None)
            detail = f"{block_reason}"
            if block_message:
                detail = f"{detail}: {block_message}"
            raise AIServiceError(f"Gemini TTS blocked: {detail}")

        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            parts = getattr(content, "parts", None) or []
            for part in parts:
                inline_data = getattr(part, "inline_data", None)
                if inline_data and getattr(inline_data, "data", None):
                    raw_data = inline_data.data
                    if isinstance(raw_data, str):
                        raw_bytes = base64.b64decode(raw_data)
                    elif isinstance(raw_data, bytes):
                        raw_bytes = raw_data
                    else:
                        raise AIServiceError("Unexpected audio payload type")
                    return raw_bytes, getattr(inline_data, "mime_type", None)

        raise AIServiceError("Gemini TTS returned no audio content")

    @staticmethod
    def _ensure_wav_bytes(pcm_bytes: bytes) -> bytes:
        if len(pcm_bytes) >= 12 and pcm_bytes[:4] == b"RIFF" and pcm_bytes[8:12] == b"WAVE":
            return pcm_bytes

        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wave_file:
            wave_file.setnchannels(1)
            wave_file.setsampwidth(2)
            wave_file.setframerate(24000)
            wave_file.writeframes(pcm_bytes)

        return buffer.getvalue()

    async def generate_state_seed(
        self,
        character: Character,
        *,
        safe_mode: bool,
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a default state seed for a character."""

        allowed_keys: Iterable[str] = SAFE_STATE_KEYS if safe_mode else NSFW_STATE_KEYS
        raw_language = normalize_language_code(language or "zh")
        target_language = "zh" if raw_language == "zh" else "en"
        fallback_state = self._simulate_state_seed(
            allowed_keys,
            safe_mode=safe_mode,
            language=target_language,
        )

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
                    language=target_language,
                )
            else:
                prompt_bundle = build_state_initialization_prompt(
                    character_name=character.name,
                    persona_prompt=persona_text,
                    avatar_url=character.avatar_url,
                    language=target_language,
                )

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt_bundle.user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=prompt_bundle.system_instruction,
                    thinking_config=self._build_thinking_config(),
                ),
            )

            response_text = extract_text_parts(response)
            if response_text:
                parsed = self._parse_state_seed(response_text, allowed_keys)
                if parsed:
                    merged = fallback_state.copy()
                    merged.update(parsed)
                    return merged
                self.logger.warning("⚠️ Unable to parse state seed from Gemini response; using fallback")
            else:
                self.logger.warning("⚠️ Empty response when generating state seed; using fallback")

        except Exception as exc:
            self.logger.error(f"❌ Error generating state seed: {exc}")

        return fallback_state

    # PRIVATE METHODS - Simplified implementations

    def _get_character_prompt(
        self,
        character: Optional[Character],
        chat_language: Optional[str] = None,
    ) -> str:
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
            user_prefs = {"chat_language": chat_language} if chat_language else None
            compiled = engine.compile(character, user_prefs=user_prefs)

            # Extract persona text from compiled result
            persona_source = compiled['used_fields'].get('persona_source', 'unknown')
            self.logger.info(f"📝 Character prompt source: {persona_source}")

            # Return character sections only (system_header is already selected separately)
            sections = compiled.get('sections', {})
            persona_parts = []

            if sections.get('character_block'):
                persona_parts.append(sections['character_block'])
            else:
                if sections.get('persona'):
                    persona_parts.append(sections['persona'])
                if sections.get('gender_hint'):
                    persona_parts.append(sections['gender_hint'])

            if sections.get('language_instruction'):
                persona_parts.append(sections['language_instruction'])

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

    def _build_intent_guidance(self, stage: str, language: Optional[str] = None) -> str:
        """
        Build SHORT stage-specific reminder based on detected stage

        Returns empty string for low-risk stages, short reminder for high-risk stages
        """
        # Use the centralized reminder from the stage detection service
        if self.intent_service:
            return self.intent_service.build_intent_guidance(stage, language=language)
        else:
            # No fallback needed - empty string is fine
            return ""

    def _parse_state_seed(self, text: str, allowed_keys: Iterable[str]) -> Dict[str, Any]:
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

        result: Dict[str, Any] = {}
        for key in allowed_keys:
            value = parsed.get(key)
            key_str = str(key)
            if key_str in QUANTIFIABLE_KEYS:
                normalized = self._normalize_quantified_value(value)
                if normalized:
                    result[key_str] = normalized
                continue
            if isinstance(value, str) and value.strip():
                result[key_str] = value.strip()
        return result

    @staticmethod
    def _normalize_quantified_value(value: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(value, dict):
            return None
        raw_value = value.get("value")
        try:
            numeric_value = int(float(raw_value))
        except (TypeError, ValueError):
            return None
        if numeric_value < 0 or numeric_value > 10:
            return None
        description = value.get("description")
        if not isinstance(description, str):
            return None
        description = description.strip()
        if not description or description == "未设定":
            return None
        return {"value": numeric_value, "description": description}

    def _simulate_state_seed(
        self,
        allowed_keys: Iterable[str],
        *,
        safe_mode: bool,
        language: str = "zh",
    ) -> Dict[str, Any]:
        if safe_mode:
            base = {
                "衣着": "穿搭整洁得体，色调温和",
                "仪态": "站姿放松，自信自然",
                "情绪": {"value": 6, "description": "心情愉悦，对交流充满期待"},
                "好感度": {"value": 4, "description": "初次见面，保持礼貌的距离感"},
                "信任度": {"value": 3, "description": "略有戒备，需要时间建立信任"},
                "兴奋度": {"value": 5, "description": "保持平稳的心态"},
                "疲惫度": {"value": 3, "description": "精力充沛，状态良好"},
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
                "情绪": {"value": 6, "description": "期待、雀跃并带着羞怯的悸动"},
                "好感度": {"value": 5, "description": "对你充满好奇，愿意进一步了解"},
                "信任度": {"value": 4, "description": "在这个私密空间中略显放松"},
                "兴奋度": {"value": 5, "description": "内心涌动着期待感"},
                "疲惫度": {"value": 3, "description": "精力充沛，身体充满活力"},
                "欲望值": {"value": 4, "description": "身体开始感受到微妙的渴望"},
                "敏感度": {"value": 6, "description": "肌肤对触碰的反应敏锐"},
                "环境": "私密空间光线暖柔，空气中弥漫甜香",
            }

        if language == "en":
            if safe_mode:
                base = {
                    "衣着": "Neat, modest outfit in soft tones",
                    "仪态": "Relaxed posture, confident and natural",
                    "情绪": {"value": 6, "description": "Cheerful mood, eager to engage"},
                    "好感度": {"value": 4, "description": "First impressions, polite distance"},
                    "信任度": {"value": 3, "description": "Slightly cautious, trust needs time"},
                    "兴奋度": {"value": 5, "description": "Steady and composed"},
                    "疲惫度": {"value": 3, "description": "Energetic and well-rested"},
                    "环境": "Warm, well-lit indoor space with cozy decor",
                    "动作": "Hands relaxed at the sides, occasionally tidies sleeves",
                    "语气": "Warm and gentle, with a hint of excitement",
                }
            else:
                base = {
                    "胸部": "Soft and full, fabric lightly pressed, subtly rising with breath",
                    "下体": "Warm and sensitive, a faint trace of desire",
                    "衣服": "Close-fitting garments slightly disheveled, outlining enticing curves",
                    "姿势": "Leaning forward a little, an inviting, intimate posture",
                    "情绪": {"value": 6, "description": "Anticipation and shy excitement beneath a warm smile"},
                    "好感度": {"value": 5, "description": "Curious about you, willing to grow closer"},
                    "信任度": {"value": 4, "description": "Relaxing in this private space, still a little guarded"},
                    "兴奋度": {"value": 5, "description": "A steady undercurrent of excitement"},
                    "疲惫度": {"value": 3, "description": "Plenty of energy, body feels lively"},
                    "欲望值": {"value": 4, "description": "A subtle, growing desire"},
                    "敏感度": {"value": 6, "description": "Skin responds keenly to touch"},
                    "环境": "Soft, warm lighting in a private space, air sweet with perfume",
                }

        missing_value = "Not set" if language == "en" else "未设定"
        return {str(key): base.get(str(key), missing_value) for key in allowed_keys}

    def _build_conversation_prompt(
        self,
        messages: List[ChatMessage],
        character: Optional[Character] = None,
        state: Optional[Dict[str, Any]] = None,
        stage: Optional[str] = None,
        language: Optional[str] = None,
        beat_mode: Optional[str] = None,
        turn_contract=None,
        force_pass_ball: bool = False,
        force_quality_retry: bool = False,
    ) -> List[Dict]:
        """
        Build conversation prompt with FULL conversation history, state tracking, and stage reminder.

        Combines:
        - Stage reminder (SHORT negative constraint, only for high-risk stages)
        - State tracking (character state persistence)
        - Turn contract (director sheet for this beat)
        - Beat progression (keep user in-scene, not as audience)
        - Natural conversation flow
        """

        character_name = self._extract_character_name(character)
        target_language = normalize_language_code(language) if language else "zh"
        labels = get_language_labels(target_language)
        user_label = labels["user"]
        state_prefix = labels["state_prefix"]

        # Build natural conversation history
        conversation_history = ""

        for message in messages:
            if message.role == 'user':
                conversation_history += f"{user_label}: {message.content}\n"
            elif message.role == 'assistant':
                conversation_history += f"{character_name}: {message.content}\n"

        # Build context sections
        stage_reminder = ""
        if stage:
            reminder_text = self._build_intent_guidance(stage, language=target_language)
            if reminder_text:  # Only inject if there's a reminder (high-risk stage)
                stage_reminder = f"{reminder_text}\n\n"

        state_context = ""
        if state:
            try:
                state_json = json.dumps(state, ensure_ascii=False)
            except (TypeError, ValueError):
                state_json = ""
            if state_json:
                state_context = f"[{state_prefix}: {state_json}]\n\n"

        # Create conversation prompt with stage reminder and state
        # Do NOT end with "{name}:" — that biases the model into third-person novel narration.
        # Length ramp: early turns stay shorter so opening → first reply doesn't whiplash.
        mode = beat_mode or detect_beat_mode(messages)
        if force_pass_ball:
            mode = "pass_ball"
        if turn_contract is None:
            persona_for_contract = (
                (getattr(character, "persona_prompt", None) or "").strip()
                or (getattr(character, "backstory", None) or "").strip()
                or (getattr(character, "description", None) or "").strip()
            )
            turn_contract = build_turn_contract(
                messages,
                state,
                language=target_language,
                persona_text=persona_for_contract,
            )
        if turn_contract.mode in {"intimacy", "conflict", "execute", "lead"}:
            mode = turn_contract.mode
        early_turn = mode == "early"
        if turn_contract.mode in {"intimacy", "conflict", "execute"}:
            continue_hint = {
                "zh": "（请以角色本人继续回应：第一人称对白 + *动作*；亲密/执行拍篇幅约160–320字，写足眼神表情与身体反应；换场后禁止复读旧场景气味；不要用「角色名听到/感受到」开场；禁止一两句软拒或「你满意了吧」）",
                "en": "(Continue in-character: first-person + *actions*; intimacy/execute — erotic density, matching-scene sensory; no soft-refuse or confirmation-loop endings.)",
                "es": "(Continúa en personaje: diálogo + *acciones*; densidad erótica; sin rechazo vacío ni '¿quedaste satisfecho?'.)",
                "ko": "(캐릭터 본인으로: 1인칭 + *동작*; 친밀/실행 턴은 시선·표정·신체 반응; 이전 장면 냄새 금지; 거절/확인 한 줄로 끝내지 마세요.)",
            }.get(
                target_language,
                "(Continue in-character: intimacy/execute — immersive erotic density, scene-matched sensory, no soft-refuse one-liner.)",
            )
        elif turn_contract.mode == "lead":
            continue_hint = {
                "zh": "（请以角色本人继续回应：用户在邀请你带领——只推进半拍到一格，制造期待；主动可以，禁止一次跳到性交中段；约120–240字）",
                "en": "(Continue in-character: user invites you to lead — half-beat anticipation, not mid-act dump.)",
                "es": "(Continúa en personaje: medio compás de anticipación, no saltes al acto.)",
                "ko": "(캐릭터로: 반 박자만 전진, 기대감 유지. 중반 섹스로 점프 금지.)",
            }.get(
                target_language,
                "(Continue in-character: lead with half-beat anticipation.)",
            )
        elif early_turn:
            continue_hint = {
                "zh": "（请以角色本人继续回应：第一人称对白 + *动作*；此为开场后前几轮，篇幅约80–180字即可，先立住角色口吻与情绪；不要用「角色名听到/感受到」开场；不要只回一两句空壳，也不要写成小作文）",
                "en": "(Continue in-character: first-person dialogue + *actions*; early turns — about a short immersive paragraph, not a wall of text; do not open with '{name} hears/feels' narration.)",
                "es": "(Continúa en personaje: diálogo en primera persona + *acciones*; turnos iniciales — un párrafo inmersivo corto, no un muro de texto; no abras con narración 'el personaje oye/siente'.)",
                "ko": "(캐릭터 본인으로 이어가세요: 1인칭 대사 + *동작*; 초반 턴은 짧은 몰입 문단 정도면 됩니다; '이름이 듣고/느끼며' 식 서술로 시작하지 마세요.)",
            }.get(
                target_language,
                "(Continue in-character: first-person dialogue + *actions*; early turn — short immersive paragraph, not a wall of text.)",
            )
        else:
            continue_hint = {
                "zh": "（请以角色本人继续回应：第一人称对白 + *动作*；完整沉浸篇幅约120–350字；不要用「角色名听到/感受到」开场；不要只回一两句空壳）",
                "en": "(Continue in-character: first-person dialogue + *actions*; aim for a full immersive reply, not a one-liner; do not open with '{name} hears/feels' narration.)",
                "es": "(Continúa en personaje: diálogo en primera persona + *acciones*; respuesta inmersiva completa, no una sola frase; no abras con narración 'el personaje oye/siente'.)",
                "ko": "(캐릭터 본인으로 이어가세요: 1인칭 대사 + *동작*; 한두 문장 껍데기가 아니라 몰입감 있는 분량으로; '이름이 듣고/느끼며' 식 서술로 시작하지 마세요.)",
            }.get(
                target_language,
                "(Continue in-character: first-person dialogue + *actions*; full immersive reply, not a one-liner.)",
            )
        if "{name}" in continue_hint:
            continue_hint = continue_hint.replace("{name}", character_name)

        beat_hint = build_beat_hint(mode, target_language)
        if force_pass_ball:
            beat_hint = (
                beat_hint
                + (
                    " 【重试】上一版仍在独角戏里忽略用户；本轮必须把用户拉进动作里。"
                    if target_language == "zh"
                    else " [RETRY] Previous reply still sidelined the user — pull them into the action."
                )
            )
        if force_quality_retry:
            if turn_contract.mode in {"intimacy", "conflict"}:
                beat_hint = (
                    beat_hint
                    + (
                        " 【重试】上一版亲密拍太短或只有软拒、关系没动。"
                        "本轮必须写出人设冲突/心动张力，身体有推进，欲望或好感要变，篇幅写够。"
                        if target_language == "zh"
                        else " [RETRY] Prior intimacy beat was thin or soft-refuse only. "
                        "Write Desire vs Role tension, advance the body/relationship, update desire/favor, write enough length."
                    )
                )
            else:
                beat_hint = (
                    beat_hint
                    + (
                        " 【重试】上一版太像色话机器或忽略了用户的人情/日常，或问句菜单太多。"
                        "本轮先像人：接住用户原话里的关心/问题，少问多做，写入真实环境感官；整段最多一句问句。"
                        if target_language == "zh"
                        else " [RETRY] Prior reply felt like a smut machine, ignored the human beat, or used a question menu. "
                        "Be a person first; do more ask less; ground real sensory detail; at most one question."
                    )
                )
        continue_hint = f"{continue_hint}\n{beat_hint}\n{turn_contract.to_prompt(target_language)}"

        if conversation_history:
            full_prompt = f"{stage_reminder}{state_context}{conversation_history.rstrip()}\n\n{continue_hint}"
        else:
            full_prompt = f"{stage_reminder}{state_context}{continue_hint}"

        if stage_reminder:
            self.logger.info(
                f"💬 Conversation prompt with stage reminder: {len(messages)} messages for {character_name}, stage '{stage}', beat '{mode}', contract '{turn_contract.mode}'"
            )
        else:
            self.logger.info(
                f"💬 Conversation prompt built: {len(messages)} messages for {character_name}, beat '{mode}', contract '{turn_contract.mode}'"
            )

        # Return in Gemini API format
        return [{
            "role": "user",
            "parts": [{"text": full_prompt}]
        }]

    def _get_block_reason(self, response: Any) -> Optional[str]:
        if not response:
            return None

        feedback = getattr(response, "prompt_feedback", None)
        if feedback:
            if getattr(feedback, "blocked", None):
                block_reason = getattr(feedback, "block_reason", None)
                return str(block_reason or "prompt_feedback.blocked")
            block_reason = getattr(feedback, "block_reason", None)
            if block_reason:
                return str(block_reason)

        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            finish_reason = getattr(candidate, "finish_reason", None)
            if finish_reason:
                finish_str = str(finish_reason)
                finish_upper = finish_str.upper()
                if finish_upper in {"SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT"}:
                    return f"finish_reason={finish_str}"

            safety_ratings = getattr(candidate, "safety_ratings", None) or []
            for rating in safety_ratings:
                if getattr(rating, "blocked", False):
                    category = getattr(rating, "category", None)
                    if category:
                        return f"safety_ratings_blocked:{category}"
                    return "safety_ratings_blocked"

        return None

    def _build_generate_config(
        self,
        *,
        system_instruction: str,
        thinking_config: Optional[types.ThinkingConfig],
        is_nsfw: bool,
    ) -> types.GenerateContentConfig:
        """
        Generation knobs tuned for immersive RP quality.

        Higher temperature for NSFW keeps sensory variety; safety BLOCK_NONE
        only for sexually_explicit on NSFW characters so heat isn't soft-censored.
        """
        temperature = 0.95 if is_nsfw else 0.8
        try:
            env_temp = os.getenv("GEMINI_TEMPERATURE", "").strip()
            if env_temp:
                temperature = float(env_temp)
        except ValueError:
            self.logger.warning("Invalid GEMINI_TEMPERATURE; using default")

        max_output_tokens = 1200 if is_nsfw else 900
        try:
            env_max = os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "").strip()
            if env_max:
                max_output_tokens = int(env_max)
        except ValueError:
            self.logger.warning("Invalid GEMINI_MAX_OUTPUT_TOKENS; using default")

        return types.GenerateContentConfig(
            system_instruction=system_instruction,
            thinking_config=thinking_config,
            temperature=temperature,
            top_p=0.95,
            max_output_tokens=max_output_tokens,
            safety_settings=self._build_chat_safety_settings(is_nsfw=is_nsfw),
        )

    def _build_chat_safety_settings(
        self,
        *,
        is_nsfw: bool,
    ) -> Optional[list[types.SafetySetting]]:
        if not is_nsfw:
            return None

        raw_flag = os.getenv("GEMINI_CHAT_ALLOW_NSFW", "").strip().lower()
        if raw_flag in {"0", "false", "no"}:
            return None
        # Default allow for NSFW characters unless explicitly disabled
        if raw_flag and raw_flag not in {"1", "true", "yes"}:
            return None

        return [
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=types.HarmBlockThreshold.BLOCK_NONE,
            ),
        ]

    @staticmethod
    def _thinking_budget_for_level(level: str) -> Optional[int]:
        level = level.lower()
        if level == "minimal":
            return 0
        if level == "low":
            return 128
        if level == "high":
            return -1
        return None

    def _build_thinking_config(self) -> Optional[types.ThinkingConfig]:
        level = os.getenv("GEMINI_THINKING_LEVEL", "").strip().lower()
        budget_env = os.getenv("GEMINI_THINKING_BUDGET", "").strip()

        if level:
            try:
                return types.ThinkingConfig(thinking_level=level)
            except Exception:
                budget = self._thinking_budget_for_level(level)
                if budget is not None:
                    return types.ThinkingConfig(thinking_budget=budget)

        if budget_env:
            try:
                return types.ThinkingConfig(thinking_budget=int(budget_env))
            except ValueError:
                self.logger.warning("Invalid GEMINI_THINKING_BUDGET=%s", budget_env)
        return None

    def _extract_state_update(self, response_text: str) -> Tuple[str, Dict[str, Any]]:
        from utils.state_block import extract_state_update

        return extract_state_update(response_text or "")

    def _simulate_response(
        self,
        character: Character,
        messages: List[ChatMessage]
    ) -> str:
        """Simulate AI response when Gemini is not available"""
        return super()._simulate_response(character, messages)
