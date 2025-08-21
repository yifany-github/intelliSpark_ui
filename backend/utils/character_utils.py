"""
Utility functions for character data handling and transformation
"""
from models import Character
from typing import Dict, Any, Optional, List


def ensure_avatar_url(character: Character) -> str:
    """
    Backend ensures every character has valid avatar URL - no frontend fallbacks needed.
    Centralizes image logic to prevent external dependencies in frontend.
    """
    # Check if avatar_url exists and is not None/empty
    if character.avatar_url and isinstance(character.avatar_url, str) and character.avatar_url.strip():
        if character.avatar_url.startswith('/assets'):
            # Local asset URL - return as-is
            return character.avatar_url
        elif character.avatar_url.startswith('http'):
            # External URL (legacy) - still return, but these will be migrated
            return character.avatar_url
    
    # No avatar set, None, empty string, or invalid - return local placeholder
    return "/assets/characters_img/Elara.jpeg"


def transform_character_to_response(character: Character) -> Dict[str, Any]:
    """
    Transform a database Character model to frontend-compatible response format.
    Handles snake_case to camelCase conversion consistently across all endpoints.
    """
    return {
        "id": character.id,
        "name": character.name,
        "description": character.description,
        "avatarUrl": ensure_avatar_url(character),  # Always guaranteed valid URL
        "backstory": character.backstory,
        "voiceStyle": character.voice_style,  # snake_case to camelCase
        "traits": character.traits,
        "category": character.category,
        "gender": character.gender,
        "conversationStyle": character.conversation_style,  # snake_case to camelCase
        "isPublic": character.is_public,  # snake_case to camelCase
        "createdBy": character.created_by,  # snake_case to camelCase
        "createdAt": character.created_at.isoformat() + "Z" if character.created_at else None  # ISO format
    }


def transform_character_list_to_response(characters: list[Character]) -> list[Dict[str, Any]]:
    """
    Transform a list of Character models to frontend-compatible response format.
    """
    return [transform_character_to_response(character) for character in characters]


# CSV Archetype-based trait extraction functions (Issue #112)

def get_character_traits_from_archetype_weights(character_name: str) -> List[str]:
    """
    Extract character traits from CSV archetype sampling configuration
    
    Args:
        character_name: Name matching .py file in prompts/characters/
        
    Returns:
        List of cleaned archetype names based on sampling weights
    """
    try:
        archetype_weights = load_character_archetype_weights(character_name)
        
        if not archetype_weights:
            return []
        
        # Extract traits from weights (minimum 5% weight to be included)
        traits = []
        for archetype_name, weight in archetype_weights.items():
            if weight >= 0.05:  # Only include significant archetypes
                clean_trait = clean_archetype_name(archetype_name)
                traits.append((clean_trait, weight))
        
        # Sort by weight (primary archetype first)
        traits.sort(key=lambda x: x[1], reverse=True)
        
        return [trait for trait, _ in traits]
        
    except Exception as e:
        print(f"Error extracting traits for {character_name}: {e}")
        return []


def clean_archetype_name(archetype_name: str) -> str:
    """
    Clean archetype names for display
    
    Examples:
        "娇羞敏感者" → "娇羞敏感" (remove redundant suffix)
        "魅惑撩人者" → "魅惑撩人" 
        "俏皮叛逆者" → "俏皮叛逆"
        "大胆主导者" → "大胆主导"
    """
    suffixes_to_remove = ["者", "人", "型"]
    
    for suffix in suffixes_to_remove:
        if archetype_name.endswith(suffix) and len(archetype_name) > 2:
            return archetype_name[:-1]
    
    return archetype_name


def load_character_archetype_weights(character_name: str) -> Dict[str, float]:
    """Load ARCHETYPE_WEIGHTS from character prompt file"""
    import importlib.util
    from pathlib import Path
    
    try:
        char_file = Path(__file__).parent.parent / "prompts" / "characters" / f"{character_name}.py"
        
        if not char_file.exists():
            return {}
        
        spec = importlib.util.spec_from_file_location("char_module", char_file)
        char_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(char_module)
        
        return getattr(char_module, 'ARCHETYPE_WEIGHTS', {})
        
    except Exception as e:
        print(f"Error loading archetype weights for {character_name}: {e}")
        return {}