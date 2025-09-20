"""Service layer for multi-role story sessions."""

from __future__ import annotations

import logging
import random
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import asyncio
import json
from dataclasses import dataclass

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models import StoryLog, StorySession, Character, ChatMessage, User
from story_engine import Choice, Effect, RoleSpec, Scene, StoryPack, StoryPackLoader, WorldState
from services.ai_model_manager import get_ai_model_manager, AIModelManager

LOGGER = logging.getLogger(__name__)
DEFAULT_STORY_PATH = Path(__file__).resolve().parent.parent / "story_engine" / "stories"


@dataclass
class _LLMMessage:
    role: str
    content: str


@dataclass
class SessionIntro:
    background: Optional[str] = None
    role_intro: Optional[str] = None


class StoryServiceError(RuntimeError):
    """Generic story service failure."""


class StorySessionNotFound(StoryServiceError):
    """Raised when a story session cannot be located."""


class StoryPackNotFound(StoryServiceError):
    """Raised when requested story pack is missing."""


class StoryRoleSummary(BaseModel):
    """Lightweight role info exposed to the UI."""

    id: str
    name: str
    traits: List[str] = Field(default_factory=list)
    inventory: List[str] = Field(default_factory=list)


class StoryMetadata(BaseModel):
    id: str
    title: str
    locale: Optional[str] = None
    start_scene: str = Field(alias="startScene")
    summary: Optional[str] = None
    cover_image: Optional[str] = Field(default=None, alias="coverImage")
    roles: List[StoryRoleSummary] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class StoryTurnResult(BaseModel):
    state: Dict[str, Any]
    narration: Optional[str] = None
    actions_log: List[Dict[str, Any]] = Field(default_factory=list, alias="actionsLog")
    choices: List[Dict[str, Any]] = Field(default_factory=list)

    class Config:
        populate_by_name = True


@dataclass
class StoryServiceConfig:
    story_path: Path = DEFAULT_STORY_PATH


