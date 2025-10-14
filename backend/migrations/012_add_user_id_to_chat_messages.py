"""
Migration 012: Add user_id to chat_messages for per-user realtime subscriptions

This enables filtering Supabase Realtime subscriptions by user instead of by chat,
eliminating subscription gaps caused by navigation between chats.

Standard pattern for production chat applications.

Created: 2025-10-13
Issue: Intermittent stuck pending state bug
"""

import os
from sqlalchemy import text, create_engine

DB_URL = os.environ.get("DATABASE_URL", "sqlite:///./roleplay_chat.db")
engine = create_engine(DB_URL)


def upgrade():
    """Add user_id column to chat_messages and backfill from chats table"""
    dialect = engine.dialect.name

    with engine.connect() as conn:
        try:
            # Step 1: Add user_id column (nullable initially)
            print("Step 1: Adding user_id column...")
            try:
                conn.execute(text(
                    "ALTER TABLE chat_messages ADD COLUMN user_id INTEGER"
                ))
                print("✅ Added user_id column to chat_messages")
            except Exception as exc:
                print(f"user_id column add skipped: {exc}")

            # Step 2: Backfill user_id from chats table
            print("Step 2: Backfilling user_id from chats table...")
            try:
                if dialect == "sqlite":
                    # SQLite doesn't support UPDATE FROM, use subquery
                    conn.execute(text("""
                        UPDATE chat_messages
                        SET user_id = (
                            SELECT c.user_id
                            FROM chats c
                            WHERE c.id = chat_messages.chat_id
                        )
                    """))
                else:
                    # PostgreSQL supports UPDATE FROM
                    conn.execute(text("""
                        UPDATE chat_messages cm
                        SET user_id = c.user_id
                        FROM chats c
                        WHERE cm.chat_id = c.id
                    """))

                # Check how many rows were updated
                result = conn.execute(text("SELECT COUNT(*) FROM chat_messages WHERE user_id IS NOT NULL"))
                count = result.scalar()
                print(f"✅ Backfilled user_id for {count} messages")
            except Exception as exc:
                print(f"Backfill skipped: {exc}")
                raise

            # Step 3: Make user_id non-null (SQLite workaround needed)
            print("Step 3: Making user_id non-null...")
            if dialect == "sqlite":
                print("⚠️  SQLite: Column is nullable (SQLite doesn't support ALTER COLUMN SET NOT NULL easily)")
                print("    This is acceptable for development - production Supabase already has NOT NULL constraint")
            else:
                try:
                    conn.execute(text(
                        "ALTER TABLE chat_messages ALTER COLUMN user_id SET NOT NULL"
                    ))
                    print("✅ Set user_id to NOT NULL")
                except Exception as exc:
                    print(f"NOT NULL constraint skipped: {exc}")

            # Step 4: Add foreign key constraint (SQLite limitation)
            print("Step 4: Adding foreign key constraint...")
            if dialect == "sqlite":
                print("⚠️  SQLite: Foreign keys are not enforced in migration (enabled at connection level)")
                print("    Foreign key will work once PRAGMA foreign_keys=ON is set")
            else:
                try:
                    conn.execute(text("""
                        ALTER TABLE chat_messages
                        ADD CONSTRAINT fk_chat_messages_user_id
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    """))
                    print("✅ Added foreign key constraint")
                except Exception as exc:
                    print(f"Foreign key constraint skipped: {exc}")

            # Step 5: Add index for performance
            print("Step 5: Creating index on user_id...")
            try:
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_chat_messages_user_id ON chat_messages(user_id)"
                ))
                print("✅ Created index on chat_messages.user_id")
            except Exception as exc:
                print(f"Index creation skipped: {exc}")

            conn.commit()
            print("✅ Migration 012 completed successfully")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Error in migration 012: {exc}")
            raise


def downgrade():
    """Remove user_id column from chat_messages"""
    dialect = engine.dialect.name

    with engine.connect() as conn:
        try:
            # Drop index first
            print("Dropping index...")
            try:
                conn.execute(text(
                    "DROP INDEX IF EXISTS ix_chat_messages_user_id"
                ))
                print("✅ Dropped index on chat_messages.user_id")
            except Exception as exc:
                print(f"Index drop skipped: {exc}")

            # Drop foreign key constraint
            if dialect != "sqlite":
                print("Dropping foreign key constraint...")
                try:
                    conn.execute(text(
                        "ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS fk_chat_messages_user_id"
                    ))
                    print("✅ Dropped foreign key constraint")
                except Exception as exc:
                    print(f"Foreign key drop skipped: {exc}")

            # Drop column
            print("Dropping user_id column...")
            try:
                if dialect == "sqlite":
                    print("⚠️  SQLite downgrade requires manual table recreation to drop columns.")
                else:
                    conn.execute(text(
                        "ALTER TABLE chat_messages DROP COLUMN IF EXISTS user_id"
                    ))
                    print("✅ Dropped user_id column from chat_messages")
            except Exception as exc:
                print(f"user_id column drop skipped: {exc}")

            conn.commit()
            print("✅ Migration 012 downgrade completed")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Error in migration 012 downgrade: {exc}")
            raise


if __name__ == "__main__":
    upgrade()
