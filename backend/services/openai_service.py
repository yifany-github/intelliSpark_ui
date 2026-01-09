"""
OpenAI GPT Service for IntelliSpark AI Chat Application

Provides OpenAI chat completions as an additional model option.
"""

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import openai

from models import Character, ChatMessage
from prompts.system import SYSTEM_PROMPT
from utils.prompt_selector import select_system_prompt
from .ai_service_base import AIServiceBase, AIServiceError

logger = logging.getLogger(__name__)
LOG_RAW_OPENAI_RESPONSE = os.getenv("OPENAI_LOG_RESPONSE", "").lower() in {"1", "true", "yes"}
MAX_LOG_RESPONSE_CHARS = 1000


class OpenAIService(AIServiceBase):
    """OpenAI GPT service implementation."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize OpenAI service."""
        super().__init__("gpt-5-mini", api_key)

    async def initialize(self) -> bool:
        """Initialize OpenAI client."""
        try:
            if not self.api_key:
                self.logger.warning("No OpenAI API key provided. OpenAI service unavailable.")
                return True

            self.client = openai.AsyncOpenAI(api_key=self.api_key)
            self.logger.info("OpenAI service initialized successfully")
            return True
        except Exception as e:
            self.logger.error(f"Failed to initialize OpenAI service: {e}")
            self.client = None
            return False

    @property
    def is_available(self) -> bool:
        return self.client is not None and self.api_key is not None

    @property
    def service_name(self) -> str:
        return "OpenAI GPT-5 mini"

    async def generate_response(
        self,
        character: Character,
        messages: List[ChatMessage],
        user_preferences: Optional[dict] = None,
        state: Optional[Dict[str, str]] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """Generate AI response using OpenAI."""
        if not self.is_available:
            raise AIServiceError("OpenAI service unavailable")

        try:
            chat_language = None
            if user_preferences and "chat_language" in user_preferences:
                chat_language = user_preferences["chat_language"]

            character_prompt = self._get_character_prompt(character, chat_language=chat_language)
            managed_messages = self._manage_conversation_length(messages)
            openai_input = self._build_openai_input(
                character_prompt,
                managed_messages,
                character,
                state,
            )
            generation_config = self._build_generation_config(user_preferences)

            if not hasattr(self.client, "responses"):
                raise AIServiceError("OpenAI responses API not available in client")

            response = await self.client.responses.create(
                model=self.model_name,
                input=openai_input,
                **generation_config
            )

            if not response:
                raise AIServiceError("Empty response from OpenAI")

            raw_text = self._extract_response_text(response)
            response_status = getattr(response, "status", None)
            if response_status and str(response_status).lower() in {"failed", "incomplete"}:
                raise AIServiceError(f"OpenAI response status={response_status}")
            if not raw_text.strip():
                raise AIServiceError("OpenAI returned empty response content")
            if LOG_RAW_OPENAI_RESPONSE:
                preview = raw_text
                if len(preview) > MAX_LOG_RESPONSE_CHARS:
                    preview = f"{preview[:MAX_LOG_RESPONSE_CHARS]}...[truncated]"
                self.logger.info(
                    "OpenAI raw response len=%s status=%s: %s",
                    len(raw_text),
                    response_status,
                    preview,
                )
            response_text, state_update = self._extract_state_update(raw_text.strip())

            if not response_text.strip():
                raise AIServiceError("OpenAI response contained only state update")

            usage = getattr(response, "usage", None)
            token_info = {
                "input_tokens": getattr(usage, "input_tokens", getattr(usage, "prompt_tokens", 0)) if usage else 0,
                "output_tokens": getattr(usage, "output_tokens", getattr(usage, "completion_tokens", 0)) if usage else 0,
                "total_tokens": getattr(usage, "total_tokens", 0) if usage else 0,
            }
            if state_update:
                token_info["state_update"] = state_update

            return response_text, token_info

        except Exception as e:
            self.logger.error(f"Error generating OpenAI response: {e}")
            raise AIServiceError(str(e))

    async def generate_opening_line(self, character: Character) -> str:
        """Generate opening line for character using OpenAI."""
        if not self.is_available:
            raise AIServiceError("OpenAI service unavailable")

        try:
            if not hasattr(self.client, "responses"):
                raise AIServiceError("OpenAI responses API not available in client")

            character_prompt = self._get_character_prompt(character)
            system_message = self._build_system_message(character_prompt, character)
            user_message = (
                f"Generate an engaging opening line for {character.name}. "
                "Stay in character and create an immersive first impression."
            )

            response = await self.client.responses.create(
                model=self.model_name,
                input=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message},
                ],
                max_output_tokens=150,
            )

            if response:
                opening_line = self._extract_response_text(response).strip()
                if opening_line:
                    return opening_line
            raise AIServiceError("Empty opening line from OpenAI")

        except Exception as e:
            self.logger.error(f"Error generating OpenAI opening line: {e}")
            raise AIServiceError(str(e))

    def _build_openai_input(
        self,
        character_prompt: dict,
        messages: List[ChatMessage],
        character: Optional[Character],
        state: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, str]]:
        openai_messages: List[Dict[str, str]] = []

        system_message = self._build_system_message(character_prompt, character)
        openai_messages.append({"role": "system", "content": system_message})

        if state:
            try:
                state_json = json.dumps(state, ensure_ascii=False)
            except (TypeError, ValueError):
                state_json = ""
            if state_json:
                openai_messages.append({"role": "system", "content": f"[当前状态: {state_json}]"})

        for message in messages:
            if message.role == "user":
                openai_messages.append({"role": "user", "content": message.content})
            elif message.role == "assistant":
                openai_messages.append({"role": "assistant", "content": message.content})

        return openai_messages

    def _extract_response_text(self, response: Any) -> str:
        output_text = getattr(response, "output_text", None)
        if isinstance(output_text, str):
            return output_text

        output_items = getattr(response, "output", None) or []
        text_parts: List[str] = []
        for item in output_items:
            if getattr(item, "type", None) != "message":
                continue
            contents = getattr(item, "content", None) or []
            for content in contents:
                if getattr(content, "type", None) == "output_text":
                    text = getattr(content, "text", None)
                    if text:
                        text_parts.append(text)
        return "".join(text_parts)

    def _build_system_message(self, character_prompt: dict, character: Optional[Character] = None) -> str:
        system_parts = []

        try:
            selected_system_prompt, prompt_type = select_system_prompt(character)
            self.logger.info(f"OpenAI using {prompt_type} system prompt")
            system_parts.append(selected_system_prompt)
        except Exception:
            system_parts.append(SYSTEM_PROMPT)

        persona_prompt = character_prompt.get("persona_prompt", "")
        if persona_prompt:
            system_parts.append(f"\nCharacter Persona:\n{persona_prompt}")

        system_parts.append("""
OpenAI GPT Instructions:
- Respond naturally and engagingly as the character
- Maintain consistency with the character's personality and backstory
- Use appropriate tone and style for the character
- Keep responses conversational and immersive
- Avoid breaking character or mentioning AI limitations
""")

        return "\n".join(system_parts)

    def _extract_state_update(self, response_text: str) -> Tuple[str, Dict[str, str]]:
        pattern = r"\[\[STATE_UPDATE\]\](?P<content>.*?)\[\[/STATE_UPDATE\]\]"
        matches = list(re.finditer(pattern, response_text, re.DOTALL))
        if not matches:
            if "[[STATE_UPDATE]]" in response_text:
                cleaned = response_text.split("[[STATE_UPDATE]]", 1)[0].strip()
                return cleaned, {}
            return response_text, {}

        raw_content = matches[0].group("content")
        state_update: Dict[str, str] = {}

        if raw_content:
            start = raw_content.find("{")
            end = raw_content.rfind("}")
            if start != -1 and end != -1 and start < end:
                candidate = raw_content[start : end + 1]
                try:
                    state_update = json.loads(candidate)
                    if not isinstance(state_update, dict):
                        state_update = {}
                except json.JSONDecodeError:
                    self.logger.warning("Failed to parse OpenAI state update block: %s", candidate)

        cleaned = re.sub(pattern, "", response_text, flags=re.DOTALL).strip()
        return cleaned, state_update

    def _build_generation_config(self, user_preferences: Optional[dict]) -> dict:
        max_tokens_env = os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "1200")
        try:
            max_output_tokens = max(1, int(max_tokens_env))
        except ValueError:
            max_output_tokens = 1200

        config = {
            "max_output_tokens": max_output_tokens,
        }

        reasoning_effort = os.getenv("OPENAI_REASONING_EFFORT", "minimal").strip().lower()
        if reasoning_effort in {"minimal", "low", "medium", "high"}:
            config["reasoning"] = {"effort": reasoning_effort}

        return config
