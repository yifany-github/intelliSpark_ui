"""Structural SceneFrame / TurnPlan pipeline — no Chinese lexicon director (#276)."""

from __future__ import annotations

import json
import re
from dataclasses import replace
from typing import Any, Dict, Optional, Tuple

from .scene_frame import (
    ACT_TYPES,
    PHASES,
    RELEASE_ACTORS,
    RELEASE_TARGETS,
    ROLES,
    SCENE_FRAME_KEY,
    SceneFrame,
    empty_scene_frame,
    roles_flipped,
    scene_frame_from_mapping,
)
from .turn_plan import TurnPlan, _quote_in_user, switch_evidence_valid

_SCENE_OPEN = r"\[\[SCENE_RESULT\]\]?"
_SCENE_CLOSE = r"\[\[/?SCENE_RESULT\]\]"
_SCENE_BLOCK_RE = re.compile(
    rf"{_SCENE_OPEN}(?P<content>.*?){_SCENE_CLOSE}",
    re.DOTALL | re.IGNORECASE,
)
_SCENE_OPEN_RE = re.compile(_SCENE_OPEN, re.IGNORECASE)


def extract_scene_result(response_text: str) -> Tuple[str, Optional[SceneFrame]]:
    """Strip [[SCENE_RESULT]] block; return (prose, frame|None)."""
    if not response_text:
        return "", None

    matches = list(_SCENE_BLOCK_RE.finditer(response_text))
    frame: Optional[SceneFrame] = None
    if matches:
        raw = matches[0].group("content") or ""
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and start < end:
            try:
                parsed = json.loads(raw[start : end + 1])
                frame = scene_frame_from_mapping(parsed)
            except (json.JSONDecodeError, TypeError):
                frame = None
        cleaned = _SCENE_BLOCK_RE.sub("", response_text).strip()
        return cleaned, frame

    open_match = _SCENE_OPEN_RE.search(response_text)
    if open_match:
        return response_text[: open_match.start()].strip(), None
    return response_text, None


def is_high_risk_turn(
    plan: TurnPlan,
    *,
    prev_scene: Optional[SceneFrame],
) -> bool:
    """Establish / switch / refuse / release / active penetration — Director rechecks."""
    if plan.transition in {"switch", "establish", "release", "refuse"}:
        return True
    if plan.boundary == "refused":
        return True
    if plan.intent == "permission" and plan.expected_scene.release_actor != "unknown":
        return True
    if plan.expected_scene.release_actor != "unknown":
        return True
    # Active penetration: prose can drift roles even when JSON scene_result matches
    if plan.expected_scene.act_type == "penetration":
        return True
    prev = prev_scene or empty_scene_frame()
    if not prev.roles_known() and plan.expected_scene.roles_known():
        return True
    if prev.roles_known() and roles_flipped(prev, plan.expected_scene):
        return True
    return False


def scene_result_structurally_valid(
    result: Optional[SceneFrame],
    plan: TurnPlan,
    *,
    prev_scene: Optional[SceneFrame],
    user_text: str,
) -> Tuple[bool, str]:
    """
    Structural invariants only.
    Returns (ok, reason).
    """
    expected = plan.expected_scene
    prev = prev_scene or empty_scene_frame()

    if result is None:
        # Penetration / known-role turns require an explicit scene_result block
        if expected.roles_known() and expected.act_type != "none":
            return False, "scene_result_required"
        result = expected

    # Validate enums already normalized by scene_frame_from_mapping
    if result.act_type not in ACT_TYPES or result.character_role not in ROLES:
        return False, "scene_result_invalid_enum"

    # Actor must not invent user-as-actor when plan/prev have no such roles + no quote
    inventing_user_actor = (
        result.character_role == "receiver"
        and result.user_role == "actor"
        and result.act_type != "none"
    )
    prior_user_actor = prev.character_role == "receiver" and prev.user_role == "actor"
    expected_user_actor = (
        expected.character_role == "receiver" and expected.user_role == "actor"
    )
    if inventing_user_actor and not prior_user_actor and not expected_user_actor:
        if not _quote_in_user(plan.evidence_quote, user_text):
            return False, "cannot_invent_receiver_without_quote"

    # No flip without valid switch evidence
    if prev.roles_known() and result.roles_known() and roles_flipped(prev, result):
        if not (plan.transition == "switch" and switch_evidence_valid(plan, user_text)):
            return False, "role_flip_without_switch_evidence"

    # Must match expected_scene on known role fields
    if expected.character_role != "unknown" and result.character_role != "unknown":
        if result.character_role != expected.character_role:
            return False, "scene_result_mismatches_expected_character_role"
    if expected.user_role != "unknown" and result.user_role != "unknown":
        if result.user_role != expected.user_role:
            return False, "scene_result_mismatches_expected_user_role"
    # act_type mismatch is soft — roles/release are the hard invariants

    if (
        expected.release_actor == "character"
        and expected.release_target == "user"
        and result.release_actor not in ("character", "unknown")
    ):
        return False, "release_actor_mismatches_expected"

    if (
        expected.release_actor == "user"
        and expected.release_target == "character"
        and result.release_actor not in ("user", "unknown")
    ):
        return False, "release_actor_mismatches_expected"

    return True, "ok"


def resolve_scene_to_persist(
    result: Optional[SceneFrame],
    plan: TurnPlan,
    *,
    prev_scene: Optional[SceneFrame],
    user_text: str,
) -> SceneFrame:
    """
    Choose SceneFrame to save. Prefer actor scene_result when structurally valid;
    else fall back to expected_scene (never persist an illegal flip).
    """
    ok, _ = scene_result_structurally_valid(
        result, plan, prev_scene=prev_scene, user_text=user_text
    )
    if ok and result is not None and result.roles_known():
        # If plan roles unknown, do not let actor invent penetration roles alone
        if not plan.expected_scene.roles_known():
            return prev_scene or empty_scene_frame()
        if result.release_actor == "unknown" and plan.expected_scene.release_actor != "unknown":
            return replace(
                result,
                release_actor=plan.expected_scene.release_actor,
                release_target=plan.expected_scene.release_target,
                phase=result.phase if result.phase != "其他" else plan.expected_scene.phase,
            )
        return result
    if plan.expected_scene.roles_known() or plan.expected_scene.act_type != "none":
        return plan.expected_scene
    return prev_scene or empty_scene_frame()


def merge_scene_into_state_update(
    state_update: Optional[Dict[str, Any]],
    scene: SceneFrame,
    plan: TurnPlan,
) -> Dict[str, Any]:
    from .turn_plan import TURN_DIRECTOR_KEY, TURN_PLAN_KEY

    out = dict(state_update or {})
    out[SCENE_FRAME_KEY] = scene.to_storage()
    # Keep legacy key in sync so older readers still work
    out["_resulting_scene"] = scene.to_storage()
    out[TURN_PLAN_KEY] = plan.to_storage()
    out[TURN_DIRECTOR_KEY] = plan.to_storage()
    return out


__all__ = [
    "extract_scene_result",
    "is_high_risk_turn",
    "scene_result_structurally_valid",
    "resolve_scene_to_persist",
    "merge_scene_into_state_update",
]
