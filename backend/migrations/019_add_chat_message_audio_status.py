"""Migration: Add audio_status and audio_error columns to chat_messages table.

Run with: python migrations/019_add_chat_message_audio_status.py
"""

import os
import sys
from sqlalchemy import inspect, text

# Add parent directory to path to import database module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import sync_engine


def run_migration() -> None:
    """Add audio_status and audio_error columns to chat_messages table."""
    print("Starting migration: Add audio_status/audio_error to chat_messages...")

    with sync_engine.begin() as conn:
        inspector = inspect(conn)
        columns = {col["name"] for col in inspector.get_columns("chat_messages")}

        if "audio_status" not in columns:
            print("Adding column: audio_status")
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN audio_status VARCHAR(32)"))
        else:
            print("Column audio_status already exists, skipping")

        if "audio_error" not in columns:
            print("Adding column: audio_error")
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN audio_error TEXT"))
        else:
            print("Column audio_error already exists, skipping")

    print("✅ Migration completed successfully!")


if __name__ == "__main__":
    run_migration()
