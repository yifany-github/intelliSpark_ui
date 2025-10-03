"""
Migration: Add avatar_url and age fields to users table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, Column, String, Integer, inspect, text
from config import settings
from models import Base

def upgrade():
    """Add avatar_url and age columns to users table"""
    engine = create_engine(settings.database_url, echo=True)

    with engine.connect() as conn:
        # Check if columns already exist
        inspector = inspect(engine)
        existing_columns = [col['name'] for col in inspector.get_columns('users')]

        # Add avatar_url column if it doesn't exist
        if 'avatar_url' not in existing_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)"))
            print("✓ Added avatar_url column to users table")
        else:
            print("✓ avatar_url column already exists")

        # Add age column if it doesn't exist
        if 'age' not in existing_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN age INTEGER"))
            print("✓ Added age column to users table")
        else:
            print("✓ age column already exists")

        conn.commit()

if __name__ == "__main__":
    print("Starting migration: Add avatar_url and age to users table")
    upgrade()
    print("Migration completed successfully!")
