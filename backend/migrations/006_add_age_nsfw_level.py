"""
Migration 006: Add age and nsfw_level to characters

This migration adds the following fields to the characters table:
- age: Optional INTEGER with range 1–200 (CHECK constraint)
- nsfw_level: INTEGER NOT NULL DEFAULT 0 with range 0–3 (CHECK constraint)

Run this migration to align the database with backend/models.py and issue #146.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import sync_engine as engine

def upgrade():
    """Add age and nsfw_level columns (idempotent at DB level if not present)."""
    with engine.connect() as conn:
        try:
            # Add age column (nullable) with range constraint when supported
            try:
                conn.execute(text(
                    """
                    ALTER TABLE characters
                    ADD COLUMN age INTEGER NULL CHECK (age >= 1 AND age <= 200)
                    """
                ))
            except Exception as e:
                # Column might already exist; print and continue
                print(f"age column add skipped or already exists: {e}")

            # Add nsfw_level column (not null, default 0) with range constraint when supported
            try:
                conn.execute(text(
                    """
                    ALTER TABLE characters
                    ADD COLUMN nsfw_level INTEGER NOT NULL DEFAULT 0 CHECK (nsfw_level >= 0 AND nsfw_level <= 3)
                    """
                ))
            except Exception as e:
                print(f"nsfw_level column add skipped or already exists: {e}")

            conn.commit()
            print("✅ Successfully added age and nsfw_level columns (or they already existed)")
        except Exception as e:
            conn.rollback()
            print(f"❌ Error adding age/nsfw_level columns: {e}")
            raise

def downgrade():
    """Remove age and nsfw_level columns (may be unsupported in SQLite)."""
    with engine.connect() as conn:
        try:
            # Note: SQLite cannot DROP COLUMN prior to v3.35.0; this may fail.
            try:
                conn.execute(text("ALTER TABLE characters DROP COLUMN age"))
            except Exception as e:
                print(f"age column drop skipped or not supported: {e}")

            try:
                conn.execute(text("ALTER TABLE characters DROP COLUMN nsfw_level"))
            except Exception as e:
                print(f"nsfw_level column drop skipped or not supported: {e}")

            conn.commit()
            print("✅ Successfully attempted removal of age and nsfw_level (if supported)")
        except Exception as e:
            conn.rollback()
            print(f"❌ Error removing age/nsfw_level columns: {e}")
            raise

if __name__ == "__main__":
    upgrade()

