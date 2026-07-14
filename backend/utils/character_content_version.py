"""Character content generation version + source-hash helpers (Issue #272)."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Mapping, Optional

# Bump when Scene Bundle prompt contract or hash inputs change.
SCENE_BUNDLE_GENERATION_VERSION = "scene_bundle_v3"

_WHITESPACE_RE = re.compile(r"\s+")


def normalize_for_hash(value: Any) -> str:
    """Collapse whitespace so trivial edits do not thrash hashes."""
    if value is None:
        return ""
    text = str(value).strip()
    return _WHITESPACE_RE.sub(" ", text)


def effective_persona_text(character: Any, *, persona_prompt: Optional[str] = None) -> str:
    """
    Same fallback chain generators use: persona_prompt → backstory → description.
    Hash must include this effective text, not only the persona_prompt column.
    """
    if persona_prompt is not None:
        text = (persona_prompt or "").strip()
        if text:
            return text
    stored = (getattr(character, "persona_prompt", None) or "").strip()
    if stored:
        return stored
    backstory = (getattr(character, "backstory", None) or "").strip()
    if backstory:
        return backstory
    return (getattr(character, "description", None) or "").strip()


def compute_source_hash(
    *,
    name: str,
    persona_prompt: str,
    scenario_hook: str,
    voice_style: str = "",
    nsfw_level: int = 0,
    description: str = "",
    backstory: str = "",
    generation_version: str = SCENE_BUNDLE_GENERATION_VERSION,
) -> str:
    """
    Hash of inputs that must stay coherent with a Scene Bundle.

    Includes backstory because generators fall back to it when persona_prompt
    is empty. Changing any of these means opening/state/summary must regenerate.
    """
    effective = (persona_prompt or "").strip() or (backstory or "").strip() or (description or "").strip()
    payload = "\n".join(
        [
            f"generation_version={normalize_for_hash(generation_version)}",
            f"name={normalize_for_hash(name)}",
            f"description={normalize_for_hash(description)}",
            f"backstory={normalize_for_hash(backstory)}",
            f"effective_persona={normalize_for_hash(effective)}",
            f"scenario_hook={normalize_for_hash(scenario_hook)}",
            f"voice_style={normalize_for_hash(voice_style)}",
            f"nsfw_level={int(nsfw_level or 0)}",
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def compute_source_hash_for_character(
    character: Any,
    *,
    persona_prompt: Optional[str] = None,
    scenario_hook: Optional[str] = None,
    generation_version: str = SCENE_BUNDLE_GENERATION_VERSION,
) -> str:
    """Compute hash from a Character ORM row (or duck-typed object)."""
    resolved_persona = (
        persona_prompt
        if persona_prompt is not None
        else (getattr(character, "persona_prompt", None) or "")
    )
    return compute_source_hash(
        name=getattr(character, "name", "") or "",
        description=getattr(character, "description", "") or "",
        backstory=getattr(character, "backstory", "") or "",
        persona_prompt=resolved_persona or "",
        scenario_hook=(
            scenario_hook
            if scenario_hook is not None
            else (getattr(character, "scenario_hook", None) or "")
        ),
        voice_style=getattr(character, "voice_style", "") or "",
        nsfw_level=int(getattr(character, "nsfw_level", 0) or 0),
        generation_version=generation_version,
    )


def compute_baseline_fingerprint(character: Any) -> str:
    """
    Fingerprint of currently stored generation inputs + outputs used to detect
    drift between dry-run review and later --apply-from-report.

    Must include every field that affects Scene Bundle generation inputs
    (name/description/voice/nsfw) as well as stored content fields.
    """
    state_raw = getattr(character, "default_state_json", None) or ""
    if isinstance(state_raw, dict):
        state_raw = json.dumps(state_raw, ensure_ascii=False, sort_keys=True)
    payload = "\n".join(
        [
            f"id={getattr(character, 'id', '')}",
            f"name={normalize_for_hash(getattr(character, 'name', None))}",
            f"description={normalize_for_hash(getattr(character, 'description', None))}",
            f"voice_style={normalize_for_hash(getattr(character, 'voice_style', None))}",
            f"nsfw_level={int(getattr(character, 'nsfw_level', 0) or 0)}",
            f"persona={normalize_for_hash(getattr(character, 'persona_prompt', None))}",
            f"backstory={normalize_for_hash(getattr(character, 'backstory', None))}",
            f"hook={normalize_for_hash(getattr(character, 'scenario_hook', None))}",
            f"opening={normalize_for_hash(getattr(character, 'opening_line', None))}",
            f"opening_en={normalize_for_hash(getattr(character, 'opening_line_en', None))}",
            f"state={normalize_for_hash(state_raw)}",
            f"state_en={normalize_for_hash(getattr(character, 'default_state_json_en', None))}",
            f"summary={normalize_for_hash(getattr(character, 'scene_summary', None))}",
            f"version={normalize_for_hash(getattr(character, 'generation_version', None))}",
            f"source_hash={normalize_for_hash(getattr(character, 'source_hash', None))}",
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def clear_generation_metadata(character: Any) -> None:
    """Invalidate migration stamps so non-atomic writes cannot look migrated."""
    character.generation_version = None
    character.source_hash = None
    character.scene_summary = None


def character_needs_regeneration(
    character: Any,
    *,
    target_version: str = SCENE_BUNDLE_GENERATION_VERSION,
    persona_prompt: Optional[str] = None,
    scenario_hook: Optional[str] = None,
) -> bool:
    """
    True when the character has no migration marker, wrong version,
    missing scene fields, or stale source_hash.
    """
    current_version = (getattr(character, "generation_version", None) or "").strip()
    if current_version != target_version:
        return True

    current_hash = (getattr(character, "source_hash", None) or "").strip()
    if not current_hash:
        return True

    expected = compute_source_hash_for_character(
        character,
        persona_prompt=persona_prompt,
        scenario_hook=scenario_hook,
        generation_version=target_version,
    )
    if current_hash != expected:
        return True

    if not (getattr(character, "opening_line", None) or "").strip():
        return True
    if not (getattr(character, "default_state_json", None) or "").strip():
        return True
    if not (getattr(character, "scene_summary", None) or "").strip():
        return True
    hook = (
        scenario_hook
        if scenario_hook is not None
        else (getattr(character, "scenario_hook", None) or "")
    )
    if not str(hook).strip():
        return True
    return False


def bundle_metadata_dict(
    *,
    generation_version: str,
    source_hash: str,
    scene_summary: str,
    scenario_hook: str,
) -> Mapping[str, str]:
    return {
        "generation_version": generation_version,
        "source_hash": source_hash,
        "scene_summary": scene_summary,
        "scenario_hook": scenario_hook,
    }


__all__ = [
    "SCENE_BUNDLE_GENERATION_VERSION",
    "bundle_metadata_dict",
    "character_needs_regeneration",
    "clear_generation_metadata",
    "compute_baseline_fingerprint",
    "compute_source_hash",
    "compute_source_hash_for_character",
    "effective_persona_text",
    "normalize_for_hash",
]
