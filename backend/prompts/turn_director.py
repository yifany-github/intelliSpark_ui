"""Compatibility shim — TurnPlan is the canonical Director output (#276 converge).

Prefer importing from prompts.turn_plan. This module keeps old names working.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .scene_frame import (
    LEGACY_RESULTING_SCENE_KEY,
    SCENE_FRAME_KEY,
    SceneFrame,
    scene_frame_from_storage,
)
from .turn_plan import (
    TURN_DIRECTOR_KEY,
    TURN_PLAN_KEY,
    TurnPlan,
    apply_switch_gate,
    build_turn_plan_prompt,
    clip_head_tail,
    conservative_fallback_plan,
    director_contract_lines,
    parse_turn_plan_payload,
    turn_plan_from_storage,
)

# Back-compat aliases
TurnDirector = TurnPlan
RESULTING_SCENE_KEY = LEGACY_RESULTING_SCENE_KEY


def conservative_fallback_director(prev_scene: Optional[SceneFrame] = None) -> TurnPlan:
    return conservative_fallback_plan(prev_scene)


def director_from_storage(raw: Any) -> Optional[TurnPlan]:
    return turn_plan_from_storage(raw)


def parse_turn_director_payload(raw: str) -> Optional[TurnPlan]:
    return parse_turn_plan_payload(raw)


def apply_role_continuity(
    director: TurnPlan,
    *,
    resulting_scene: Optional[Dict[str, Any]] = None,
    prev_director: Optional[TurnPlan] = None,
    user_text: str = "",
) -> TurnPlan:
    """Legacy name — now switch-gated TurnPlan correction."""
    prev_scene = None
    if isinstance(resulting_scene, dict):
        from .scene_frame import scene_frame_from_mapping

        prev_scene = scene_frame_from_mapping(resulting_scene)
    elif prev_director is not None:
        prev_scene = prev_director.expected_scene
    return apply_switch_gate(director, prev_scene=prev_scene, user_text=user_text)


def build_turn_director_prompt(
    conversation: str,
    *,
    prev_director: Optional[TurnPlan] = None,
    state: Optional[Dict[str, Any]] = None,
    resulting_scene: Optional[Dict[str, Any]] = None,
) -> str:
    prev_scene = scene_frame_from_storage(state) if isinstance(state, dict) else None
    if prev_scene is None and isinstance(resulting_scene, dict):
        from .scene_frame import scene_frame_from_mapping

        prev_scene = scene_frame_from_mapping(resulting_scene)
    if prev_scene is None and prev_director is not None:
        prev_scene = prev_director.expected_scene
    return build_turn_plan_prompt(
        conversation,
        prev_scene=prev_scene,
        state=state,
    )


def resulting_scene_from_storage(raw: Any):
    from .scene_frame import scene_frame_from_mapping

    frame = scene_frame_from_mapping(raw)
    return frame.to_storage() if frame else None


__all__ = [
    "TURN_DIRECTOR_KEY",
    "TURN_PLAN_KEY",
    "SCENE_FRAME_KEY",
    "RESULTING_SCENE_KEY",
    "TurnDirector",
    "TurnPlan",
    "clip_head_tail",
    "build_turn_director_prompt",
    "build_turn_plan_prompt",
    "parse_turn_director_payload",
    "parse_turn_plan_payload",
    "conservative_fallback_director",
    "conservative_fallback_plan",
    "director_from_storage",
    "turn_plan_from_storage",
    "apply_role_continuity",
    "apply_switch_gate",
    "director_contract_lines",
    "resulting_scene_from_storage",
]
