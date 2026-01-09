"""
Utility functions for character data handling and transformation
"""
from models import Character
from typing import Dict, Any, Optional, List
from config import settings
from backend.services.storage_manager import get_storage_manager, StorageManagerError
from utils.datetime_utils import format_datetime

# Constants for persona parsing
PERSONA_DESCRIPTION_PATTERN = r'你是([^#]+?)(?=\n\n|\n####|$)'
MAX_PERSONA_PROMPT_SIZE = 50000  # 50KB limit for security
MAX_CHARACTER_NAME_LENGTH = 100
MAX_METADATA_FILE_SIZE = 10000  # 10KB limit for metadata files

# In-memory cache for persona prompts to avoid file I/O on every request
_PERSONA_CACHE = {}


def resolve_asset_url(relative_path: str) -> str:
    """Convert /assets/ URL to Supabase public URL when storage is enabled."""
    if not relative_path or not relative_path.startswith('/assets/'):
        return relative_path

    storage_path = relative_path.replace('/assets/', '', 1)

    if settings.supabase_storage_enabled:
        try:
            storage = get_storage_manager()
            return storage.build_public_url(storage_path)
        except StorageManagerError:
            pass

    return relative_path


def ensure_avatar_url(character: Character) -> str:
    """
    Backend ensures every character has valid avatar URL - no frontend fallbacks needed.
    Centralizes image logic to prevent external dependencies in frontend.
    Priority: gallery_primary_image > avatar_url > fallback placeholder
    """
    # First priority: Gallery primary image (if gallery is enabled)
    if (hasattr(character, 'gallery_enabled') and character.gallery_enabled and 
        hasattr(character, 'gallery_primary_image') and character.gallery_primary_image):
        return resolve_asset_url(character.gallery_primary_image)
    
    # Second priority: Check if avatar_url exists and is not None/empty
    if character.avatar_url and isinstance(character.avatar_url, str) and character.avatar_url.strip():
        if character.avatar_url.startswith('/assets'):
            # Local asset URL - convert if using external storage
            return resolve_asset_url(character.avatar_url)
        elif character.avatar_url.startswith('http'):
            # External URL (legacy) - still return, but these will be migrated
            return character.avatar_url
    
    # No avatar set, None, empty string, or invalid - return local placeholder
    return resolve_asset_url("/assets/characters_img/Elara.jpeg")


