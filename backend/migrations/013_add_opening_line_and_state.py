"""
Migration 013: Add cached opening lines and chat state persistence.

- Adds `opening_line` column to `characters`
- Creates `character_chat_states` table (chat_id PK, state_json, updated_at)
"""

import logging
import os
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


def table_exists(conn, table: str) -> bool:
    inspector = engine.dialect.has_table
    return inspector(conn, table)


def run_migration() -> bool:
    """Execute the migration."""
    try:
        # Ensure base schema exists before alteration
        Base.metadata.create_all(engine)

        with engine.connect() as conn:
            trans = conn.begin()
            try:
                dialect = conn.dialect.name
                logger.info("🚀 Running migration 013 (dialect=%s)...", dialect)

                # Step 1: add opening_line column if missing
                if not column_exists(conn, "characters", "opening_line"):
                    logger.info("Adding opening_line column to characters...")
                    conn.execute(text("ALTER TABLE characters ADD COLUMN opening_line TEXT"))
                    logger.info("✅ opening_line column added.")
                else:
                    logger.info("ℹ️ opening_line column already exists; skipping add.")

                # Step 2: create character_chat_states table
                if not table_exists(conn, "character_chat_states"):
                    logger.info("Creating character_chat_states table...")
                    if dialect == "sqlite":
                        conn.execute(
                            text(
                                """
                                CREATE TABLE character_chat_states (
                                    chat_id INTEGER PRIMARY KEY,
                                    state_json TEXT,
                                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                    FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
                                )
                                """
                            )
                        )
                    else:
                        conn.execute(
                            text(
                                """
                                CREATE TABLE character_chat_states (
                                    chat_id INTEGER PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
                                    state_json TEXT,
                                    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                                )
                                """
                            )
                        )
                        conn.execute(
                            text(
                                "CREATE INDEX ix_character_chat_states_updated_at ON character_chat_states(updated_at)"
                            )
                        )
                    logger.info("✅ character_chat_states table created.")
                else:
                    logger.info("ℹ️ character_chat_states table already exists; skipping create.")

                trans.commit()
                logger.info("🎉 Migration 013 applied successfully.")
                return True
            except Exception as exc:
                logger.error("❌ Migration 013 failed; rolling back. Details: %s", exc)
                trans.rollback()
                raise
    except Exception as exc:
        logger.error("❌ Migration 013 encountered an error: %s", exc)
        return False


def downgrade() -> bool:
    """Revert the migration."""
    try:
        with engine.connect() as conn:
            trans = conn.begin()
            try:
                dialect = conn.dialect.name
                logger.info("⚙️ Downgrading migration 013 (dialect=%s)...", dialect)

                if table_exists(conn, "character_chat_states"):
                    logger.info("Dropping character_chat_states table...")
                    if dialect != "sqlite":
                        conn.execute(
                            text(
                                "DROP INDEX IF EXISTS ix_character_chat_states_updated_at"
                            )
                        )
                    conn.execute(text("DROP TABLE IF EXISTS character_chat_states"))
                    logger.info("✅ character_chat_states table dropped.")

                if column_exists(conn, "characters", "opening_line"):
                    if dialect == "sqlite":
                        logger.warning(
                            "SQLite cannot drop columns without table rebuild. "
                            "opening_line column remains."
                        )
                    else:
                        logger.info("Dropping opening_line column from characters...")
                        conn.execute(text("ALTER TABLE characters DROP COLUMN opening_line"))
                        logger.info("✅ opening_line column dropped.")

                trans.commit()
                logger.info("✅ Migration 013 downgrade complete.")
                return True
            except Exception as exc:
                logger.error("❌ Downgrade failed; rolling back. Details: %s", exc)
                trans.rollback()
                raise
    except Exception as exc:
        logger.error("❌ Migration 013 downgrade encountered an error: %s", exc)
        return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    if run_migration():
        logger.info("Migration 013 finished successfully.")
    else:
        logger.error("Migration 013 failed.")
