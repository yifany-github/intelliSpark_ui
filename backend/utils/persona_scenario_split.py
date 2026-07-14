"""Separate stable persona core from replaceable scenario hooks (Issue #272)."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Mapping, Optional, Tuple

from prompts.persona_dynamics import (
    DYNAMICS_KEYS,
    format_dynamics_block,
    normalize_dynamics,
    parse_dynamics_from_persona,
)
from prompts.scene_bootstrap import place_markers

# Sections that often lock a replaceable scene into the persona core.
_SCENE_SECTION_RE = re.compile(
    r"(?ms)^\s*(?:[-*•]?\s*)?(?:处境|当前场景|开场场景|场景设定|开场现场)\s*[:：].*?"
    r"(?=^\s*(?:[-*•]?\s*)?(?:核心|性格|行为|外貌|关系|冲突|口吻|扮演|动力学|【)|\Z)"
)

# Bullet/line items that permanently bake a concrete crisis scene into the core.
_SCENE_LOCK_LINE_RE = re.compile(
    r"(?m)^\s*(?:[-*•]\s*)?(?:处境|当前场景|开场场景)\s*[:：].+$"
)

_SCENE_LOCK_HINTS = (
    "地牢",
    "牢房",
    "被俘",
    "春药",
    "化功散",
    "营帐",
    "厨房",
    "客厅沙发",
    "夜店吧台",
    "修仙洞府",
    "多次被凌辱",
    "受化功散",
)

_STRUCTURED_SECTION_RE = re.compile(
    r"(?ms)^【(?P<title>关系|冲突(?: Desire vs Role)?|冲突（轻）|性格锚|口吻|外形要点|扮演)】\s*(?P<body>.*?)(?=^【|\Z)"
)


def _persona_source(character: Any) -> str:
    return (
        (getattr(character, "persona_prompt", None) or "").strip()
        or (getattr(character, "backstory", None) or "").strip()
        or (getattr(character, "description", None) or "").strip()
        or ""
    )


def _parse_state(character: Any) -> Dict[str, Any]:
    raw = getattr(character, "default_state_json", None)
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, json.JSONDecodeError):
        return {}


def strip_scene_sections(persona_text: str) -> str:
    """Remove dedicated 处境/场景 sections that belong in scenario_hook."""
    text = persona_text or ""
    cleaned = _SCENE_SECTION_RE.sub("", text)
    cleaned = _SCENE_LOCK_LINE_RE.sub("", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned


def extract_and_strip_scene_locks(persona_text: str) -> Tuple[str, str]:
    """
    Pull replaceable crisis/scene prose out of the persona core.

    Returns (compact_persona, extracted_scene_bits).
    """
    text = persona_text or ""
    extracted: list[str] = []

    # Capture dedicated scene sections / lines before stripping.
    for m in _SCENE_SECTION_RE.finditer(text):
        bit = re.sub(r"\s+", " ", m.group(0)).strip()
        if bit:
            extracted.append(bit[:240])
    for m in _SCENE_LOCK_LINE_RE.finditer(text):
        bit = m.group(0).strip().lstrip("-*• \t")
        if bit:
            extracted.append(bit[:240])

    text = strip_scene_sections(text)

    # Bullet/lines that still mention lock hints
    kept_lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if any(h in stripped for h in _SCENE_LOCK_HINTS) and (
            stripped.startswith(("•", "-", "*", "处境", "当前"))
            or "处境" in stripped[:12]
            or re.match(r"^[-*•]?\s*处境", stripped)
        ):
            extracted.append(stripped.lstrip("-*• \t").strip()[:240])
            continue
        kept_lines.append(line)
    text = "\n".join(kept_lines)

    # Line-level: pull crisis props out of personality lists without nuking the whole persona.
    hard_crisis = ("被俘", "春药", "化功散", "多次被凌辱", "地牢", "牢房", "受化功散")
    kept_lines2: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and any(h in stripped for h in hard_crisis):
            extracted.append(stripped[:240])
            continue
        kept_lines2.append(line)
    text = "\n".join(kept_lines2)

    # Paragraph-level only when multiple lock hints cluster in a long block.
    paragraphs = re.split(r"\n\s*\n", text)
    kept_paras: list[str] = []
    for para in paragraphs:
        hits = sum(1 for h in _SCENE_LOCK_HINTS if h in para)
        if hits >= 3 and len(para) > 120:
            extracted.append(re.sub(r"\s+", " ", para).strip()[:240])
            continue
        if para.strip():
            kept_paras.append(para)
    compact = "\n\n".join(p.strip() for p in kept_paras if p.strip()).strip()
    # If we over-stripped into emptiness, fall back to section-stripped source minus hard lines only.
    if not compact:
        fallback_lines = []
        for line in strip_scene_sections(persona_text or "").splitlines():
            if any(h in line for h in hard_crisis):
                continue
            fallback_lines.append(line)
        compact = "\n".join(fallback_lines).strip()
    # Dedupe while preserving order
    seen = set()
    unique_bits: list[str] = []
    for bit in extracted:
        if bit not in seen:
            seen.add(bit)
            unique_bits.append(bit)
    scene_bits = "；".join(unique_bits)
    return compact, scene_bits


def derive_scenario_hook(character: Any) -> str:
    """
    Build a short replaceable current-scene hook.

    Prefer persisted scenario_hook; else environment alone.
    Only append opening when it does not conflict with environment place markers.
    """
    existing = (getattr(character, "scenario_hook", None) or "").strip()
    if existing:
        return existing[:240]

    state = _parse_state(character)
    env = str(state.get("环境") or "").strip()
    opening = (getattr(character, "opening_line", None) or "").strip()
    persona = _persona_source(character)
    _, extracted = extract_and_strip_scene_locks(persona)

    if env:
        env_places = place_markers(env)
        opening_places = place_markers(opening)
        if opening and env_places and opening_places and env_places.isdisjoint(opening_places):
            # Conflicting worlds — keep environment only; do not bake two plays into hook.
            return env[:240]
        if opening and not (env_places and opening_places and env_places.isdisjoint(opening_places)):
            beat = opening.replace("\n", " ")
            if len(beat) > 80:
                beat = beat[:77] + "…"
            # Prefer env as canonical place; opening only as beat cue when places agree/empty.
            if not env_places or not opening_places or not env_places.isdisjoint(opening_places):
                return f"{env}｜开场：{beat}"[:240]
        return env[:240]

    if extracted:
        return extracted[:240]

    m = re.search(
        r"(?ms)^\s*(?:[-*•]?\s*)?(?:处境|当前场景|开场场景)\s*[:：]\s*(.+?)(?=^\s*\S|\Z)",
        persona,
    )
    if m:
        return m.group(1).strip().replace("\n", " ")[:240]

    if opening:
        return f"开场当下：{opening.replace(chr(10), ' ')[:160]}"

    name = getattr(character, "name", None) or "角色"
    return f"与{name}的初次见面现场"


def _structured_bits(persona_text: str) -> Dict[str, str]:
    bits: Dict[str, str] = {}
    for m in _STRUCTURED_SECTION_RE.finditer(persona_text or ""):
        title = m.group("title")
        body = (m.group("body") or "").strip()
        if title.startswith("冲突"):
            bits["冲突"] = body
        else:
            bits[title] = body
    return bits


def build_differentiated_dynamics(character: Any, persona_text: str) -> Dict[str, str]:
    """
    Build a short Dynamics card that is character-specific.

    Prefer explicit 【动力学】; else derive from structured slim sections and
    distinctive persona fragments — never return the same generic else-template
    for every legacy character.
    """
    parsed = parse_dynamics_from_persona(persona_text)
    if any(parsed.values()):
        return parsed

    bits = _structured_bits(persona_text)
    name = (getattr(character, "name", None) or "她").strip()
    # Prefer the short public name without series suffix.
    short_name = re.split(r"\s+|《", name, maxsplit=1)[0] or "她"
    description = (getattr(character, "description", None) or "").strip()
    voice = (getattr(character, "voice_style", None) or "").strip()

    conflict = bits.get("冲突", "")
    relation = bits.get("关系", "")
    anchor = bits.get("性格锚", "")
    tone = bits.get("口吻", "") or voice

    out: Dict[str, str] = {k: "" for k in DYNAMICS_KEYS}

    if conflict or "Desire vs Role" in (persona_text or "") or "【冲突" in (persona_text or ""):
        out["mask"] = f"先维持{short_name}在关系里得体的一面" + (
            f"：{(relation[:40] if relation else '可靠、照顾人的日常角色')}"
        )
        out["drive"] = (
            conflict.split("。")[0].strip()[:80]
            if conflict
            else "想被靠近与确认，却不能丢掉自己的体面"
        )
        out["defense"] = "被点破时用身份口吻/推开半寸/改话题护住自己"
        out["initiative"] = "真要越线时先犹豫半拍，再用动作而不是演讲推进"
        out["pressure_shift"] = "压力升高时嘴上还想维持原来的自己，身体先诚实"
        out["boundary"] = f"不会立刻变成无脑献上的服务机；仍是{short_name}"
    elif any(k in (persona_text or "") for k in ("夜店", "吧台", "酒吧")):
        out["mask"] = f"用大胆玩笑盖住认真动情——像{short_name}本人，不是通用浪女模板"
        out["drive"] = (anchor.split("。")[0].strip()[:80] if anchor else "要掌控节奏、被接住、玩得过瘾")
        out["defense"] = "被看穿时更用力挑衅或把人往暗处带"
        out["initiative"] = "先撩并留半拍门槛，被接住才加码"
        out["pressure_shift"] = "真动情时玩笑变少，动作和眼神比嘴更直"
        out["boundary"] = "不做谁都行的换皮服务机"
    else:
        # Fingerprint from description/persona so two legacy blobs don't share one card.
        seed = (description or persona_text or short_name)[:120]
        trait = ""
        for token in ("机智", "温柔", "霸道", "娇羞", "冷淡", "腹黑", "母性", "傲娇", "顺从", "挑逗"):
            if token in seed:
                trait = token
                break
        trait = trait or "她惯有的语气"
        out["mask"] = f"用{trait}保护自己，先像{short_name}再进亲密"
        if description:
            out["drive"] = f"想被认真对待：{description[:60]}"
        else:
            out["drive"] = f"想被当成{short_name}本人，而不是工具"
        out["defense"] = f"被逼近时先缩回自己的说话方式" + (f"（{tone[:24]}）" if tone else "")
        out["initiative"] = f"主动时用符合{short_name}口吻的一小步"
        out["pressure_shift"] = "压力升高时破绽从语气和动作里漏出来"
        out["boundary"] = f"不忽然换成另一个人的性格；始终是{short_name}"

    return normalize_dynamics(out)


def ensure_dynamics_block(character: Any, persona_text: str) -> str:
    """Append a differentiated 【动力学】 card when missing."""
    body = (persona_text or "").strip()
    parsed = parse_dynamics_from_persona(body)
    if any(parsed.values()):
        return body
    dynamics = build_differentiated_dynamics(character, body)
    block = format_dynamics_block(dynamics)
    if not block:
        return body
    if not body:
        return block
    return f"{body.rstrip()}\n\n{block}"


def build_compact_persona_prompt(character: Any) -> str:
    """
    Stable character core + short Dynamics.

    Strips replaceable scene locks out of the core; keeps slim structured
    personas (嘉允/娜琏/恩爱) largely intact.
    """
    source = _persona_source(character)
    core, _extracted = extract_and_strip_scene_locks(source)

    if core and "以【当前状态】为准" not in core and "当前状态" not in core:
        if len(source) > 900 or _extracted or any(h in source for h in _SCENE_LOCK_HINTS):
            core = (
                f"{core.rstrip()}\n\n"
                "【场景提示】具体衣服/姿势/环境以【当前状态】与 scenario_hook 为准；"
                "不要把可替换的地牢/厨房/客厅等开场现场永久写进角色核。"
            )

    return ensure_dynamics_block(character, core)


def separate_persona_and_scenario(character: Any) -> Tuple[str, str]:
    """Return (persona_prompt, scenario_hook) for migration candidates."""
    persona = build_compact_persona_prompt(character)
    hook = derive_scenario_hook(character)
    # If hook is still empty-ish but we extracted scene locks, prefer those.
    if not hook or hook.startswith("与"):
        _, extracted = extract_and_strip_scene_locks(_persona_source(character))
        if extracted:
            hook = extracted[:240]
    return persona, hook


def persona_has_explicit_dynamics(persona_text: str) -> bool:
    return any(parse_dynamics_from_persona(persona_text or "").values())


def hook_has_internal_place_conflict(hook: str) -> bool:
    """True when a single hook string contains disjoint place worlds joined by ｜."""
    text = hook or ""
    if "｜" not in text and "|" not in text:
        return False
    parts = re.split(r"[｜|]", text)
    if len(parts) < 2:
        return False
    left = place_markers(parts[0])
    right = place_markers(parts[1])
    return bool(left and right and left.isdisjoint(right))


def migration_audit_flags(character: Any) -> Dict[str, Any]:
    """Read-only signals for dry-run reports."""
    persona = _persona_source(character)
    state = _parse_state(character)
    env = str(state.get("环境") or "")
    compact, extracted = extract_and_strip_scene_locks(persona)
    return {
        "has_explicit_dynamics": persona_has_explicit_dynamics(persona),
        "persona_duplicates_backstory": (
            bool(getattr(character, "persona_prompt", None))
            and bool(getattr(character, "backstory", None))
            and (getattr(character, "persona_prompt") or "").strip()
            == (getattr(character, "backstory") or "").strip()
        ),
        "persona_len": len(persona),
        "compact_persona_len": len(compact),
        "extracted_scene_bits": extracted[:160],
        "environment": env[:120],
        "scene_lock_hints": [h for h in _SCENE_LOCK_HINTS if h in persona],
        "generation_version": getattr(character, "generation_version", None),
        "source_hash": getattr(character, "source_hash", None),
        "has_scene_summary": bool((getattr(character, "scene_summary", None) or "").strip()),
        "has_scenario_hook": bool((getattr(character, "scenario_hook", None) or "").strip()),
        "has_opening_line_en": bool((getattr(character, "opening_line_en", None) or "").strip()),
        "has_default_state_en": bool((getattr(character, "default_state_json_en", None) or "").strip()),
    }


__all__ = [
    "build_compact_persona_prompt",
    "build_differentiated_dynamics",
    "derive_scenario_hook",
    "ensure_dynamics_block",
    "extract_and_strip_scene_locks",
    "hook_has_internal_place_conflict",
    "migration_audit_flags",
    "persona_has_explicit_dynamics",
    "separate_persona_and_scenario",
    "strip_scene_sections",
]
