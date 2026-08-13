"""SceneFrame — objective interaction scene across turns (#276 converge).

Persisted after each successful actor turn. Director reads this as prior reality.
No Chinese lexicon inference — roles come from Actor scene_result + structural checks.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional

ACT_TYPES = ("penetration", "oral", "manual", "none")
ROLES = ("actor", "receiver", "mutual", "unknown")
RELEASE_ACTORS = ("character", "user", "unknown")
RELEASE_TARGETS = ("character", "user", "external", "unknown")
PHASES = (
    "其他",
    "插入前",
    "准备插入",
    "插入时",
    "抽插时",
    "角色高潮（自然发生）",
)

# Canonical key; legacy `_resulting_scene` still read for migration
SCENE_FRAME_KEY = "_scene_frame"
LEGACY_RESULTING_SCENE_KEY = "_resulting_scene"


@dataclass(frozen=True)
class SceneFrame:
    act_type: str = "none"
    character_role: str = "unknown"
    user_role: str = "unknown"
    phase: str = "其他"
    release_actor: str = "unknown"
    release_target: str = "unknown"

    def to_storage(self) -> Dict[str, Any]:
        return asdict(self)

    def to_prompt(self, language: str = "zh") -> str:
        if language != "zh":
            return (
                f"[SCENE FRAME act={self.act_type} phase={self.phase} "
                f"char={self.character_role} user={self.user_role} "
                f"release={self.release_actor}->{self.release_target}]"
            )
        return (
            f"【现场 SceneFrame · {self.act_type} · {self.phase}】\n"
            f"角色：{self.character_role}；用户：{self.user_role}；"
            f"释放：{self.release_actor}->{self.release_target}\n"
            "性别只决定身体词库，绝不决定谁插入、谁被插入、谁射。"
        )

    def roles_coherent(self) -> bool:
        """Legal role pairs only — rejects actor/actor, receiver/receiver, etc."""
        c, u = self.character_role, self.user_role
        if c == "unknown" or u == "unknown":
            return True  # unknown is allowed (incomplete, not illegal)
        if c == "mutual" and u == "mutual":
            return True
        if {c, u} == {"actor", "receiver"}:
            return True
        return False

    def roles_known(self) -> bool:
        """True when both sides have concrete complementary (or mutual) roles."""
        if self.character_role == "unknown" or self.user_role == "unknown":
            return False
        return self.roles_coherent()

    def to_interaction_frame_dict(self) -> Dict[str, Any]:
        """Bridge for turn_contract InteractionFrame fields."""
        return {
            "act_type": self.act_type,
            "character_role": self.character_role,
            "user_role": self.user_role,
            "release_actor": self.release_actor,
            "release_target": self.release_target,
            "confidence": 0.9 if self.roles_known() else 0.0,
            "evidence": "recent_context" if self.roles_known() else "unknown",
        }


def empty_scene_frame() -> SceneFrame:
    return SceneFrame()


def _norm_enum(value: Any, allowed: tuple[str, ...], default: str) -> str:
    s = str(value or default).strip()
    return s if s in allowed else default


def scene_frame_from_mapping(raw: Any) -> Optional[SceneFrame]:
    if not isinstance(raw, dict):
        return None
    phase = raw.get("phase") or raw.get("stage") or "其他"
    frame = SceneFrame(
        act_type=_norm_enum(raw.get("act_type"), ACT_TYPES, "none"),
        character_role=_norm_enum(raw.get("character_role"), ROLES, "unknown"),
        user_role=_norm_enum(raw.get("user_role"), ROLES, "unknown"),
        phase=_norm_enum(phase, PHASES, "其他"),
        release_actor=_norm_enum(raw.get("release_actor"), RELEASE_ACTORS, "unknown"),
        release_target=_norm_enum(raw.get("release_target"), RELEASE_TARGETS, "unknown"),
    )
    # Illegal pairs → coerce to unknown rather than accept incoherent scene
    if not frame.roles_coherent():
        return SceneFrame(
            act_type=frame.act_type,
            character_role="unknown",
            user_role="unknown",
            phase=frame.phase,
            release_actor=frame.release_actor,
            release_target=frame.release_target,
        )
    return frame


def scene_frame_from_storage(state: Optional[Dict[str, Any]]) -> Optional[SceneFrame]:
    """Load SceneFrame from chat state (new key, then legacy)."""
    if not isinstance(state, dict):
        return None
    frame = scene_frame_from_mapping(state.get(SCENE_FRAME_KEY))
    if frame is not None:
        return frame
    return scene_frame_from_mapping(state.get(LEGACY_RESULTING_SCENE_KEY))


def roles_flipped(a: SceneFrame, b: SceneFrame) -> bool:
    pair = {"actor", "receiver"}
    if {a.character_role, a.user_role} != pair or {b.character_role, b.user_role} != pair:
        return False
    return a.character_role != b.character_role and a.user_role != b.user_role


__all__ = [
    "ACT_TYPES",
    "ROLES",
    "RELEASE_ACTORS",
    "RELEASE_TARGETS",
    "PHASES",
    "SCENE_FRAME_KEY",
    "LEGACY_RESULTING_SCENE_KEY",
    "SceneFrame",
    "empty_scene_frame",
    "scene_frame_from_mapping",
    "scene_frame_from_storage",
    "roles_flipped",
]
