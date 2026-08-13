"""TurnPlan — Director output for how this turn should change the scene (#276).

Switch is never trusted from a boolean alone: transition=switch requires
evidence_quote that is a substring of the current user utterance (server check).
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Optional

from .scene_frame import (
    ACT_TYPES,
    PHASES,
    RELEASE_ACTORS,
    RELEASE_TARGETS,
    ROLES,
    SceneFrame,
    empty_scene_frame,
    scene_frame_from_mapping,
)

TURN_PLAN_KEY = "_turn_plan"
# Legacy storage key still written/read during transition
TURN_DIRECTOR_KEY = "_turn_director"

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
TRANSITIONS = (
    "continue",
    "switch",
    "establish",
    "release",
    "refuse",
    "other",
)


@dataclass(frozen=True)
class TurnPlan:
    intent: str = "other"
    boundary: str = "unknown"
    next_beat: str = ""
    transition: str = "other"
    evidence_quote: str = ""
    expected_scene: SceneFrame = field(default_factory=empty_scene_frame)
    source: str = "llm"  # llm | fallback | corrected

    def to_storage(self) -> Dict[str, Any]:
        return {
            "intent": self.intent,
            "boundary": self.boundary,
            "next_beat": self.next_beat,
            "transition": self.transition,
            "evidence_quote": self.evidence_quote,
            "expected_scene": self.expected_scene.to_storage(),
            "source": self.source,
            # Legacy flat fields for older readers / turn_contract bridge
            "stage": self.expected_scene.phase,
            "act_type": self.expected_scene.act_type,
            "character_role": self.expected_scene.character_role,
            "user_role": self.expected_scene.user_role,
            "release_actor": self.expected_scene.release_actor,
            "release_target": self.expected_scene.release_target,
            "user_intent": self.intent,
        }

    def to_prompt(self, language: str = "zh") -> str:
        scene = self.expected_scene.to_prompt(language)
        if language != "zh":
            return (
                f"{scene}\n"
                f"[TURN PLAN intent={self.intent} boundary={self.boundary} "
                f"transition={self.transition}]\n"
                f"NEXT BEAT: {self.next_beat or 'n/a'}\n"
                "Obey expected_scene roles. Soft = half-beat. Do not invent user climax."
            )
        lines = [
            scene,
            f"【导演 TurnPlan · 意图{self.intent} · 边界{self.boundary} · 转移{self.transition}】",
        ]
        if self.next_beat.strip():
            lines.append(f"本轮下一拍：{self.next_beat.strip()}")
        if self.transition == "switch" and self.evidence_quote.strip():
            lines.append(f"换位证据（须来自用户原话）：{self.evidence_quote.strip()}")
        lines.append("禁止代写用户未写出的表情/高潮/内心；软意图只推进半拍。")
        if self.boundary == "refused":
            lines.append("用户边界为拒绝：禁止当成允许内射或继续升级释放。")
        elif self.intent == "soft":
            lines.append("软试探：身体反应可以有，禁止主动拉开裤链/直接插入。")
        if (
            self.expected_scene.release_actor == "character"
            and self.expected_scene.release_target == "user"
        ):
            lines.append(
                "释放语义：用户在问角色是否射入用户；角色回应自己的释放，禁止改成用户在射。"
            )
        elif (
            self.expected_scene.release_actor == "user"
            and self.expected_scene.release_target == "character"
        ):
            lines.append(
                "释放语义：用户可能射入角色；角色写承受/邀请，禁止擅自改成角色在射。"
            )
        return "\n".join(lines)

    # --- bridge aliases used by older call sites ---
    @property
    def stage(self) -> str:
        return self.expected_scene.phase

    @property
    def act_type(self) -> str:
        return self.expected_scene.act_type

    @property
    def character_role(self) -> str:
        return self.expected_scene.character_role

    @property
    def user_role(self) -> str:
        return self.expected_scene.user_role

    @property
    def release_actor(self) -> str:
        return self.expected_scene.release_actor

    @property
    def release_target(self) -> str:
        return self.expected_scene.release_target

    @property
    def user_intent(self) -> str:
        return self.intent

    def to_interaction_frame(self):
        from .interaction_frame import InteractionFrame

        d = self.expected_scene.to_interaction_frame_dict()
        return InteractionFrame(**d)


def conservative_fallback_plan(prev_scene: Optional[SceneFrame] = None) -> TurnPlan:
    scene = prev_scene or empty_scene_frame()
    return TurnPlan(
        intent="other",
        boundary="unknown",
        next_beat="接住用户当前句；主客体不明则勿默认插入方向",
        transition="other",
        evidence_quote="",
        expected_scene=scene,
        source="fallback",
    )


def turn_plan_from_storage(raw: Any) -> Optional[TurnPlan]:
    if not isinstance(raw, dict):
        return None
    try:
        if isinstance(raw.get("expected_scene"), dict):
            expected = scene_frame_from_mapping(raw.get("expected_scene")) or empty_scene_frame()
        else:
            # Legacy flat TurnDirector shape
            expected = scene_frame_from_mapping(
                {
                    "act_type": raw.get("act_type"),
                    "character_role": raw.get("character_role"),
                    "user_role": raw.get("user_role"),
                    "phase": raw.get("stage") or raw.get("phase"),
                    "release_actor": raw.get("release_actor"),
                    "release_target": raw.get("release_target"),
                }
            ) or empty_scene_frame()
        intent = str(raw.get("intent") or raw.get("user_intent") or "other")
        if intent not in USER_INTENTS:
            intent = "other"
        boundary = str(raw.get("boundary") or "unknown")
        if boundary not in BOUNDARIES:
            boundary = "unknown"
        transition = str(raw.get("transition") or "other")
        if transition not in TRANSITIONS:
            # legacy role_switch bool
            if raw.get("role_switch") is True:
                transition = "switch"
            else:
                transition = "other"
        return TurnPlan(
            intent=intent,
            boundary=boundary,
            next_beat=str(raw.get("next_beat") or "")[:160],
            transition=transition,
            evidence_quote=str(raw.get("evidence_quote") or "")[:120],
            expected_scene=expected,
            source=str(raw.get("source") or "llm"),
        )
    except (TypeError, ValueError):
        return None


def _norm(value: Any, allowed: tuple[str, ...], default: str) -> str:
    s = str(value or default).strip()
    return s if s in allowed else default


def parse_turn_plan_payload(raw: str) -> Optional[TurnPlan]:
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

    # Nested expected_scene or flat legacy fields
    nested = data.get("expected_scene")
    if isinstance(nested, dict):
        expected = SceneFrame(
            act_type=_norm(nested.get("act_type"), ACT_TYPES, "none"),
            character_role=_norm(nested.get("character_role"), ROLES, "unknown"),
            user_role=_norm(nested.get("user_role"), ROLES, "unknown"),
            phase=_norm(nested.get("phase") or nested.get("stage"), PHASES, "其他"),
            release_actor=_norm(nested.get("release_actor"), RELEASE_ACTORS, "unknown"),
            release_target=_norm(nested.get("release_target"), RELEASE_TARGETS, "unknown"),
        )
    else:
        expected = SceneFrame(
            act_type=_norm(data.get("act_type"), ACT_TYPES, "none"),
            character_role=_norm(data.get("character_role"), ROLES, "unknown"),
            user_role=_norm(data.get("user_role"), ROLES, "unknown"),
            phase=_norm(data.get("phase") or data.get("stage"), PHASES, "其他"),
            release_actor=_norm(data.get("release_actor"), RELEASE_ACTORS, "unknown"),
            release_target=_norm(data.get("release_target"), RELEASE_TARGETS, "unknown"),
        )

    intent = _norm(data.get("intent") or data.get("user_intent"), USER_INTENTS, "other")
    boundary = _norm(data.get("boundary"), BOUNDARIES, "unknown")
    transition = _norm(data.get("transition"), TRANSITIONS, "other")
    # Never honor bare role_switch without transition+quote — map only if quote present
    if transition != "switch" and data.get("role_switch") is True:
        quote = str(data.get("evidence_quote") or "").strip()
        if quote:
            transition = "switch"
    evidence_quote = str(data.get("evidence_quote") or "").strip()[:120]
    next_beat = str(data.get("next_beat") or "").strip()[:160]

    return TurnPlan(
        intent=intent,
        boundary=boundary,
        next_beat=next_beat,
        transition=transition,
        evidence_quote=evidence_quote,
        expected_scene=expected,
        source="llm",
    )


_QUOTE_STRIP_CHARS = (
    " \n\r\t\u3000"
    "\u201c\u201d\u2018\u2019\"'"
    "「」『』"
    "!！?？。.,，…~～"
)


def normalize_for_quote_match(text: str) -> str:
    """Strip whitespace / quotes / punctuation for structural evidence check."""
    if not text:
        return ""
    t = str(text)
    for ch in _QUOTE_STRIP_CHARS:
        t = t.replace(ch, "")
    return t.strip()


# Quotes that are too ambiguous to authorize user-as-actor / role switch.
# Closed set — not a growing cue lexicon for scene inference.
_NON_ROLE_EVIDENCE_QUOTES = frozenset(
    {
        "进来",
        "插进来",
        "进来吧",
        "快进来",
        "继续",
        "深一点",
        "再快点",
        "快点",
        "要",
        "来",
    }
)


def _quote_in_user(quote: str, user_text: str) -> bool:
    """Substring check with minimum length; reject closed-set ambiguous quotes."""
    nq = normalize_for_quote_match(quote or "")
    if len(nq) < 3:
        return False
    if nq in _NON_ROLE_EVIDENCE_QUOTES:
        return False
    return nq in normalize_for_quote_match(user_text)


def switch_evidence_valid(plan: TurnPlan, user_text: str) -> bool:
    """Server does not interpret Chinese — only checks quote ⊆ user utterance."""
    if plan.transition != "switch":
        return False
    return _quote_in_user(plan.evidence_quote, user_text)


def apply_switch_gate(
    plan: TurnPlan,
    *,
    prev_scene: Optional[SceneFrame],
    user_text: str,
) -> TurnPlan:
    """
    Structural gates (no Chinese understanding on server):
    - Flip vs prev requires transition=switch AND evidence_quote ⊆ user text
    - First-time establish of character=receiver (user penetrates) also requires
      evidence_quote ⊆ user text; otherwise keep roles unknown (never invent opposite)
    """
    from dataclasses import replace

    prev = prev_scene or empty_scene_frame()
    expected = plan.expected_scene

    if not expected.roles_coherent():
        return replace(
            plan,
            transition="other",
            evidence_quote="",
            expected_scene=SceneFrame(
                act_type=expected.act_type,
                character_role="unknown",
                user_role="unknown",
                phase=expected.phase,
                release_actor="unknown",
                release_target="unknown",
            ),
            source="corrected",
        )

    if not prev.roles_known():
        # Establishing user-as-actor / character-as-receiver needs quote evidence
        establishing_user_actor = (
            expected.character_role == "receiver"
            and expected.user_role == "actor"
            and expected.act_type != "none"
        )
        if establishing_user_actor and not _quote_in_user(plan.evidence_quote, user_text):
            # Do NOT invent character=actor — that "proves" the opposite claim.
            return replace(
                plan,
                transition="other",
                evidence_quote="",
                expected_scene=SceneFrame(
                    act_type=expected.act_type,
                    character_role="unknown",
                    user_role="unknown",
                    phase=expected.phase,
                    release_actor="unknown",
                    release_target="unknown",
                ),
                source="corrected",
            )
        if expected.roles_known() and expected.act_type != "none" and plan.transition == "other":
            return replace(plan, transition="establish", source="corrected")
        return plan

    flipped = (
        expected.roles_known()
        and {prev.character_role, prev.user_role} == {"actor", "receiver"}
        and {expected.character_role, expected.user_role} == {"actor", "receiver"}
        and prev.character_role != expected.character_role
    )
    if not flipped:
        char_role = (
            prev.character_role
            if expected.character_role == "unknown"
            else expected.character_role
        )
        user_role = (
            prev.user_role if expected.user_role == "unknown" else expected.user_role
        )
        release_actor = expected.release_actor
        release_target = expected.release_target
        # Release must follow stable roles unless switch already validated
        if char_role == "actor" and user_role == "receiver":
            if release_actor == "user" and release_target == "character":
                release_actor, release_target = "character", "user"
        elif char_role == "receiver" and user_role == "actor":
            if release_actor == "character" and release_target == "user":
                release_actor, release_target = "user", "character"

        if (
            expected.character_role == "unknown"
            and plan.intent in {"enter", "continue", "permission"}
        ) or (
            release_actor != expected.release_actor
            or release_target != expected.release_target
            or char_role != expected.character_role
        ):
            filled = SceneFrame(
                act_type=expected.act_type if expected.act_type != "none" else prev.act_type,
                character_role=char_role,
                user_role=user_role,
                phase=expected.phase if expected.phase != "其他" else prev.phase,
                release_actor=release_actor,
                release_target=release_target,
            )
            return replace(plan, expected_scene=filled, source="corrected")
        return plan

    if plan.transition == "switch" and switch_evidence_valid(plan, user_text):
        return plan

    # Invalid switch claim — keep previous roles
    corrected = SceneFrame(
        act_type=expected.act_type if expected.act_type != "none" else prev.act_type,
        character_role=prev.character_role,
        user_role=prev.user_role,
        phase=expected.phase if expected.phase != "其他" else prev.phase,
        release_actor=expected.release_actor,
        release_target=expected.release_target,
    )
    return replace(
        plan,
        transition="continue",
        evidence_quote="",
        expected_scene=corrected,
        source="corrected",
    )


def clip_head_tail(content: str, max_len: int = 420) -> str:
    text = content or ""
    if len(text) <= max_len:
        return text
    head = max(80, max_len // 2 - 20)
    tail = max_len - head - 3
    return f"{text[:head]}…{text[-tail:]}"


def _scene_snippet(scene: Optional[SceneFrame]) -> str:
    if scene is None or not scene.roles_known():
        if scene is None:
            return "（无）"
        return (
            f"act={scene.act_type} phase={scene.phase} char={scene.character_role} "
            f"user={scene.user_role}"
        )
    return (
        f"act={scene.act_type} phase={scene.phase} char={scene.character_role} "
        f"user={scene.user_role} release={scene.release_actor}->{scene.release_target}"
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
    return "；".join(bits) if bits else "（无相关字段）"


def build_turn_plan_prompt(
    conversation: str,
    *,
    prev_scene: Optional[SceneFrame] = None,
    state: Optional[Dict[str, Any]] = None,
) -> str:
    return f"""你是回合导演。根据上一场 SceneFrame 与当前对话，输出一行 JSON（不要 markdown，不要解释）。

