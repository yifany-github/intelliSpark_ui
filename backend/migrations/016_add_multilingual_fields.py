"""Add multilingual fields to characters table for i18n support.

This migration adds English language fields to support bilingual content:
- name_en: English character name
- description_en: English description
- backstory_en: English backstory
- opening_line_en: English opening line
- default_state_json_en: English state JSON
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from database import sync_engine


def run_migration():
    """Add multilingual columns to characters table."""
    print("Starting migration: Add multilingual fields to characters table")

    with sync_engine.begin() as conn:
        # Check if columns already exist using inspector (db agnostic)
        inspector = inspect(conn)
        columns = {col['name'] for col in inspector.get_columns('characters')}

        # Add English language columns if they don't exist
        if "name_en" not in columns:
            print("Adding name_en column...")
            conn.execute(text("""
                ALTER TABLE characters
                ADD COLUMN name_en VARCHAR(255)
            """))

        if "description_en" not in columns:
            print("Adding description_en column...")
            conn.execute(text("""
                ALTER TABLE characters
                ADD COLUMN description_en TEXT
            """))

        if "backstory_en" not in columns:
            print("Adding backstory_en column...")
            conn.execute(text("""
                ALTER TABLE characters
                ADD COLUMN backstory_en TEXT
            """))

        if "opening_line_en" not in columns:
            print("Adding opening_line_en column...")
            conn.execute(text("""
                ALTER TABLE characters
                ADD COLUMN opening_line_en TEXT
            """))

        if "default_state_json_en" not in columns:
            print("Adding default_state_json_en column...")
            conn.execute(text("""
                ALTER TABLE characters
                ADD COLUMN default_state_json_en TEXT
            """))

    print("✓ Migration completed successfully")
    print("\nNext steps:")
    print("1. Update models.py to include new fields")
    print("2. Use translation_service.py to auto-translate existing characters")
    print("3. Update API routes to return language-specific content")


if __name__ == "__main__":
    run_migration()