def transform_character_to_response(character: Character, db_session=None) -> Dict[str, Any]:
    """
    Transform a database Character model to frontend-compatible response format.
    Handles snake_case to camelCase conversion consistently across all endpoints.

    Args:
        character: Character model to transform
        db_session: Optional database session to enrich with creator username
    """
    response = {
        "id": character.id,
        "name": character.name,
        "description": character.description,
        "avatarUrl": ensure_avatar_url(character),  # Always guaranteed valid URL
        "backstory": character.backstory,
        "personaPrompt": getattr(character, 'persona_prompt', None),
        "voiceStyle": character.voice_style,  # snake_case to camelCase
        "traits": character.traits,
        "category": character.category,
        "gender": character.gender,
        "age": character.age,
        "nsfwLevel": character.nsfw_level,
        "conversationStyle": character.conversation_style,  # snake_case to camelCase
        "isPublic": character.is_public,  # snake_case to camelCase
        "galleryEnabled": getattr(character, 'gallery_enabled', False),
        "createdBy": character.created_by,  # snake_case to camelCase
        "createdAt": format_datetime(character.created_at),  # ISO format
        # Soft delete fields for admin visibility
        "isDeleted": getattr(character, 'is_deleted', False),
        "deletedAt": format_datetime(getattr(character, 'deleted_at', None)),
        "deletedBy": getattr(character, 'deleted_by', None),
        "deleteReason": getattr(character, 'delete_reason', None),
        # Admin management and analytics fields
        "isFeatured": character.is_featured,
        "viewCount": character.view_count,
        "likeCount": character.like_count,
        "chatCount": character.chat_count,
        "trendingScore": float(character.trending_score) if character.trending_score else 0.0,
        "lastActivity": format_datetime(character.last_activity)
    }
    if getattr(character, "opening_line", None):
        response["openingLine"] = character.opening_line
    default_state_raw = getattr(character, "default_state_json", None)
    if default_state_raw:
        try:
            import json
            parsed = json.loads(default_state_raw) if isinstance(default_state_raw, str) else default_state_raw
            if isinstance(parsed, dict):
                response["defaultState"] = parsed
        except Exception:
            pass

    # Include multilingual fields for localization (English)
    if getattr(character, "name_en", None):
        response["name_en"] = character.name_en
    if getattr(character, "description_en", None):
        response["description_en"] = character.description_en
    if getattr(character, "backstory_en", None):
        response["backstory_en"] = character.backstory_en
    if getattr(character, "opening_line_en", None):
        response["opening_line_en"] = character.opening_line_en
    if getattr(character, "default_state_json_en", None):
        response["default_state_json_en"] = character.default_state_json_en

    # Include multilingual fields for localization (Chinese)
    if getattr(character, "name_zh", None):
        response["name_zh"] = character.name_zh
    if getattr(character, "description_zh", None):
        response["description_zh"] = character.description_zh
    if getattr(character, "backstory_zh", None):
        response["backstory_zh"] = character.backstory_zh
    if getattr(character, "opening_line_zh", None):
        response["opening_line_zh"] = character.opening_line_zh
    if getattr(character, "default_state_json_zh", None):
        response["default_state_json_zh"] = character.default_state_json_zh

    # Enrich with creator username if db_session provided and character has creator
    if db_session and character.created_by:
        from models import User
        creator = db_session.query(User).filter(User.id == character.created_by).first()
        if creator:
            response["createdByUsername"] = creator.username

    return response


def transform_character_list_to_response(characters: list[Character], db_session=None) -> list[Dict[str, Any]]:
    """
    Transform a list of Character models to frontend-compatible response format.

    Args:
        characters: List of Character models to transform
        db_session: Optional database session to enrich with creator usernames
    """
    return [transform_character_to_response(character, db_session) for character in characters]


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
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error extracting traits for {character_name}: {e}")
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
        if archetype_name.endswith(suffix) and len(archetype_name) > len(suffix):
            return archetype_name[:-len(suffix)]
    
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
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error loading archetype weights for {character_name}: {e}")
        return {}


# Persona description extraction functions (Issue #119)

def get_character_description_from_persona(character_name: str) -> str:
    """
    Get character description by parsing their persona prompt structure
    
    Args:
        character_name: Name of character (matches .py file in prompts/characters/)
        
    Returns:
        Extracted description from persona prompt
    """
    try:
        # Load character's persona prompt using existing infrastructure
        persona_prompt = load_character_persona_prompt(character_name)
        
        if not persona_prompt:
            return ""
        
        # Extract description using structural parsing
        description = extract_description_from_persona(persona_prompt)
        
        return description
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error extracting description for {character_name}: {e}")
        return ""


def extract_description_from_persona(persona_prompt: str) -> str:
    """
    Extract character description from structured persona prompt
    
    Parsing rules:
    1. Find paragraph starting with "你是" 
    2. Extract until first double newline "\n\n" or section header "####"
    3. Clean up whitespace
    
    Args:
        persona_prompt: The PERSONA_PROMPT string from character file
        
    Returns:
        Extracted description string
    """
    import re
    
    # Security: Prevent ReDoS by limiting input size
    if len(persona_prompt) > MAX_PERSONA_PROMPT_SIZE:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Persona prompt too large for parsing: {len(persona_prompt)} chars")
        return ""
    
    # Find the description paragraph after "你是"
    match = re.search(PERSONA_DESCRIPTION_PATTERN, persona_prompt, re.DOTALL)
    
    if match:
        description = match.group(1).strip()
        # Clean up any extra whitespace
        description = re.sub(r'\s+', ' ', description)
        return description
    
    return ""