字段：
{{
  "intent": "permission"|"continue"|"enter"|"refuse"|"soft"|"mundane"|"other",
  "boundary": "allowed"|"refused"|"unknown",
  "next_beat": "一句中文导演指示（≤40字）",
  "transition": "continue"|"switch"|"establish"|"release"|"refuse"|"other",
  "evidence_quote": "若 transition=switch 或首次建立用户插入，必须从用户当前原话摘录≥3字（不含标点包装）；否则空字符串",
  "expected_scene": {{
    "act_type": "penetration"|"oral"|"manual"|"none",
    "character_role": "actor"|"receiver"|"mutual"|"unknown",
    "user_role": "actor"|"receiver"|"mutual"|"unknown",
    "phase": "其他"|"插入前"|"准备插入"|"插入时"|"抽插时"|"角色高潮（自然发生）",
    "release_actor": "character"|"user"|"unknown",
    "release_target": "character"|"user"|"external"|"unknown"
  }}
}}

硬规则：
1. 不确定就写 unknown / none / 其他；禁止猜插入方向；禁止编造相反角色
2. 性别绝不决定谁插入、谁射
3. expected_scene 是本轮结束后应成立的客观现场；character_role/user_role 须互补（actor↔receiver 或 mutual↔mutual），禁止 actor/actor、receiver/receiver
4. 换位（角色与用户插入方向对调）必须 transition=switch，且 evidence_quote 必须是用户当前原话的连续摘录；否则 transition=continue 并保持上一场角色
5. 首次建立「角色=receiver / 用户插入」同样必须 evidence_quote 摘自用户原话且≥3字（如「我插你/让我进去」）；禁止把「进来/插进来/进来！」当作换位或用户插入证据。证据不足时 roles 写 unknown，不要猜成角色=actor
6. 「不要射在里面」→ boundary=refused
7. 「射在里面可以吗」且角色已是插入方 → release_actor=character, release_target=user, transition=release
8. 「射在里面可以吗」且用户已是插入方 → release_actor=user, release_target=character, transition=release
9. 日常拿手机等 → act_type=none，勿判 penetration
10. soft → 只推进半拍，禁止跳到插入

