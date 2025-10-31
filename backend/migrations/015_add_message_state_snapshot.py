"""
Migration 015: Persist per-message state snapshots.

- Adds `state_snapshot` column to `chat_messages`
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
                logger.info("🚀 Running migration 015 (dialect=%s)...", dialect)

                if not column_exists(conn, "chat_messages", "state_snapshot"):
                    logger.info("Adding state_snapshot column to chat_messages...")
                    conn.execute(text("ALTER TABLE chat_messages ADD COLUMN state_snapshot TEXT"))
                    logger.info("✅ state_snapshot column added.")
                else:
                    logger.info("ℹ️ state_snapshot column already exists; skipping add.")

                trans.commit()
                logger.info("🎉 Migration 015 applied successfully.")
                return True
            except Exception as exc:
                logger.error("❌ Migration 015 failed; rolling back. Details: %s", exc)
                trans.rollback()
                raise
    except Exception as exc:
        logger.error("❌ Migration 015 encountered an error: %s", exc)
        return False


def downgrade() -> bool:
    try:
        with engine.connect() as conn:
            trans = conn.begin()
            try:
                dialect = conn.dialect.name
                logger.info("⚙️ Downgrading migration 015 (dialect=%s)...", dialect)

                if column_exists(conn, "chat_messages", "state_snapshot"):
                    if dialect == "sqlite":
                        logger.warning(
                            "SQLite cannot drop columns without table rebuild. "
                            "state_snapshot column remains."
                        )
                    else:
                        logger.info("Dropping state_snapshot column from chat_messages...")
                        conn.execute(text("ALTER TABLE chat_messages DROP COLUMN state_snapshot"))
                        logger.info("✅ state_snapshot column dropped.")

                trans.commit()
                logger.info("✅ Migration 015 downgrade complete.")
                return True
            except Exception as exc:
                logger.error("❌ Downgrade failed; rolling back. Details: %s", exc)
                trans.rollback()
                raise
    except Exception as exc:
        logger.error("❌ Migration 015 downgrade encountered an error: %s", exc)
        return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    if run_migration():
        logger.info("Migration 015 finished successfully.")
    else:
        logger.error("Migration 015 failed.")
