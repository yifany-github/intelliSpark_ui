"""Role-aware interaction frame for bidirectional NSFW semantics (#276).

Detects who is acting / receiving / releasing from dialogue evidence.
Gender must NOT decide act roles — only body vocabulary consumers may use gender.

Evidence priority: explicit_current > recent_context > unknown
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Optional, Sequence

from .beat_progression import iter_history, last_assistant_text, last_user_text

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
        """Short director sheet — injected alongside turn contract."""
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


# --- cue lexicons (substring, CJK) ---

_USER_CREAMPIE_ASK = (
    "射在里面",
    "射里面",
    "内射可以",
    "射进来可以",
    "射在我里面",
    "射给我里面",
    "可以内射",
    "内射吗",
    "射进来吗",
)

_USER_ASKS_WHERE_RELEASE = (
    "射哪里",
    "射哪儿",
    "射在哪",
    "想射哪",
    "要射哪",
)

# Character (1st person) as penetrator / actor in recent assistant text
_CHAR_ACTOR_PEN = (
    "插进你",
    "顶进你",
    "插进你的",
    "顶进你的",
    "整根没入",
    "抽送",
    "我的肉棒",
    "我的鸡巴",
    "我腰微微上顶",
    "我腰上顶",
    "把你抱",
    "扣着你腰",
    "顶到最",
)

# Character as receiver
_CHAR_RECEIVER_PEN = (
    "被你插",
    "你插进来",
    "你顶进来",
    "穴口被",
    "含着你的肉棒",
    "含着你的鸡巴",
    "你的肉棒",
    "你的鸡巴",
    "被撑开",
    "内壁被",
)

_USER_COMMAND_ENTER = (
    "进来",
    "插进来",
    "插我",
    "进入我",
    "干我",
)

_USER_COMMAND_CHAR_RECEIVE = (
    "我插你",
    "我进去",
    "让我进去",
    "我要进去",
)


def _compact(text: str) -> str:
    return (text or "").replace(" ", "").replace("\n", "")


def _hits(text: str, cues: Sequence[str]) -> int:
    body = _compact(text)
    return sum(1 for c in cues if c in body)


def parse_interaction_frame_payload(raw: str) -> Optional[InteractionFrame]:
    """Parse LLM JSON (possibly fenced) into InteractionFrame; None if invalid."""
    text = (raw or "").strip()
    if not text:
        return None
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    # First JSON object in the reply
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
    """
    Prefer LLM primary; fill unknown fields from keyword heuristic fallback.
    If primary is empty, return fallback wholesale.
    """
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
    # If we borrowed critical role/release from fallback, keep at least fallback evidence
    borrowed = (
        (primary.character_role == "unknown" and character_role != "unknown")
        or (primary.release_actor == "unknown" and release_actor != "unknown")
    )
    if borrowed and evidence == "unknown":
        evidence = fallback.evidence

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
    Keyword / heuristic fallback for act roles.

    character_gender is accepted for API symmetry but MUST NOT decide roles.
    Prefer LLM director via NSFWIntentService.detect_interaction_frame in generate path.
    """
    del character_gender  # explicit: gender is not an act-role signal
    user_text = last_user_text(messages)
    assistant_text = last_assistant_text(messages)
    recent_assistant = "\n".join(
        text for role, text in iter_history(messages, limit=10) if role == "assistant"
    )
    recent_user = "\n".join(
        text for role, text in iter_history(messages, limit=10) if role == "user"
    )

    u = _compact(user_text)
    evidence = "unknown"
    confidence = 0.0
    act_type = "none"
    char_role = "unknown"
    user_role = "unknown"
    release_actor = "unknown"
    release_target = "unknown"

    actor_score = _hits(recent_assistant, _CHAR_ACTOR_PEN) + _hits(assistant_text, _CHAR_ACTOR_PEN)
    receiver_score = _hits(recent_assistant, _CHAR_RECEIVER_PEN) + _hits(
        assistant_text, _CHAR_RECEIVER_PEN
    )
    # User commands this turn
    user_wants_char_enter = any(c in u for c in _USER_COMMAND_ENTER) and not any(
        c in u for c in _USER_COMMAND_CHAR_RECEIVE
    )
    user_wants_self_enter = any(c in u for c in _USER_COMMAND_CHAR_RECEIVE)

    if user_wants_char_enter:
        act_type = "penetration"
        char_role = "actor"
        user_role = "receiver"
        evidence = "explicit_current"
        confidence = 0.85
    elif user_wants_self_enter:
        act_type = "penetration"
        char_role = "receiver"
        user_role = "actor"
        evidence = "explicit_current"
        confidence = 0.85
    elif actor_score >= 2 and actor_score > receiver_score:
        act_type = "penetration"
        char_role = "actor"
        user_role = "receiver"
        evidence = "recent_context"
        confidence = min(0.75, 0.4 + 0.1 * actor_score)
    elif receiver_score >= 2 and receiver_score > actor_score:
        act_type = "penetration"
        char_role = "receiver"
        user_role = "actor"
        evidence = "recent_context"
        confidence = min(0.75, 0.4 + 0.1 * receiver_score)
    elif actor_score == 1 and receiver_score == 0:
        act_type = "penetration"
        char_role = "actor"
        user_role = "receiver"
        evidence = "recent_context"
        confidence = 0.45
    elif receiver_score == 1 and actor_score == 0:
        act_type = "penetration"
        char_role = "receiver"
        user_role = "actor"
        evidence = "recent_context"
        confidence = 0.45

    # Creampie / release questions — resolve against established penetration roles
    creampie_ask = any(c in u for c in _USER_CREAMPIE_ASK)
    where_ask = any(c in u for c in _USER_ASKS_WHERE_RELEASE)

    if creampie_ask or where_ask:
        if char_role == "actor" and user_role == "receiver":
            # Character is inside user → 「射在里面」= character into user
            release_actor = "character"
            release_target = "user"
            if evidence == "unknown":
                evidence = "explicit_current"
            else:
                evidence = "explicit_current" if creampie_ask else evidence
            confidence = max(confidence, 0.9)
            act_type = "penetration"
        elif char_role == "receiver" and user_role == "actor":
            release_actor = "user"
            release_target = "character"
            evidence = "explicit_current"
            confidence = max(confidence, 0.9)
            act_type = "penetration"
        elif creampie_ask and ("射在我里面" in u or "射给我里面" in u):
            # Explicit user body as target → character is releaser
            release_actor = "character"
            release_target = "user"
            char_role = "actor" if char_role == "unknown" else char_role
            user_role = "receiver" if user_role == "unknown" else user_role
            act_type = "penetration"
            evidence = "explicit_current"
            confidence = 0.8
        # else leave release unknown — do not default to female-receiver creampie

    # Oral / manual weak signals (optional, low confidence)
    if act_type == "none":
        if any(c in u for c in ("含住", "口交", "用嘴")) or any(
            c in _compact(assistant_text) for c in ("含着", "吞吐")
        ):
            act_type = "oral"
            evidence = "explicit_current" if any(c in u for c in ("含住", "口交", "用嘴")) else "recent_context"
            confidence = max(confidence, 0.4)
        elif any(c in u for c in ("用手", "撸", "摸我")):
            act_type = "manual"
            evidence = "explicit_current"
            confidence = max(confidence, 0.4)

    return InteractionFrame(
        act_type=act_type if act_type in ACT_TYPES else "none",
        character_role=char_role if char_role in ROLES else "unknown",
        user_role=user_role if user_role in ROLES else "unknown",
        release_actor=release_actor if release_actor in RELEASE_ACTORS else "unknown",
        release_target=release_target if release_target in RELEASE_TARGETS else "unknown",
        confidence=float(confidence),
        evidence=evidence if evidence in EVIDENCE_LEVELS else "unknown",
    )


def frame_forbids_user_as_releaser(reply: str, frame: InteractionFrame) -> bool:
    """
    True when reply wrongly makes the user the ejaculator while frame says character releases into user.
    """
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
        "那就射吧",
        "就射吧",
        "你可以射",
        "让你射",
    )
    return any(b in body for b in bad)


def frame_release_contract_lines(frame: InteractionFrame) -> tuple[str, ...]:
    """Hard must / must_not snippets for turn_contract."""
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
    "build_interaction_frame",
    "parse_interaction_frame_payload",
    "coalesce_interaction_frame",
    "frame_forbids_user_as_releaser",
    "frame_release_contract_lines",
]
