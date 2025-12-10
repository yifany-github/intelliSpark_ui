"""Migration: Add Chinese language fields to characters table

This migration adds _zh fields to support bidirectional translation:
- Characters with Chinese as original language use _en fields for English
- Characters with English as original language use _zh fields for Chinese

Run with: python migrations/017_add_chinese_language_fields.py
"""

import sys
import os
from sqlalchemy import text

# Add parent directory to path to import database module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import sync_engine


def run_migration():
    """Add Chinese language fields to characters table"""
    print("Starting migration: Add Chinese language fields...")

    with sync_engine.begin() as conn:
        # Check if columns already exist
        result = conn.execute(text("PRAGMA table_info(characters)"))
        columns = [row[1] for row in result]

        fields_to_add = [
            ("name_zh", "VARCHAR(255)"),
            ("description_zh", "TEXT"),
            ("backstory_zh", "TEXT"),
            ("opening_line_zh", "TEXT"),
            ("default_state_json_zh", "TEXT"),
        ]

        for field_name, field_type in fields_to_add:
            if field_name not in columns:
                print(f"Adding column: {field_name}")
                conn.execute(text(f"ALTER TABLE characters ADD COLUMN {field_name} {field_type}"))
            else:
                print(f"Column {field_name} already exists, skipping")

    print("✅ Migration completed successfully!")
    print("\nChinese language fields added:")
    print("  - name_zh")
    print("  - description_zh")
    print("  - backstory_zh")
    print("  - opening_line_zh")
    print("  - default_state_json_zh")
    print("\nYou can now run the translation script to populate these fields:")
    print("  python scripts/translate_characters.py --all --target zh")


if __name__ == "__main__":
    run_migration()
