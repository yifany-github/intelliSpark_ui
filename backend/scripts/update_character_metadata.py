#!/usr/bin/env python3
"""
Update character metadata (gender, NSFW level) in database

This script updates existing characters with proper gender and NSFW level
information for the prototype. Focus on 艾莉丝 as the main production character.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import Character

def update_character_metadata():
    """Update character metadata for prototype"""
    db = SessionLocal()
    
    try:
        # Character metadata updates
        character_updates = {
            "艾莉丝": {
                "gender": "female",
                "category": "adult",  # Mark as adult content
                "description": "A shy yet alluring flight attendant with a mysterious charm"
            },
            "Kravus": {
                "gender": "male", 
                "category": "fantasy"
            },
            "Lyra": {
                "gender": "female",
                "category": "fantasy"
            },
            "XN-7": {
                "gender": "other",  # Android - non-binary
                "category": "sci-fi"
            }
        }
        
        updated_count = 0
        
        for name, metadata in character_updates.items():
            character = db.query(Character).filter(Character.name == name).first()
            
            if character:
                # Update metadata
                for field, value in metadata.items():
                    setattr(character, field, value)
                
                print(f"✅ Updated {name}: {metadata}")
                updated_count += 1
            else:
                print(f"❌ Character not found: {name}")
        
        # Commit all changes
        db.commit()
        print(f"\n🎉 Successfully updated {updated_count} characters")
        
        # Verify updates
        print("\n📋 Current character metadata:")
        characters = db.query(Character).all()
        for char in characters:
            print(f"  {char.name}: gender={char.gender}, category={char.category}")
            
    except Exception as e:
        db.rollback()
        print(f"❌ Error updating characters: {e}")
        
    finally:
        db.close()

if __name__ == "__main__":
    print("🔧 Updating character metadata for prototype...")
    update_character_metadata()