def load_character_persona_prompt(character_name: str) -> str:
    """Load PERSONA_PROMPT from character prompt file with caching"""
    import importlib.util
    from pathlib import Path
    import re
    
    try:
        # Security: Validate character name to prevent path traversal and arbitrary file access
        if not re.match(r'^[a-zA-Z0-9_\u4e00-\u9fff]+$', character_name):
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Invalid character name format rejected: {repr(character_name)}")
            return ""
        
        # Additional security: Limit character name length to prevent DoS
        if len(character_name) > MAX_CHARACTER_NAME_LENGTH:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Character name too long rejected: {len(character_name)} chars")
            return ""
        
        # Check cache first to avoid file I/O
        if character_name in _PERSONA_CACHE:
            return _PERSONA_CACHE[character_name]
        
        char_file = Path(__file__).parent.parent / "prompts" / "characters" / f"{character_name}.py"
        
        if not char_file.exists():
            # Cache negative result to avoid repeated file system checks
            _PERSONA_CACHE[character_name] = ""
            return ""
        
        # Load the character module
        spec = importlib.util.spec_from_file_location("char_module", char_file)
        char_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(char_module)
        
        # Get persona prompt and cache it
        persona_prompt = getattr(char_module, 'PERSONA_PROMPT', "")
        _PERSONA_CACHE[character_name] = persona_prompt
        
        return persona_prompt
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error loading persona prompt for {character_name}: {e}")
        # Cache empty result to avoid repeated failures
        _PERSONA_CACHE[character_name] = ""
        return ""


# Character metadata sync functions

def get_character_gender_from_prompt(character_name: str) -> Optional[str]:
    """Get character gender from prompt file"""
    return _get_character_metadata_field(character_name, 'CHARACTER_GENDER')


def get_character_nsfw_level_from_prompt(character_name: str) -> Optional[int]:
    """Get character NSFW level from prompt file"""
    return _get_character_metadata_field(character_name, 'CHARACTER_NSFW_LEVEL')


def get_character_category_from_prompt(character_name: str) -> Optional[str]:
    """Get character category from prompt file"""
    return _get_character_metadata_field(character_name, 'CHARACTER_CATEGORY')


def _get_character_metadata_field(character_name: str, field_name: str):
    """Generic function to get metadata field from character prompt file"""
    import re
    import ast
    from pathlib import Path
    import logging
    
    # Security: Validate field name whitelist
    ALLOWED_FIELDS = {
        'CHARACTER_GENDER', 
        'CHARACTER_NSFW_LEVEL', 
        'CHARACTER_CATEGORY'
    }
    
    if field_name not in ALLOWED_FIELDS:
        return None
    
    try:
        # Security: Validate character name to prevent path traversal
        if not re.match(r'^[a-zA-Z0-9_\u4e00-\u9fff]+$', character_name):
            return None
        
        if len(character_name) > MAX_CHARACTER_NAME_LENGTH:
            return None
        
        char_file = Path(__file__).parent.parent / "prompts" / "characters" / f"{character_name}.py"
        
        if not char_file.exists():
            return None
        
        # Security: Check file size before reading to prevent memory issues
        if char_file.stat().st_size > MAX_METADATA_FILE_SIZE:
            logger = logging.getLogger(__name__)
            logger.warning(f"Character file {character_name} too large: {char_file.stat().st_size} bytes")
            return None
        
        # Security: Read file and parse constants only (no code execution)
        with open(char_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Parse the specific field using regex instead of exec
        pattern = rf'^{re.escape(field_name)}\s*=\s*(.+)$'
        match = re.search(pattern, content, re.MULTILINE)
        
        if match:
            try:
                # Safely evaluate basic Python literals only (no code execution)
                return ast.literal_eval(match.group(1).strip())
            except (ValueError, SyntaxError):
                return None
        
        return None
        
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error loading {field_name} for {character_name}: {e}")
        return None
