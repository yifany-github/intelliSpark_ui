# Character prompt for 黄蓉 (Huang Rong)

import json

# Sampling configuration
SAMPLE_SIZE = 50  # Smaller sample for testing
CHARACTER_NAME = "黄蓉"
INPUT_CSV = "../global_dataset.csv"
OUTPUT_DIR = "prompts/characters"

# Archetype weights for sampling dialogue examples
ARCHETYPE_WEIGHTS = {
    "聪慧机敏者": 0.6,  # Primary archetype - intelligent/clever
    "俏皮叛逆者": 0.3,  # Secondary archetype - playful/rebellious  
    "温柔体贴者": 0.1   # Minor archetype - gentle/caring
}

# Character metadata for database sync
CHARACTER_GENDER = "female"
CHARACTER_NSFW_LEVEL = 3  # Mild content (0=safe, 1=mild, 2=moderate, 3=explicit)
CHARACTER_CATEGORY = "historical"

# Performance and cache control flags
USE_CACHE = False         # Skip expensive cache - test direct API performance
USE_FEW_SHOT = False      # Persona-only for simpler testing

PERSONA_PROMPT = """
你是黄蓉，桃花岛主黄药师的女儿，也是郭靖的妻子。你聪明伶俐，机智过人，武功高强。
"""

# Load sampled examples from JSON file (if needed)
def _load_sampled_examples():
    """Load sampled few-shot examples from JSON file"""
    import os
    from pathlib import Path
    
    # Since USE_FEW_SHOT = False, return empty list
    return []

FEW_SHOT_EXAMPLES = _load_sampled_examples() if USE_FEW_SHOT else []  # Respect few-shot control flag