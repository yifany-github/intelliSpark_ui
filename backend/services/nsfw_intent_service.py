"""
Sexual stage + unified Turn Director for IntelliSpark.

One structured LLM call produces stage + interaction roles + intent/boundary/next_beat.
LLM JSON (including unknown) is authoritative. Conservative fallback only on API/parse failure.
"""

from typing import List, Dict, Any, Optional
import asyncio
import os
import logging
from google import genai
from google.genai import types

from models import ChatMessage
from config import settings
from prompts.interaction_frame import InteractionFrame
from prompts.sexual_stage_detection import build_stage_detection_prompt
from prompts.sexual_stage_reminders import get_stage_reminder
from prompts.turn_director import (
    TurnDirector,
    build_turn_director_prompt,
    conservative_fallback_director,
    director_from_storage,
    parse_turn_director_payload,
    TURN_DIRECTOR_KEY,
)
from utils.gemini_response import extract_text_parts


class NSFWIntentService:
    """Stage reminders + unified turn director."""

    def __init__(self, gemini_client=None):
        self.logger = logging.getLogger(__name__)
        default_model = "gemini-2.0-flash-001"
        intent_override = os.getenv("GEMINI_INTENT_MODEL", "").strip()
        shared_override = os.getenv("GEMINI_MODEL", "").strip()
        self.model_name = intent_override or shared_override or default_model

        if gemini_client:
            self.client = gemini_client
            self.logger.info("NSFW Intent Service initialized with shared client")
        else:
            self.client = self._create_client()

    def _create_client(self):
        if not settings.gemini_api_key:
            self.logger.warning("No Gemini API key found for NSFW Intent Service")
            return None

        try:
            os.environ["GEMINI_API_KEY"] = settings.gemini_api_key
            client = genai.Client()
            self.logger.info("NSFW Intent Service initialized successfully")
            return client
        except Exception as e:
            self.logger.error(f"Failed to initialize NSFW Intent Service: {e}")
            return None

    def _format_messages_for_director(self, messages: List[ChatMessage]) -> str:
        conversation_lines = []
        for message in messages:
            if message.role == "user":
                conversation_lines.append(f"用户: {message.content}")
            elif message.role == "assistant":
                content = message.content or ""
                if len(content) > 280:
                    content = content[:280] + "..."
                conversation_lines.append(f"角色: {content}")
        return "\n".join(conversation_lines)

    def _format_messages_for_analysis(self, messages: List[ChatMessage]) -> str:
        """Legacy stage-only formatter (kept for old helpers)."""
        conversation_lines = []
        for message in messages:
            if message.role == "user":
                conversation_lines.append(f"用户: {message.content}")
            elif message.role == "assistant":
                content = message.content[:100] + "..." if len(message.content) > 100 else message.content
                conversation_lines.append(f"AI: {content}")
        return "\n".join(conversation_lines)

    def _sync_generate_director_json(self, prompt: str) -> str:
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config=types.GenerateContentConfig(
                max_output_tokens=220,
                temperature=0.1,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        return extract_text_parts(response) or ""

    async def detect_turn_director(
        self,
        recent_messages: List[ChatMessage],
        *,
        state: Optional[Dict[str, Any]] = None,
        prev_director: Optional[TurnDirector] = None,
        character_gender: str = "",
    ) -> TurnDirector:
        """
        Unified Stage + Interaction Frame director.

        character_gender accepted for API symmetry only — never used for roles.
        """
        del character_gender
        if prev_director is None and isinstance(state, dict):
            prev_director = director_from_storage(state.get(TURN_DIRECTOR_KEY))

        if not self.client:
            self.logger.warning("No Gemini client for turn director; conservative fallback")
            return conservative_fallback_director()
        if not recent_messages:
            return conservative_fallback_director()

        try:
            conversation = self._format_messages_for_director(recent_messages[-8:])
            prompt = build_turn_director_prompt(
                conversation,
                prev_director=prev_director,
                state=state if isinstance(state, dict) else None,
            )
            # Offload sync SDK call so the event loop is not blocked
            response_text = await asyncio.to_thread(self._sync_generate_director_json, prompt)
            parsed = parse_turn_director_payload(response_text)
            if parsed is None:
                self.logger.warning("Turn director JSON unparseable; conservative fallback")
                return conservative_fallback_director()
            # LLM unknown is authoritative — do NOT coalesce with keyword heuristics
            self.logger.info(
                "🎯 Turn director: stage=%s act=%s char=%s user=%s release=%s->%s "
                "intent=%s boundary=%s conf=%.2f evidence=%s",
                parsed.stage,
                parsed.act_type,
                parsed.character_role,
                parsed.user_role,
                parsed.release_actor,
                parsed.release_target,
                parsed.user_intent,
                parsed.boundary,
                parsed.confidence,
                parsed.evidence,
            )
            return parsed
        except (ConnectionError, TimeoutError) as e:
            self.logger.warning("Turn director LLM unavailable: %s; fallback", e)
            return conservative_fallback_director()
        except Exception as e:
            self.logger.error("Turn director failed: %s; fallback", e)
            return conservative_fallback_director()

    async def detect_user_intent(self, recent_messages: List[ChatMessage]) -> str:
        """Backward-compatible stage string via unified director."""
        director = await self.detect_turn_director(recent_messages)
        return director.stage or "其他"

    async def detect_interaction_frame(
        self,
        recent_messages: List[ChatMessage],
        *,
        character_gender: str = "",
        state: Optional[Dict[str, Any]] = None,
        prev_director: Optional[TurnDirector] = None,
    ) -> InteractionFrame:
        """Backward-compatible InteractionFrame via unified director."""
        director = await self.detect_turn_director(
            recent_messages,
            state=state,
            prev_director=prev_director,
            character_gender=character_gender,
        )
        return director.to_interaction_frame()

    def _build_intent_detection_prompt(self, conversation: str) -> str:
        return build_stage_detection_prompt(conversation)

    def build_intent_guidance(
        self,
        stage: str,
        language: Optional[str] = None,
        interaction_frame=None,
    ) -> str:
        reminder = get_stage_reminder(
            stage,
            language=language or "zh",
            interaction_frame=interaction_frame,
        )
        if reminder:
            self.logger.info(f"💡 Stage reminder for '{stage}': {reminder}")
        return reminder

    def should_prevent_auto_completion(self, stage: str) -> bool:
        high_risk_stages = ["准备插入", "插入时", "抽插时", "角色高潮（自然发生）"]
        return stage in high_risk_stages
