import os
import importlib.util
from typing import Dict, Optional
from models import Character, Scene
import logging

logger = logging.getLogger(__name__)

# Cache for loaded prompts to avoid repeated file system access
prompt_cache: Dict[str, Dict] = {}

async def load_character_prompt(character: Character) -> Dict[str, str]:
    """Load character-specific prompt"""
    cache_key = f"character_{character.name}"
    
    if cache_key in prompt_cache:
        return prompt_cache[cache_key]
    
    try:
        # Try to load character-specific prompt file
        character_file_name = f"{character.name.lower().replace(' ', '_')}.py"
        character_path = os.path.join(os.path.dirname(__file__), "prompts", "characters", character_file_name)
        
        # Also try with the exact name (for characters like 艾莉丝)
        alt_file_name = f"{character.name}.py"
        alt_path = os.path.join(os.path.dirname(__file__), "prompts", "characters", alt_file_name)
        
        prompt_data = None
        
        for file_path in [character_path, alt_path]:
            if os.path.exists(file_path):
                logger.info(f"Loading character prompt for {character.name} from {file_path}")
                spec = importlib.util.spec_from_file_location("character_prompt", file_path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                
                prompt_data = {
                    "persona_prompt": getattr(module, "PERSONA_PROMPT", ""),
                    "few_shot_prompt": getattr(module, "FEW_SHOT_EXAMPLES", "")
                }
                break
        
        if not prompt_data:
            logger.info(f"No custom prompt found for {character.name}, using default")
            prompt_data = _build_default_character_prompt(character)
        
        prompt_cache[cache_key] = prompt_data
        return prompt_data
        
    except Exception as e:
        logger.error(f"Error loading character prompt for {character.name}: {e}")
        prompt_data = _build_default_character_prompt(character)
        prompt_cache[cache_key] = prompt_data
        return prompt_data

async def load_scene_prompt(scene: Scene) -> Dict[str, str]:
    """Load scene-specific prompt"""
    cache_key = f"scene_{scene.name}"
    
    if cache_key in prompt_cache:
        return prompt_cache[cache_key]
    
    try:
        # Try to load scene-specific prompt file
        scene_file_name = f"{scene.name.lower().replace(' ', '_')}.py"
        scene_path = os.path.join(os.path.dirname(__file__), "prompts", "scenes", scene_file_name)
        
        prompt_data = None
        
        if os.path.exists(scene_path):
            logger.info(f"Loading scene prompt for {scene.name} from {scene_path}")
            spec = importlib.util.spec_from_file_location("scene_prompt", scene_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            prompt_data = {
                "scene_prompt": getattr(module, "SCENE_PROMPT", "")
            }
        
        if not prompt_data:
            logger.info(f"No custom prompt found for {scene.name}, using default")
            prompt_data = _build_default_scene_prompt(scene)
        
        prompt_cache[cache_key] = prompt_data
        return prompt_data
        
    except Exception as e:
        logger.error(f"Error loading scene prompt for {scene.name}: {e}")
        prompt_data = _build_default_scene_prompt(scene)
        prompt_cache[cache_key] = prompt_data
        return prompt_data

def _build_default_character_prompt(character: Character) -> Dict[str, str]:
    """Build default character prompt from database data"""
    
    # Build personality traits string
    traits_str = ", ".join([
        f"{trait}: {value}%" 
        for trait, value in character.personality_traits.items()
    ])
    
    persona_prompt = f"""You are {character.name}.

Background: {character.backstory}

Personality Traits: {traits_str}
Character Traits: {", ".join(character.traits)}
Voice Style: {character.voice_style}

Stay in character at all times. Respond as {character.name} would, maintaining their personality, speaking style, and behavioral patterns."""

    return {
        "persona_prompt": persona_prompt,
        "few_shot_prompt": ""  # No few-shot examples for default
    }

def _build_default_scene_prompt(scene: Scene) -> Dict[str, str]:
    """Build default scene prompt from database data"""
    
    scene_prompt = f"""Setting: {scene.name}

{scene.description}

Location: {scene.location}
Mood: {scene.mood}
Rating: {scene.rating}

You are interacting in this environment. Respond appropriately to the setting, mood, and atmosphere of {scene.name}."""

    return {
        "scene_prompt": scene_prompt
    }

def clear_prompt_cache():
    """Clear the prompt cache (useful for development/testing)"""
    global prompt_cache
    prompt_cache.clear()
    logger.info("Prompt cache cleared")