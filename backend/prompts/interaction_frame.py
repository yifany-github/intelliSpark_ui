"""InteractionFrame bridge type for turn_contract (#276).

Production roles come from TurnPlan.expected_scene / Actor scene_result.
This module no longer runs a Chinese-lexicon co-director.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Optional, Sequence

from .scene_frame import LEGACY_RESULTING_SCENE_KEY as RESULTING_SCENE_KEY

ACT_TYPES = ("penetration", "oral", "manual", "none")
ROLES = ("actor", "receiver", "mutual", "unknown")
RELEASE_ACTORS = ("character", "user", "unknown")
RELEASE_TARGETS = ("character", "user", "external", "unknown")
EVIDENCE_LEVELS = ("explicit_current", "recent_context", "unknown")


@dataclass(frozen=True)
class InteractionFrame:
    act_type: str = "none"
    character_role: str = "unknown"
    user_role: str = "unknown"
    release_actor: str = "unknown"
    release_target: str = "unknown"
    confidence: float = 0.0
    evidence: str = "unknown"

    def to_prompt(self, language: str = "zh") -> str:
        if language != "zh":
            return (
                f"[INTERACTION FRAME act={self.act_type} "
                f"char={self.character_role} user={self.user_role} "
                f"release={self.release_actor}->{self.release_target} "
                f"evidence={self.evidence} conf={self.confidence:.2f}]\n"
                "Gender does not decide who penetrates or ejaculates. Obey roles above."
            )

        lines = [
            f"【互动主客体 · {self.act_type} · 证据{self.evidence} · 置信{self.confidence:.2f}】",
            f"角色本轮角色：{self.character_role}；用户本轮角色：{self.user_role}",
            f"释放者：{self.release_actor}；释放目标：{self.release_target}",
            "性别只决定身体词库，绝不决定谁插入、谁被插入、谁射。",
        ]
        if self.release_actor == "character" and self.release_target == "user":
            lines.append(
                "若用户问「射在里面可以吗」：指角色是否射入用户体内；"
                "禁止写成「你（用户）想射就射吧」。"
            )
        elif self.release_actor == "user" and self.release_target == "character":
            lines.append(
                "若用户问射哪里/内射：指用户射入角色体内；角色用承受与邀请回应，禁止改成角色在射。"
            )
        elif self.character_role == "actor" and self.act_type == "penetration":
            lines.append("角色是插入方：写角色推进/抽送与用户体内感觉；禁止把角色写成被插入默认体。")
        elif self.character_role == "receiver" and self.act_type == "penetration":
            lines.append("角色是被插入方：写角色被进入的即时感受；禁止假设用户高潮进程。")
        elif self.evidence == "unknown":
            lines.append("主客体不明：不要默认女角被插入；用角色人设与用户当前句推进，勿发明用户身体剧本。")
        return "\n".join(lines)


def parse_interaction_frame_payload(raw: str) -> Optional[InteractionFrame]:
    text = (raw or "").strip()
    if not text:
        return None
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(text[start : end + 1])
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(data, dict):
        return None

    act_type = str(data.get("act_type") or "none").strip()
    char_role = str(data.get("character_role") or "unknown").strip()
    user_role = str(data.get("user_role") or "unknown").strip()
    release_actor = str(data.get("release_actor") or "unknown").strip()
    release_target = str(data.get("release_target") or "unknown").strip()
    evidence = str(data.get("evidence") or "unknown").strip()
    try:
        confidence = float(data.get("confidence") or 0.0)
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    if act_type not in ACT_TYPES:
        act_type = "none"
    if char_role not in ROLES:
        char_role = "unknown"
    if user_role not in ROLES:
        user_role = "unknown"
    if release_actor not in RELEASE_ACTORS:
        release_actor = "unknown"
    if release_target not in RELEASE_TARGETS:
        release_target = "unknown"
    if evidence not in EVIDENCE_LEVELS:
        evidence = "unknown"

    return InteractionFrame(
        act_type=act_type,
        character_role=char_role,
        user_role=user_role,
        release_actor=release_actor,
        release_target=release_target,
        confidence=confidence,
        evidence=evidence,
    )


def coalesce_interaction_frame(
    primary: Optional[InteractionFrame],
    fallback: InteractionFrame,
) -> InteractionFrame:
    if primary is None:
        return fallback
    primary_empty = (
        primary.act_type == "none"
        and primary.character_role == "unknown"
        and primary.user_role == "unknown"
        and primary.release_actor == "unknown"
        and primary.release_target == "unknown"
    )
    if primary_empty and fallback.confidence > primary.confidence:
        return fallback

    act_type = primary.act_type if primary.act_type != "none" else fallback.act_type
    character_role = (
        primary.character_role
        if primary.character_role != "unknown"
        else fallback.character_role
    )
    user_role = (
        primary.user_role if primary.user_role != "unknown" else fallback.user_role
    )
    release_actor = (
        primary.release_actor
        if primary.release_actor != "unknown"
        else fallback.release_actor
    )
    release_target = (
        primary.release_target
        if primary.release_target != "unknown"
        else fallback.release_target
    )
    evidence = primary.evidence if primary.evidence != "unknown" else fallback.evidence
    confidence = max(primary.confidence, fallback.confidence)
    return InteractionFrame(
        act_type=act_type if act_type in ACT_TYPES else "none",
        character_role=character_role if character_role in ROLES else "unknown",
        user_role=user_role if user_role in ROLES else "unknown",
        release_actor=release_actor if release_actor in RELEASE_ACTORS else "unknown",
        release_target=release_target if release_target in RELEASE_TARGETS else "unknown",
        confidence=float(confidence),
        evidence=evidence if evidence in EVIDENCE_LEVELS else "unknown",
    )


def build_interaction_frame(
    messages: Sequence[Any],
    *,
    character_gender: str = "",
) -> InteractionFrame:
    """
    Deprecated no-op heuristic.

    Roles must come from TurnPlan / Actor scene_result — not Chinese cue lists.
    """
    del messages, character_gender
    return InteractionFrame()


def resulting_scene_from_storage(raw: Any) -> Optional[dict]:
    from .scene_frame import scene_frame_from_mapping

    frame = scene_frame_from_mapping(raw)
    return frame.to_storage() if frame else None


def frame_forbids_user_as_releaser(reply: str, frame: InteractionFrame) -> bool:
    """Legacy phrase check for unit tests; live path uses Director recheck."""
    if not (
        frame.release_actor == "character"
        and frame.release_target == "user"
        and frame.confidence >= 0.7
    ):
        return False
    body = reply or ""
    bad = (
        "你想射就射",
        "你射吧",
        "你射在里面",
        "你射进来",
        "你内射",
        "你可以射",
        "让你射",
    )
    return any(b in body for b in bad)


def frame_release_contract_lines(frame: InteractionFrame) -> tuple[str, ...]:
    must: list[str] = []
    if frame.release_actor == "character" and frame.release_target == "user":
        must.append(
            "释放语义：用户在问角色是否射入用户体内；角色用同意/犹豫回应自己的释放，禁止改成用户在射"
        )
    elif frame.release_actor == "user" and frame.release_target == "character":
        must.append(
            "释放语义：用户可能射入角色体内；角色写承受/邀请，禁止改成角色自己在射精完成态（除非用户要角色射）"
        )
    if frame.character_role == "actor" and frame.act_type == "penetration":
        must.append("角色是插入方：推进与抽送写角色主动；禁止默认写成角色被插入")
    elif frame.character_role == "receiver" and frame.act_type == "penetration":
        must.append("角色是被插入方：写被进入的即时感受；禁止假设用户未写出的高潮进程")
    return tuple(must)


__all__ = [
    "InteractionFrame",
    "RESULTING_SCENE_KEY",
    "build_interaction_frame",
    "parse_interaction_frame_payload",
    "coalesce_interaction_frame",
    "frame_forbids_user_as_releaser",
    "frame_release_contract_lines",
    "resulting_scene_from_storage",
]
