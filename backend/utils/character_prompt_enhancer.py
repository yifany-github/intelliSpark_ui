import json
import os
import logging
from typing import Dict, List, Any
from models import Character

# Set up logging
logger = logging.getLogger(__name__)

class CharacterPromptEnhancer:
    def __init__(self):
        self.few_shots_path = os.path.join(os.path.dirname(__file__), '..', 'prompts', 'generic_few_shots.json')
        self._load_generic_examples()
    
    def _load_generic_examples(self):
        """Load generic few-shot examples from JSON file"""
        try:
            with open(self.few_shots_path, 'r', encoding='utf-8') as f:
                self.generic_data = json.load(f)
        except FileNotFoundError:
            logger.warning(f"Few-shot examples file not found at {self.few_shots_path}")
            self.generic_data = []
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON in few-shot examples file: {e}")
            self.generic_data = []
    
    
    def generate_few_shot_examples(self, character: Character, count: int = 6) -> List[Dict]:
        """Generate conversation examples from the simple array"""
        # Load all examples and take the first 'count' items
        return self.generic_data[:count] if self.generic_data else []
    
    def enhance_dynamic_prompt(self, character: Character) -> Dict[str, Any]:
        """Generate enhanced prompt with personality analysis and few-shot examples"""
        from prompts.character_templates import DYNAMIC_CHARACTER_TEMPLATE
        
        # Build personality traits string
        traits_section = ""
        if character.traits:
            traits_section = f"### 性格特征\n{', '.join(character.traits)}\n\n"
        
        # Build additional character info
        character_info = []
        if character.gender:
            character_info.append(f"性别: {character.gender}")
        if character.age:
            character_info.append(f"年龄: {character.age}")
        if character.occupation:
            character_info.append(f"职业: {character.occupation}")
        
        character_details_section = ""
        if character_info:
            character_details_section = f"### 角色详情\n{', '.join(character_info)}\n\n"
        
        # Generate enhanced persona prompt
        persona_prompt = DYNAMIC_CHARACTER_TEMPLATE.format(
            name=character.name,
            description=character.description or '一个独特的角色，拥有自己的个性。',
            backstory=character.backstory or '这个角色有着有趣的背景故事，塑造了他们的回应方式。',
            voice_style=character.voice_style or '以自然、引人入胜的方式说话。',
            traits_section=traits_section,
            character_details_section=character_details_section
        )
        
        # Generate few-shot examples
        few_shot_examples = self.generate_few_shot_examples(character, count=len(self.generic_data))
        
        return {
            "persona_prompt": persona_prompt,
            "few_shot_contents": few_shot_examples
        }