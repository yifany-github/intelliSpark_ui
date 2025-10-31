"""
Utility script to backfill cached opening lines for characters.

Usage:
    python backend/scripts/backfill_opening_lines.py --limit 25
    python backend/scripts/backfill_opening_lines.py --force
"""

import argparse
import asyncio
import logging
from typing import Optional

from sqlalchemy.orm import Session

from database import SessionLocal
from models import Character
from services.ai_model_manager import AIModelManager

logger = logging.getLogger(__name__)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill cached character opening lines.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum number of characters to process (0 = all).")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate opening lines even if a cached value already exists.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show which characters would be updated without writing to the database.",
    )
    return parser.parse_args()


async def _generate_opening_line(manager: AIModelManager, character: Character) -> Optional[str]:
    try:
        opening_line = await manager.generate_opening_line(character)
        return opening_line.strip() if opening_line else None
    except Exception as exc:
        logger.error("Failed to generate opening line for %s: %s", character.name, exc)
        return None


async def backfill_opening_lines(limit: int, force: bool, dry_run: bool) -> None:
    manager = AIModelManager()
    initialized = await manager.initialize()
    if not initialized:
        logger.warning("No AI providers available; generated opening lines may fall back to defaults.")

    session: Session = SessionLocal()
    updated = 0

    try:
        query = session.query(Character).order_by(Character.id)
        if not force:
            query = query.filter(Character.opening_line.is_(None))
        if limit and limit > 0:
            query = query.limit(limit)

        characters = query.all()
        logger.info("Processing %d character(s)...", len(characters))

        for character in characters:
            if not force and character.opening_line:
                continue

            opening_line = await _generate_opening_line(manager, character)
            if not opening_line:
                logger.warning("Skipping %s - opening line generation returned empty result", character.name)
                continue

            logger.info("Character %s opening line: %s", character.name, opening_line)

            if dry_run:
                continue

            character.opening_line = opening_line
            session.add(character)
            session.commit()
            updated += 1

        if dry_run:
            logger.info("Dry run complete. %d character(s) would be updated.", len(characters))
        else:
            logger.info("Backfill complete. %d character(s) updated.", updated)
    finally:
        session.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
    args = _parse_args()
    asyncio.run(backfill_opening_lines(args.limit, args.force, args.dry_run))


if __name__ == "__main__":
    main()
