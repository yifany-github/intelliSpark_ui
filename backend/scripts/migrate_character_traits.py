#!/usr/bin/env python3
"""
Migrate all character traits to match CSV archetype sampling configuration

This script updates character traits in the database to reflect their actual
CSV archetype sampling weights, fixing the disconnect between displayed traits
and AI dialogue behavior.

Usage:
    cd backend
    python scripts/migrate_character_traits.py
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from database import SessionLocal
from models import Character
from utils.character_utils import get_character_traits_from_archetype_weights


def migrate_all_character_traits():
    """Update all character traits to match CSV archetype sampling"""
    db = SessionLocal()
    
    try:
        characters = db.query(Character).all()
        
        print(f"Migrating traits for {len(characters)} characters...")
        print("=" * 60)
        
        updated_count = 0
        
        for character in characters:
            print(f"\nCharacter: {character.name}")
            print(f"  Current traits: {character.traits}")
            
            # Get traits from CSV archetype sampling
            new_traits = get_character_traits_from_archetype_weights(character.name)
            
            if new_traits:
                print(f"  New traits: {new_traits}")
                print(f"  Based on archetype sampling weights from character config")
                
                # Update database
                character.traits = new_traits
                db.commit()
                
                print(f"  ✅ Updated successfully")
                updated_count += 1
            else:
                print(f"  ⚠️ No archetype weights found, keeping current traits")
        
        print("\n" + "=" * 60)
        print(f"✅ Migration completed! Updated {updated_count} characters.")
        print("All character traits now match CSV archetype sampling.")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def verify_migration():
    """Verify the migration results"""
    db = SessionLocal()
    
    try:
        characters = db.query(Character).all()
        
        print("\n" + "=" * 60)
        print("VERIFICATION: Current character traits after migration")
        print("=" * 60)
        
        for character in characters:
            print(f"{character.name}: {character.traits}")
            
            # Check if traits match archetype weights
            expected_traits = get_character_traits_from_archetype_weights(character.name)
            if expected_traits and character.traits == expected_traits:
                print(f"  ✅ Matches archetype sampling configuration")
            elif expected_traits:
                print(f"  ⚠️ Expected: {expected_traits}")
            else:
                print(f"  ℹ️ No archetype configuration found")
        
        print("\n✅ Verification completed!")
        
    finally:
        db.close()


if __name__ == "__main__":
    print("Character Traits Migration Script")
    print("Issue #112: Character Traits Should Map to CSV Archetype Sampling System")
    print("=" * 80)
    
    # Run migration
    migrate_all_character_traits()
    
    # Verify results
    verify_migration()
    
    print("\n🎯 Migration completed successfully!")
    print("Character traits now accurately reflect CSV archetype sampling behavior.")