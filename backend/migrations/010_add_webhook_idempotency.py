"""
Migration 010: Add Webhook Idempotency Support

Adds stripe_event_id to token_transactions to prevent duplicate webhook processing.
This prevents race conditions where Stripe sends the same webhook twice.
"""

import os
from sqlalchemy import text, create_engine

DB_URL = os.environ.get("DATABASE_URL", "sqlite:///./roleplay_chat.db")
engine = create_engine(DB_URL)

def upgrade():
    """Add stripe_event_id column for webhook idempotency."""
    dialect = engine.dialect.name

    with engine.connect() as conn:
        try:
            # Add stripe_event_id column to token_transactions
            try:
                conn.execute(text(
                    """
                    ALTER TABLE token_transactions
                    ADD COLUMN stripe_event_id VARCHAR(255)
                    """
                ))
                print("✅ stripe_event_id column added to token_transactions")
            except Exception as exc:
                print(f"stripe_event_id column add skipped or already exists: {exc}")

            # Add unique index on stripe_event_id for fast duplicate checking
            try:
                if dialect == "sqlite":
                    conn.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS idx_token_transactions_stripe_event_id ON token_transactions(stripe_event_id)"
                    ))
                else:
                    # PostgreSQL
                    conn.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS idx_token_transactions_stripe_event_id ON token_transactions(stripe_event_id) WHERE stripe_event_id IS NOT NULL"
                    ))
                print("✅ Unique index created on stripe_event_id")
            except Exception as exc:
                print(f"stripe_event_id index creation skipped: {exc}")

            conn.commit()
            print("✅ Migration 010 completed successfully")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Error in migration 010: {exc}")
            raise


def downgrade():
    """Remove stripe_event_id column and index."""
    dialect = engine.dialect.name

    with engine.connect() as conn:
        try:
            # Drop index
            try:
                conn.execute(text("DROP INDEX IF EXISTS idx_token_transactions_stripe_event_id"))
                print("✅ Dropped stripe_event_id index")
            except Exception as exc:
                print(f"Index drop skipped: {exc}")

            # Drop column
            try:
                if dialect == "sqlite":
                    print("SQLite downgrade requires manual table recreation")
                else:
                    conn.execute(text("ALTER TABLE token_transactions DROP COLUMN IF EXISTS stripe_event_id"))
                    print("✅ Dropped stripe_event_id column")
            except Exception as exc:
                print(f"Column drop skipped: {exc}")

            conn.commit()
            print("✅ Migration 010 downgrade completed")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Error in migration 010 downgrade: {exc}")
            raise


if __name__ == "__main__":
    upgrade()
