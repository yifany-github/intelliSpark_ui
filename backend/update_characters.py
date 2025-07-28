#!/usr/bin/env python3
"""
Script to update backend characters with beautiful images to match frontend mockCharacters
"""

from database import SessionLocal
from models import Character
import json

def update_characters():
    """Update existing characters and add missing ones to match frontend mockCharacters"""
    
    db = SessionLocal()
    try:
        # Frontend mockCharacters data with beautiful images
        frontend_characters = [
            {
                "id": 1,
                "name": "艾莉丝",
                "avatarUrl": "/assets/characters_img/Elara.jpeg",  # Keep local image
                "description": "Ancient arcane practitioner with mystical powers",
                "backstory": "Elara is the last of an ancient line of arcane practitioners who once advised kings and queens throughout the realm. After centuries of extending her life through magical means, she has accumulated vast knowledge but has grown somewhat detached from humanity.",
                "voiceStyle": "Mystical, refined feminine voice",
                "traits": ["Wise", "Mysterious", "Powerful", "Ancient"],
                "personalityTraits": {"Warmth": 40, "Humor": 20, "Intelligence": 95, "Patience": 75},
                "category": "fantasy",
                "gender": "female",
                "age": "Ancient",
                "occupation": "Arcane Practitioner"
            },
            {
                "id": 2,
                "name": "Kravus",
                "avatarUrl": "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
                "description": "Battle-hardened warrior from the northern plains",
                "backstory": "A battle-hardened warrior from the northern plains, Kravus fights for honor and glory. His imposing presence and scarred visage tell of countless battles survived through sheer strength and determination.",
                "voiceStyle": "Deep, commanding masculine voice",
                "traits": ["Strong", "Honorable", "Warrior", "Brave"],
                "personalityTraits": {"Warmth": 30, "Humor": 45, "Intelligence": 65, "Patience": 25},
                "category": "fantasy",
                "gender": "male",
                "age": "35",
                "occupation": "Warrior"
            },
            {
                "id": 3,
                "name": "Lyra",
                "avatarUrl": "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
                "description": "Nimble rogue with a mysterious past",
                "backstory": "A nimble rogue with a mysterious past, Lyra uses her wit and cunning to survive in a world that has never shown her kindness. Despite her tough exterior, she harbors a soft spot for those who have been wronged.",
                "voiceStyle": "Sly, confident feminine voice",
                "traits": ["Cunning", "Agile", "Mysterious", "Witty"],
                "personalityTraits": {"Warmth": 50, "Humor": 75, "Intelligence": 85, "Patience": 40},
                "category": "fantasy",
                "gender": "female",
                "age": "28",
                "occupation": "Rogue"
            },
            {
                "id": 4,
                "name": "XN-7",
                "avatarUrl": "https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
                "description": "Advanced android with curiosity about human emotions",
                "backstory": "An advanced android with a curiosity about human emotions. XN-7 was designed to assist with complex calculations and data analysis, but has developed beyond its original programming and now seeks to understand what it means to be alive.",
                "voiceStyle": "Synthetic, precise voice with subtle emotional undertones",
                "traits": ["Logical", "Curious", "Analytical", "Evolving"],
                "personalityTraits": {"Warmth": 25, "Humor": 10, "Intelligence": 99, "Patience": 90},
                "category": "sciFi",
                "gender": "android",
                "age": "2 years",
                "occupation": "Data Analyst"
            },
            {
                "id": 5,
                "name": "Zara",
                "avatarUrl": "https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
                "description": "Skilled diplomat and negotiator from the eastern kingdoms",
                "backstory": "A skilled diplomat and negotiator from the eastern kingdoms, Zara believes in solving conflicts through words rather than weapons. Her charm and intelligence have prevented many wars.",
                "voiceStyle": "Diplomatic, eloquent feminine voice",
                "traits": ["Charismatic", "Intelligent", "Peaceful", "Diplomatic"],
                "personalityTraits": {"Warmth": 80, "Humor": 60, "Intelligence": 90, "Patience": 85},
                "category": "fantasy",
                "gender": "female",
                "age": "32",
                "occupation": "Diplomat"
            },
            {
                "id": 6,
                "name": "Marcus",
                "avatarUrl": "https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
                "description": "Former royal guard seeking redemption",
                "backstory": "A former royal guard who turned to adventure after losing his lord in a terrible battle. Marcus seeks redemption and purpose in helping others achieve their goals.",
                "voiceStyle": "Noble, honorable masculine voice",
                "traits": ["Loyal", "Protective", "Honorable", "Dedicated"],
                "personalityTraits": {"Warmth": 70, "Humor": 40, "Intelligence": 75, "Patience": 80},
                "category": "fantasy",
                "gender": "male",
                "age": "40",
                "occupation": "Former Royal Guard"
            }
        ]
        
        print("=== UPDATING BACKEND CHARACTERS ===")
        
        # Update existing characters and add missing ones
        for char_data in frontend_characters:
            char_id = char_data["id"]
            existing_char = db.query(Character).filter(Character.id == char_id).first()
            
            if existing_char:
                print(f"Updating character: {char_data['name']}")
                # Update existing character
                existing_char.name = char_data["name"]
                existing_char.description = char_data["description"]
                existing_char.avatar_url = char_data["avatarUrl"]
                existing_char.backstory = char_data["backstory"]
                existing_char.voice_style = char_data["voiceStyle"]
                existing_char.traits = char_data["traits"]
                existing_char.personality_traits = char_data["personalityTraits"]
                existing_char.category = char_data["category"]
                existing_char.gender = char_data["gender"]
                existing_char.age = char_data["age"]
                existing_char.occupation = char_data["occupation"]
                existing_char.is_public = True
                existing_char.nsfw_level = 0
                
            else:
                print(f"Adding new character: {char_data['name']}")
                # Create new character
                new_char = Character(
                    name=char_data["name"],
                    description=char_data["description"],
                    avatar_url=char_data["avatarUrl"],
                    backstory=char_data["backstory"],
                    voice_style=char_data["voiceStyle"],
                    traits=char_data["traits"],
                    personality_traits=char_data["personalityTraits"],
                    category=char_data["category"],
                    gender=char_data["gender"],
                    age=char_data["age"],
                    occupation=char_data["occupation"],
                    is_public=True,
                    nsfw_level=0
                )
                db.add(new_char)
        
        # Instead of removing, let's convert the extra character to match one of our target characters
        # We'll convert "快乐老家" to "Zara" since both will have ID 5
        extra_char = db.query(Character).filter(Character.name == "快乐老家").first()
        if extra_char:
            print(f"Converting extra character '{extra_char.name}' to 'Zara'")
            # Update it to match Zara's data
            zara_data = next(char for char in frontend_characters if char["name"] == "Zara")
            extra_char.name = zara_data["name"]
            extra_char.description = zara_data["description"]
            extra_char.avatar_url = zara_data["avatarUrl"]
            extra_char.backstory = zara_data["backstory"]
            extra_char.voice_style = zara_data["voiceStyle"]
            extra_char.traits = zara_data["traits"]
            extra_char.personality_traits = zara_data["personalityTraits"]
            extra_char.category = zara_data["category"]
            extra_char.gender = zara_data["gender"]
            extra_char.age = zara_data["age"]
            extra_char.occupation = zara_data["occupation"]
            extra_char.is_public = True
            extra_char.nsfw_level = 0
        
        # Commit all changes
        db.commit()
        print("✅ Successfully updated all characters!")
        
        # Verify the changes
        print("\n=== VERIFICATION ===")
        characters = db.query(Character).all()
        for char in characters:
            print(f"ID: {char.id} | Name: {char.name} | Avatar: {char.avatar_url}")
        
        print(f"\nTotal characters in database: {len(characters)}")
        
    except Exception as e:
        print(f"❌ Error updating characters: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    update_characters()