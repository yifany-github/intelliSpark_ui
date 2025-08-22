#!/usr/bin/env python3
"""
Migrate all character descriptions to match their persona prompt structure
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from database import SessionLocal
from models import Character
from utils.character_utils import get_character_description_from_persona


def migrate_all_character_descriptions():
    """Update all character descriptions from persona prompts"""
    db = SessionLocal()
    
    try:
        characters = db.query(Character).all()
        
        print(f"Migrating descriptions for {len(characters)} characters...")
        print("=" * 60)
        
        updated_characters = []
        
        # Process all characters first, collecting updates
        for character in characters:
            print(f"\nCharacter: {character.name}")
            print(f"  Current description: {character.description or 'None'}")
            
            # Get description from persona prompt structure
            new_description = get_character_description_from_persona(character.name)
            
            if new_description:
                print(f"  New description: {new_description[:100]}...")
                print(f"  Extracted from persona prompt structure")
                
                # Update both description and backstory fields
                character.description = new_description
                character.backstory = new_description
                updated_characters.append(character.name)
                
                print(f"  ✅ Prepared for update")
            else:
                print(f"  ⚠️ No persona prompt found, keeping current description")
        
        # Single commit for all changes - transaction safety
        if updated_characters:
            db.commit()
            print(f"\n🎉 Successfully committed updates for: {', '.join(updated_characters)}")
        else:
            print(f"\n📝 No characters needed updates")
        
        print("\n" + "=" * 60)
        print("Migration completed! All character descriptions now match persona prompts.")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_all_character_descriptions()