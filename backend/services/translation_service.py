"""Translation service for character content localization.

Provides automatic translation between Chinese and English for character data.
Uses Grok API to support NSFW content translation.
"""

import json
import logging
from typing import Dict, Optional, Literal
import openai
from config import settings


logger = logging.getLogger(__name__)


class TranslationService:
    """Service for translating character content between languages using Grok API."""

    def __init__(self):
        """Initialize translation service with Grok."""
        if not settings.grok_api_key:
            logger.warning("GROK_API_KEY not set - translation service unavailable")
            self.client = None
        else:
            self.client = openai.AsyncOpenAI(
                api_key=settings.grok_api_key,
                base_url="https://api.x.ai/v1"
            )
            self.model = "grok-3-mini"  # Use same model as chat service (supports NSFW)

    def detect_language(self, text: str) -> Literal["zh", "en"]:
        """Detect if text is primarily Chinese or English.

        Args:
            text: Text to detect language for

        Returns:
            "zh" for Chinese, "en" for English
        """
        if not text or len(text.strip()) == 0:
            return "en"

        # Count Chinese characters
        chinese_chars = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')
        total_chars = len(text)

        # If more than 30% Chinese characters, consider it Chinese
        if total_chars > 0 and chinese_chars / total_chars > 0.3:
            return "zh"
        return "en"

    async def translate_text(
        self,
        text: str,
        target_lang: Literal["zh", "en"],
        context: Optional[str] = None
    ) -> str:
        """Translate text to target language using Grok API.

        Args:
            text: Text to translate
            target_lang: Target language ("zh" or "en")
            context: Optional context about the text type

        Returns:
            Translated text
        """
        if not self.client:
            logger.error("Translation service unavailable - GROK_API_KEY not set")
            return text

        if not text or len(text.strip()) == 0:
            return text

        # Detect source language
        source_lang = self.detect_language(text)

        # If already in target language, return as is
        if source_lang == target_lang:
            return text

        try:
            # Build system and user prompts based on target language
            if target_lang == "zh":
                system_prompt = """你是一位专业的翻译专家。你的任务是将英文内容翻译成自然流畅的中文。
要求：
1. 保持原文的语气、风格和情感
2. 翻译要地道、符合中文表达习惯
3. 对于NSFW内容，如实翻译，不要回避或审查
4. 只返回翻译结果，不要添加任何解释"""
                user_prompt = f"""{f'内容类型：{context}' if context else ''}

英文原文：
{text}

请翻译为中文："""
            else:
                system_prompt = """You are a professional translator. Your task is to translate Chinese content into natural, fluent English.
Requirements:
1. Maintain the original tone, style, and emotion
2. Translation should be idiomatic and natural in English
3. For NSFW content, translate faithfully without censorship
4. Return only the translation without any explanations"""
                user_prompt = f"""{f'Content type: {context}' if context else ''}

Chinese original:
{text}

Translate to English:"""

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,  # Lower temperature for more consistent translations
                max_tokens=4000
            )

            translated = response.choices[0].message.content.strip()
            logger.info(f"Translated text from {source_lang} to {target_lang}")
            return translated

        except Exception as e:
            logger.error(f"Translation failed: {e}")
            return text

    async def translate_state_json(
        self,
        state_json: str,
        target_lang: Literal["zh", "en"]
    ) -> str:
        """Translate state JSON structure.

        Args:
            state_json: JSON string containing state data
            target_lang: Target language

        Returns:
            Translated JSON string
        """
        if not self.client or not state_json:
            return state_json

        try:
            state = json.loads(state_json)

            # Determine key translation mapping
            if target_lang == "zh":
                # English to Chinese key mapping
                key_map = {
                    "Clothing": "衣着",
                    "Demeanor": "仪态",
                    "Mood": "情绪",
                    "Favorability": "好感度",
                    "Trust": "信任度",
                    "Excitement": "兴奋度",
                    "Fatigue": "疲惫度",
                    "Environment": "环境",
                    "Action": "动作",
                    "Tone": "语气",
                    # NSFW keys
                    "Chest": "胸部",
                    "Lower_Body": "下体",
                    "Outfit": "衣服",
                    "Posture": "姿势",
                    "Emotion": "情绪",
                }
            else:
                # Chinese to English key mapping
                key_map = {
                    "衣着": "Clothing",
                    "仪态": "Demeanor",
                    "情绪": "Mood",
                    "好感度": "Favorability",
                    "信任度": "Trust",
                    "兴奋度": "Excitement",
                    "疲惫度": "Fatigue",
                    "环境": "Environment",
                    "动作": "Action",
                    "语气": "Tone",
                    # NSFW keys
                    "胸部": "Chest",
                    "下体": "Lower_Body",
                    "衣服": "Outfit",
                    "姿势": "Posture",
                }

            translated_state = {}

            for key, value in state.items():
                # Translate key
                translated_key = key_map.get(key, key)

                # Translate value
                if isinstance(value, str):
                    # Simple string value
                    if value and value != "未设定":
                        translated_value = await self.translate_text(value, target_lang, context="character state")
                    else:
                        translated_value = "Not set" if target_lang == "en" else "未设定"
                elif isinstance(value, dict) and "description" in value:
                    # Quantified state with description
                    translated_value = {
                        "value": value.get("value"),
                        "description": await self.translate_text(
                            value.get("description", ""),
                            target_lang,
                            context="character state description"
                        )
                    }
                else:
                    translated_value = value

                translated_state[translated_key] = translated_value

            return json.dumps(translated_state, ensure_ascii=False, indent=2)

        except Exception as e:
            logger.error(f"State JSON translation failed: {e}")
            return state_json

    async def translate_character_data(
        self,
        character_data: Dict,
        target_lang: Literal["zh", "en"]
    ) -> Dict:
        """Translate all character fields to target language.

        Args:
            character_data: Dictionary containing character fields
            target_lang: Target language

        Returns:
            Dictionary with translated fields
        """
        if not self.client:
            logger.error("Translation service unavailable")
            return {}

        translated = {}

        # Translate name
        if character_data.get("name"):
            # Names are usually kept as is, but we can add translation if needed
            translated["name"] = character_data["name"]

        # Translate description
        if character_data.get("description"):
            translated["description"] = await self.translate_text(
                character_data["description"],
                target_lang,
                context="character description"
            )

        # Translate backstory
        if character_data.get("backstory"):
            translated["backstory"] = await self.translate_text(
                character_data["backstory"],
                target_lang,
                context="character backstory"
            )

        # Translate opening line
        if character_data.get("opening_line"):
            translated["opening_line"] = await self.translate_text(
                character_data["opening_line"],
                target_lang,
                context="character opening line"
            )

        # Translate default state JSON
        if character_data.get("default_state_json"):
            translated["default_state_json"] = await self.translate_state_json(
                character_data["default_state_json"],
                target_lang
            )

        return translated


# Singleton instance
_translation_service: Optional[TranslationService] = None


def get_translation_service() -> TranslationService:
    """Get singleton translation service instance."""
    global _translation_service
    if _translation_service is None:
        _translation_service = TranslationService()
    return _translation_service
