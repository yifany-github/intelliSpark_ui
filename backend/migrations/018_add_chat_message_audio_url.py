"""Migration: Add audio_url column to chat_messages table.

Run with: python migrations/018_add_chat_message_audio_url.py
"""

import os
import sys
from sqlalchemy import inspect, text

# Add parent directory to path to import database module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import sync_engine


def run_migration() -> None:
    """Add audio_url column to chat_messages table."""
    print("Starting migration: Add audio_url to chat_messages...")

    with sync_engine.begin() as conn:
        inspector = inspect(conn)
        columns = [col["name"] for col in inspector.get_columns("chat_messages")]

        if "audio_url" not in columns:
            print("Adding column: audio_url")
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN audio_url TEXT"))
        else:
            print("Column audio_url already exists, skipping")

    print("✅ Migration completed successfully!")


if __name__ == "__main__":
    run_migration()
