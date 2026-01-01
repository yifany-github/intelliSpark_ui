"""
Migration 008: Add Stripe customer ID column to users

Adds a nullable stripe_customer_id column to persist the Stripe Customer
reference for each user so we can reuse saved payment methods.
"""

import os
from sqlalchemy import text, create_engine

DB_URL = os.environ.get("DATABASE_URL", "sqlite:///./roleplay_chat.db")
engine = create_engine(DB_URL)

def upgrade():
    """Add stripe_customer_id column and supporting index."""
    dialect = engine.dialect.name

    with engine.connect() as conn:
        try:
            try:
                conn.execute(text(
                    """
                    ALTER TABLE users
                    ADD COLUMN stripe_customer_id VARCHAR(255)
                    """
                ))
            except Exception as exc:
                print(f"stripe_customer_id column add skipped or already exists: {exc}")

            try:
                if dialect == "postgresql":
                    conn.execute(text(
                        """
                        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id
                        ON users(stripe_customer_id)
                        WHERE stripe_customer_id IS NOT NULL
                        """
                    ))
                else:
                    conn.execute(text(
                        """
                        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id
                        ON users(stripe_customer_id)
                        """
                    ))
            except Exception as exc:
                print(f"stripe_customer_id index creation skipped: {exc}")

            conn.commit()
            print("✅ stripe_customer_id column (and index) ready on users table")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Error adding stripe_customer_id column: {exc}")
            raise


def downgrade():
    """Remove stripe_customer_id column and index."""
    with engine.connect() as conn:
        try:
            try:
                conn.execute(text("DROP INDEX IF EXISTS idx_users_stripe_customer_id"))
            except Exception as exc:
                print(f"Index drop skipped or not supported: {exc}")

            try:
                conn.execute(text("ALTER TABLE users DROP COLUMN stripe_customer_id"))
            except Exception as exc:
                print(f"stripe_customer_id column drop skipped or not supported: {exc}")

            conn.commit()
            print("✅ stripe_customer_id column removal attempted")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Error removing stripe_customer_id column: {exc}")
            raise


if __name__ == "__main__":
    upgrade()
