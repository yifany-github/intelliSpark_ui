"""Migration to clear old state formats and force regeneration with quantified values."""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from config import Settings

# Get database URL from config
settings = Settings()
DATABASE_URL = settings.database_url

def migrate():
    """Clear default_state_json from all characters to force regeneration with quantified format."""
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Clear default_state_json from all characters
        result = session.execute(
            text("UPDATE characters SET default_state_json = NULL WHERE default_state_json IS NOT NULL")
        )
        print(f"✓ Cleared default_state_json from {result.rowcount} characters")

        # Clear all existing chat states to force regeneration
        result = session.execute(
            text("UPDATE character_chat_states SET state_json = NULL WHERE state_json IS NOT NULL")
        )
        print(f"✓ Cleared state_json from {result.rowcount} chat states")

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
