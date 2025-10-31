"""Backfill character default state templates."""

import argparse
import asyncio
import json
import logging
from typing import Optional

from sqlalchemy.orm import Session

from database import SessionLocal
from models import Character
from services.ai_model_manager import AIModelManager

logger = logging.getLogger(__name__)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill character default state templates.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum number of characters to process (0 = all).")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate default states even if a cached value already exists.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show which characters would be updated without writing to the database.",
    )
    return parser.parse_args()


async def _generate_state_seed(manager: AIModelManager, character: Character) -> Optional[str]:
    try:
        state_seed = await manager.generate_character_state_seed(character)
        if not state_seed:
            return None
        # Persist as UTF-8 JSON string for consistency with runtime generation.
        return json.dumps(state_seed, ensure_ascii=False)
    except Exception as exc:
        logger.error("Failed to generate default state for %s: %s", character.name, exc)
        return None


async def backfill_character_states(limit: int, force: bool, dry_run: bool) -> None:
    manager = AIModelManager()
    initialized = await manager.initialize()
    if not initialized:
        logger.warning("No AI providers available; generated states may use fallback templates.")

    session: Session = SessionLocal()
    updated = 0

    try:
        query = session.query(Character).order_by(Character.id)
        if not force:
            query = query.filter((Character.default_state_json.is_(None)) | (Character.default_state_json == ""))
        if limit and limit > 0:
            query = query.limit(limit)

        characters = query.all()
        logger.info("Processing %d character(s) for default state backfill...", len(characters))

        for character in characters:
            if not force and character.default_state_json:
                continue

            state_json = await _generate_state_seed(manager, character)
            if not state_json:
                logger.warning("Skipping %s - state generation returned empty result", character.name)
                continue

            logger.info("Character %s default state: %s", character.name, state_json)

            if dry_run:
                continue

            character.default_state_json = state_json
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
    asyncio.run(backfill_character_states(args.limit, args.force, args.dry_run))


if __name__ == "__main__":
    main()
