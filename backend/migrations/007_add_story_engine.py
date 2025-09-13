"""
Migration 007: Add story engine tables for sessions and events log
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine


def upgrade():
    with engine.connect() as conn:
        try:
            # story_sessions
            conn.execute(text(
                """
                CREATE TABLE IF NOT EXISTS story_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    pack_id VARCHAR(100) NOT NULL,
                    chapter_id VARCHAR(100),
                    scene_id VARCHAR(100) NOT NULL,
                    vars_json TEXT,
                    relationships_json TEXT,
                    nsfw_mode BOOLEAN DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            ))

            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_story_sessions_user ON story_sessions(user_id)"
            ))

            # story_events_log
            conn.execute(text(
                """
                CREATE TABLE IF NOT EXISTS story_events_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    event_key VARCHAR(100) NOT NULL,
                    payload_json TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            ))

            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_story_events_session ON story_events_log(session_id)"
            ))

            conn.commit()
            print("✅ Created story engine tables (story_sessions, story_events_log)")
        except Exception as e:
            conn.rollback()
            print(f"❌ Migration 007 failed: {e}")
            raise


def downgrade():
    with engine.connect() as conn:
        try:
            conn.execute(text("DROP TABLE IF EXISTS story_events_log"))
            conn.execute(text("DROP TABLE IF EXISTS story_sessions"))
            conn.commit()
            print("✅ Dropped story engine tables")
        except Exception as e:
            conn.rollback()
            print(f"❌ Downgrade failed: {e}")
            raise


if __name__ == "__main__":
    upgrade()

