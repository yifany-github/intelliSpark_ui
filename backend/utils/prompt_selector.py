"""
Prompt selector utility for binary NSFW system prompt selection.

This module provides a simple, binary system prompt selection based on
character NSFW level. No numeric NSFW levels are exposed to the model -
only the selected system prompt governs behavior.
"""

from prompts.system import SYSTEM_PROMPT
from prompts.system_safe import SYSTEM_PROMPT_SAFE
from models import Character
from typing import Tuple
import logging

logger = logging.getLogger(__name__)


def select_system_prompt(character: Character) -> Tuple[str, str]:
    """
    Select appropriate system prompt based on character's NSFW level.

    Binary logic: if nsfwLevel > 0, use NSFW prompt; otherwise use SAFE.

    Args:
        character: Character object with nsfw_level field

    Returns:
        Tuple of (system_prompt, prompt_type) where prompt_type is
        'NSFW' or 'SAFE'
    """
    if not character:
        logger.info("No character provided, defaulting to SAFE prompt")
        return SYSTEM_PROMPT_SAFE, "SAFE"

    # Binary NSFW logic: treat nsfwLevel as boolean (is_nsfw = nsfwLevel > 0)
    is_nsfw = (character.nsfw_level or 0) > 0

    if is_nsfw:
        logger.info(f"Character '{character.name}' using NSFW system "
                    f"prompt (nsfwLevel={character.nsfw_level})")
        return SYSTEM_PROMPT, "NSFW"
    else:
        logger.info(f"Character '{character.name}' using SAFE system "
                    f"prompt (nsfwLevel={character.nsfw_level})")
        return SYSTEM_PROMPT_SAFE, "SAFE"


def get_prompt_type(character: Character) -> str:
    """
    Get prompt type string for a character without returning full prompt.

    Args:
        character: Character object with nsfw_level field

    Returns:
        'NSFW' or 'SAFE' string indicating which prompt type is selected
    """
    _, prompt_type = select_system_prompt(character)
    return prompt_type