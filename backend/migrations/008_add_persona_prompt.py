"""
Migration 008: Add persona_prompt to characters

Adds an optional TEXT column `persona_prompt` to the `characters` table to
allow overriding backstory with a direct persona system prompt.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine


def upgrade():
    with engine.connect() as conn:
        try:
            try:
                conn.execute(text(
                    """
                    ALTER TABLE characters
                    ADD COLUMN persona_prompt TEXT NULL
                    """
                ))
            except Exception as e:
                print(f"persona_prompt add skipped or already exists: {e}")

            conn.commit()
            print("✅ persona_prompt column ensured on characters table")
        except Exception as e:
            conn.rollback()
            print(f"❌ Migration 008 failed: {e}")
            raise


def downgrade():
    with engine.connect() as conn:
        try:
            try:
                conn.execute(text("ALTER TABLE characters DROP COLUMN persona_prompt"))
            except Exception as e:
                print(f"persona_prompt drop skipped or not supported: {e}")
            conn.commit()
            print("✅ Downgrade attempted for persona_prompt")
        except Exception as e:
            conn.rollback()
            print(f"❌ Downgrade failed: {e}")
            raise


if __name__ == "__main__":
    upgrade()
