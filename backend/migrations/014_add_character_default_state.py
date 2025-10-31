"""
Migration 014: Persist per-character default state template.

- Adds `default_state_json` column to `characters`
"""

import logging
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text

# Ensure we can import database module when running as script
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
    """Execute the migration."""
    try:
        # Ensure base schema exists before alteration
        Base.metadata.create_all(engine)

        with engine.connect() as conn:
            trans = conn.begin()
            try:
                dialect = conn.dialect.name
                logger.info("🚀 Running migration 014 (dialect=%s)...", dialect)

                if not column_exists(conn, "characters", "default_state_json"):
                    logger.info("Adding default_state_json column to characters...")
                    conn.execute(text("ALTER TABLE characters ADD COLUMN default_state_json TEXT"))
                    logger.info("✅ default_state_json column added.")
                else:
                    logger.info("ℹ️ default_state_json column already exists; skipping add.")

                trans.commit()
                logger.info("🎉 Migration 014 applied successfully.")
                return True
            except Exception as exc:
                logger.error("❌ Migration 014 failed; rolling back. Details: %s", exc)
                trans.rollback()
                raise
    except Exception as exc:
        logger.error("❌ Migration 014 encountered an error: %s", exc)
        return False


def downgrade() -> bool:
    """Revert the migration."""
    try:
        with engine.connect() as conn:
            trans = conn.begin()
            try:
                dialect = conn.dialect.name
                logger.info("⚙️ Downgrading migration 014 (dialect=%s)...", dialect)

                if column_exists(conn, "characters", "default_state_json"):
                    if dialect == "sqlite":
                        logger.warning(
                            "SQLite cannot drop columns without table rebuild. "
                            "default_state_json column remains."
                        )
                    else:
                        logger.info("Dropping default_state_json column from characters...")
                        conn.execute(text("ALTER TABLE characters DROP COLUMN default_state_json"))
                        logger.info("✅ default_state_json column dropped.")

                trans.commit()
                logger.info("✅ Migration 014 downgrade complete.")
                return True
            except Exception as exc:
                logger.error("❌ Downgrade failed; rolling back. Details: %s", exc)
                trans.rollback()
                raise
    except Exception as exc:
        logger.error("❌ Migration 014 downgrade encountered an error: %s", exc)
        return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    if run_migration():
        logger.info("Migration 014 finished successfully.")
    else:
        logger.error("Migration 014 failed.")
