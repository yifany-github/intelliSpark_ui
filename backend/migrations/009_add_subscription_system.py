"""
Migration 009: Add Premium Subscription System

Creates the premium_subscriptions table and adds token expiration fields
to support monthly subscription model with 2-month token carry-over.
"""

import os
from sqlalchemy import text, create_engine

DB_URL = os.environ.get("DATABASE_URL", "sqlite:///./backend/roleplay_chat.db")
engine = create_engine(DB_URL)

def upgrade():
    """Add premium_subscriptions table and token expiration fields."""
    dialect = engine.dialect.name

    with engine.connect() as conn:
        try:
            # Create premium_subscriptions table
            try:
                conn.execute(text(
                    """
                    CREATE TABLE IF NOT EXISTS premium_subscriptions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
                        stripe_customer_id VARCHAR(255) NOT NULL,
                        plan_tier VARCHAR(50) NOT NULL,
                        status VARCHAR(50) NOT NULL,
                        current_period_start DATETIME NOT NULL,
                        current_period_end DATETIME NOT NULL,
                        cancel_at_period_end BOOLEAN DEFAULT 0,
                        monthly_token_allowance INTEGER DEFAULT 200,
                        tokens_allocated_this_period INTEGER DEFAULT 0,
                        last_token_allocation_date DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                    """ if dialect == "sqlite" else
                    """
                    CREATE TABLE IF NOT EXISTS premium_subscriptions (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
                        stripe_customer_id VARCHAR(255) NOT NULL,
                        plan_tier VARCHAR(50) NOT NULL,
                        status VARCHAR(50) NOT NULL,
                        current_period_start TIMESTAMP NOT NULL,
                        current_period_end TIMESTAMP NOT NULL,
                        cancel_at_period_end BOOLEAN DEFAULT FALSE,
                        monthly_token_allowance INTEGER DEFAULT 200,
                        tokens_allocated_this_period INTEGER DEFAULT 0,
                        last_token_allocation_date TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                    """
                ))
                print("✅ premium_subscriptions table created")
            except Exception as exc:
                print(f"premium_subscriptions table creation skipped or already exists: {exc}")

            # Add indexes for premium_subscriptions
            try:
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_user_id ON premium_subscriptions(user_id)"
                ))
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_status ON premium_subscriptions(status)"
                ))
                print("✅ premium_subscriptions indexes created")
            except Exception as exc:
                print(f"premium_subscriptions indexes creation skipped: {exc}")

            # Add expires_at column to token_transactions
            try:
                conn.execute(text(
                    """
                    ALTER TABLE token_transactions
                    ADD COLUMN expires_at DATETIME
                    """ if dialect == "sqlite" else
                    """
                    ALTER TABLE token_transactions
                    ADD COLUMN expires_at TIMESTAMP
                    """
                ))
                print("✅ expires_at column added to token_transactions")
            except Exception as exc:
                print(f"expires_at column add skipped or already exists: {exc}")

            # Add subscription_id column to token_transactions
            try:
                conn.execute(text(
                    """
                    ALTER TABLE token_transactions
                    ADD COLUMN subscription_id INTEGER
                    """
                ))
                print("✅ subscription_id column added to token_transactions")
            except Exception as exc:
                print(f"subscription_id column add skipped or already exists: {exc}")

            # Add is_premium_member flag to users table for quick lookup
            try:
                conn.execute(text(
                    """
                    ALTER TABLE users
                    ADD COLUMN is_premium_member BOOLEAN DEFAULT 0
                    """ if dialect == "sqlite" else
                    """
                    ALTER TABLE users
                    ADD COLUMN is_premium_member BOOLEAN DEFAULT FALSE
                    """
                ))
                print("✅ is_premium_member column added to users")
            except Exception as exc:
                print(f"is_premium_member column add skipped or already exists: {exc}")

            # Add index on expires_at for efficient cleanup queries
            try:
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS idx_token_transactions_expires_at ON token_transactions(expires_at)"
                ))
                print("✅ expires_at index created on token_transactions")
            except Exception as exc:
                print(f"expires_at index creation skipped: {exc}")

            conn.commit()
            print("✅ Migration 009 completed successfully")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Error in migration 009: {exc}")
            raise


def downgrade():
    """Remove premium subscription system."""
    dialect = engine.dialect.name

    with engine.connect() as conn:
        try:
            # Drop indexes
            try:
                conn.execute(text("DROP INDEX IF EXISTS idx_token_transactions_expires_at"))
                conn.execute(text("DROP INDEX IF EXISTS idx_premium_subscriptions_status"))
                conn.execute(text("DROP INDEX IF EXISTS idx_premium_subscriptions_user_id"))
            except Exception as exc:
                print(f"Index drops skipped: {exc}")

            # Drop columns
            try:
                if dialect == "sqlite":
                    # SQLite doesn't support DROP COLUMN easily, so we'd need to recreate the table
                    print("SQLite downgrade requires manual table recreation")
                else:
                    conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS is_premium_member"))
                    conn.execute(text("ALTER TABLE token_transactions DROP COLUMN IF EXISTS subscription_id"))
                    conn.execute(text("ALTER TABLE token_transactions DROP COLUMN IF EXISTS expires_at"))
            except Exception as exc:
                print(f"Column drops skipped: {exc}")

            # Drop table
            try:
                conn.execute(text("DROP TABLE IF EXISTS premium_subscriptions"))
            except Exception as exc:
                print(f"Table drop skipped: {exc}")

            conn.commit()
            print("✅ Migration 009 downgrade completed")
        except Exception as exc:
            conn.rollback()
            print(f"❌ Error in migration 009 downgrade: {exc}")
            raise


if __name__ == "__main__":
    upgrade()