上一场 SceneFrame: {_scene_snippet(prev_scene)}
当前状态摘要: {_state_snippet(state)}

当前对话:
{conversation}

只输出 JSON:"""


def build_director_recheck_prompt(
    *,
    reply: str,
    plan: TurnPlan,
    prev_scene: Optional[SceneFrame],
    user_text: str,
) -> str:
    return f"""你是同一位回合导演，正在复核演员本轮正文是否符合 TurnPlan。
只输出一行 JSON（三态）：
{{"status":"pass"|"actor_fail"|"verifier_error","reason":"≤30字"}}

规则：
1. pass：正文主客体/释放与 expected_scene 一致
2. actor_fail：正文明确搞反插入方向或「谁在射」，或 boundary=refused 却写成允许内射
3. verifier_error：文本不足、歧义、或你无法可靠判断——不要猜成 actor_fail
4. 无用户原话换位证据时，演员不得把已是插入方的角色写成被插入 → actor_fail
5. 不要评价文笔，只判主客体/释放/边界

上一场: {_scene_snippet(prev_scene)}
TurnPlan: intent={plan.intent} boundary={plan.boundary} transition={plan.transition}
expected: {_scene_snippet(plan.expected_scene)}
用户原话: {user_text[:200]}
演员正文:
{(reply or '')[:1200]}

