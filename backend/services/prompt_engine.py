"""
PromptEngine: Simplified NSFW-agnostic prompt compilation for persona-focused character interactions

This engine treats character backstory as the primary persona prompt, with optional
persona_prompt field that overrides backstory when present. NSFW selection is handled
upstream by AI services (Issue #156) - this engine only composes persona sections.
"""

import logging
from typing import Dict, List, Optional, Any
from models import Character, ChatMessage

logger = logging.getLogger(__name__)


class PromptEngine:
    """
    Simple NSFW-agnostic prompt compiler that prioritizes persona prompts.
    
    Design principles:
    - Use persona_prompt if available, otherwise fall back to backstory
    - Only include name, persona, and optional gender
    - NSFW selection handled upstream by AI services
    - Provide token estimation for budget management
    """
    
    def __init__(self, system_prompt: str = ""):
        """
        Initialize the prompt engine with a preselected system prompt.
        
        Args:
            system_prompt: Preselected system instruction (SAFE/NSFW chosen upstream)
        """
        self.system_prompt = system_prompt
        self.max_persona_chars = 5000  # Hard cap as per requirements
        self.warn_persona_chars = 2000  # Soft warning threshold
    
    def compile(
        self,
        character: Character,
        chat_context: Optional[List[ChatMessage]] = None,
        user_prefs: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Compile a complete prompt from character and context.

        Args:
            character: Character model with persona_prompt/backstory
            chat_context: Recent chat messages for conversation context
            user_prefs: User preferences including chat_language

        Returns:
            Dictionary with compiled prompt data:
            {
                "system_text": str,           # Complete system prompt
                "messages": List[Dict],       # Formatted messages for API
                "token_counts": Dict,         # Token estimation breakdown
                "sections": Dict,             # Individual prompt sections
                "used_fields": Dict           # Which fields were used for compilation
            }
        """
        try:
            # Step 1: Determine persona source (persona_prompt vs backstory)
            persona_text, persona_source = self._get_persona_text(character)

            # Step 2: Extract language preference from user_prefs
            chat_language = None
            if user_prefs and 'chat_language' in user_prefs:
                chat_language = user_prefs['chat_language']

            # Step 3: Build system instruction sections
            sections = self._build_sections(character, persona_text, chat_language)

            # Step 4: Assemble full system text
            system_text = self._assemble_system_text(sections)
            
            # Step 4: Format conversation context
            messages = self._format_messages(chat_context or [], character)
            
            # Step 5: Estimate token usage
            token_counts = self._estimate_tokens(system_text, messages)
            
            # Step 6: Validate constraints
            validation_warnings = self._validate_constraints(persona_text, token_counts)
            
            return {
                "system_text": system_text,
                "messages": messages,
                "token_counts": token_counts,
                "sections": sections,
                "used_fields": {
                    "persona_source": persona_source,
                    "name": character.name,
                    "gender": character.gender if character.gender else None
                },
                "validation_warnings": validation_warnings
            }
            
        except Exception as e:
            logger.error(f"PromptEngine compilation failed: {e}")
            # Return safe fallback
            return self._create_fallback_response(character, str(e))
    
    def _get_persona_text(self, character: Character) -> tuple[str, str]:
        """
        Get persona text and identify source.
        
        Returns:
            (persona_text, source) where source is 'persona_prompt' or 'backstory'
        """
        if character.persona_prompt and character.persona_prompt.strip():
            # Validate persona_prompt length
            persona_text = character.persona_prompt.strip()
            if len(persona_text) > self.max_persona_chars:
                logger.warning(f"Persona prompt truncated from {len(persona_text)} to {self.max_persona_chars} chars")
                persona_text = persona_text[:self.max_persona_chars]
            
            return persona_text, "persona_prompt"
        else:
            # Fall back to backstory
            persona_text = character.backstory.strip() if character.backstory else ""
            if len(persona_text) > self.max_persona_chars:
                logger.warning(f"Backstory truncated from {len(persona_text)} to {self.max_persona_chars} chars")
                persona_text = persona_text[:self.max_persona_chars]
                
            return persona_text, "backstory"
    
    def _build_sections(
        self,
        character: Character,
        persona_text: str,
        chat_language: Optional[str] = None
    ) -> Dict[str, str]:
        """Build individual prompt sections including language instruction."""
        sections = {}

        # Core system instruction (preselected upstream)
        if self.system_prompt:
            sections["system_header"] = self.system_prompt.strip()

        # Character persona (main section)
        if persona_text:
            sections["persona"] = f"角色设定：\n{persona_text}"

        # Optional gender hint (1-line)
        if character.gender:
            sections["gender_hint"] = f"性别定位：{character.gender}"

        # Language instruction (critical for output language)
        if chat_language:
            language_map = {
                "zh": "中文(简体)",
                "en": "English",
                "es": "Español",
                "ko": "한국어",
            }
            target_language = language_map.get(chat_language, chat_language)

            # Build language-specific STATE_UPDATE examples
            if chat_language == "zh":
                state_example = '{"情绪": {"value": 7, "description": "更加放松，脸上露出温暖的笑容"}, "好感度": {"value": 5, "description": "对你充满好奇，愿意进一步了解"}}'
                state_instruction = "所有状态描述必须用中文书写"
            else:
                state_example = '{"情绪": {"value": 7, "description": "Feeling more relaxed, a warm smile on face"}, "好感度": {"value": 5, "description": "Curious about you, willing to learn more"}}'
                state_instruction = f"Write ALL state descriptions in {target_language}"

            sections["language_instruction"] = f"""**CRITICAL LANGUAGE OVERRIDE INSTRUCTION**:
THIS INSTRUCTION OVERRIDES ALL PREVIOUS LANGUAGE EXAMPLES IN THE SYSTEM PROMPT.

You MUST respond in {target_language} ONLY. This applies to:
1. All dialogue and narrative text
2. ALL "description" fields in [[STATE_UPDATE]] JSON blocks
3. Character actions, thoughts, and environment descriptions
4. Every single piece of text in your response

CRITICAL REQUIREMENT FOR STATE UPDATES:
- Ignore any Chinese examples you saw in the system prompt above
- Do NOT translate JSON keys. Keep keys exactly as provided (e.g., 情绪, 好感度, 信任度, 兴奋度, 疲惫度, 欲望值, 敏感度, 胸部, 下体, 衣服, 姿势, 环境).
- {state_instruction}
- Correct format: [[STATE_UPDATE]]{state_example}[[/STATE_UPDATE]]

If you see examples like "更加放松，脸上露出温暖的笑容" in the system prompt, those are just templates.
For {target_language} output, translate them to {target_language}.

If the user writes in a different language, STILL respond entirely in {target_language}."""

        return sections
    
    def _assemble_system_text(self, sections: Dict[str, str]) -> str:
        """Assemble sections into complete system text."""
        ordered_sections = []

        # Order: header → persona → gender → language_instruction (at end for emphasis)
        section_order = ["system_header", "persona", "gender_hint", "language_instruction"]

        for section_key in section_order:
            if section_key in sections and sections[section_key]:
                ordered_sections.append(sections[section_key])

        return "\n\n".join(ordered_sections)
    
    def _format_messages(
        self, 
        chat_context: List[ChatMessage], 
        character: Character
    ) -> List[Dict[str, Any]]:
        """Format chat messages for API consumption."""
        if not chat_context:
            return []
        
        # Convert to API format (implementation depends on AI service)
        formatted_messages = []
        for msg in chat_context[-10:]:  # Keep recent 10 messages for context
            formatted_messages.append({
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat() if hasattr(msg, 'timestamp') else None
            })
        
        return formatted_messages
    
    def _estimate_tokens(self, system_text: str, messages: List[Dict]) -> Dict[str, int]:
        """
        Estimate token counts for budget management.
        
        Simple character-based estimation: ~4 chars per token for mixed text.
        """
        system_tokens = len(system_text) // 4
        
        messages_tokens = 0
        for msg in messages:
            messages_tokens += len(msg.get("content", "")) // 4
        
        total_tokens = system_tokens + messages_tokens
        
        return {
            "system_tokens": system_tokens,
            "messages_tokens": messages_tokens,
            "total_tokens": total_tokens,
            "estimated": True  # Mark as rough estimation
        }
    
    def _validate_constraints(self, persona_text: str, token_counts: Dict) -> List[str]:
        """Validate prompt constraints and return warnings."""
        warnings = []
        
        # Character length warnings
        if len(persona_text) > self.warn_persona_chars:
            warnings.append(f"Persona text is {len(persona_text)} characters (recommended: <{self.warn_persona_chars})")
        
        # Token budget warnings
        if token_counts["total_tokens"] > 8000:
            warnings.append(f"Total tokens {token_counts['total_tokens']} may exceed context limits")
        
        return warnings
    
    def _create_fallback_response(self, character: Character, error: str) -> Dict[str, Any]:
        """Create safe fallback response on compilation failure."""
        return {
            "system_text": f"你是{character.name}。{character.backstory[:200] if character.backstory else '请保持角色一致性。'}",
            "messages": [],
            "token_counts": {"system_tokens": 50, "messages_tokens": 0, "total_tokens": 50, "estimated": True},
            "sections": {"fallback": "编译失败，使用备用提示"},
            "used_fields": {"persona_source": "fallback", "error": error},
            "validation_warnings": [f"Prompt compilation failed: {error}"]
        }


def create_prompt_preview(
    character: Character, 
    sample_chat: Optional[List[ChatMessage]] = None,
    system_prompt: str = ""
) -> Dict[str, Any]:
    """
    Helper function to create a preview of how the prompt will look.
    
    This is used by the admin preview endpoint.
    
    Args:
        character: Character to preview
        sample_chat: Optional sample conversation
        system_prompt: Preselected system prompt (SAFE/NSFW chosen upstream)
    """
    engine = PromptEngine(system_prompt=system_prompt)
    result = engine.compile(character, sample_chat)
    
    # Add preview-specific information
    result["preview_info"] = {
        "character_name": character.name,
        "persona_source": result["used_fields"]["persona_source"],
        "has_persona_prompt": bool(character.persona_prompt and character.persona_prompt.strip()),
        "has_backstory": bool(character.backstory and character.backstory.strip()),
        "generated_at": "now"
    }
    
    return result
