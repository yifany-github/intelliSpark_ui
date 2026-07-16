"""Unified Turn Director — one structured LLM call for stage + interaction roles (#276).

LLM JSON is authoritative including unknown. Heuristic fallback only when
API/parse fails, and must stay conservative (no boundary guessing).
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional, Sequence

from .interaction_frame import (
    ACT_TYPES,
    EVIDENCE_LEVELS,
    InteractionFrame,
    RELEASE_ACTORS,
    RELEASE_TARGETS,
    ROLES,
)

TURN_DIRECTOR_KEY = "_turn_director"

VALID_STAGES = (
    "其他",
    "插入前",
    "准备插入",
    "插入时",
    "抽插时",
    "角色高潮（自然发生）",
)
USER_INTENTS = (
    "permission",
    "continue",
    "enter",
    "refuse",
    "soft",
    "mundane",
    "other",
)
BOUNDARIES = ("allowed", "refused", "unknown")


@dataclass(frozen=True)
class TurnDirector:
    stage: str = "其他"
    act_type: str = "none"
    character_role: str = "unknown"
    user_role: str = "unknown"
    release_actor: str = "unknown"
    release_target: str = "unknown"
    user_intent: str = "other"
    boundary: str = "unknown"
    next_beat: str = ""
    confidence: float = 0.0
    evidence: str = "unknown"
    source: str = "llm"  # llm | fallback

    def to_interaction_frame(self) -> InteractionFrame:
        return InteractionFrame(
            act_type=self.act_type if self.act_type in ACT_TYPES else "none",
            character_role=self.character_role if self.character_role in ROLES else "unknown",
            user_role=self.user_role if self.user_role in ROLES else "unknown",
            release_actor=self.release_actor if self.release_actor in RELEASE_ACTORS else "unknown",
            release_target=self.release_target if self.release_target in RELEASE_TARGETS else "unknown",
            confidence=float(self.confidence),
            evidence=self.evidence if self.evidence in EVIDENCE_LEVELS else "unknown",
        )

    def to_storage(self) -> Dict[str, Any]:
        return asdict(self)

    def to_prompt(self, language: str = "zh") -> str:
        frame_prompt = self.to_interaction_frame().to_prompt(language)
        if language != "zh":
            extra = (
                f"[DIRECTOR intent={self.user_intent} boundary={self.boundary} "
                f"stage={self.stage}]\n"
                f"NEXT BEAT: {self.next_beat or 'n/a'}\n"
                "Do not invent unstated user affect/actions. Soft intent = half-beat, not mid-act dump."
            )
            return f"{frame_prompt}\n{extra}"
        lines = [
            frame_prompt,
            f"【导演拍 · 阶段{self.stage} · 意图{self.user_intent} · 边界{self.boundary}】",
        ]
        if self.next_beat.strip():
            lines.append(f"本轮下一拍：{self.next_beat.strip()}")
        lines.append("禁止代写用户未写出的表情/高潮/内心；软意图只推进半拍，不要跳到性交中段。")
        if self.boundary == "refused":
            lines.append("用户边界为拒绝/不要：禁止当成允许内射或继续升级。")
        elif self.user_intent == "soft":
            lines.append("软试探：身体反应可以有，禁止主动拉开裤链/直接插入。")
        return "\n".join(lines)


def conservative_fallback_director() -> TurnDirector:
    """API/parse failure only — do not invent act roles or release."""
    return TurnDirector(
        stage="其他",
        act_type="none",
        character_role="unknown",
        user_role="unknown",
        release_actor="unknown",
        release_target="unknown",
        user_intent="other",
        boundary="unknown",
        next_beat="接住用户当前句，像这个人回应；主客体不明则勿默认插入方向",
        confidence=0.0,
        evidence="unknown",
        source="fallback",
    )


def director_from_storage(raw: Any) -> Optional[TurnDirector]:
    if not isinstance(raw, dict):
        return None
    try:
        return TurnDirector(
            stage=str(raw.get("stage") or "其他"),
            act_type=str(raw.get("act_type") or "none"),
            character_role=str(raw.get("character_role") or "unknown"),
            user_role=str(raw.get("user_role") or "unknown"),
            release_actor=str(raw.get("release_actor") or "unknown"),
            release_target=str(raw.get("release_target") or "unknown"),
            user_intent=str(raw.get("user_intent") or "other"),
            boundary=str(raw.get("boundary") or "unknown"),
            next_beat=str(raw.get("next_beat") or "")[:160],
            confidence=float(raw.get("confidence") or 0.0),
            evidence=str(raw.get("evidence") or "unknown"),
            source=str(raw.get("source") or "llm"),
        )
    except (TypeError, ValueError):
        return None


def parse_turn_director_payload(raw: str) -> Optional[TurnDirector]:
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

    stage = str(data.get("stage") or "其他").strip()
    if stage not in VALID_STAGES:
        # allow english aliases lightly
        aliases = {
            "penetration": "抽插时",
            "other": "其他",
        }
        stage = aliases.get(stage, "其他")
        if stage not in VALID_STAGES:
            stage = "其他"

    act_type = str(data.get("act_type") or "none").strip()
    char_role = str(data.get("character_role") or "unknown").strip()
    user_role = str(data.get("user_role") or "unknown").strip()
    release_actor = str(data.get("release_actor") or "unknown").strip()
    release_target = str(data.get("release_target") or "unknown").strip()
    user_intent = str(data.get("user_intent") or "other").strip()
    boundary = str(data.get("boundary") or "unknown").strip()
    next_beat = str(data.get("next_beat") or "").strip()[:160]
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
    if user_intent not in USER_INTENTS:
        user_intent = "other"
    if boundary not in BOUNDARIES:
        boundary = "unknown"
    if evidence not in EVIDENCE_LEVELS:
        evidence = "unknown"

    return TurnDirector(
        stage=stage,
        act_type=act_type,
        character_role=char_role,
        user_role=user_role,
        release_actor=release_actor,
        release_target=release_target,
        user_intent=user_intent,
        boundary=boundary,
        next_beat=next_beat,
        confidence=confidence,
        evidence=evidence,
        source="llm",
    )


def _state_snippet(state: Optional[Dict[str, Any]]) -> str:
    if not isinstance(state, dict) or not state:
        return "（无）"
    keep = ("环境", "衣服", "姿势", "欲望值", "兴奋度", "好感度")
    bits = []
    for k in keep:
        v = state.get(k)
        if v is None:
            continue
        if isinstance(v, dict):
            bits.append(f"{k}={v.get('value', v.get('description', ''))}")
        else:
            s = str(v).strip()
            if s:
                bits.append(f"{k}={s[:40]}")
    return "；".join(bits) if bits else "（无关键字段）"


def _prev_snippet(prev: Optional[TurnDirector]) -> str:
    if prev is None:
        return "（无）"
    return (
        f"stage={prev.stage} act={prev.act_type} char={prev.character_role} "
        f"user={prev.user_role} release={prev.release_actor}->{prev.release_target} "
        f"intent={prev.user_intent} boundary={prev.boundary}"
    )


def build_turn_director_prompt(
    conversation: str,
    *,
    prev_director: Optional[TurnDirector] = None,
    state: Optional[Dict[str, Any]] = None,
) -> str:
    return f"""你是回合导演。根据对话客观事实，输出一行 JSON（不要 markdown，不要解释）。

