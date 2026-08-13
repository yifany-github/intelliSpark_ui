"""
Sexual stage + unified TurnPlan Director for IntelliSpark.

One structured LLM call produces TurnPlan (intent/boundary/transition/expected_scene).
Switch requires evidence_quote ⊆ user text (server gate). No keyword co-director.
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
from prompts.scene_frame import SceneFrame, scene_frame_from_storage
from prompts.sexual_stage_detection import build_stage_detection_prompt
from prompts.sexual_stage_reminders import get_stage_reminder
from prompts.turn_plan import (
    TurnPlan,
    RECHECK_VERIFIER_ERROR,
    apply_switch_gate,
    build_director_recheck_prompt,
    build_turn_plan_prompt,
    clip_head_tail,
    conservative_fallback_plan,
    parse_recheck_payload,
    parse_turn_plan_payload,
    turn_plan_from_storage,
    TURN_DIRECTOR_KEY,
    TURN_PLAN_KEY,
)
from utils.gemini_response import extract_text_parts


class NSFWIntentService:
    """Stage reminders + unified TurnPlan director."""

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
                content = clip_head_tail(message.content or "", max_len=420)
                conversation_lines.append(f"角色: {content}")
        return "\n".join(conversation_lines)

    def _format_messages_for_analysis(self, messages: List[ChatMessage]) -> str:
        conversation_lines = []
        for message in messages:
            if message.role == "user":
                conversation_lines.append(f"用户: {message.content}")
            elif message.role == "assistant":
                content = message.content[:100] + "..." if len(message.content) > 100 else message.content
                conversation_lines.append(f"AI: {content}")
        return "\n".join(conversation_lines)

    def _last_user_text(self, messages: List[ChatMessage]) -> str:
        for message in reversed(messages or []):
            if getattr(message, "role", None) == "user":
                return getattr(message, "content", None) or ""
        return ""

    def _sync_generate_director_json(self, prompt: str, max_tokens: int = 280) -> str:
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config=types.GenerateContentConfig(
                max_output_tokens=max_tokens,
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
        prev_director: Optional[TurnPlan] = None,
        character_gender: str = "",
    ) -> TurnPlan:
        """Unified TurnPlan director. character_gender unused for roles."""
        del character_gender
        prev_scene = scene_frame_from_storage(state if isinstance(state, dict) else None)
        if prev_director is None and isinstance(state, dict):
            prev_director = turn_plan_from_storage(
                state.get(TURN_PLAN_KEY) or state.get(TURN_DIRECTOR_KEY)
            )
        user_text = self._last_user_text(recent_messages)

        if not self.client:
            self.logger.warning("No Gemini client for turn plan; conservative fallback")
            return apply_switch_gate(
                conservative_fallback_plan(prev_scene),
                prev_scene=prev_scene,
                user_text=user_text,
            )
        if not recent_messages:
            return apply_switch_gate(
                conservative_fallback_plan(prev_scene),
                prev_scene=prev_scene,
                user_text=user_text,
            )

        try:
            conversation = self._format_messages_for_director(recent_messages[-8:])
            prompt = build_turn_plan_prompt(
                conversation,
                prev_scene=prev_scene,
                state=state if isinstance(state, dict) else None,
            )
            response_text = await asyncio.to_thread(self._sync_generate_director_json, prompt)
            parsed = parse_turn_plan_payload(response_text)
            if parsed is None:
                self.logger.warning("Turn plan JSON unparseable; conservative fallback")
                return apply_switch_gate(
                    conservative_fallback_plan(prev_scene),
                    prev_scene=prev_scene,
                    user_text=user_text,
                )
            gated = apply_switch_gate(parsed, prev_scene=prev_scene, user_text=user_text)
            # Evidence/coherence demotion → one Director retry, never invent opposite roles
            if gated.source == "corrected" and not gated.expected_scene.roles_known():
                self.logger.info("🎯 TurnPlan corrected to unknown; retrying Director once")
                retry_prompt = (
                    prompt
                    + "\n\n注意：上一稿证据不足或角色不互补，已被服务器否决。"
                    "请重新输出；证据不足时 roles 必须 unknown，禁止猜测相反角色。"
                )
                retry_text = await asyncio.to_thread(
                    self._sync_generate_director_json, retry_prompt
                )
                retried = parse_turn_plan_payload(retry_text)
                if retried is not None:
                    gated = apply_switch_gate(
                        retried, prev_scene=prev_scene, user_text=user_text
                    )
            esc = gated.expected_scene
            self.logger.info(
                "🎯 TurnPlan: intent=%s boundary=%s transition=%s "
                "char=%s user=%s release=%s->%s quote=%r src=%s",
                gated.intent,
                gated.boundary,
                gated.transition,
                esc.character_role,
                esc.user_role,
                esc.release_actor,
                esc.release_target,
                (gated.evidence_quote or "")[:40],
                gated.source,
            )
            return gated
        except (ConnectionError, TimeoutError) as e:
            self.logger.warning("Turn plan LLM unavailable: %s; fallback", e)
            return apply_switch_gate(
                conservative_fallback_plan(prev_scene),
                prev_scene=prev_scene,
                user_text=user_text,
            )
        except Exception as e:
            self.logger.error("Turn plan failed: %s; fallback", e)
            return apply_switch_gate(
                conservative_fallback_plan(prev_scene),
                prev_scene=prev_scene,
                user_text=user_text,
            )

    async def recheck_actor_reply(
        self,
        reply: str,
        plan: TurnPlan,
        *,
        prev_scene: Optional[SceneFrame] = None,
        user_text: str = "",
    ) -> str:
        """High-risk Director recheck → pass | actor_fail | verifier_error."""
        if not self.client:
            return RECHECK_VERIFIER_ERROR
        try:
            prompt = build_director_recheck_prompt(
                reply=reply,
                plan=plan,
                prev_scene=prev_scene,
                user_text=user_text,
            )
            response_text = await asyncio.to_thread(
                self._sync_generate_director_json, prompt, 80
            )
            status = parse_recheck_payload(response_text)
            self.logger.info("🔍 Director recheck status=%s", status)
            return status
        except Exception as e:
            self.logger.warning("Director recheck failed (verifier_error): %s", e)
            return RECHECK_VERIFIER_ERROR

    async def detect_user_intent(self, recent_messages: List[ChatMessage]) -> str:
        director = await self.detect_turn_director(recent_messages)
        return director.stage or "其他"

    async def detect_interaction_frame(
        self,
        recent_messages: List[ChatMessage],
        *,
        character_gender: str = "",
        state: Optional[Dict[str, Any]] = None,
        prev_director: Optional[TurnPlan] = None,
    ) -> InteractionFrame:
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
