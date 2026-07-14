"""
Migration 021: Character Scene Bundle metadata (Issue #272).

Adds:
- scene_summary: atomic bundle one-line summary
- scenario_hook: replaceable current-scene input (not baked into persona core)
- generation_version: content pipeline version marker
- source_hash: hash of persona_prompt + scenario_hook (+ related inputs)
"""

import logging
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text

PARENT_DIR = Path(__file__).resolve().parent.parent
if str(PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(PARENT_DIR))

load_dotenv()

try:
    from database import sync_engine as engine
    from models import Base
except ImportError:
    from backend.database import sync_engine as engine  # fallback
    from backend.models import Base

logger = logging.getLogger(__name__)

COLUMNS = (
    ("scene_summary", "TEXT"),
    ("scenario_hook", "TEXT"),
    ("generation_version", "VARCHAR(32)"),
    ("source_hash", "VARCHAR(64)"),
)


def column_exists(conn, table: str, column: str) -> bool:
    query = text(
        """
        SELECT 1
        FROM pragma_table_info(:table)
        WHERE name = :column
        """
        if conn.dialect.name == "sqlite"
        else """
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = :table
          AND column_name = :column
        """
    )
    return conn.execute(query, {"table": table, "column": column}).first() is not None


def run_migration() -> bool:
    try:
        Base.metadata.create_all(engine)

        with engine.connect() as conn:
            trans = conn.begin()
            try:
                dialect = conn.dialect.name
                logger.info("Running migration 021 (dialect=%s)...", dialect)

                for name, col_type in COLUMNS:
                    if column_exists(conn, "characters", name):
                        logger.info("Column %s already exists; skipping.", name)
                        continue
                    logger.info("Adding characters.%s ...", name)
                    conn.execute(
                        text(f"ALTER TABLE characters ADD COLUMN {name} {col_type}")
                    )
                    logger.info("Added characters.%s", name)

                if dialect != "sqlite":
                    conn.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS idx_characters_generation_version "
                            "ON characters (generation_version)"
                        )
                    )

                trans.commit()
                logger.info("Migration 021 applied successfully.")
                return True
            except Exception as exc:
                logger.error("Migration 021 failed; rolling back: %s", exc)
                trans.rollback()
                raise
    except Exception as exc:
        logger.error("Migration 021 error: %s", exc)
        return False


def downgrade() -> bool:
    try:
        with engine.connect() as conn:
            trans = conn.begin()
            try:
                dialect = conn.dialect.name
                if dialect == "sqlite":
                    logger.warning(
                        "SQLite cannot drop columns without rebuild; leaving columns in place."
                    )
                else:
                    conn.execute(text("DROP INDEX IF EXISTS idx_characters_generation_version"))
                    for name, _ in COLUMNS:
                        if column_exists(conn, "characters", name):
                            conn.execute(text(f"ALTER TABLE characters DROP COLUMN {name}"))
                            logger.info("Dropped characters.%s", name)
                trans.commit()
                return True
            except Exception as exc:
                logger.error("Downgrade 021 failed: %s", exc)
                trans.rollback()
                raise
    except Exception as exc:
        logger.error("Downgrade 021 error: %s", exc)
        return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    if run_migration():
        logger.info("Migration 021 finished successfully.")
    else:
        logger.error("Migration 021 failed.")
        sys.exit(1)
