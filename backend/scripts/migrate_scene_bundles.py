"""Migrate legacy characters to versioned Scene Bundles (Issue #272).

Defaults to dry-run. Writes only with explicit --apply after validation.

Examples:
  # Audit + generate candidates for 12 featured characters (no DB writes)
  python scripts/migrate_scene_bundles.py --featured

  # Specific IDs
  python scripts/migrate_scene_bundles.py --ids 4,13,67,71,73

  # After review, apply validated candidates only
  python scripts/migrate_scene_bundles.py --featured --apply
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
from services.scene_bundle_migrator import SceneBundleMigrator, select_characters
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
        help="Comma-separated character IDs to process.",
    )
    parser.add_argument(
        "--featured",
        action="store_true",
        help="Process featured characters only.",
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
        help="Write validated candidates to the database. Without this flag, dry-run only.",
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
        "  audit: dynamics=%s persona_len=%s scene_locks=%s",
        audit.get("has_explicit_dynamics"),
        audit.get("persona_len"),
        audit.get("scene_lock_hints"),
    )
    old = candidate.old or {}
    new = candidate.new or {}
    logger.info("  OLD opening: %s", _preview_text(old.get("opening_line")))
    logger.info("  NEW opening: %s", _preview_text(new.get("opening_line")))
    logger.info("  OLD scene_summary: %s", _preview_text(old.get("scene_summary")))
    logger.info("  NEW scene_summary: %s", _preview_text(new.get("scene_summary")))
    logger.info("  NEW scenario_hook: %s", _preview_text(new.get("scenario_hook"), 200))
    old_env = (old.get("default_state") or {}).get("环境")
    new_env = (new.get("default_state") or {}).get("环境")
    logger.info("  OLD 环境: %s", _preview_text(str(old_env or "")))
    logger.info("  NEW 环境: %s", _preview_text(str(new_env or "")))
    logger.info(
        "  meta: version=%s hash=%s",
        new.get("generation_version"),
        _preview_text(new.get("source_hash"), 16),
    )


async def run_audit_only(
    *,
    character_ids: Optional[Sequence[int]],
    featured_only: bool,
    limit: int,
    output_path: str,
) -> int:
    """Persona/scenario separation preview without calling the LLM."""
    from services.scene_bundle_migrator import snapshot_character_content
    from utils.persona_scenario_split import migration_audit_flags, separate_persona_and_scenario
    from utils.character_content_version import (
        SCENE_BUNDLE_GENERATION_VERSION,
        character_needs_regeneration,
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
                "audit": audit,
                "old": snapshot_character_content(character),
                "proposed": {
                    "persona_prompt": persona,
                    "scenario_hook": hook,
                    "generation_version": SCENE_BUNDLE_GENERATION_VERSION,
                    "source_hash": compute_source_hash(
                        name=character.name or "",
                        description=character.description or "",
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


async def run_migration(
    *,
    character_ids: Optional[Sequence[int]],
    featured_only: bool,
    limit: int,
    force: bool,
    apply: bool,
    output_path: str,
    generation_version: str,
    audit_only: bool = False,
) -> int:
    if audit_only:
        if apply:
            logger.error("--audit-only cannot be combined with --apply")
            return 1
        return await run_audit_only(
            character_ids=character_ids,
            featured_only=featured_only,
            limit=limit,
            output_path=output_path,
        )

    if apply:
        logger.warning("APPLY MODE — validated candidates will be written to the database.")
    else:
        logger.info("DRY-RUN mode — no database writes (pass --apply to write).")

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
    )

    session = SessionLocal()
    report = {
        "mode": "apply" if apply else "dry-run",
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
        ok = fail = skipped = applied = 0

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
            if apply:
                if migrator.apply_candidate(character, candidate):
                    session.add(character)
                    session.commit()
                    applied += 1
                    logger.info("  applied id=%s", character.id)
                else:
                    session.rollback()
                    fail += 1
                    ok -= 1

        report["summary"] = {
            "matched": len(characters),
            "validation_ok": ok,
            "validation_failed": fail,
            "skipped_idempotent": skipped,
            "applied": applied if apply else 0,
        }
        logger.info("Summary: %s", report["summary"])
    finally:
        session.close()

    out = Path(output_path) if output_path else Path("tmp") / (
        f"scene_bundle_migration_{'apply' if apply else 'dryrun'}_"
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
    if not ids and not args.featured and args.limit <= 0:
        logger.error("Specify --featured, --ids, or --limit to select characters.")
        sys.exit(1)

    code = asyncio.run(
        run_migration(
            character_ids=ids,
            featured_only=args.featured,
            limit=args.limit,
            force=args.force,
            apply=args.apply,
            output_path=args.output,
            generation_version=args.generation_version,
            audit_only=args.audit_only,
        )
    )
    sys.exit(code)


if __name__ == "__main__":
    main()
