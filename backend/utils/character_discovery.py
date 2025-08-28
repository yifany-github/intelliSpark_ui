"""
Character Discovery System for IntelliSpark AI Chat Application

This module provides automatic discovery of character files in the prompts/characters/
directory, eliminating the need for manual registry maintenance in gemini_service.py.

Features:
- Auto-discovery of .py character files
- CHARACTER_NAME extraction from files
- Module path mapping for dynamic imports
- Error handling for malformed character files
"""

import os
import re
import importlib.util
from pathlib import Path
from typing import Dict, Optional, List
import logging

logger = logging.getLogger(__name__)

def discover_character_files(characters_dir: Optional[str] = None) -> Dict[str, str]:
    """
    Scan prompts/characters/ directory for .py files and extract character names.
    
    Args:
        characters_dir: Custom directory path (defaults to backend/prompts/characters/)
        
    Returns:
        Dict mapping character names to module paths: {"character_name": "module_path"}
        
    Example:
        {"艾莉丝": "prompts.characters.艾莉丝", "小雪": "prompts.characters.小雪"}
    """
    if characters_dir is None:
        # Default to prompts/characters relative to this file's location
        current_file = Path(__file__).resolve()
        backend_dir = current_file.parent.parent  # Go up from utils/ to backend/
        characters_dir = backend_dir / "prompts" / "characters"
    else:
        characters_dir = Path(characters_dir)
    
    character_registry = {}
    
    if not characters_dir.exists():
        logger.warning(f"Characters directory not found: {characters_dir}")
        return character_registry
    
    logger.info(f"Scanning for character files in: {characters_dir}")
    
    # Find all .py files (excluding __init__.py)
    python_files = [f for f in characters_dir.glob("*.py") if f.name != "__init__.py"]
    
    for py_file in python_files:
        try:
            # Extract character name from file
            character_name = extract_character_name_from_file(py_file)
            
            if character_name:
                # Convert file path to module path (e.g., "艾莉丝.py" -> "prompts.characters.艾莉丝")
                module_path = f"prompts.characters.{py_file.stem}"
                character_registry[character_name] = module_path
                logger.debug(f"Discovered character: {character_name} -> {module_path}")
            else:
                logger.warning(f"Could not extract CHARACTER_NAME from {py_file.name}")
                
        except Exception as e:
            logger.error(f"Error processing character file {py_file.name}: {e}")
            continue
    
    logger.info(f"Auto-discovered {len(character_registry)} characters: {list(character_registry.keys())}")
    return character_registry