class StoryService:
    """Coordinates story pack loading and session persistence."""

    def __init__(
        self,
        db: Session,
        *,
        config: Optional[StoryServiceConfig] = None,
        loader: Optional[StoryPackLoader] = None,
    ) -> None:
        self.db = db
        self.config = config or StoryServiceConfig()
        self.loader = loader or StoryPackLoader(self.config.story_path)
        self._ai_manager: Optional[AIModelManager] = None

    # ------------------------------------------------------------------
    # Story catalog helpers
    # ------------------------------------------------------------------
    def list_stories(self) -> List[StoryMetadata]:
        """Return metadata for all discoverable story packs."""
        packs = self.loader.load_all()
        return [self._to_metadata(pack) for pack in packs.values()]

    def get_story(self, story_id: str) -> StoryPack:
        try:
            return self.loader.load(story_id)
        except RuntimeError as exc:
            raise StoryPackNotFound(str(exc)) from exc

    def refresh_cache(self) -> None:
        """Clear cached story packs so subsequent calls load latest files."""
        self.loader.clear_cache()

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------
    def create_session(
        self,
        *,
        story_id: str,
        user_id: Optional[int],
        user_role: Optional[str],
        user: Optional[User] = None,
    ) -> Tuple[StorySession, SessionIntro]:
        pack = self.get_story(story_id)
        session_uuid = str(uuid.uuid4())
        state = self._initial_state(session_uuid, pack)

        intro = self._generate_session_intro(
            pack=pack,
            state=state,
            user_role=user_role,
            user=user,
        )

        if intro.background or intro.role_intro:
            meta = state.variables.get("__meta")
            if not isinstance(meta, dict):
                meta = {}
            meta["intro"] = {
                "background": intro.background,
                "roleIntro": intro.role_intro,
            }
            state.variables["__meta"] = meta

        session = StorySession(
            id=session_uuid,
            story_id=pack.id,
            user_id=user_id,
            user_role=user_role,
            state=self._dump_model(state),
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        if intro.background or intro.role_intro:
            self.append_log(
                session_id=session.id,
                kind="INTRO",
                actor="SYSTEM",
                payload={
                    "background": intro.background,
                    "roleIntro": intro.role_intro,
                },
            )

        return session, intro

    def get_session(self, session_id: str) -> StorySession:
        session = self.db.query(StorySession).filter(StorySession.id == session_id).first()
        if not session:
            raise StorySessionNotFound(f"Session '{session_id}' not found")
        return session

    def get_available_choices(self, session: StorySession) -> List[Dict[str, Any]]:
        pack = self.get_story(session.story_id)
        state = WorldState(**session.state)
        return self._choice_summaries(pack, state)

    def append_log(
        self,
        *,
        session_id: str,
        kind: str,
        payload: Optional[Dict[str, Any]] = None,
        actor: Optional[str] = None,
    ) -> StoryLog:
        session = self.get_session(session_id)
        log_entry = StoryLog(
            session_id=session.id,
            kind=kind,
            actor=actor,
            payload=payload or {},
        )
        self.db.add(log_entry)
        self.db.commit()
        self.db.refresh(log_entry)
        return log_entry

    # ------------------------------------------------------------------
    # Turn orchestration
    # ------------------------------------------------------------------
    def run_turn(
        self,
        *,
        session_id: str,
        user_role: str,
        user_text: str,
        user: Optional[User] = None,
    ) -> StoryTurnResult:
        session = self.get_session(session_id)
        pack = self.get_story(session.story_id)
        state = WorldState(**session.state)

        LOGGER.info(
            "Run turn invoked for session %s role %s (story=%s)",
            session_id,
            user_role,
            pack.id,
        )

        current_scene = self._get_scene(pack, state.scene_id)
        available_choices = self._filter_choices(current_scene.choices, state)

        selected_choice = self._select_choice(available_choices, user_text)
        if not selected_choice and available_choices:
            selected_choice = available_choices[0]

        applied_effects: List[str] = []
        next_scene_id = state.scene_id
        if selected_choice:
            effects_result = self._apply_effects(state, selected_choice.effects)
            applied_effects.extend(effects_result)
            if selected_choice.goto:
                next_scene_id = selected_choice.goto

        state.scene_id = next_scene_id
        next_scene = self._get_scene(pack, state.scene_id)
        scene_enter_effects = []
        if next_scene and next_scene.on_enter:
            scene_enter_effects = self._apply_effects(state, next_scene.on_enter)
            applied_effects.extend(scene_enter_effects)

        ai_actions = self._propose_ai_actions(state, pack.roles, exclude=user_role)

        available_choices_summary = self._choice_summaries(pack, state)
        narration = self._maybe_generate_ai_narration(
            pack=pack,
            state=state,
            user_role=user_role,
            user_text=user_text,
            selected_choice=selected_choice,
            effect_summaries=applied_effects,
            ai_actions=ai_actions,
            available_choices=available_choices_summary,
            user=user,
        ) or self._build_narration(state, next_scene, applied_effects, ai_actions)

        actions_log = self._build_action_log(user_role, selected_choice, ai_actions, applied_effects)

        session.state = self._dump_model(state)
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        self.append_log(
            session_id=session.id,
            kind="TURN",
            actor=user_role,
            payload={
                "user_text": user_text,
                "choice_id": selected_choice.id if selected_choice else None,
                "effects": applied_effects,
                "ai_actions": ai_actions,
                "next_scene": state.scene_id,
            },
        )

        return StoryTurnResult(
            state=self._dump_model(state),
            narration=narration,
            actions_log=actions_log,
            choices=available_choices_summary,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _to_metadata(pack: StoryPack) -> StoryMetadata:
        start_scene = None
        for scene in pack.scenes:
            if scene.id == pack.start_scene:
                start_scene = scene
                break

        return StoryMetadata(
            id=pack.id,
            title=pack.title,
            locale=pack.locale,
            start_scene=pack.start_scene,
            summary=start_scene.desc if start_scene else None,
            cover_image=pack.cover_image,
            roles=[
                StoryRoleSummary(
                    id=role.id,
                    name=role.name,
                    traits=list(role.traits),
                    inventory=list(role.inventory),
                )
                for role in pack.roles
            ],
        )

    def _initial_state(self, session_uuid: str, pack: StoryPack) -> WorldState:
        inventories = {role.id: list(role.inventory) for role in pack.roles}
        stats = {role.id: {} for role in pack.roles}
        state = WorldState(
            session_id=session_uuid,
            story_id=pack.id,
            scene_id=pack.start_scene,
            time=pack.variables.get("time"),
            location=pack.variables.get("location"),
            flags=dict(pack.flags),
            variables=dict(pack.variables),
            inventories=inventories,
            stats=stats,
        )
        return state

    # ------------------------------------------------------------------
    # Choice and effect helpers
    # ------------------------------------------------------------------
    def _get_scene(self, pack: StoryPack, scene_id: str) -> Optional[Scene]:
        for scene in pack.scenes:
            if scene.id == scene_id:
                return scene
        LOGGER.warning("Scene '%s' not found in story '%s'", scene_id, pack.id)
        return None

    def _filter_choices(self, choices: List[Choice], state: WorldState) -> List[Choice]:
        return [choice for choice in choices if self._condition_met(choice.when, state)]

    def _choice_summaries(self, pack: StoryPack, state: WorldState) -> List[Dict[str, Any]]:
        scene = self._get_scene(pack, state.scene_id)
        if not scene:
            return []
        available = self._filter_choices(scene.choices, state)
        return [
            {
                "id": choice.id,
                "prompt": choice.prompt,
                "goto": choice.goto,
            }
            for choice in available
        ]

    def _condition_met(self, expr: Optional[str], state: WorldState) -> bool:
        if not expr:
            return True

        def flag(name: str) -> bool:
            return bool(state.flags.get(name))

        def has(role: str, item: str) -> bool:
            return item in state.inventories.get(role, [])

        def location_is(name: str) -> bool:
            return (state.location or "").strip() == name

        def var(name: str) -> Any:
            return state.variables.get(name)

        safe_globals = {"__builtins__": {}}
        safe_locals = {
            "flag": flag,
            "has": has,
            "locationIs": location_is,
            "var": var,
        }
        try:
            return bool(eval(expr, safe_globals, safe_locals))
        except Exception as exc:  # pragma: no cover - guard rails
            LOGGER.warning("Failed to evaluate condition '%s': %s", expr, exc)
            return False

    def _select_choice(self, choices: List[Choice], user_text: str) -> Optional[Choice]:
        lowered = user_text.lower()
        for choice in choices:
            if choice.id.lower() in lowered:
                return choice
            if choice.prompt.lower() in lowered:
                return choice
        if choices:
            # Simple fuzzy match by overlapping words
            tokens = set(lowered.split())
            scored = []
            for choice in choices:
                prompt_tokens = set(choice.prompt.lower().split())
                overlap = len(tokens & prompt_tokens)
                scored.append((overlap, choice))
            scored.sort(key=lambda item: item[0], reverse=True)
            if scored and scored[0][0] > 0:
                return scored[0][1]
        return None

    def _apply_effects(self, state: WorldState, effects: List[Effect]) -> List[str]:
        summaries: List[str] = []
        for effect in effects or []:
            if effect.set_flag:
                for key, value in effect.set_flag.items():
                    state.flags[key] = bool(value)
                    summaries.append(f"flag:{key}={'ON' if value else 'OFF'}")
            if effect.set_var:
                for key, value in effect.set_var.items():
                    state.variables[key] = value
                    summaries.append(f"var:{key}={value}")
            if effect.give_item:
                to_role = effect.give_item.to
                item = effect.give_item.item
                if to_role:
                    state.inventories.setdefault(to_role, []).append(item)
                    summaries.append(f"{to_role}获得{item}")
            if effect.remove_item:
                from_role = effect.remove_item.from_
                item = effect.remove_item.item
                if from_role and item in state.inventories.get(from_role, []):
                    state.inventories[from_role].remove(item)
                    summaries.append(f"{from_role}失去{item}")
            if effect.set_location:
                state.location = effect.set_location
                summaries.append(f"地点→{effect.set_location}")
            if effect.time_advance:
                state.time = effect.time_advance
                summaries.append(f"时间→{effect.time_advance}")
        return summaries

    def _propose_ai_actions(
        self, state: WorldState, roles: List[RoleSpec], exclude: str
    ) -> List[Dict[str, Any]]:
        ai_roles = [role for role in roles if role.id != exclude]
        random.seed(state.session_id)
        actions: List[Dict[str, Any]] = []
        verbs = ["观察四周", "准备道具", "支持队友", "分析线索"]
        for role in ai_roles:
            action = {
                "role": role.id,
                "action": random.choice(verbs),
                "inventory": state.inventories.get(role.id, []),
            }
            actions.append(action)
        return actions

    def _build_narration(
        self,
        state: WorldState,
        scene: Optional[Choice],
        effect_summaries: List[str],
        ai_actions: List[Dict[str, Any]],
    ) -> str:
        scene_title = scene.title if scene else state.scene_id
        parts = [f"当前场景《{scene_title}》"]
        if state.location:
            parts.append(f"地点：{state.location}")
        if state.time:
            parts.append(f"时间：{state.time}")
        if effect_summaries:
            parts.append("状态变化：" + "，".join(effect_summaries))
        if ai_actions:
            highlights = [f"{item['role']} {item['action']}" for item in ai_actions]
            parts.append("队友行动：" + "，".join(highlights))
        return "；".join(parts)

    def _build_action_log(
        self,
        user_role: str,
        choice: Optional[Choice],
        ai_actions: List[Dict[str, Any]],
        effect_summaries: List[str],
    ) -> List[Dict[str, Any]]:
        log: List[Dict[str, Any]] = []
        log.append(
            {
                "role": user_role,
                "choiceId": choice.id if choice else None,
                "choicePrompt": choice.prompt if choice else None,
                "effects": effect_summaries,
            }
        )
        log.extend(ai_actions)
        return log

    def _generate_session_intro(
        self,
        *,
        pack: StoryPack,
        state: WorldState,
        user_role: Optional[str],
        user: Optional[User],
    ) -> SessionIntro:
        try:
            ai_manager = self._get_ai_manager()
        except Exception as exc:
            LOGGER.error("Failed to obtain AI model manager for session intro: %s", exc)
            return SessionIntro()

        if not ai_manager:
            return SessionIntro()

        role_id = user_role or (pack.roles[0].id if pack.roles else None)
        available_choices = self._choice_summaries(pack, state)

        try:
            intro = self._run_async(
                self._generate_session_intro_async(
                    ai_manager=ai_manager,
                    narrator=self._build_narrator_character(pack),
                    pack=pack,
                    state=state,
                    user_role=role_id,
                    available_choices=available_choices,
                    user=user,
                )
            )
            return intro or SessionIntro()
        except Exception as exc:
            LOGGER.error("Session intro AI call failed: %s", exc)
            return SessionIntro()

    def _maybe_generate_ai_narration(
        self,
        *,
        pack: StoryPack,
        state: WorldState,
        user_role: str,
        user_text: str,
        selected_choice: Optional[Choice],
        effect_summaries: List[str],
        ai_actions: List[Dict[str, Any]],
        available_choices: List[Dict[str, Any]],
        user: Optional[User],
    ) -> Optional[str]:
        try:
            ai_manager = self._get_ai_manager()
        except Exception as exc:
            LOGGER.error("Failed to obtain AI model manager for story narration: %s", exc)
            return None

        if not ai_manager:
            return None

        narrator_character = self._build_narrator_character(pack)
        prompt = self._build_narration_prompt(
            pack=pack,
            state=state,
            user_role=user_role,
            user_text=user_text,
            selected_choice=selected_choice,
            effect_summaries=effect_summaries,
            ai_actions=ai_actions,
            available_choices=available_choices,
        )
        messages = [_LLMMessage(role="user", content=prompt)]

        try:
            return self._run_async(
                self._generate_ai_narration_async(
                    ai_manager=ai_manager,
                    narrator=narrator_character,
                    messages=messages,
                    user=user,
                )
            )
        except Exception as exc:
            LOGGER.error("Story narration AI call failed: %s", exc)
            return None

    def _get_ai_manager(self) -> Optional[AIModelManager]:
        if self._ai_manager is not None:
            return self._ai_manager
        try:
            self._ai_manager = self._run_async(get_ai_model_manager())
        except Exception as exc:
            LOGGER.error("Unable to initialize AI model manager: %s", exc)
            self._ai_manager = None
        return self._ai_manager

    def _run_async(self, coro):
        try:
            return asyncio.run(coro)
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                asyncio.set_event_loop(loop)
                return loop.run_until_complete(coro)
            finally:
                asyncio.set_event_loop(None)
                loop.close()

    async def _generate_ai_narration_async(
        self,
        *,
        ai_manager: AIModelManager,
        narrator: Character,
        messages: List[_LLMMessage],
        user: Optional[User],
    ) -> Optional[str]:
        try:
            response, _ = await ai_manager.generate_response(
                narrator,
                messages,  # type: ignore[arg-type]
                user_preferences={"mode": "story_narration"},
                user=user,
            )
            return response.strip() if response else None
        except Exception as exc:
            LOGGER.error("AI narration generation error: %s", exc)
            return None

    async def _generate_session_intro_async(
        self,
        *,
        ai_manager: AIModelManager,
        narrator: Character,
        pack: StoryPack,
        state: WorldState,
        user_role: Optional[str],
        available_choices: List[Dict[str, Any]],
        user: Optional[User],
    ) -> SessionIntro:
        filtered_variables = {
            k: v for k, v in state.variables.items() if not str(k).startswith("__")
        }

        context = {
            "story": {
                "id": pack.id,
                "title": pack.title,
                "locale": pack.locale,
            },
            "scene": {
                "id": state.scene_id,
                "time": state.time,
                "location": state.location,
            },
            "flags": state.flags,
            "variables": filtered_variables,
            "available_choices": available_choices,
        }

        context_text = json.dumps(context, ensure_ascii=False, indent=2)
        background_prompt = (
            "你是中文互动小说的旁白。请在 3 段以内，用沉浸式第三人称描绘当前故事的背景、"
            "氛围与潜在冲突，并暗示玩家可以做出的行动方向。避免剧透后续剧情。\n\n"
            f"故事设定：\n{context_text}\n\n请输出旁白背景描述："
        )

        background_messages = [_LLMMessage(role="user", content=background_prompt)]
        background_text = None
        try:
            background_response, _ = await ai_manager.generate_response(
                narrator,
                background_messages,  # type: ignore[arg-type]
                user_preferences={"mode": "story_intro"},
                user=user,
            )
            if background_response:
                background_text = background_response.strip()
        except Exception as exc:
            LOGGER.error("Background intro generation failed: %s", exc)

        role_intro_text = None
        if user_role:
            role_context = self._build_role_context(pack, user_role)
            role_prompt = (
                "请作为旁白，描述玩家扮演的角色在当前场景中的心境、特长和动机，"
                "用 2 段以内文字突出该角色与众不同之处，并给出即将采取行动的暗示。\n\n"
                f"角色信息：\n{json.dumps(role_context, ensure_ascii=False, indent=2)}\n\n"
                f"场景：{state.scene_id}"
            )
            role_messages = [_LLMMessage(role="user", content=role_prompt)]
            try:
                role_response, _ = await ai_manager.generate_response(
                    narrator,
                    role_messages,  # type: ignore[arg-type]
                    user_preferences={"mode": "story_role_intro"},
                    user=user,
                )
                if role_response:
                    role_intro_text = role_response.strip()
            except Exception as exc:
                LOGGER.error("Role intro generation failed: %s", exc)

        return SessionIntro(background=background_text, role_intro=role_intro_text)

    def _build_narrator_character(self, pack: StoryPack) -> Character:
        narrator_name = f"《{pack.title}》旁白" if pack.title else "故事旁白"
        narrator = Character(
            name=narrator_name,
            backstory=(
                "你是沉浸式互动小说的旁白，以第三人称视角描述场景、角色行动"
                "与情绪变化，帮助玩家感受故事氛围。"
            ),
            voice_style="优雅而富有画面感的中文旁白",
            traits=["narrator", "storyteller"],
            description="负责将故事进展生动呈现的旁白角色",
        )
        narrator.id = 0
        narrator.is_public = True
        narrator.avatar_url = narrator.avatar_url or None
        narrator.persona_prompt = (
            "请保持旁白身份，用中文第三人称或全知视角描写，"
            "语气生动、富有画面感，同时帮助玩家理解状态变化。"
        )
        return narrator

    def _build_narration_prompt(
        self,
        *,
        pack: StoryPack,
        state: WorldState,
        user_role: str,
        user_text: str,
        selected_choice: Optional[Choice],
        effect_summaries: List[str],
        ai_actions: List[Dict[str, Any]],
        available_choices: List[Dict[str, Any]],
    ) -> str:
        filtered_variables = {
            k: v for k, v in state.variables.items() if not str(k).startswith("__")
        }

        context = {
            "story": {
                "id": pack.id,
                "title": pack.title,
                "locale": pack.locale,
            },
            "scene": {
                "id": state.scene_id,
                "time": state.time,
                "location": state.location,
            },
            "flags": state.flags,
            "variables": filtered_variables,
            "inventories": state.inventories,
            "player": {
                "role": user_role,
                "action": user_text,
            },
            "selected_choice": {
                "id": selected_choice.id if selected_choice else None,
                "prompt": selected_choice.prompt if selected_choice else None,
            },
            "effects": effect_summaries,
            "ai_actions": ai_actions,
            "available_choices": available_choices,
        }

        context_text = json.dumps(context, ensure_ascii=False, indent=2)
        instructions = (
            "你是中文互动冒险的旁白，请根据提供的上下文，用沉浸式第三人称描写"
            "玩家及队友的行为、情绪与环境。篇幅控制在 1-2 段，保持紧凑节奏，"
            "突出当前决策带来的影响，并为下一步埋下线索。"
        )

        return f"{instructions}\n\n当前上下文：\n{context_text}\n\n请输出旁白叙述："

    def _build_role_context(self, pack: StoryPack, role_id: Optional[str]) -> Dict[str, Any]:
        if not role_id:
            return {}
        for role in pack.roles:
            if role.id == role_id:
                return {
                    "id": role.id,
                    "name": role.name,
                    "traits": role.traits,
                    "inventory": role.inventory,
                }
        return {"id": role_id, "name": role_id}

    @staticmethod
    def _dump_model(model: BaseModel) -> Dict[str, Any]:
        if hasattr(model, "model_dump"):
            return model.model_dump(by_alias=True)
        return model.dict(by_alias=True)