只输出 JSON:"""


RECHECK_PASS = "pass"
RECHECK_ACTOR_FAIL = "actor_fail"
RECHECK_VERIFIER_ERROR = "verifier_error"


def parse_recheck_payload(raw: str) -> str:
    """Return pass | actor_fail | verifier_error. Parse/API ambiguity → verifier_error."""
    text = (raw or "").strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return RECHECK_VERIFIER_ERROR
    try:
        data = json.loads(text[start : end + 1])
    except (json.JSONDecodeError, TypeError):
        return RECHECK_VERIFIER_ERROR
    if not isinstance(data, dict):
        return RECHECK_VERIFIER_ERROR
    status = str(data.get("status") or "").strip().lower()
    if not status:
        if data.get("ok") is True:
            status = RECHECK_PASS
        elif data.get("ok") is False:
            status = RECHECK_ACTOR_FAIL
        else:
            status = RECHECK_VERIFIER_ERROR
    if status not in {RECHECK_PASS, RECHECK_ACTOR_FAIL, RECHECK_VERIFIER_ERROR}:
        return RECHECK_VERIFIER_ERROR
    return status


def director_contract_lines(plan: TurnPlan) -> tuple[str, ...]:
    must: list[str] = []
    esc = plan.expected_scene
    if esc.release_actor == "character" and esc.release_target == "user":
        must.append(
            "释放语义：用户在问角色是否射入用户体内；角色用同意/犹豫回应自己的释放，禁止改成用户在射"
        )
    elif esc.release_actor == "user" and esc.release_target == "character":
        must.append(
            "释放语义：用户可能射入角色体内；角色写承受/邀请，禁止改成角色自己在射精完成态"
        )
    if esc.character_role == "actor" and esc.act_type == "penetration":
        must.append("角色是插入方：推进与抽送写角色主动；禁止默认写成角色被插入")
    elif esc.character_role == "receiver" and esc.act_type == "penetration":
        must.append("角色是被插入方：写被进入的即时感受；禁止假设用户未写出的高潮进程")
    if plan.next_beat.strip():
        must.append(f"导演下一拍：{plan.next_beat.strip()}")
    if plan.boundary == "refused":
        must.append("用户明确拒绝内射/该动作：禁止写成允许或继续升级释放")
    if plan.intent == "soft":
        must.append("软意图：只推进半拍到一格期待；禁止一次跳到性交中段或主动掏出")
    if plan.intent == "mundane":
        must.append("先接住日常/人情，再决定是否升温")
    must.append(
        "正文后必须附隐藏块 [[SCENE_RESULT]]{...}[[/SCENE_RESULT]]，"
        "字段 character_role/user_role/act_type/phase/release_actor/release_target 与现场一致"
    )
    return tuple(must)


__all__ = [
    "TURN_PLAN_KEY",
    "TURN_DIRECTOR_KEY",
    "TurnPlan",
    "USER_INTENTS",
    "BOUNDARIES",
    "TRANSITIONS",
    "conservative_fallback_plan",
    "turn_plan_from_storage",
    "parse_turn_plan_payload",
    "normalize_for_quote_match",
    "switch_evidence_valid",
    "apply_switch_gate",
    "clip_head_tail",
    "build_turn_plan_prompt",
    "build_director_recheck_prompt",
    "parse_recheck_payload",
    "RECHECK_PASS",
    "RECHECK_ACTOR_FAIL",
    "RECHECK_VERIFIER_ERROR",
    "director_contract_lines",
]
