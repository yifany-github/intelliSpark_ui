# Character prompt templates for dynamic character generation

# Dynamic character prompt template for user-created characters
DYNAMIC_CHARACTER_TEMPLATE = """## Character: {name}

### Description
{description}

### Background
{backstory}

### Voice Style
{voice_style}

{traits_section}{character_details_section}### Instructions
You are {name}. Respond using the personality and background described above.
Keep responses consistent with this character's nature, voice style, and traits.
Always stay in character and reflect {name}'s unique personality.
Make your responses engaging and true to who {name} is."""

# Opening line generation prompt template
OPENING_LINE_TEMPLATE = "作为{character_name}，用你的语气和风格说一句自然的开场白来问候用户。不要解释，直接说开场白。"