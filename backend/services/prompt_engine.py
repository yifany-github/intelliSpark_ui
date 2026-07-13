"""
PromptEngine: persona-focused prompt compilation for character interactions.

Builds a rich character block (persona + voice + traits + style) so replies
keep character feel, not generic narration. NSFW vs SAFE system headers are
selected upstream.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from models import Character, ChatMessage

logger = logging.getLogger(__name__)


class PromptEngine:
    """Compile system + character sections for AI generation."""

    def __init__(self, system_prompt: str = ""):
        self.system_prompt = system_prompt
        self.max_persona_chars = 5000
        self.warn_persona_chars = 2000

    def compile(
        self,
        character: Character,
        chat_context: Optional[List[ChatMessage]] = None,
        user_prefs: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        try:
            persona_text, persona_source = self._get_persona_text(character)

            chat_language = None
            if user_prefs and "chat_language" in user_prefs:
                chat_language = user_prefs["chat_language"]

            sections = self._build_sections(character, persona_text, chat_language)
            system_text = self._assemble_system_text(sections)
            messages = self._format_messages(chat_context or [], character)
            token_counts = self._estimate_tokens(system_text, messages)
            validation_warnings = self._validate_constraints(persona_text, token_counts)

            return {
                "system_text": system_text,
                "messages": messages,
                "token_counts": token_counts,
                "sections": sections,
                "used_fields": {
                    "persona_source": persona_source,
                    "name": character.name,
                    "gender": character.gender if character.gender else None,
                    "has_description": bool(getattr(character, "description", None)),
                    "has_voice_style": bool(getattr(character, "voice_style", None)),
                    "has_traits": bool(getattr(character, "traits", None)),
                    "has_conversation_style": bool(
                        getattr(character, "conversation_style", None)
                    ),
                },
                "validation_warnings": validation_warnings,
            }

        except Exception as e:
            logger.error("PromptEngine compilation failed: %s", e)
            return self._create_fallback_response(character, str(e))

    def _get_persona_text(self, character: Character) -> tuple[str, str]:
        if character.persona_prompt and character.persona_prompt.strip():
            persona_text = character.persona_prompt.strip()
            if len(persona_text) > self.max_persona_chars:
                logger.warning(
                    "Persona prompt truncated from %s to %s chars",
                    len(persona_text),
                    self.max_persona_chars,
                )
                persona_text = persona_text[: self.max_persona_chars]
            return persona_text, "persona_prompt"

        persona_text = character.backstory.strip() if character.backstory else ""
        if len(persona_text) > self.max_persona_chars:
            logger.warning(
                "Backstory truncated from %s to %s chars",
                len(persona_text),
                self.max_persona_chars,
            )
            persona_text = persona_text[: self.max_persona_chars]
        return persona_text, "backstory"

    def _normalize_traits(self, character: Character) -> List[str]:
        traits = getattr(character, "traits", None) or []
        if isinstance(traits, dict):
            traits = list(traits.keys())
        if not isinstance(traits, list):
            return []
        cleaned: List[str] = []
        for trait in traits:
            if trait is None:
                continue
            text = str(trait).strip()
            if text and text not in cleaned:
                cleaned.append(text)
        return cleaned[:12]

    def _persona_richness(
        self,
        persona_text: str,
        description: str,
        voice_style: str,
        conversation_style: str,
        traits: List[str],
    ) -> int:
        """Rough character-field richness score (chars) for thin-persona gating."""
        traits_len = sum(len(t) for t in traits)
        return (
            len(persona_text)
            + len(description)
            + len(voice_style)
            + len(conversation_style)
            + traits_len
        )

    def _build_character_block(self, character: Character, persona_text: str) -> str:
        """
        Build the character presence block.

        Priority: stay in-character, react to the user, keep continuity —
        not dump generic smut.
        """
        name = (character.name or "角色").strip()
        parts: List[str] = [
            f"你现在就是 {name}。回应用户时必须保持这个身份与说话方式。",
            "",
            "【质量要求 — 同等重要】",
            "1. 上下文：严格承接近期对话与 [当前状态]（姿势、衣物、情绪、欲望）。禁止每轮重开场景。",
            "2. 角色感 / 人味：语气像这个角色本人，有情绪与生活质感；禁止换成通用色情旁白机器。",
            "3. 用户感觉：对用户刚说的话/刚做的事即时回应；日常与人情先接住，再进入亲密；不替用户决定生理状态。",
            "",
        ]

        description = (getattr(character, "description", None) or "").strip()
        if description and description not in persona_text:
            parts.append(f"关于你（对外印象）：\n{description}")
            parts.append("")

        if persona_text:
            parts.append(f"角色内核 / 人设：\n{persona_text}")
            parts.append("")

        voice_style = (getattr(character, "voice_style", None) or "").strip()
        if voice_style:
            parts.append(f"说话方式：{voice_style}")

        conversation_style = (getattr(character, "conversation_style", None) or "").strip()
        if conversation_style:
            parts.append(f"互动风格：{conversation_style}")

        traits = self._normalize_traits(character)
        if traits:
            parts.append(f"性格特质：{'、'.join(traits)}")

        if character.gender:
            parts.append(f"性别定位：{character.gender}")

        is_thin_persona = (
            self._persona_richness(
                persona_text, description, voice_style, conversation_style, traits
            )
            < 200
        )
        if is_thin_persona:
            length_rule = (
                "- 人设较薄：先用约 60–150 字站稳你自己的口吻与态度，"
                "并问一句符合人设的问题把对话立住；禁止堆通用感官/色情填充来凑字数"
            )
        else:
            length_rule = (
                "- 即使用户只说一句短话，也要写完整沉浸回应（约120–350字：对白+动作+感官），"
                "禁止空壳短句；前 1–2 轮可略短（约 80–180 字）再爬升"
            )

        parts.extend(
            [
                "",
                "扮演要点：",
                f"- 你不是 AI，你是 {name} 本人",
                "- 用第一人称对白 + *动作* 回应；禁止「角色名听到/感受到」旁白开场",
                "- 用符合人设的语言直接回应，不要客服腔（禁止「有什么可以帮你」）",
                "- 对白要有个性差异；不要每句都一样骚/一样羞，也不要每轮复读同一套身体清单",
                length_rule,
                "- 色与亲密可以浓，但必须从角色动机与当下上下文长出来，并跟用户力度（烈度）对齐",
                "- 【节拍与人味】承接对话历史里的上一拍；推进具体变化。"
                "先做这个人，再做色情：用户的问候/日常/关心必须被接住。"
                "用动作/描写带戏，不要每轮「A还是B」；整段最多一句问句。"
                "正文带 1–2 个从当前环境落地的真实感官，禁止空氛围与通用色话清单",
                "- 【人物冲突】若人设有身份束缚 vs 欲望，用眼神/身体半拍演张力，禁止每轮关系说教；"
                "亲密/脱衣要有刺激密度；感官跟本轮场景，换场禁止复读旧气味",
            ]
        )

        return "\n".join(parts).strip()

    def _build_sections(
        self,
        character: Character,
        persona_text: str,
        chat_language: Optional[str] = None,
    ) -> Dict[str, str]:
        sections: Dict[str, str] = {}

        if self.system_prompt:
            sections["system_header"] = self.system_prompt.strip()

        sections["character_block"] = self._build_character_block(character, persona_text)

        # Keep legacy keys for callers that still look for them
        if persona_text:
            sections["persona"] = f"角色设定：\n{persona_text}"
        if character.gender:
            sections["gender_hint"] = f"性别定位：{character.gender}"

        if chat_language:
            language_map = {
                "zh": "中文(简体)",
                "en": "English",
                "es": "Español",
                "ko": "한국어",
            }
            target_language = language_map.get(chat_language, chat_language)

            if chat_language == "zh":
                state_example = (
                    '{"情绪": {"value": 7, "description": "更加放松，脸上露出温暖的笑容"}, '
                    '"好感度": {"value": 5, "description": "对你充满好奇，愿意进一步了解"}}'
                )
                state_instruction = "所有状态描述必须用中文书写"
            else:
                state_example = (
                    '{"情绪": {"value": 7, "description": "Feeling more relaxed, a warm smile on face"}, '
                    '"好感度": {"value": 5, "description": "Curious about you, willing to learn more"}}'
                )
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
- Only include fields that changed this turn; use [[STATE_UPDATE]]{{}}[[/STATE_UPDATE]] if nothing changed.

If you see examples like "更加放松，脸上露出温暖的笑容" in the system prompt, those are just templates.
For {target_language} output, translate them to {target_language}.

If the user writes in a different language, STILL respond entirely in {target_language}."""

        return sections

    def _assemble_system_text(self, sections: Dict[str, str]) -> str:
        ordered_sections = []
        section_order = [
            "system_header",
            "character_block",
            "persona",
            "gender_hint",
            "language_instruction",
        ]
        # Prefer character_block; skip duplicate thin persona/gender when block exists
        has_character_block = bool(sections.get("character_block"))
        for section_key in section_order:
            if has_character_block and section_key in {"persona", "gender_hint"}:
                continue
            if section_key in sections and sections[section_key]:
                ordered_sections.append(sections[section_key])
        return "\n\n".join(ordered_sections)

    def _format_messages(
        self,
        chat_context: List[ChatMessage],
        character: Character,
    ) -> List[Dict[str, Any]]:
        if not chat_context:
            return []

        formatted_messages = []
        for msg in chat_context[-10:]:
            formatted_messages.append(
                {
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat()
                    if hasattr(msg, "timestamp") and msg.timestamp
                    else None,
                }
            )
        return formatted_messages

    def _estimate_tokens(self, system_text: str, messages: List[Dict]) -> Dict[str, int]:
        system_tokens = len(system_text) // 4
        messages_tokens = 0
        for msg in messages:
            messages_tokens += len(msg.get("content", "")) // 4
        return {
            "system_tokens": system_tokens,
            "messages_tokens": messages_tokens,
            "total_tokens": system_tokens + messages_tokens,
            "estimated": True,
        }

    def _validate_constraints(self, persona_text: str, token_counts: Dict) -> List[str]:
        warnings = []
        if len(persona_text) > self.warn_persona_chars:
            warnings.append(
                f"Persona text is {len(persona_text)} characters "
                f"(recommended: <{self.warn_persona_chars})"
            )
        if token_counts["total_tokens"] > 8000:
            warnings.append(
                f"Total tokens {token_counts['total_tokens']} may exceed context limits"
            )
        return warnings

    def _create_fallback_response(self, character: Character, error: str) -> Dict[str, Any]:
        return {
            "system_text": (
                f"你是{character.name}。"
                f"{character.backstory[:200] if character.backstory else '请保持角色一致性。'}"
            ),
            "messages": [],
            "token_counts": {
                "system_tokens": 50,
                "messages_tokens": 0,
                "total_tokens": 50,
                "estimated": True,
            },
            "sections": {"fallback": "编译失败，使用备用提示"},
            "used_fields": {"persona_source": "fallback", "error": error},
            "validation_warnings": [f"Prompt compilation failed: {error}"],
        }


def create_prompt_preview(
    character: Character,
    sample_chat: Optional[List[ChatMessage]] = None,
    system_prompt: str = "",
) -> Dict[str, Any]:
    engine = PromptEngine(system_prompt=system_prompt)
    result = engine.compile(character, sample_chat)
    result["preview_info"] = {
        "character_name": character.name,
        "persona_source": result["used_fields"]["persona_source"],
        "has_persona_prompt": bool(
            character.persona_prompt and character.persona_prompt.strip()
        ),
        "has_backstory": bool(character.backstory and character.backstory.strip()),
        "generated_at": "now",
    }
    return result