字段：
{{
  "stage": "其他"|"插入前"|"准备插入"|"插入时"|"抽插时"|"角色高潮（自然发生）",
  "act_type": "penetration"|"oral"|"manual"|"none",
  "character_role": "actor"|"receiver"|"mutual"|"unknown",
  "user_role": "actor"|"receiver"|"mutual"|"unknown",
  "release_actor": "character"|"user"|"unknown",
  "release_target": "character"|"user"|"external"|"unknown",
  "user_intent": "permission"|"continue"|"enter"|"refuse"|"soft"|"mundane"|"other",
  "boundary": "allowed"|"refused"|"unknown",
  "next_beat": "一句中文导演指示（≤40字）",
  "confidence": 0.0到1.0,
  "evidence": "explicit_current"|"recent_context"|"unknown"
}}

硬规则：
1. 不确定就写 unknown / none / 其他；禁止猜插入方向或释放方向
2. 性别绝不决定谁插入、谁射
3. 「不要射在里面/别内射」→ boundary=refused，release 勿当成允许
4. 「射在里面可以吗」且角色已是插入方 → release_actor=character, release_target=user, user_intent=permission, boundary=allowed|unknown
5. 「射在里面可以吗」且用户已是插入方 → release_actor=user, release_target=character
6. 「进来拿手机」类日常 → act_type=none，勿判 penetration
7. soft/想你了/抱一下 → user_intent=soft，next_beat 只要半拍身体/情绪，禁止跳到插入
8. next_beat 必须服务角色延续与节奏，禁止代写用户高潮/哭腔

上一张导演帧: {_prev_snippet(prev_director)}
当前状态摘要: {_state_snippet(state)}

当前对话:
{conversation}

只输出 JSON:"""


def director_contract_lines(director: TurnDirector) -> tuple[str, ...]:
    """Extra must lines for turn_contract beyond interaction frame release lines."""
    from .interaction_frame import frame_release_contract_lines

    must = list(frame_release_contract_lines(director.to_interaction_frame()))
    if director.next_beat.strip():
        must.append(f"导演下一拍：{director.next_beat.strip()}")
    if director.boundary == "refused":
        must.append("用户明确拒绝内射/该动作：禁止写成允许或继续升级释放")
    if director.user_intent == "soft":
        must.append("软意图：只推进半拍到一格期待；禁止一次跳到性交中段或主动掏出")
    if director.user_intent == "mundane":
        must.append("先接住日常/人情，再决定是否升温")
    return tuple(must)


__all__ = [
    "TURN_DIRECTOR_KEY",
    "TurnDirector",
    "build_turn_director_prompt",
    "parse_turn_director_payload",
    "conservative_fallback_director",
    "director_from_storage",
    "director_contract_lines",
]
