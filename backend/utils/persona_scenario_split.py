"""Separate stable persona core from replaceable scenario hooks (Issue #272)."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

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


def _short_name(character: Any) -> str:
    name = (getattr(character, "name", None) or "她").strip()
    return re.split(r"\s+|《", name, maxsplit=1)[0] or "她"


def _is_already_slim(persona_text: str) -> bool:
    """Structured short personas (嘉允/娜琏/恩爱 style) should stay intact."""
    text = persona_text or ""
    if len(text) > 900:
        return False
    return any(
        marker in text
        for marker in ("【关系】", "【冲突", "【性格锚】", "【动力学】", "【口吻】")
    )


def _clause_around(text: str, needle: str, radius: int = 36) -> str:
    body = text or ""
    idx = body.find(needle)
    if idx < 0:
        return ""
    # Expand to nearest sentence / section boundaries.
    start = idx
    while start > 0 and body[start - 1] not in "。！？\n【】":
        start -= 1
        if idx - start > radius + 20:
            break
    end = idx + len(needle)
    while end < len(body) and body[end] not in "。！？\n【":
        end += 1
        if end - idx > radius + 40:
            break
    snippet = body[start:end]
    # Drop section headers accidentally captured.
    snippet = re.sub(r"【[^】]*】?", "", snippet)
    snippet = re.sub(r"^[^【\n]{0,8}】", "", snippet)
    snippet = re.sub(r"\s+", " ", snippet).strip(" ；;,.。：:")
    if len(snippet) < 4:
        return ""
    return snippet[:80]


def _first_matching_clause(text: str, needles: Sequence[str]) -> str:
    for needle in needles:
        if not needle:
            continue
        hit = _clause_around(text, needle)
        if hit and "【" not in hit:
            return hit
    return ""


def _identity_bullets(persona_text: str, limit: int = 3) -> List[str]:
    out: list[str] = []
    for line in (persona_text or "").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if any(k in stripped for k in ("身份", "性格", "你是", "角色设定", "外貌")):
            cleaned = re.sub(r"^[-*•\t\d.、\s]+", "", stripped)
            cleaned = re.sub(r"^(身份|性格|外貌)\s*[:：]\s*", "", cleaned)
            if cleaned and cleaned not in out:
                out.append(cleaned[:100])
        if len(out) >= limit:
            break
    return out


def rebuild_slim_persona_core(character: Any, stripped_core: str) -> str:
    """
    Rebuild a short stable core from bloated legacy prompts.

    Keeps identity + relationship/conflict cues; drops long example dumps and
    replaceable wardrobe/place prose.
    """
    short = _short_name(character)
    description = (getattr(character, "description", None) or "").strip()
    voice = (getattr(character, "voice_style", None) or "").strip()
    bits = _structured_bits(stripped_core)
    bullets = _identity_bullets(stripped_core)

    parts: list[str] = []
    head = f"你是{short}。"
    if description:
        head += description[:140].rstrip("。") + "。"
    parts.append(head)

    if bullets:
        parts.append("【身份核】" + "；".join(bullets[:3]))

    if bits.get("关系"):
        parts.append("【关系】" + bits["关系"][:140])
    if bits.get("冲突"):
        parts.append("【冲突 Desire vs Role】" + bits["冲突"][:140])

    if bits.get("性格锚"):
        parts.append("【性格锚】" + bits["性格锚"][:120])
    elif bullets:
        # Reuse a non-appearance bullet as temperament cue when present.
        for b in bullets:
            if not b.startswith("外貌") and "寸" not in b:
                parts.append(f"【性格锚】{b[:100]}")
                break

    tone = bits.get("口吻") or voice or "符合本人习惯的说话方式"
    parts.append(f"【口吻】{tone[:100]}")
    parts.append("【外形要点】具体衣服/姿势/环境以【当前状态】与 scenario_hook 为准。")
    parts.append("【扮演】先做人，再进入亲密；换场后感官跟新场景。禁止复述「不是AI / 满足任何幻想」套话。")
    return "\n\n".join(parts)


def build_differentiated_dynamics(character: Any, persona_text: str) -> Dict[str, str]:
    """
    Build a short Dynamics card from THIS character's text.

    Prefer explicit 【动力学】; else derive concrete choice snippets from the
    persona/description — not one shared else-template with a name splice.
    """
    parsed = parse_dynamics_from_persona(persona_text)
    if any(parsed.values()):
        return parsed

    bits = _structured_bits(persona_text)
    short = _short_name(character)
    description = (getattr(character, "description", None) or "").strip()
    voice = (getattr(character, "voice_style", None) or "").strip()
    body = persona_text or ""
    seed = f"{description}\n{body}"

    conflict = bits.get("冲突", "")
    relation = bits.get("关系", "")
    anchor = bits.get("性格锚", "")
    tone = bits.get("口吻", "") or voice

    out: Dict[str, str] = {k: "" for k in DYNAMICS_KEYS}

    if conflict or "Desire vs Role" in body or "【冲突" in body:
        rel = (relation or _first_matching_clause(seed, ("姨妈", "继母", "继子", "闺蜜")))[:48]
        out["mask"] = (
            f"先维持{short}在这段关系里得体的一面"
            + (f"（{rel}）" if rel else "")
        )
        out["drive"] = (
            conflict.split("。")[0].strip()[:90]
            if conflict
            else (
                _first_matching_clause(seed, ("想被", "渴望", "禁忌吸引", "想要"))
                or "想被靠近与确认，却不能丢掉体面"
            )
        )
        out["defense"] = (
            _first_matching_clause(seed, ("推开", "改话题", "心虚", "掩饰", "抗拒"))
            or "被点破时用身份口吻推开半寸或改话题"
        )
        out["initiative"] = (
            _first_matching_clause(seed, ("犹豫", "靠近", "半拍"))
            or "真要越线时先犹豫半拍，再用动作推进"
        )
        out["pressure_shift"] = (
            _first_matching_clause(seed, ("发颤", "嘴硬", "身体比嘴"))
            or "压力升高时嘴上还想维持原来的自己，身体先诚实"
        )
        out["boundary"] = f"不会立刻变成无脑献上的服务机；仍是{short}"
    elif any(k in body for k in ("夜店", "吧台", "酒吧")):
        out["mask"] = (
            _first_matching_clause(seed, ("玩笑", "挑衅", "大胆", "浪"))
            or f"用大胆玩笑盖住认真动情——像{short}"
        )
        out["drive"] = (
            (anchor.split("。")[0].strip()[:90] if anchor else "")
            or _first_matching_clause(seed, ("掌控", "接住", "玩", "独占"))
            or "要掌控节奏、被接住、玩得过瘾"
        )
        out["defense"] = (
            _first_matching_clause(seed, ("看穿", "暗处", "更用力", "吃醋"))
            or "被看穿时更用力挑衅或把人往暗处带"
        )
        out["initiative"] = (
            _first_matching_clause(seed, ("先撩", "门槛", "加码", "过来"))
            or "先撩并留半拍门槛，被接住才加码"
        )
        out["pressure_shift"] = (
            _first_matching_clause(seed, ("动情", "玩笑变少", "眼神", "直"))
            or "真动情时玩笑变少，动作和眼神比嘴更直"
        )
        out["boundary"] = f"不做谁都行的换皮服务机；始终是{short}"
    else:
        # Content-derived snippets — each key pulls a different cue from THIS text.
        trait = ""
        for token in ("机智", "温柔", "霸道", "娇羞", "冷淡", "腹黑", "母性", "傲娇", "顺从", "挑逗", "精分", "征服"):
            if token in seed:
                trait = token
                break
        mask_cue = _first_matching_clause(seed, ("表面", "外表", "伪装", "掩饰"))
        if not mask_cue and trait:
            mask_cue = f"用{trait}保护自己，先像{short}再进亲密"
        drive_cue = _first_matching_clause(
            seed, ("渴望", "想要", "攻略", "目标", "征服", "吃肉", "欲望")
        ) or (description.split("。")[0][:70] if description else "")
        defense_cue = _first_matching_clause(
            seed, ("抗拒", "推开", "冷笑", "缩回", "戒备", "害羞")
        )
        initiative_cue = _first_matching_clause(
            seed, ("主动", "试探", "引导", "靠近", "开口", "撩")
        )
        pressure_cue = _first_matching_clause(
            seed, ("失控", "破绽", "颤抖", "湿润", "沉沦", "快感")
        )

        out["mask"] = mask_cue or f"先维持{short}习惯的距离与语气"
        out["drive"] = drive_cue or f"想被认真对待，而不是被当成工具（{short}）"
        out["defense"] = defense_cue or (
            f"被逼近时退回自己的口吻" + (f"：{tone[:28]}" if tone else "")
        )
        out["initiative"] = initiative_cue or f"主动时只走符合{short}性格的一小步"
        out["pressure_shift"] = pressure_cue or f"压力升高时{short}的破绽从语气和动作漏出"
        out["boundary"] = f"不忽然换成另一个人的性格；始终是{short}"

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

    Slim structured personas stay intact. Bloated legacy prompts are rebuilt
    into a short core so migration does not grow persona length.
    """
    source = _persona_source(character)
    if _is_already_slim(source):
        return ensure_dynamics_block(character, source)

    stripped, _extracted = extract_and_strip_scene_locks(source)
    core = rebuild_slim_persona_core(character, stripped or source)
    return ensure_dynamics_block(character, core)


def separate_persona_and_scenario(character: Any) -> Tuple[str, str]:
    """Return (persona_prompt, scenario_hook) for migration candidates."""
    persona = build_compact_persona_prompt(character)
    hook = derive_scenario_hook(character)
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
    "rebuild_slim_persona_core",
    "separate_persona_and_scenario",
    "strip_scene_sections",
]
