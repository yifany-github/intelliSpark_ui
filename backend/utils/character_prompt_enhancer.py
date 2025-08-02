import json
import os
from typing import Dict, List, Any
from models import Character

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
            print(f"Warning: Few-shot examples file not found at {self.few_shots_path}")
            self.generic_data = []
        except json.JSONDecodeError as e:
            print(f"Warning: Invalid JSON in few-shot examples file: {e}")
            self.generic_data = []
    
    def analyze_personality_archetype(self, character: Character) -> str:
        """Determine personality archetype from character traits and description"""
        traits = character.traits or []
        description = (character.description or "").lower()
        backstory = (character.backstory or "").lower()
        voice_style = (character.voice_style or "").lower()
        
        # Combine all text for analysis
        combined_text = f"{description} {backstory} {voice_style} {' '.join([trait.lower() for trait in traits])}"
        
        # Keyword-based archetype detection with scoring
        archetype_keywords = {
            "友善型": [
                # Chinese keywords
                '友善', '温柔', '善良', '热情', '友好', '关怀', '体贴', '温暖', '亲切', '支持',
                # English keywords  
                'friendly', 'kind', 'warm', 'caring', 'supportive', 'gentle', 'compassionate', 
                'helpful', 'nurturing', 'empathetic', 'loving', 'sweet'
            ],
            "神秘型": [
                # Chinese keywords
                '神秘', '冷酷', '深沉', '安静', '沉默', '隐秘', '谜', '暗', '秘密', '阴影',
                # English keywords
                'mysterious', 'dark', 'quiet', 'enigmatic', 'secretive', 'shadowy', 'cryptic',
                'reserved', 'aloof', 'brooding', 'intriguing', 'elusive'
            ],
            "活泼型": [
                # Chinese keywords
                '活泼', '开朗', '兴奋', '快乐', '热闹', '积极', '充满活力', '欢快', '乐观', '阳光',
                # English keywords
                'lively', 'cheerful', 'energetic', 'happy', 'upbeat', 'enthusiastic', 'bubbly',
                'vibrant', 'playful', 'spirited', 'optimistic', 'joyful'
            ],
            "理性型": [
                # Chinese keywords
                '理性', '逻辑', '分析', '冷静', '客观', '理智', '思考', '智慧', '学者', '科学',
                # English keywords
                'logical', 'rational', 'analytical', 'calm', 'objective', 'intellectual', 'wise',
                'scientific', 'methodical', 'systematic', 'thoughtful', 'scholarly'
            ]
        }
        
        # Calculate scores for each archetype
        archetype_scores = {}
        for archetype, keywords in archetype_keywords.items():
            score = 0
            for keyword in keywords:
                # Count occurrences in combined text
                score += combined_text.count(keyword)
                # Bonus points for exact trait matches
                if keyword in [trait.lower() for trait in traits]:
                    score += 2
            archetype_scores[archetype] = score
        
        # Return archetype with highest score, default to 友善型 if tie or no matches
        if not archetype_scores or max(archetype_scores.values()) == 0:
            return "友善型"
        
        return max(archetype_scores, key=archetype_scores.get)
    
    def generate_few_shot_examples(self, character: Character, count: int = 6) -> List[Dict]:
        """Generate contextual conversation examples from the simple array"""
        # Load all examples and take the first 'count' items
        if isinstance(self.generic_data, list):
            return self.generic_data[:count] if self.generic_data else []
        else:
            # Fallback for old format
            return self._generate_simple_examples(character)[:count]
    
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
        
        # Generate simple few-shot examples
        few_shot_examples = self._generate_simple_examples(character)
        
        return {
            "persona_prompt": persona_prompt,
            "few_shot_contents": few_shot_examples
        }
    
    def _generate_simple_examples(self, character: Character) -> List[Dict]:
        """Load the 150 few-shot examples from JSON file"""
        if isinstance(self.generic_data, list):
            return self.generic_data
        else:
            # Fallback to basic examples
            return [
                {
                    "role": "user",
                    "content": "你好"
                },
                {
                    "role": "assistant", 
                    "content": f"*温暖地微笑* 你好！我是{character.name}。"
                }
            ]