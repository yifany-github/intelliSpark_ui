"""
Utility functions for character data handling and transformation
"""
from models import Character
from typing import Dict, Any, Optional


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
        "nsfwLevel": character.nsfw_level,  # snake_case to camelCase
        "createdBy": character.created_by,  # snake_case to camelCase
        "createdAt": character.created_at.isoformat() + "Z" if character.created_at else None  # ISO format
    }


def transform_character_list_to_response(characters: list[Character]) -> list[Dict[str, Any]]:
    """
    Transform a list of Character models to frontend-compatible response format.
    """
    return [transform_character_to_response(character) for character in characters]