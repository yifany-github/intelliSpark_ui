"""
Database Migration: Add Character Gallery Support
Migration ID: 004
Description: Add gallery support to Character model and create CharacterGalleryImage table

This migration:
1. Adds gallery-related fields to the characters table
2. Creates character_gallery_images table for multi-image management
3. Maintains backward compatibility with existing avatar_url field
"""

import logging
import sys
import os
from pathlib import Path

# Add parent directory to path for imports
parent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(parent_dir))

from sqlalchemy import text
from database import sync_engine as engine

logger = logging.getLogger(__name__)

def run_migration():
    """Execute the character gallery migration"""
    
    try:
        with engine.connect() as conn:
            # Start transaction
            trans = conn.begin()
            
            try:
                logger.info("🖼️ Starting Character Gallery migration...")
                
                # 1. Add gallery fields to characters table
                logger.info("📝 Adding gallery fields to characters table...")
                
                conn.execute(text("""
                    ALTER TABLE characters 
                    ADD COLUMN gallery_enabled BOOLEAN DEFAULT FALSE
                """))
                
                conn.execute(text("""
                    ALTER TABLE characters 
                    ADD COLUMN gallery_primary_image VARCHAR(500) NULL
                """))
                
                conn.execute(text("""
                    ALTER TABLE characters 
                    ADD COLUMN gallery_images_count INTEGER DEFAULT 0
                """))
                
                conn.execute(text("""
                    ALTER TABLE characters 
                    ADD COLUMN gallery_updated_at DATETIME NULL
                """))
                
                logger.info("✅ Successfully added gallery fields to characters table")
                
                # 2. Create character_gallery_images table
                logger.info("📝 Creating character_gallery_images table...")
                
                conn.execute(text("""
                    CREATE TABLE character_gallery_images (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        character_id INTEGER NOT NULL,
                        image_url VARCHAR(500) NOT NULL,
                        thumbnail_url VARCHAR(500) NULL,
                        alt_text VARCHAR(200) NULL,
                        category VARCHAR(50) DEFAULT 'general',
                        display_order INTEGER DEFAULT 0,
                        is_primary BOOLEAN DEFAULT FALSE,
                        file_size INTEGER NULL,
                        dimensions VARCHAR(20) NULL,
                        file_format VARCHAR(10) NULL,
                        is_active BOOLEAN DEFAULT TRUE,
                        uploaded_by INTEGER NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
                        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
                    )
                """))
                
                # Create indexes for better performance
                conn.execute(text("""
                    CREATE INDEX idx_character_gallery_images_character_id 
                    ON character_gallery_images(character_id)
                """))
                
                conn.execute(text("""
                    CREATE INDEX idx_character_gallery_images_display_order 
                    ON character_gallery_images(display_order)
                """))
                
                conn.execute(text("""
                    CREATE INDEX idx_character_gallery_images_is_primary 
                    ON character_gallery_images(is_primary)
                """))
                
                conn.execute(text("""
                    CREATE INDEX idx_character_gallery_images_is_active 
                    ON character_gallery_images(is_active)
                """))
                
                logger.info("✅ Successfully created character_gallery_images table with indexes")
                
                # 3. Migrate existing avatar_url to gallery system (optional)
                logger.info("📝 Checking for existing character images to migrate...")
                
                result = conn.execute(text("""
                    SELECT id, name, avatar_url 
                    FROM characters 
                    WHERE avatar_url IS NOT NULL AND avatar_url != ''
                """))
                
                existing_characters = result.fetchall()
                migrated_count = 0
                
                for character in existing_characters:
                    char_id, char_name, avatar_url = character
                    
                    # Create gallery image record for existing avatar
                    conn.execute(text("""
                        INSERT INTO character_gallery_images 
                        (character_id, image_url, alt_text, category, display_order, is_primary, is_active)
                        VALUES (:char_id, :avatar_url, :alt_text, 'portrait', 0, TRUE, TRUE)
                    """), {
                        'char_id': char_id,
                        'avatar_url': avatar_url,
                        'alt_text': f'{char_name} character image'
                    })
                    
                    # Update character gallery settings
                    conn.execute(text("""
                        UPDATE characters 
                        SET gallery_enabled = TRUE,
                            gallery_primary_image = :avatar_url,
                            gallery_images_count = 1,
                            gallery_updated_at = CURRENT_TIMESTAMP
                        WHERE id = :char_id
                    """), {
                        'char_id': char_id,
                        'avatar_url': avatar_url
                    })
                    
                    migrated_count += 1
                    logger.info(f"🔄 Migrated character '{char_name}' (ID: {char_id}) to gallery system")
                
                logger.info(f"✅ Successfully migrated {migrated_count} existing character images to gallery system")
                
                # Commit transaction
                trans.commit()
                logger.info("🎉 Character Gallery migration completed successfully!")
                
                return True
                
            except Exception as e:
                # Rollback on error
                trans.rollback()
                logger.error(f"❌ Error during migration: {e}")
                raise
                
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        return False

def verify_migration():
    """Verify that the migration was applied correctly"""
    
    try:
        with engine.connect() as conn:
            # Check if gallery fields exist in characters table
            result = conn.execute(text("""
                PRAGMA table_info(characters)
            """))
            
            columns = [row[1] for row in result.fetchall()]  # row[1] is column name
            
            required_columns = [
                'gallery_enabled', 
                'gallery_primary_image', 
                'gallery_images_count', 
                'gallery_updated_at'
            ]
            
            for col in required_columns:
                if col not in columns:
                    logger.error(f"❌ Missing column: {col}")
                    return False
            
            # Check if character_gallery_images table exists
            result = conn.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='character_gallery_images'
            """))
            
            if not result.fetchone():
                logger.error("❌ character_gallery_images table not found")
                return False
            
            # Check gallery images count
            result = conn.execute(text("""
                SELECT COUNT(*) FROM character_gallery_images
            """))
            
            gallery_count = result.fetchone()[0]
            logger.info(f"✅ Migration verification passed. Gallery images: {gallery_count}")
            
            return True
            
    except Exception as e:
        logger.error(f"❌ Migration verification failed: {e}")
        return False

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger.info("🚀 Running Character Gallery migration...")
    
    if run_migration():
        logger.info("✅ Migration completed successfully")
        
        if verify_migration():
            logger.info("✅ Migration verification passed")
        else:
            logger.error("❌ Migration verification failed")
    else:
        logger.error("❌ Migration failed")