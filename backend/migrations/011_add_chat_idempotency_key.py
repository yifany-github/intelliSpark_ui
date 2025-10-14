"""
Migration 011: Add chat idempotency support

Adds idempotency_key column to chats table and enforces uniqueness per user.
This allows the backend to safely ignore duplicate chat creation requests.
"""

import os
from sqlalchemy import text, create_engine

DB_URL = os.environ.get("DATABASE_URL", "sqlite:///./roleplay_chat.db")
engine = create_engine(DB_URL)


def upgrade():
    """Add idempotency_key column and unique constraint to chats."""
    dialect = engine.dialect.name

    with engine.connect() as conn:
        try:
            try:
                conn.execute(text(
                    "ALTER TABLE chats ADD COLUMN idempotency_key VARCHAR(64)"
                ))
                print("✅ Added idempotency_key column to chats")
            except Exception as exc:
                print(f"idempotency_key column add skipped: {exc}")

            try:
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_chats_idempotency_key ON chats(idempotency_key)"
                ))
                print("✅ Created index on chats.idempotency_key")
            except Exception as exc:
                print(f"idempotency_key index creation skipped: {exc}")

            try:
                if dialect == "sqlite":
                    conn.execute(text(
                        """
                        CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_user_idempotency
                        ON chats(user_id, idempotency_key)
                        WHERE idempotency_key IS NOT NULL
                        """
                    ))
                else:
                    conn.execute(text(
                        """
                        ALTER TABLE chats
                        ADD CONSTRAINT uq_chat_user_idempotency UNIQUE (user_id, idempotency_key)
                        """
                    ))
                print("✅ Enforced uniqueness of (user_id, idempotency_key)")
            except Exception as exc:
                print(f"idempotency unique constraint/index skipped: {exc}")

            conn.commit()
            print("✅ Migration 011 completed successfully")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Error in migration 011: {exc}")
            raise


def downgrade():
    """Remove idempotency support from chats."""
    dialect = engine.dialect.name

    with engine.connect() as conn:
        try:
            try:
                if dialect == "sqlite":
                    conn.execute(text(
                        "DROP INDEX IF EXISTS uq_chat_user_idempotency"
                    ))
                else:
                    conn.execute(text(
                        "ALTER TABLE chats DROP CONSTRAINT IF EXISTS uq_chat_user_idempotency"
                    ))
                print("✅ Removed UNIQUE constraint/index on (user_id, idempotency_key)")
            except Exception as exc:
                print(f"Unique constraint drop skipped: {exc}")

            try:
                conn.execute(text(
                    "DROP INDEX IF EXISTS ix_chats_idempotency_key"
                ))
                print("✅ Dropped index on chats.idempotency_key")
            except Exception as exc:
                print(f"Index drop skipped: {exc}")

            try:
                if dialect == "sqlite":
                    print("⚠️ SQLite downgrade requires manual table recreation to drop columns.")
                else:
                    conn.execute(text("ALTER TABLE chats DROP COLUMN IF EXISTS idempotency_key"))
                    print("✅ Dropped idempotency_key column from chats")
            except Exception as exc:
                print(f"idempotency_key column drop skipped: {exc}")

            conn.commit()
            print("✅ Migration 011 downgrade completed")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Error in migration 011 downgrade: {exc}")
            raise


if __name__ == "__main__":
    upgrade()
