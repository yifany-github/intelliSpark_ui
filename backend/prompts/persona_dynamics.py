"""Short persona dynamics card — want/fear/defense as choice engines.

Not a new director module. Extract once from persona; each turn activate ONE
dimension and inject a single director goal into TurnContract.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

# Stable keys — universal, not role enums (aunt/teacher/alien all fit)
DYNAMICS_KEYS: Tuple[str, ...] = (
    "mask",
    "drive",
    "defense",
    "initiative",
    "pressure_shift",
    "boundary",
)

# Chat-state meta (hidden from diegetic UI)
RELATIONSHIP_READ_KEY = "_relationship_read"
UNRESOLVED_THREAD_KEY = "_unresolved_thread"
LAST_DYNAMIC_KEY = "_last_dynamic"

# mode → preferred dynamics (first available wins; then rotate off recent)
_MODE_PRIORITY: Dict[str, Tuple[str, ...]] = {
    "lead": ("initiative", "mask", "drive"),
    "preference": ("drive", "defense", "boundary"),
    "threshold": ("pressure_shift", "boundary", "defense"),
    "human_first": ("mask", "drive", "initiative"),
    "conflict": ("defense", "pressure_shift", "drive"),
    "intimacy": ("drive", "defense", "initiative"),
    "execute": ("initiative", "pressure_shift", "drive"),
    "react": ("defense", "initiative", "mask"),
    "early": ("mask", "initiative", "drive"),
    "mutual": ("drive", "mask", "initiative"),
    "pass_ball": ("initiative", "drive", "pressure_shift"),
}

_KEY_LABEL_ZH = {
    "mask": "面具/自我保护",
    "drive": "核心欲望",
    "defense": "被逼近时的回避",
    "initiative": "主动时的推进方式",
    "pressure_shift": "压力升高后的失控点",
    "boundary": "硬边界",
}


def empty_dynamics() -> Dict[str, str]:
    return {k: "" for k in DYNAMICS_KEYS}


def normalize_dynamics(raw: Any) -> Dict[str, str]:
    """Accept dict / JSON-like mapping; keep only known keys, short strings."""
    out = empty_dynamics()
    if not isinstance(raw, Mapping):
        return out
    for key in DYNAMICS_KEYS:
        val = raw.get(key)
        if isinstance(val, str) and val.strip():
            out[key] = val.strip()[:120]
    return out


def parse_dynamics_from_persona(persona_text: str) -> Dict[str, str]:
    """
    Parse optional 【动力学】 block from persona.

    Format (one key per line)::
        【动力学】
        mask: ...
        drive: ...
    """
    body = persona_text or ""
    out = empty_dynamics()
    m = re.search(r"【动力学】\s*(.*?)(?=\n【|\Z)", body, flags=re.S)
    if not m:
        return out
    block = m.group(1)
    for key in DYNAMICS_KEYS:
        km = re.search(
            rf"(?im)^\s*{key}\s*[:：]\s*(.+?)\s*$",
            block,
        )
        if km:
            out[key] = km.group(1).strip()[:120]
    return out


def infer_dynamics_from_persona(persona_text: str) -> Dict[str, str]:
    """
    Lightweight fallback when no 【动力学】 block — still differential, not identity enum.
    Prefer explicit block; this only bridges migration.
    """
    parsed = parse_dynamics_from_persona(persona_text)
    if any(parsed.values()):
        return parsed

    body = persona_text or ""
    out = empty_dynamics()
    # Generic inferences from existing slim-persona sections — not role labels
    if "Desire vs Role" in body or "【冲突" in body:
        out["drive"] = "想被靠近与确认，却不能丢掉自己的体面"
        out["defense"] = "用照顾/推开/说笑把危险话题挡回去"
        out["pressure_shift"] = "压力大时身体比嘴诚实，嘴上仍想维持原来的自己"
        out["boundary"] = "不会主动变成无性格的服务机器"
        out["mask"] = "先维持日常里那个可靠、得体的自己"
        out["initiative"] = "真要动时也先半拍犹豫，再用动作而不是演讲"
    elif "敢撩" in body or "挑衅" in body or "夜店" in body:
        out["mask"] = "用大胆和玩笑盖住认真动情"
        out["drive"] = "要掌控节奏、被接住、玩得过瘾"
        out["defense"] = "被看穿时更用力挑衅或把人往暗处带"
        out["initiative"] = "先撩、留半拍门槛，被接住才加码"
        out["pressure_shift"] = "真动情时玩笑变少，眼神和动作更直"
        out["boundary"] = "不做谁都行的换皮服务机"
    else:
        out["mask"] = "用习惯的礼貌或距离保护自己"
        out["drive"] = "想被认真对待，而不是被当成工具"
        out["defense"] = "被逼近时先缩回熟悉的说话方式"
        out["initiative"] = "主动时用符合自己口吻的一小步"
        out["pressure_shift"] = "压力升高时破绽从语气和动作里漏出来"
        out["boundary"] = "不忽然换成另一个人的性格"
    return out


def resolve_dynamics(
    persona_text: str,
    *,
    explicit: Optional[Mapping[str, Any]] = None,
) -> Dict[str, str]:
    """explicit dict wins; else parse block; else infer."""
    if explicit:
        norm = normalize_dynamics(explicit)
        if any(norm.values()):
            return norm
    parsed = parse_dynamics_from_persona(persona_text)
    if any(parsed.values()):
        return parsed
    return infer_dynamics_from_persona(persona_text)


def _relationship_bits(state: Optional[Mapping[str, Any]]) -> Tuple[str, str, Tuple[str, ...]]:
    if not isinstance(state, Mapping):
        return "", "", ()
    read = state.get(RELATIONSHIP_READ_KEY) or state.get("relationship_read") or ""
    thread = state.get(UNRESOLVED_THREAD_KEY) or state.get("unresolved_thread") or ""
    last = state.get(LAST_DYNAMIC_KEY) or state.get("last_dynamic") or ""
    recent: Tuple[str, ...] = ()
    if isinstance(last, str) and last.strip() in DYNAMICS_KEYS:
        recent = (last.strip(),)
    elif isinstance(last, (list, tuple)):
        recent = tuple(str(x) for x in last if str(x) in DYNAMICS_KEYS)
    read_s = read.strip()[:80] if isinstance(read, str) else ""
    thread_s = thread.strip()[:80] if isinstance(thread, str) else ""
    return read_s, thread_s, recent


def select_active_dynamic(
    *,
    mode: str,
    intensity: str = "medium",
    dynamics: Mapping[str, str],
    recent_goals: Sequence[str] = (),
    preference: bool = False,
    threshold: bool = False,
) -> Tuple[str, str]:
    """
    Rule table — no LLM. Returns (key, text) or ("", "").

    Prefer mode priorities; skip empty / recently used; intensity only breaks ties.
    """
    effective_mode = mode
    if preference:
        effective_mode = "preference"
    elif threshold:
        effective_mode = "threshold"

    order = list(_MODE_PRIORITY.get(effective_mode, _MODE_PRIORITY["mutual"]))
    # Under heavy heat, pressure_shift rises in priority for execute/intimacy
    if intensity == "heavy" and effective_mode in {"execute", "intimacy", "conflict"}:
        order = ["pressure_shift"] + [k for k in order if k != "pressure_shift"]

    recent = {g for g in recent_goals if g in DYNAMICS_KEYS}
    filled = {k: (dynamics.get(k) or "").strip() for k in DYNAMICS_KEYS}

    def pick(skip_recent: bool) -> Optional[str]:
        for key in order:
            text = filled.get(key) or ""
            if not text:
                continue
            if skip_recent and key in recent:
                continue
            return key
        return None

    key = pick(skip_recent=True) or pick(skip_recent=False)
    if not key:
        return "", ""
    return key, filled[key]


def format_persona_goal(
    key: str,
    text: str,
    *,
    relationship_read: str = "",
    unresolved_thread: str = "",
) -> str:
    """Single must-line: director goal, not psychology lecture."""
    label = _KEY_LABEL_ZH.get(key, key)
    parts = [
        f"【人物选择·{label}】{text}",
        "用一个具体选择或动作体现，不要解释人格/身份标签，不要说「作为××」",
    ]
    if relationship_read:
        parts.append(f"她眼下如何看你：{relationship_read}")
    if unresolved_thread:
        parts.append(f"未收的线：{unresolved_thread}")
    return "；".join(parts)


def build_persona_goal(
    *,
    mode: str,
    intensity: str = "medium",
    persona_text: str = "",
    state: Optional[Mapping[str, Any]] = None,
    explicit_dynamics: Optional[Mapping[str, Any]] = None,
    preference: bool = False,
    threshold: bool = False,
) -> Tuple[str, str]:
    """
    Returns (goal_must_line, active_key).
    Empty goal if nothing usable — caller may skip.
    """
    dynamics = resolve_dynamics(persona_text, explicit=explicit_dynamics)
    rel_read, thread, recent_from_state = _relationship_bits(state)
    key, text = select_active_dynamic(
        mode=mode,
        intensity=intensity,
        dynamics=dynamics,
        recent_goals=recent_from_state,
        preference=preference,
        threshold=threshold,
    )
    if not key or not text:
        return "", ""
    goal = format_persona_goal(
        key,
        text,
        relationship_read=rel_read,
        unresolved_thread=thread,
    )
    return goal, key


def format_dynamics_block(dynamics: Mapping[str, str]) -> str:
    """Serialize for embedding into persona_prompt."""
    lines = ["【动力学】"]
    for key in DYNAMICS_KEYS:
        val = (dynamics.get(key) or "").strip()
        if val:
            lines.append(f"{key}: {val}")
    return "\n".join(lines) if len(lines) > 1 else ""


__all__ = [
    "DYNAMICS_KEYS",
    "LAST_DYNAMIC_KEY",
    "RELATIONSHIP_READ_KEY",
    "UNRESOLVED_THREAD_KEY",
    "build_persona_goal",
    "format_dynamics_block",
    "infer_dynamics_from_persona",
    "normalize_dynamics",
    "parse_dynamics_from_persona",
    "resolve_dynamics",
    "select_active_dynamic",
    "format_persona_goal",
]
