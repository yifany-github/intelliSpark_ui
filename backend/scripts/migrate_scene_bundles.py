"""Migrate legacy characters to versioned Scene Bundles (Issue #272).

Defaults to dry-run. Production writes require --apply-from-report <dryrun.json>
so the reviewed candidate is written verbatim (no second LLM call).

Examples:
  # Generate reviewable candidates (no DB writes)
  python scripts/migrate_scene_bundles.py --featured --output tmp/featured_dryrun.json

  # After review, write exactly those candidates
  python scripts/migrate_scene_bundles.py --apply-from-report tmp/featured_dryrun.json --ids 71,73,67

  # Audit persona/scenario split only
  python scripts/migrate_scene_bundles.py --featured --audit-only
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Sequence

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from database import SessionLocal
from services.scene_bundle_migrator import (
    SceneBundleMigrator,
    load_candidates_from_report,
    select_characters,
)
from utils.character_content_version import SCENE_BUNDLE_GENERATION_VERSION

logger = logging.getLogger(__name__)


def _parse_ids(raw: Optional[str]) -> Optional[List[int]]:
    if not raw:
        return None
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    return [int(p) for p in parts]


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate characters to versioned atomic Scene Bundles (default: dry-run)."
    )
    parser.add_argument(
        "--ids",
        type=str,
        default="",
        help="Comma-separated character IDs to process / filter apply-from-report.",
    )
    parser.add_argument(
        "--featured",
        action="store_true",
        help="Process featured characters only (dry-run / audit).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Maximum characters to process (0 = all matched).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate even when generation_version+source_hash already match.",
    )
    parser.add_argument(
        "--audit-only",
        action="store_true",
        help="Only separate persona/scenario and print old vs proposed core (no AI Scene Bundle).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="DEPRECATED unsafe mode. Use --apply-from-report instead.",
    )
    parser.add_argument(
        "--apply-from-report",
        type=str,
        default="",
        help="Path to a reviewed dry-run JSON report. Writes those candidates verbatim "
        "(no LLM regeneration). Refuses if live baseline_fingerprint drifted.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="",
        help="Optional path to write JSON report (defaults under backend/tmp/).",
    )
    parser.add_argument(
        "--generation-version",
        type=str,
        default=SCENE_BUNDLE_GENERATION_VERSION,
        help="Target generation_version stamp.",
    )
    parser.add_argument(
        "--skip-english",
        action="store_true",
        help="Do not generate EN bundles; clear opening_line_en/default_state_json_en on apply.",
    )
    return parser.parse_args()


def _preview_text(value: Optional[str], limit: int = 160) -> str:
    text = (value or "").replace("\n", " ").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def _print_candidate(candidate) -> None:
    header = f"[{candidate.character_id}] {candidate.name}"
    if candidate.skipped:
        logger.info("%s SKIP — %s", header, candidate.skip_reason)
        return
    status = "OK" if candidate.validation_ok else "FAIL"
    logger.info("%s %s", header, status)
    if candidate.validation_errors:
        logger.info("  errors: %s", "; ".join(candidate.validation_errors))
    audit = candidate.audit or {}
    logger.info(
        "  audit: dynamics=%s persona_len=%s→compact=%s locks=%s en_cleared=%s",
        audit.get("has_explicit_dynamics"),
        audit.get("persona_len"),
        audit.get("compact_persona_len"),
        audit.get("scene_lock_hints"),
        audit.get("english_fields_cleared"),
    )
    old = candidate.old or {}
    new = candidate.new or {}
    logger.info("  OLD opening: %s", _preview_text(old.get("opening_line")))
    logger.info("  NEW opening: %s", _preview_text(new.get("opening_line")))
    if new.get("opening_line_en"):
        logger.info("  NEW opening_en: %s", _preview_text(new.get("opening_line_en")))
    logger.info("  OLD scene_summary: %s", _preview_text(old.get("scene_summary")))
    logger.info("  NEW scene_summary: %s", _preview_text(new.get("scene_summary")))
    logger.info("  NEW scenario_hook: %s", _preview_text(new.get("scenario_hook"), 200))
    old_env = (old.get("default_state") or {}).get("环境")
    new_env = (new.get("default_state") or {}).get("环境")
    logger.info("  OLD 环境: %s", _preview_text(str(old_env or "")))
    logger.info("  NEW 环境: %s", _preview_text(str(new_env or "")))
    logger.info(
        "  meta: version=%s hash=%s baseline=%s",
        new.get("generation_version"),
        _preview_text(new.get("source_hash"), 16),
        _preview_text(candidate.baseline_fingerprint, 16),
    )


async def run_audit_only(
    *,
    character_ids: Optional[Sequence[int]],
    featured_only: bool,
    limit: int,
    output_path: str,
) -> int:
    from services.scene_bundle_migrator import snapshot_character_content
    from utils.persona_scenario_split import migration_audit_flags, separate_persona_and_scenario
    from utils.character_content_version import (
        SCENE_BUNDLE_GENERATION_VERSION,
        character_needs_regeneration,
        compute_baseline_fingerprint,
        compute_source_hash,
    )

    session = SessionLocal()
    report = {
        "mode": "audit-only",
        "generation_version": SCENE_BUNDLE_GENERATION_VERSION,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "candidates": [],
        "summary": {},
    }
    try:
        characters = select_characters(
            session,
            character_ids=character_ids,
            featured_only=featured_only,
            limit=limit,
        )
        logger.info("Auditing %d character(s)...", len(characters))
        needs = 0
        for character in characters:
            persona, hook = separate_persona_and_scenario(character)
            audit = migration_audit_flags(character)
            stale = character_needs_regeneration(
                character,
                persona_prompt=persona,
                scenario_hook=hook,
            )
            if stale:
                needs += 1
            entry = {
                "character_id": character.id,
                "name": character.name,
                "needs_regeneration": stale,
                "baseline_fingerprint": compute_baseline_fingerprint(character),
                "audit": audit,
                "old": snapshot_character_content(character),
                "proposed": {
                    "persona_prompt": persona,
                    "scenario_hook": hook,
                    "generation_version": SCENE_BUNDLE_GENERATION_VERSION,
                    "source_hash": compute_source_hash(
                        name=character.name or "",
                        description=character.description or "",
                        backstory=character.backstory or "",
                        persona_prompt=persona,
                        scenario_hook=hook,
                        voice_style=character.voice_style or "",
                        nsfw_level=int(character.nsfw_level or 0),
                    ),
                },
            }
            report["candidates"].append(entry)
            logger.info(
                "[%s] %s needs_regen=%s dynamics=%s persona %s→%s locks=%s",
                character.id,
                character.name,
                stale,
                audit.get("has_explicit_dynamics"),
                audit.get("persona_len"),
                len(persona),
                audit.get("scene_lock_hints"),
            )
            logger.info("  scenario_hook: %s", _preview_text(hook, 200))
            logger.info("  OLD opening: %s", _preview_text(entry["old"].get("opening_line")))
        report["summary"] = {
            "matched": len(characters),
            "needs_regeneration": needs,
        }
    finally:
        session.close()

    out = Path(output_path) if output_path else Path("tmp") / (
        f"scene_bundle_audit_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("Wrote audit report: %s", out)
    return 0


async def run_apply_from_report(
    *,
    report_path: str,
    character_ids: Optional[Sequence[int]],
) -> int:
    """Write reviewed dry-run candidates verbatim — no LLM calls."""
    logger.warning(
        "APPLY-FROM-REPORT — writing reviewed candidates from %s (no LLM regeneration).",
        report_path,
    )
    candidates = load_candidates_from_report(report_path)
    if character_ids:
        allow = set(character_ids)
        candidates = [c for c in candidates if c.character_id in allow]

    session = SessionLocal()
    applied = refused = skipped = 0
    # Migrator only needed for apply_candidate helper (no AI).
    migrator = SceneBundleMigrator(ai_manager=None, force=False)
    try:
        from models import Character

        for candidate in candidates:
            if candidate.skipped:
                skipped += 1
                logger.info("[%s] %s SKIP (was idempotent in report)", candidate.character_id, candidate.name)
                continue
            if not candidate.validation_ok:
                refused += 1
                logger.warning(
                    "[%s] %s REFUSE — report marked invalid: %s",
                    candidate.character_id,
                    candidate.name,
                    candidate.validation_errors,
                )
                continue

            character = (
                session.query(Character)
                .filter(Character.id == candidate.character_id)
                .first()
            )
            if not character:
                refused += 1
                logger.warning("[%s] REFUSE — character not found", candidate.character_id)
                continue

            if migrator.apply_candidate(character, candidate, require_baseline_match=True):
                session.add(character)
                session.commit()
                applied += 1
                logger.info("[%s] %s applied from report", character.id, character.name)
            else:
                session.rollback()
                refused += 1
    finally:
        session.close()

    summary = {
        "mode": "apply-from-report",
        "report": report_path,
        "applied": applied,
        "refused": refused,
        "skipped_idempotent": skipped,
    }
    logger.info("Summary: %s", summary)
    return 0 if refused == 0 else 2


async def run_migration(
    *,
    character_ids: Optional[Sequence[int]],
    featured_only: bool,
    limit: int,
    force: bool,
    apply: bool,
    apply_from_report: str,
    output_path: str,
    generation_version: str,
    audit_only: bool = False,
    skip_english: bool = False,
) -> int:
    if apply and not apply_from_report:
        logger.error(
            "Bare --apply is disabled. Generate a dry-run report, review it, then run:\n"
            "  python scripts/migrate_scene_bundles.py --apply-from-report <report.json> [--ids ...]"
        )
        return 1

    if apply_from_report:
        return await run_apply_from_report(
            report_path=apply_from_report,
            character_ids=character_ids,
        )

    if audit_only:
        return await run_audit_only(
            character_ids=character_ids,
            featured_only=featured_only,
            limit=limit,
            output_path=output_path,
        )

    logger.info("DRY-RUN mode — no database writes.")

    from services.ai_model_manager import AIModelManager

    manager = AIModelManager()
    initialized = await manager.initialize()
    if not initialized:
        logger.error("No AI providers available; cannot generate atomic Scene Bundles.")
        return 1

    migrator = SceneBundleMigrator(
        ai_manager=manager,
        generation_version=generation_version,
        force=force,
        generate_english=not skip_english,
    )

    session = SessionLocal()
    report = {
        "mode": "dry-run",
        "generation_version": generation_version,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "candidates": [],
        "summary": {},
    }

    try:
        characters = select_characters(
            session,
            character_ids=character_ids,
            featured_only=featured_only,
            limit=limit,
        )
        if not characters:
            logger.warning("No characters matched selection filters.")
            report["summary"] = {"matched": 0}
            return 0

        logger.info("Processing %d character(s)...", len(characters))
        ok = fail = skipped = 0

        for character in characters:
            candidate = await migrator.build_candidate(character)
            _print_candidate(candidate)
            report["candidates"].append(candidate.to_dict())

            if candidate.skipped:
                skipped += 1
                continue
            if not candidate.validation_ok:
                fail += 1
                continue
            ok += 1

        report["summary"] = {
            "matched": len(characters),
            "validation_ok": ok,
            "validation_failed": fail,
            "skipped_idempotent": skipped,
            "applied": 0,
        }
        logger.info("Summary: %s", report["summary"])
        logger.info(
            "Next: review this report, then apply with "
            "--apply-from-report <this file> [--ids ...]"
        )
    finally:
        session.close()

    out = Path(output_path) if output_path else Path("tmp") / (
        f"scene_bundle_migration_dryrun_"
        f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("Wrote report: %s", out)
    return 0 if report["summary"].get("validation_failed", 0) == 0 else 2


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
    args = _parse_args()
    ids = _parse_ids(args.ids)
    if not args.apply_from_report and not ids and not args.featured and args.limit <= 0:
        logger.error("Specify --featured, --ids, --limit, or --apply-from-report.")
        sys.exit(1)

    code = asyncio.run(
        run_migration(
            character_ids=ids,
            featured_only=args.featured,
            limit=args.limit,
            force=args.force,
            apply=args.apply,
            apply_from_report=args.apply_from_report,
            output_path=args.output,
            generation_version=args.generation_version,
            audit_only=args.audit_only,
            skip_english=args.skip_english,
        )
    )
    sys.exit(code)


if __name__ == "__main__":
    main()
