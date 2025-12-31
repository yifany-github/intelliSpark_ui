"""Migration to clear old state formats and force regeneration with quantified values."""

import sys
import os
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from config import Settings

# Get database URL from config
settings = Settings()
DATABASE_URL = settings.database_url


def _column_nullable(engine, table: str, column: str) -> Optional[bool]:
    inspector = inspect(engine)
    if not inspector.has_table(table):
        print(f"⚠️  Table {table} not found; skipping")
        return None
    for col in inspector.get_columns(table):
        if col["name"] == column:
            return col.get("nullable", True)
    print(f"⚠️  Column {table}.{column} not found; skipping")
    return None


def _clear_column(session, engine, table: str, column: str) -> int:
    nullable = _column_nullable(engine, table, column)
    if nullable is None:
        return 0
    if nullable:
        stmt = f"UPDATE {table} SET {column} = NULL WHERE {column} IS NOT NULL"
    else:
        stmt = f"UPDATE {table} SET {column} = '' WHERE {column} <> ''"
    result = session.execute(text(stmt))
    return result.rowcount

def migrate():
    """Clear default_state_json from all characters to force regeneration with quantified format."""
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Clear default_state_json from all characters
        cleared_characters = _clear_column(session, engine, "characters", "default_state_json")
        print(f"✓ Cleared default_state_json from {cleared_characters} characters")

        # Clear all existing chat states to force regeneration
        cleared_chat_states = _clear_column(session, engine, "character_chat_states", "state_json")
        print(f"✓ Cleared state_json from {cleared_chat_states} chat states")

        session.commit()
        print("\n✅ Migration completed successfully!")
        print("   - All characters will regenerate their default states with quantified format")
        print("   - All existing chats will use new quantified states on next message")

    except Exception as e:
        session.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Migration 015: Update to Quantified State Format")
    print("=" * 60)
    print("\nThis migration will:")
    print("  1. Clear cached default states from all characters")
    print("  2. Clear existing chat states")
    print("  3. Force regeneration with new quantified format")
    print("\n⚠️  Warning: This will reset all character and chat states")

    response = input("\nProceed with migration? (yes/no): ").strip().lower()

    if response == "yes":
        migrate()
    else:
        print("\n❌ Migration cancelled")
