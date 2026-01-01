"""
Migration 007: Add soft delete fields to characters (Issue #162)

This migration adds the following soft delete fields to the characters table:
- is_deleted: BOOLEAN NOT NULL DEFAULT FALSE (indexed for performance)
- deleted_at: DATETIME NULL (timestamp when deleted)
- deleted_by: INTEGER NULL (foreign key to users.id - admin who deleted)
- delete_reason: TEXT NULL (optional reason for deletion)

This enables admin safeguards with soft delete functionality, allowing for character
restoration and impact tracking before permanent deletion.
"""

import os
from sqlalchemy import text, create_engine

# Create a lightweight engine without importing app settings to avoid env dependency during migrations
# Falls back to local SQLite DB used in development if DATABASE_URL is not set
DB_URL = os.environ.get("DATABASE_URL", "sqlite:///./roleplay_chat.db")
engine = create_engine(DB_URL)

def upgrade():
    """Add soft delete columns to characters table (idempotent)."""
    with engine.connect() as conn:
        try:
            # Add is_deleted column with index for performance
            try:
                conn.execute(text(
                    """
                    ALTER TABLE characters
                    ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE
                    """
                ))
                # Create index on is_deleted for query performance
                conn.execute(text(
                    """
                    CREATE INDEX IF NOT EXISTS idx_characters_is_deleted 
                    ON characters(is_deleted)
                    """
                ))
            except Exception as e:
                print(f"is_deleted column add skipped or already exists: {e}")

            # Add deleted_at timestamp column
            try:
                conn.execute(text(
                    """
                    ALTER TABLE characters
                    ADD COLUMN deleted_at DATETIME NULL
                    """
                ))
            except Exception as e:
                print(f"deleted_at column add skipped or already exists: {e}")

            # Add deleted_by foreign key column
            try:
                conn.execute(text(
                    """
                    ALTER TABLE characters
                    ADD COLUMN deleted_by INTEGER NULL
                    """
                ))
                # Note: SQLite doesn't support adding foreign key constraints via ALTER TABLE
                # The foreign key relationship is defined in the SQLAlchemy model
            except Exception as e:
                print(f"deleted_by column add skipped or already exists: {e}")

            # Add delete_reason text column
            try:
                conn.execute(text(
                    """
                    ALTER TABLE characters
                    ADD COLUMN delete_reason TEXT NULL
                    """
                ))
            except Exception as e:
                print(f"delete_reason column add skipped or already exists: {e}")

            conn.commit()
            print("✅ Successfully added soft delete columns to characters table (or they already existed)")
            print("   - is_deleted: BOOLEAN NOT NULL DEFAULT FALSE (indexed)")
            print("   - deleted_at: DATETIME NULL")
            print("   - deleted_by: INTEGER NULL (FK to users.id)")
            print("   - delete_reason: TEXT NULL")
        except Exception as e:
            conn.rollback()
            print(f"❌ Error adding soft delete columns: {e}")
            raise

def downgrade():
    """Remove soft delete columns (may be unsupported in SQLite)."""
    with engine.connect() as conn:
        try:
            # Note: SQLite cannot DROP COLUMN prior to v3.35.0; this may fail.
            try:
                conn.execute(text("DROP INDEX IF EXISTS idx_characters_is_deleted"))
            except Exception as e:
                print(f"Index drop skipped or not supported: {e}")

            try:
                conn.execute(text("ALTER TABLE characters DROP COLUMN is_deleted"))
            except Exception as e:
                print(f"is_deleted column drop skipped or not supported: {e}")

            try:
                conn.execute(text("ALTER TABLE characters DROP COLUMN deleted_at"))
            except Exception as e:
                print(f"deleted_at column drop skipped or not supported: {e}")

            try:
                conn.execute(text("ALTER TABLE characters DROP COLUMN deleted_by"))
            except Exception as e:
                print(f"deleted_by column drop skipped or not supported: {e}")

            try:
                conn.execute(text("ALTER TABLE characters DROP COLUMN delete_reason"))
            except Exception as e:
                print(f"delete_reason column drop skipped or not supported: {e}")

            conn.commit()
            print("✅ Successfully attempted removal of soft delete columns (if supported)")
        except Exception as e:
            conn.rollback()
            print(f"❌ Error removing soft delete columns: {e}")
            raise

if __name__ == "__main__":
    upgrade()
