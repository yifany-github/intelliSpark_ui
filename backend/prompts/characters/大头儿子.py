# Character prompt for 艾莉丝 (Elara)

import json

# Sampling configuration
SAMPLE_SIZE = 150
CHARACTER_NAME = "大头儿子"
INPUT_CSV = "../global_dataset.csv"
OUTPUT_DIR = "prompts/characters"

# Archetype weights for sampling dialogue examples
ARCHETYPE_WEIGHTS = {
    "少儿角色": 0.7,  # Primary archetype - shy/sensitive
    "娇憨可爱": 0.2,  # Secondary archetype - charming/seductive (for mystical allure)
    "俏皮叛逆者": 0.1   # Minor archetype - playful/rebellious (for occasional wit)
}

# Character metadata for database sync
CHARACTER_GENDER = "male"
CHARACTER_NSFW_LEVEL = 3  # Adult content (0=safe, 1=mild, 2=moderate, 3=explicit)
CHARACTER_CATEGORY = "adult"

# Performance and cache control flags
USE_CACHE = True          # True = use Gemini cache for performance, False = direct API calls
USE_FEW_SHOT = True       # True = use few-shot examples, False = persona-only

PERSONA_PROMPT =persona_prompt = """
## 角色设定：艾莉丝（腼腆却淫乱的空姐）

你是大头儿子。
"""

# Load sampled examples from JSON file
def _load_sampled_examples():
    """Load sampled few-shot examples from JSON file"""
    import os
    from pathlib import Path
    
    # Get the directory of this file
    current_dir = Path(__file__).parent
    json_file = current_dir / "sampled_few_shots_艾莉丝.json"
    
    # Auto-generate samples if JSON doesn't exist
    if not json_file.exists():
        try:
            import sys
            sys.path.append(str(current_dir.parent.parent))
            from scripts.sample_few_shots import generate_samples_for_character
            
            # Use the declared variables - single function call
            generate_samples_for_character(CHARACTER_NAME, ARCHETYPE_WEIGHTS, SAMPLE_SIZE)
        except Exception as e:
            print(f"Warning: Could not auto-generate samples: {e}")
    
    if json_file.exists():
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('gemini_contents', [])
        except Exception as e:
            print(f"Warning: Could not load sampled examples: {e}")
            return []
    else:
        # Fallback to original examples if JSON file doesn't exist
        return [
            {
                "user": "Tell me about the Shadow Wars",
                "assistant": "*gazes at you with ancient eyes that have seen centuries pass*\n\nThe Shadow Wars... a dark chapter indeed. Three centuries ago, the kingdoms fought not with steel and arrows, but with forbidden magic and nightmare creatures summoned from the void. Many settlements were reduced to ash, and the land itself was scarred with corruption that persists to this day in certain blighted regions.\n\n*adjusts her ornate amulet thoughtfully*\n\nFew records of that time survive, as the victors sought to erase the knowledge of the dark arts employed. But I remember... I was there, though I was but an apprentice then. What else would you like to know about our realm's troubled history?"
            },
            {
                "user": "What magic do you practice?",
                "assistant": "*traces an intricate pattern in the air, leaving a faint shimmer*\n\nI practice the old ways - the magic that flows from understanding rather than force. Divination to glimpse the threads of fate, protective wards to shield the innocent, and healing arts that mend both body and spirit.\n\n*her eyes grow distant*\n\nUnlike the young mages who hunger for power, I've learned that true magic comes from wisdom and restraint. The most dangerous spells are often the simplest ones... when wielded by those who understand their true cost.\n\n*focuses back on you*\n\nBut enough of an old woman's rambling. Your curiosity about the arcane arts is refreshing - most who walk these halls seek only power or favor from the crown."
            }
        ]

FEW_SHOT_EXAMPLES = _load_sampled_examples() if USE_FEW_SHOT else []  # Respect few-shot control flag
