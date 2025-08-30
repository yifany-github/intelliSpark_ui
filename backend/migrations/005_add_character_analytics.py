"""
Migration 005: Add character analytics and admin management fields

This migration adds the following fields to the characters table:
- is_featured: Boolean flag for Editor's Choice selection
- view_count: Track character page views
- like_count: Track character likes/favorites
- chat_count: Track number of chat sessions created
- trending_score: Calculated trending score for dynamic sorting
- last_activity: Timestamp of last interaction

Run this migration to enable admin-controlled filtering and analytics tracking.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine

def upgrade():
    """Add character analytics and admin management fields"""
    with engine.connect() as conn:
        try:
            # Add new columns to characters table
            conn.execute(text("""
                ALTER TABLE characters 
                ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
            """))
            
            conn.execute(text("""
                ALTER TABLE characters 
                ADD COLUMN view_count INTEGER DEFAULT 0;
            """))
            
            conn.execute(text("""
                ALTER TABLE characters 
                ADD COLUMN like_count INTEGER DEFAULT 0;
            """))
            
            conn.execute(text("""
                ALTER TABLE characters 
                ADD COLUMN chat_count INTEGER DEFAULT 0;
            """))
            
            conn.execute(text("""
                ALTER TABLE characters 
                ADD COLUMN trending_score DECIMAL(10,2) DEFAULT 0.0;
            """))
            
            conn.execute(text("""
                ALTER TABLE characters 
                ADD COLUMN last_activity TIMESTAMP;
            """))
            
            # Create indexes for performance
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_characters_is_featured 
                ON characters(is_featured);
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_characters_trending_score 
                ON characters(trending_score DESC);
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_characters_view_count 
                ON characters(view_count DESC);
            """))
            
            conn.commit()
            print("✅ Successfully added character analytics fields and indexes")
            
        except Exception as e:
            conn.rollback()
            print(f"❌ Error adding character analytics fields: {e}")
            raise

def downgrade():
    """Remove character analytics and admin management fields"""
    with engine.connect() as conn:
        try:
            # Remove indexes
            conn.execute(text("DROP INDEX IF EXISTS idx_characters_is_featured;"))
            conn.execute(text("DROP INDEX IF EXISTS idx_characters_trending_score;"))
            conn.execute(text("DROP INDEX IF EXISTS idx_characters_view_count;"))
            
            # Remove columns
            conn.execute(text("ALTER TABLE characters DROP COLUMN is_featured;"))
            conn.execute(text("ALTER TABLE characters DROP COLUMN view_count;"))
            conn.execute(text("ALTER TABLE characters DROP COLUMN like_count;"))
            conn.execute(text("ALTER TABLE characters DROP COLUMN chat_count;"))
            conn.execute(text("ALTER TABLE characters DROP COLUMN trending_score;"))
            conn.execute(text("ALTER TABLE characters DROP COLUMN last_activity;"))
            
            conn.commit()
            print("✅ Successfully removed character analytics fields")
            
        except Exception as e:
            conn.rollback()
            print(f"❌ Error removing character analytics fields: {e}")
            raise

if __name__ == "__main__":
    upgrade()