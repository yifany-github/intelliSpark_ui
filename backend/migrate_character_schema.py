#!/usr/bin/env python3
"""
Migration script to update character schema with new fields
"""

import sqlite3
import os
from datetime import datetime

def migrate_character_schema():
    """Add new fields to the characters table"""
    
    # Database path
    db_path = os.path.join(os.path.dirname(__file__), 'roleplay_chat.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if the new columns already exist
        cursor.execute("PRAGMA table_info(characters)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # List of new columns to add
        new_columns = [
            ('description', 'TEXT'),
            ('category', 'VARCHAR(100)'),
            ('gender', 'VARCHAR(100)'),
            ('age', 'VARCHAR(100)'),
            ('occupation', 'VARCHAR(255)'),
            ('hobbies', 'JSON'),
            ('catchphrase', 'VARCHAR(500)'),
            ('conversation_style', 'VARCHAR(255)'),
            ('is_public', 'BOOLEAN DEFAULT 1'),
            ('nsfw_level', 'INTEGER DEFAULT 0'),
            ('created_by', 'INTEGER')
        ]
        
        # Add missing columns
        for column_name, column_type in new_columns:
            if column_name not in columns:
                print(f"Adding column: {column_name}")
                cursor.execute(f"ALTER TABLE characters ADD COLUMN {column_name} {column_type}")
        
        # Make avatar_url nullable if it's not already
        if 'avatar_url' in columns:
            # SQLite doesn't support ALTER COLUMN, so we'll just make sure it works
            print("avatar_url column already exists")
        
        # Update existing records to have default values for new fields
        cursor.execute("""
            UPDATE characters 
            SET 
                description = COALESCE(description, SUBSTR(backstory, 1, 200) || '...'),
                category = COALESCE(category, 'Original'),
                is_public = COALESCE(is_public, 1),
                nsfw_level = COALESCE(nsfw_level, 0),
                conversation_style = COALESCE(conversation_style, 'Detailed responses')
            WHERE description IS NULL OR category IS NULL OR is_public IS NULL OR nsfw_level IS NULL
        """)
        
        conn.commit()
        print("Character schema migration completed successfully!")
        
        # Show updated schema
        cursor.execute("PRAGMA table_info(characters)")
        columns = cursor.fetchall()
        print("\nUpdated character table schema:")
        for column in columns:
            print(f"  {column[1]} - {column[2]}")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_character_schema()