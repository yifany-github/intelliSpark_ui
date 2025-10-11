"""
Migration 011: Add Refresh Tokens Table

Introduces a persistent store for refresh tokens so we can rotate and revoke them per device.
The table stores a hashed version of each refresh token along with metadata.
"""

import os
from sqlalchemy import text, create_engine

DB_URL = os.environ.get("DATABASE_URL", "sqlite:///./roleplay_chat.db")
engine = create_engine(DB_URL)


CREATE_TABLE_SQLITE = """
CREATE TABLE IF NOT EXISTS user_refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    user_agent VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
"""

CREATE_TABLE_POSTGRES = """
CREATE TABLE IF NOT EXISTS user_refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    user_agent VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);
"""

INDEX_DEFINITIONS = [
    ("idx_user_refresh_tokens_user_id", "CREATE INDEX IF NOT EXISTS idx_user_refresh_tokens_user_id ON user_refresh_tokens(user_id)"),
    ("idx_user_refresh_tokens_token_hash", "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_refresh_tokens_token_hash ON user_refresh_tokens(token_hash)"),
    ("idx_user_refresh_tokens_expires_at", "CREATE INDEX IF NOT EXISTS idx_user_refresh_tokens_expires_at ON user_refresh_tokens(expires_at)")
]


def upgrade():
    """Create user_refresh_tokens table and supporting indexes."""
    dialect = engine.dialect.name

    table_sql = CREATE_TABLE_POSTGRES if dialect not in ("sqlite", "sqlite3") else CREATE_TABLE_SQLITE

    with engine.connect() as conn:
        try:
            conn.execute(text(table_sql))
            for index_name, index_sql in INDEX_DEFINITIONS:
                try:
                    conn.execute(text(index_sql))
                except Exception as exc:  # index may already exist
                    print(f"Index {index_name} skipped: {exc}")
            conn.commit()
            print("✅ Migration 011 completed successfully")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Error in migration 011: {exc}")
            raise


def downgrade():
    """Drop user_refresh_tokens table."""
    with engine.connect() as conn:
        try:
            conn.execute(text("DROP TABLE IF EXISTS user_refresh_tokens"))
            conn.commit()
            print("✅ Migration 011 downgrade completed")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Error in migration 011 downgrade: {exc}")
            raise


if __name__ == "__main__":
    upgrade()
