"""Atomic Scene Bundle migration helpers (Issue #272).

Dry-run writes a reviewable JSON report. Apply must load that report and write
exactly the reviewed candidate — never regenerate via LLM at apply time.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Mapping, Optional, Sequence

from prompts.scene_bootstrap import scene_pair_looks_coherent
from utils.character_content_version import (
    SCENE_BUNDLE_GENERATION_VERSION,
    character_needs_regeneration,
    compute_baseline_fingerprint,
    compute_source_hash,
)
from utils.persona_scenario_split import (
    hook_has_internal_place_conflict,
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
    # Fingerprint of DB content at dry-run time — required for --apply-from-report
    baseline_fingerprint: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "SceneBundleCandidate":
        return cls(
            character_id=int(data["character_id"]),
            name=str(data.get("name") or ""),
            skipped=bool(data.get("skipped")),
            skip_reason=str(data.get("skip_reason") or ""),
            validation_ok=bool(data.get("validation_ok")),
            validation_errors=list(data.get("validation_errors") or []),
            audit=dict(data.get("audit") or {}),
            old=dict(data.get("old") or {}),
            new=dict(data.get("new") or {}),
            baseline_fingerprint=str(data.get("baseline_fingerprint") or ""),
        )


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
        "backstory": getattr(character, "backstory", None),
        "scenario_hook": getattr(character, "scenario_hook", None),
        "opening_line": getattr(character, "opening_line", None),
        "opening_line_en": getattr(character, "opening_line_en", None),
        "default_state": _parse_state_json(getattr(character, "default_state_json", None)),
        "default_state_en": _parse_state_json(getattr(character, "default_state_json_en", None)),
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
    if hook and hook_has_internal_place_conflict(hook):
        errors.append("scenario_hook has internal place conflict")

    if hook:
        hook_places = place_markers(hook)
        scene_places = place_markers(f"{env} {scene_summary}")
        if hook_places and scene_places.isdisjoint(hook_places):
            errors.append(
                f"scenario_hook/environment mismatch (hook={sorted(hook_places)} scene={sorted(scene_places)})"
            )
    return errors


class SceneBundleMigrator:
    """Build reviewable Scene Bundle candidates; write only reviewed report rows."""

    def __init__(
        self,
        *,
        ai_manager: Any,
        generation_version: str = SCENE_BUNDLE_GENERATION_VERSION,
        force: bool = False,
        generate_english: bool = True,
    ) -> None:
        self.ai_manager = ai_manager
        self.generation_version = generation_version
        self.force = force
        self.generate_english = generate_english

    async def build_candidate(self, character: Any) -> SceneBundleCandidate:
        audit = migration_audit_flags(character)
        old = snapshot_character_content(character)
        baseline = compute_baseline_fingerprint(character)
        candidate = SceneBundleCandidate(
            character_id=int(character.id),
            name=str(character.name or ""),
            audit=audit,
            old=old,
            baseline_fingerprint=baseline,
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
        original_persona = getattr(character, "persona_prompt", None)
        original_hook = getattr(character, "scenario_hook", None)
        character.persona_prompt = new_persona
        character.scenario_hook = scenario_hook

        try:
            bundle = await self.ai_manager.generate_scene_bootstrap(
                character,
                language="zh",
                allow_split_fallback=False,
            )
        except TypeError:
            bundle = await self.ai_manager.generate_scene_bootstrap(character)
        except Exception as exc:
            character.persona_prompt = original_persona
            character.scenario_hook = original_hook
            candidate.validation_errors = [f"scene_bootstrap_failed: {exc}"]
            candidate.new = {
                "persona_prompt": new_persona,
                "scenario_hook": scenario_hook,
                "opening_line": None,
                "opening_line_en": None,
                "default_state": {},
                "default_state_en": {},
                "scene_summary": None,
                "generation_version": self.generation_version,
                "source_hash": None,
                "clear_english_fields": False,
            }
            return candidate
        finally:
            character.persona_prompt = original_persona
            character.scenario_hook = original_hook

        bundle = bundle or {}
        opening = (bundle.get("opening_line") or "").strip()
        state = bundle.get("state") if isinstance(bundle.get("state"), dict) else {}
        summary = (bundle.get("scene_summary") or "").strip()

        errors = validate_atomic_bundle(
            opening_line=opening,
            state=state,
            scene_summary=summary,
            safe_mode=safe_mode,
            scenario_hook=scenario_hook,
        )
        if not summary:
            errors.append("atomic_bundle_required: scene_summary empty (split fallback?)")

        opening_en = None
        state_en: Dict[str, Any] = {}
        clear_english = False
        needs_en = bool(
            (getattr(character, "opening_line_en", None) or "").strip()
            or (getattr(character, "default_state_json_en", None) or "").strip()
        )
        if self.generate_english and needs_en and not errors:
            character.persona_prompt = new_persona
            character.scenario_hook = scenario_hook
            try:
                en_bundle = await self.ai_manager.generate_scene_bootstrap(
                    character,
                    language="en",
                    allow_split_fallback=False,
                )
            except TypeError:
                en_bundle = await self.ai_manager.generate_scene_bootstrap(
                    character, language="en"
                )
            except Exception as exc:
                en_bundle = {}
                errors.append(f"english_bundle_failed: {exc}")
            finally:
                character.persona_prompt = original_persona
                character.scenario_hook = original_hook

            en_bundle = en_bundle or {}
            opening_en = (en_bundle.get("opening_line") or "").strip() or None
            state_en = en_bundle.get("state") if isinstance(en_bundle.get("state"), dict) else {}
            en_summary = (en_bundle.get("scene_summary") or "").strip()
            if not opening_en or not state_en:
                # Do not leave stale English content that would shadow the new ZH bundle.
                clear_english = True
                errors.append("english_bundle_incomplete: will clear opening_line_en/default_state_json_en on apply")
            else:
                # Soft check — EN state may use Chinese keys still.
                if not scene_pair_looks_coherent(opening_en, state_en, safe_mode=safe_mode):
                    clear_english = True
                    errors.append("english_bundle_incoherent: will clear EN fields on apply")
                elif not en_summary:
                    # EN summary optional for chat path; keep opening/state if coherent
                    pass
        elif needs_en and not self.generate_english:
            clear_english = True

        soft_errors = [e for e in errors if e.startswith("english_bundle_")]
        hard_errors = [e for e in errors if not e.startswith("english_bundle_")]
        if soft_errors and not hard_errors:
            clear_english = True

        source_hash = compute_source_hash(
            name=character.name or "",
            description=character.description or "",
            backstory=character.backstory or "",
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
            "opening_line_en": None if clear_english else opening_en,
            "default_state": state,
            "default_state_en": {} if clear_english else state_en,
            "scene_summary": summary or None,
            "generation_version": self.generation_version,
            "source_hash": source_hash,
            "clear_english_fields": clear_english,
        }
        candidate.validation_errors = hard_errors
        candidate.validation_ok = not hard_errors
        if clear_english and candidate.validation_ok:
            candidate.audit = {
                **candidate.audit,
                "english_fields_cleared": True,
                "english_soft_errors": soft_errors,
            }
        return candidate

    def apply_candidate(
        self,
        character: Any,
        candidate: SceneBundleCandidate,
        *,
        require_baseline_match: bool = True,
    ) -> bool:
        """
        Write a previously reviewed candidate onto the Character (caller commits).

        Never trusts report flags alone:
        - re-validates opening/state/summary coherence
        - recomputes source_hash from live generation inputs + reviewed persona/hook
        - refuses mismatched generation_version / drifted baseline
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

        if require_baseline_match:
            if not candidate.baseline_fingerprint:
                logger.warning(
                    "Refusing apply for %s: report missing baseline_fingerprint",
                    candidate.character_id,
                )
                return False
            live = compute_baseline_fingerprint(character)
            if live != candidate.baseline_fingerprint:
                logger.warning(
                    "Refusing apply for %s (%s): baseline fingerprint mismatch "
                    "(character changed since dry-run review)",
                    candidate.character_id,
                    candidate.name,
                )
                return False

        new = dict(candidate.new or {})
        required = (
            "persona_prompt",
            "scenario_hook",
            "opening_line",
            "default_state",
            "scene_summary",
            "generation_version",
            "source_hash",
        )
        for key in required:
            if key not in new or new[key] in (None, "", {}):
                logger.warning(
                    "Refusing apply for %s: incomplete reviewed payload missing %s",
                    candidate.character_id,
                    key,
                )
                return False

        report_version = str(new.get("generation_version") or "").strip()
        if report_version != self.generation_version:
            logger.warning(
                "Refusing apply for %s: generation_version %r != target %r",
                candidate.character_id,
                report_version,
                self.generation_version,
            )
            return False

        safe_mode = int(getattr(character, "nsfw_level", 0) or 0) == 0
        state = new.get("default_state") if isinstance(new.get("default_state"), dict) else {}
        recheck = validate_atomic_bundle(
            opening_line=str(new.get("opening_line") or ""),
            state=state,
            scene_summary=str(new.get("scene_summary") or ""),
            safe_mode=safe_mode,
            scenario_hook=str(new.get("scenario_hook") or ""),
        )
        if recheck:
            logger.warning(
                "Refusing apply for %s (%s): report payload failed re-validation: %s",
                candidate.character_id,
                candidate.name,
                recheck,
            )
            return False

        expected_hash = compute_source_hash(
            name=character.name or "",
            description=character.description or "",
            backstory=character.backstory or "",
            persona_prompt=str(new["persona_prompt"]),
            scenario_hook=str(new["scenario_hook"]),
            voice_style=character.voice_style or "",
            nsfw_level=int(character.nsfw_level or 0),
            generation_version=self.generation_version,
        )
        reported_hash = str(new.get("source_hash") or "").strip()
        if reported_hash and reported_hash != expected_hash:
            logger.warning(
                "Refusing apply for %s: report source_hash does not match recomputed hash "
                "(report may be tampered or stale relative to live inputs)",
                candidate.character_id,
            )
            return False

        # Always persist the recomputed hash / canonical version.
        new["source_hash"] = expected_hash
        new["generation_version"] = self.generation_version

        character.persona_prompt = new["persona_prompt"]
        character.scenario_hook = new["scenario_hook"]
        character.opening_line = new["opening_line"]
        character.default_state_json = json.dumps(
            new["default_state"], ensure_ascii=False
        )
        character.scene_summary = new["scene_summary"]
        character.generation_version = new["generation_version"]
        character.source_hash = new["source_hash"]

        if new.get("clear_english_fields"):
            character.opening_line_en = None
            character.default_state_json_en = None
        else:
            if new.get("opening_line_en"):
                character.opening_line_en = new["opening_line_en"]
            if new.get("default_state_en"):
                character.default_state_json_en = json.dumps(
                    new["default_state_en"], ensure_ascii=False
                )
        return True

    def build_adopt_existing_candidate(self, character: Any) -> SceneBundleCandidate:
        """
        Promote live hand-edited content into a reviewable Scene Bundle report row.

        No LLM. Keeps current persona/opening/state; fills scenario_hook + scene_summary
        when missing so --apply-from-report can stamp generation_version/source_hash.
        """
        from utils.persona_scenario_split import derive_scenario_hook

        audit = migration_audit_flags(character)
        old = snapshot_character_content(character)
        baseline = compute_baseline_fingerprint(character)
        candidate = SceneBundleCandidate(
            character_id=int(character.id),
            name=str(character.name or ""),
            audit={**audit, "adopt_existing": True},
            old=old,
            baseline_fingerprint=baseline,
        )

        persona = (
            (getattr(character, "persona_prompt", None) or "").strip()
            or (getattr(character, "backstory", None) or "").strip()
            or (getattr(character, "description", None) or "").strip()
        )
        opening = (getattr(character, "opening_line", None) or "").strip()
        state = _parse_state_json(getattr(character, "default_state_json", None))
        hook = derive_scenario_hook(character)
        summary = (getattr(character, "scene_summary", None) or "").strip()
        if not summary:
            summary = synthesize_scene_summary(opening, state)

        safe_mode = int(getattr(character, "nsfw_level", 0) or 0) == 0
        errors = validate_atomic_bundle(
            opening_line=opening,
            state=state,
            scene_summary=summary,
            safe_mode=safe_mode,
            scenario_hook=hook,
        )

        source_hash = compute_source_hash(
            name=character.name or "",
            description=character.description or "",
            backstory=character.backstory or "",
            persona_prompt=persona,
            scenario_hook=hook,
            voice_style=character.voice_style or "",
            nsfw_level=int(character.nsfw_level or 0),
            generation_version=self.generation_version,
        )

        needs_en = bool(
            (getattr(character, "opening_line_en", None) or "").strip()
            or (getattr(character, "default_state_json_en", None) or "").strip()
        )
        # Hand-edited ZH pilots often keep stale EN that would shadow the new scene.
        clear_english = bool(needs_en)
        candidate.new = {
            "persona_prompt": persona,
            "scenario_hook": hook,
            "opening_line": opening or None,
            "opening_line_en": None if clear_english else getattr(character, "opening_line_en", None),
            "default_state": state,
            "default_state_en": {}
            if clear_english
            else _parse_state_json(getattr(character, "default_state_json_en", None)),
            "scene_summary": summary or None,
            "generation_version": self.generation_version,
            "source_hash": source_hash,
            "clear_english_fields": clear_english,
            "adopt_existing": True,
        }

        candidate.validation_errors = errors
        candidate.validation_ok = not errors
        return candidate


def synthesize_scene_summary(opening: str, state: Mapping[str, Any]) -> str:
    """Build a short scene_summary from live opening + 环境 when column is empty."""
    env = str((state or {}).get("环境") or "").strip().rstrip("。.")
    beat = (opening or "").replace("*", " ").replace("\n", " ").strip()
    beat = " ".join(beat.split())
    if len(beat) > 72:
        beat = beat[:69] + "…"
    if env and beat:
        return f"{env}。开场：{beat}"[:240]
    return (env or beat or "当前场景")[:240]


def load_candidates_from_report(path: str) -> List[SceneBundleCandidate]:
    with open(path, "r", encoding="utf-8") as fh:
        report = json.load(fh)
    rows = report.get("candidates") or []
    return [SceneBundleCandidate.from_dict(row) for row in rows]


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
    "load_candidates_from_report",
    "select_characters",
    "snapshot_character_content",
    "synthesize_scene_summary",
    "validate_atomic_bundle",
]
