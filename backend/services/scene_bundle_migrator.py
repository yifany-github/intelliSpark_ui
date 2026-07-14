"""Atomic Scene Bundle migration helpers (Issue #272).

Generates opening_line + default_state_json + scene_summary together from one
persona_prompt + scenario_hook. Defaults to dry-run; never writes unless apply.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Sequence

from prompts.scene_bootstrap import scene_pair_looks_coherent
from utils.character_content_version import (
    SCENE_BUNDLE_GENERATION_VERSION,
    character_needs_regeneration,
    compute_source_hash,
)
from utils.persona_scenario_split import (
    migration_audit_flags,
    separate_persona_and_scenario,
)

logger = logging.getLogger(__name__)


@dataclass
class SceneBundleCandidate:
    character_id: int
    name: str
    skipped: bool = False
    skip_reason: str = ""
    validation_ok: bool = False
    validation_errors: List[str] = field(default_factory=list)
    audit: Dict[str, Any] = field(default_factory=dict)
    old: Dict[str, Any] = field(default_factory=dict)
    new: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _parse_state_json(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, json.JSONDecodeError):
        return {}


def snapshot_character_content(character: Any) -> Dict[str, Any]:
    return {
        "persona_prompt": getattr(character, "persona_prompt", None),
        "scenario_hook": getattr(character, "scenario_hook", None),
        "opening_line": getattr(character, "opening_line", None),
        "default_state": _parse_state_json(getattr(character, "default_state_json", None)),
        "scene_summary": getattr(character, "scene_summary", None),
        "generation_version": getattr(character, "generation_version", None),
        "source_hash": getattr(character, "source_hash", None),
    }


def validate_atomic_bundle(
    *,
    opening_line: str,
    state: Dict[str, Any],
    scene_summary: str,
    safe_mode: bool,
    scenario_hook: str = "",
) -> List[str]:
    """Return validation error strings; empty list means OK."""
    from prompts.scene_bootstrap import GENERIC_FALLBACK_ENV_MARKERS, place_markers

    errors: List[str] = []
    if not (opening_line or "").strip():
        errors.append("missing opening_line")
    if not isinstance(state, dict) or not state:
        errors.append("missing default_state")
    if not (scene_summary or "").strip():
        errors.append("missing scene_summary")
    if opening_line and state and not scene_pair_looks_coherent(
        opening_line, state, safe_mode=safe_mode
    ):
        errors.append("opening_line/state incoherent")

    env = str((state or {}).get("环境") or "")
    if any(marker in env for marker in GENERIC_FALLBACK_ENV_MARKERS):
        errors.append("state uses generic fallback environment")

    hook = (scenario_hook or "").strip()
    if hook:
        hook_places = place_markers(hook)
        scene_places = place_markers(f"{env} {scene_summary}")
        if hook_places and scene_places.isdisjoint(hook_places):
            errors.append(
                f"scenario_hook/environment mismatch (hook={sorted(hook_places)} scene={sorted(scene_places)})"
            )
    return errors


class SceneBundleMigrator:
    """Build reviewable Scene Bundle candidates; write only on explicit apply."""

    def __init__(
        self,
        *,
        ai_manager: Any,
        generation_version: str = SCENE_BUNDLE_GENERATION_VERSION,
        force: bool = False,
    ) -> None:
        self.ai_manager = ai_manager
        self.generation_version = generation_version
        self.force = force

    async def build_candidate(self, character: Any) -> SceneBundleCandidate:
        audit = migration_audit_flags(character)
        old = snapshot_character_content(character)
        candidate = SceneBundleCandidate(
            character_id=int(character.id),
            name=str(character.name or ""),
            audit=audit,
            old=old,
        )

        new_persona, scenario_hook = separate_persona_and_scenario(character)

        if not self.force and not character_needs_regeneration(
            character,
            target_version=self.generation_version,
            persona_prompt=new_persona,
            scenario_hook=scenario_hook,
        ):
            candidate.skipped = True
            candidate.skip_reason = "idempotent: generation_version+source_hash match"
            candidate.validation_ok = True
            candidate.new = old
            return candidate

        safe_mode = int(getattr(character, "nsfw_level", 0) or 0) == 0

        # Temporary attributes for AI providers that read character fields.
        original_persona = getattr(character, "persona_prompt", None)
        original_hook = getattr(character, "scenario_hook", None)
        character.persona_prompt = new_persona
        character.scenario_hook = scenario_hook

        try:
            bundle = await self.ai_manager.generate_scene_bootstrap(
                character,
                allow_split_fallback=False,
            )
        except TypeError:
            # Older managers without allow_split_fallback kwarg.
            bundle = await self.ai_manager.generate_scene_bootstrap(character)
        except Exception as exc:
            character.persona_prompt = original_persona
            character.scenario_hook = original_hook
            candidate.validation_errors = [f"scene_bootstrap_failed: {exc}"]
            candidate.new = {
                "persona_prompt": new_persona,
                "scenario_hook": scenario_hook,
                "opening_line": None,
                "default_state": {},
                "scene_summary": None,
                "generation_version": self.generation_version,
                "source_hash": None,
            }
            return candidate
        finally:
            # Restore until apply decides; candidate carries proposed values.
            character.persona_prompt = original_persona
            character.scenario_hook = original_hook

        bundle = bundle or {}
        opening = (bundle.get("opening_line") or "").strip()
        state = bundle.get("state") if isinstance(bundle.get("state"), dict) else {}
        summary = (bundle.get("scene_summary") or "").strip()

        # Reject silent split fallback (empty summary + incoherent) for migration.
        errors = validate_atomic_bundle(
            opening_line=opening,
            state=state,
            scene_summary=summary,
            safe_mode=safe_mode,
            scenario_hook=scenario_hook,
        )
        # Detect split fallback marker: empty scene_summary after "atomic" path
        if not summary:
            errors.append("atomic_bundle_required: scene_summary empty (split fallback?)")

        source_hash = compute_source_hash(
            name=character.name or "",
            description=character.description or "",
            persona_prompt=new_persona,
            scenario_hook=scenario_hook,
            voice_style=character.voice_style or "",
            nsfw_level=int(character.nsfw_level or 0),
            generation_version=self.generation_version,
        )

        candidate.new = {
            "persona_prompt": new_persona,
            "scenario_hook": scenario_hook,
            "opening_line": opening or None,
            "default_state": state,
            "scene_summary": summary or None,
            "generation_version": self.generation_version,
            "source_hash": source_hash,
        }
        candidate.validation_errors = errors
        candidate.validation_ok = not errors
        return candidate

    def apply_candidate(self, character: Any, candidate: SceneBundleCandidate) -> bool:
        """
        Write candidate onto the Character instance (caller commits).

        Returns False if validation failed — never writes partial bundles.
        """
        if candidate.skipped:
            return False
        if not candidate.validation_ok:
            logger.warning(
                "Refusing to apply invalid bundle for %s (%s): %s",
                candidate.character_id,
                candidate.name,
                candidate.validation_errors,
            )
            return False

        new = candidate.new
        character.persona_prompt = new["persona_prompt"]
        character.scenario_hook = new["scenario_hook"]
        character.opening_line = new["opening_line"]
        character.default_state_json = json.dumps(
            new["default_state"], ensure_ascii=False
        )
        character.scene_summary = new["scene_summary"]
        character.generation_version = new["generation_version"]
        character.source_hash = new["source_hash"]
        return True


def select_characters(
    session: Any,
    *,
    character_ids: Optional[Sequence[int]] = None,
    featured_only: bool = False,
    limit: int = 0,
) -> List[Any]:
    from models import Character

    query = session.query(Character).filter(
        (Character.is_deleted.is_(False)) | (Character.is_deleted.is_(None))
    )
    if character_ids:
        query = query.filter(Character.id.in_(list(character_ids)))
    if featured_only:
        query = query.filter(Character.is_featured.is_(True))
    query = query.order_by(Character.id)
    if limit and limit > 0:
        query = query.limit(limit)
    return list(query.all())


__all__ = [
    "SceneBundleCandidate",
    "SceneBundleMigrator",
    "select_characters",
    "snapshot_character_content",
    "validate_atomic_bundle",
]