def extract_character_name_from_file(file_path: Path) -> Optional[str]:
    """
    Extract CHARACTER_NAME from a character .py file.
    
    Args:
        file_path: Path to the character .py file
        
    Returns:
        Character name string if found, None otherwise
        
    Example:
        For a file containing 'CHARACTER_NAME = "艾莉丝"', returns "艾莉丝"
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Look for CHARACTER_NAME = "value" or CHARACTER_NAME = 'value'
        # Handle various quote types and whitespace
        patterns = [
            r'^CHARACTER_NAME\s*=\s*["\']([^"\']+)["\']',  # Standard quotes
            r'^CHARACTER_NAME\s*=\s*"""([^"]+)"""',        # Triple quotes
            r'^CHARACTER_NAME\s*=\s*\'\'\'([^\']+)\'\'\'', # Triple single quotes
        ]
        
        for pattern in patterns:
            match = re.search(pattern, content, re.MULTILINE)
            if match:
                character_name = match.group(1).strip()
                logger.debug(f"Extracted CHARACTER_NAME '{character_name}' from {file_path.name}")
                return character_name
        
        # Alternative: try importing the module directly (more robust but slower)
        return extract_character_name_by_import(file_path)
        
    except Exception as e:
        logger.error(f"Error reading character file {file_path}: {e}")
        return None

def extract_character_name_by_import(file_path: Path) -> Optional[str]:
    """
    Extract CHARACTER_NAME by directly importing the module.
    
    This is a fallback method when regex parsing fails.
    More robust but slower than regex parsing.
    
    Args:
        file_path: Path to the character .py file
        
    Returns:
        Character name string if found, None otherwise
    """
    try:
        # Load module from file path
        spec = importlib.util.spec_from_file_location("temp_character_module", file_path)
        if spec is None or spec.loader is None:
            return None
            
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Extract CHARACTER_NAME attribute
        if hasattr(module, 'CHARACTER_NAME'):
            character_name = getattr(module, 'CHARACTER_NAME')
            if isinstance(character_name, str) and character_name.strip():
                logger.debug(f"Imported CHARACTER_NAME '{character_name}' from {file_path.name}")
                return character_name.strip()
        
        logger.warning(f"No valid CHARACTER_NAME found in {file_path.name}")
        return None
        
    except Exception as e:
        logger.error(f"Error importing character file {file_path}: {e}")
        return None

def validate_character_file(file_path: Path) -> Dict[str, any]:
    """
    Validate that a character file contains required attributes.
    
    Args:
        file_path: Path to the character .py file
        
    Returns:
        Dict with validation results:
        {
            "valid": bool,
            "character_name": str,
            "missing_attributes": List[str],
            "use_cache": bool,
            "use_few_shot": bool
        }
    """
    result = {
        "valid": False,
        "character_name": None,
        "missing_attributes": [],
        "use_cache": True,  # Default values
        "use_few_shot": True
    }
    
    try:
        # Import the module
        spec = importlib.util.spec_from_file_location("temp_character_module", file_path)
        if spec is None or spec.loader is None:
            result["missing_attributes"].append("Unable to load module")
            return result
            
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Check required attributes
        required_attrs = ["CHARACTER_NAME", "PERSONA_PROMPT"]
        for attr in required_attrs:
            if not hasattr(module, attr):
                result["missing_attributes"].append(attr)
        
        # Extract character name
        if hasattr(module, 'CHARACTER_NAME'):
            result["character_name"] = getattr(module, 'CHARACTER_NAME')
        
        # Extract control flags (with defaults)
        if hasattr(module, 'USE_CACHE'):
            result["use_cache"] = getattr(module, 'USE_CACHE')
        
        if hasattr(module, 'USE_FEW_SHOT'):
            result["use_few_shot"] = getattr(module, 'USE_FEW_SHOT')
        
        # File is valid if no required attributes are missing
        result["valid"] = len(result["missing_attributes"]) == 0
        
        return result
        
    except Exception as e:
        result["missing_attributes"].append(f"Import error: {e}")
        return result

def get_discovered_character_metadata(character_name: str) -> Dict[str, any]:
    """
    Get metadata for a discovered character by name.
    
    Args:
        character_name: Name of the character to get metadata for
        
    Returns:
        Dict with character metadata including control flags
    """
    try:
        # Find the character in the registry
        character_registry = discover_character_files()
        module_path = character_registry.get(character_name)
        
        if not module_path:
            logger.warning(f"Character '{character_name}' not found in auto-discovery registry")
            return {}
        
        # Import the module
        module = importlib.import_module(module_path)
        
        # Extract metadata
        metadata = {
            "character_name": getattr(module, 'CHARACTER_NAME', character_name),
            "use_cache": getattr(module, 'USE_CACHE', True),
            "use_few_shot": getattr(module, 'USE_FEW_SHOT', True),
            "character_gender": getattr(module, 'CHARACTER_GENDER', None),
            "character_nsfw_level": getattr(module, 'CHARACTER_NSFW_LEVEL', None),
            "character_category": getattr(module, 'CHARACTER_CATEGORY', None),
        }
        
        return metadata
        
    except Exception as e:
        logger.error(f"Error getting metadata for character '{character_name}': {e}")
        return {}