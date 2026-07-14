"""Separate stable persona core from replaceable scenario hooks (Issue #272)."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Mapping, Optional, Tuple

from prompts.persona_dynamics import (
    format_dynamics_block,
    parse_dynamics_from_persona,
    resolve_dynamics,
)

# Sections that often lock a replaceable scene into the persona core.
_SCENE_SECTION_RE = re.compile(
    r"(?ms)^\s*(?:[-*•]?\s*)?(?:处境|当前场景|开场场景|场景设定|开场现场)\s*[:：].*?"
    r"(?=^\s*(?:[-*•]?\s*)?(?:核心|性格|行为|外貌|关系|冲突|口吻|扮演|动力学|【)|\Z)"
)

# Phrases that permanently bake a concrete location into the core.
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


def derive_scenario_hook(character: Any) -> str:
    """
    Build a short replaceable current-scene hook.

    Prefer persisted scenario_hook; else environment + opening beat.
    Never invent bondage/dungeon unless already present in current content.
    """
    existing = (getattr(character, "scenario_hook", None) or "").strip()
    if existing:
        return existing[:240]

    state = _parse_state(character)
    env = str(state.get("环境") or "").strip()
    opening = (getattr(character, "opening_line", None) or "").strip()

    if env and opening:
        # Keep hook short: environment + one beat cue from opening.
        beat = opening.replace("\n", " ")
        if len(beat) > 80:
            beat = beat[:77] + "…"
        return f"{env}｜开场：{beat}"[:240]

    if env:
        return env[:240]

    persona = _persona_source(character)
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


def strip_scene_sections(persona_text: str) -> str:
    """Remove dedicated 处境/场景 sections that belong in scenario_hook."""
    text = persona_text or ""
    cleaned = _SCENE_SECTION_RE.sub("", text)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned


def ensure_dynamics_block(persona_text: str) -> str:
    """Append a short 【动力学】 card when missing."""
    body = (persona_text or "").strip()
    parsed = parse_dynamics_from_persona(body)
    if any(parsed.values()):
        return body
    dynamics = resolve_dynamics(body)
    block = format_dynamics_block(dynamics)
    if not block:
        return body
    if not body:
        return block
    return f"{body.rstrip()}\n\n{block}"


def build_compact_persona_prompt(character: Any) -> str:
    """
    Stable character core + short Dynamics.

    Does not invent a new identity. Keeps structured slim personas (嘉允/娜琏/恩爱)
    largely intact; strips dedicated scene sections from bloated legacy prompts.
    """
    existing_hook_aware = _persona_source(character)
    core = strip_scene_sections(existing_hook_aware)

    # Soft cue: remind generators that clothes/place live in current state.
    if core and "当前状态" not in core and "以【当前状态】为准" not in core:
        # Only append for long legacy blobs that hard-code wardrobe/place.
        if len(core) > 900 or any(h in core for h in _SCENE_LOCK_HINTS):
            core = (
                f"{core.rstrip()}\n\n"
                "【场景提示】具体衣服/姿势/环境以【当前状态】与 scenario_hook 为准；"
                "不要把可替换的地牢/厨房/客厅等开场现场永久写进角色核。"
            )

    return ensure_dynamics_block(core)


def separate_persona_and_scenario(character: Any) -> Tuple[str, str]:
    """Return (persona_prompt, scenario_hook) for migration candidates."""
    persona = build_compact_persona_prompt(character)
    hook = derive_scenario_hook(character)
    return persona, hook


def persona_has_explicit_dynamics(persona_text: str) -> bool:
    return any(parse_dynamics_from_persona(persona_text or "").values())


def migration_audit_flags(character: Any) -> Dict[str, Any]:
    """Read-only signals for dry-run reports."""
    persona = _persona_source(character)
    state = _parse_state(character)
    env = str(state.get("环境") or "")
    return {
        "has_explicit_dynamics": persona_has_explicit_dynamics(persona),
        "persona_duplicates_backstory": (
            bool(getattr(character, "persona_prompt", None))
            and bool(getattr(character, "backstory", None))
            and (getattr(character, "persona_prompt") or "").strip()
            == (getattr(character, "backstory") or "").strip()
        ),
        "persona_len": len(persona),
        "environment": env[:120],
        "scene_lock_hints": [h for h in _SCENE_LOCK_HINTS if h in persona],
        "generation_version": getattr(character, "generation_version", None),
        "source_hash": getattr(character, "source_hash", None),
        "has_scene_summary": bool((getattr(character, "scene_summary", None) or "").strip()),
        "has_scenario_hook": bool((getattr(character, "scenario_hook", None) or "").strip()),
    }


__all__ = [
    "build_compact_persona_prompt",
    "derive_scenario_hook",
    "ensure_dynamics_block",
    "migration_audit_flags",
    "persona_has_explicit_dynamics",
    "separate_persona_and_scenario",
    "strip_scene_sections",
]
