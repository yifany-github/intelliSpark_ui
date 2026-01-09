"""Character state management service for chat continuity."""

from __future__ import annotations

import json
import logging
from typing import Dict, Optional, Sequence, Union, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from ..models import Character, CharacterChatState, Chat
    from .ai_model_manager import get_ai_model_manager
    from .translation_service import get_translation_service
except ImportError:
    # Fallback for script execution
    from models import Character, CharacterChatState, Chat
    from services.ai_model_manager import get_ai_model_manager
    from services.translation_service import get_translation_service


class CharacterStateManager:
    """Persist and retrieve per-chat character state snapshots."""

    NSFW_KEYS: Sequence[str] = ("胸部", "下体", "衣服", "姿势", "情绪", "环境", "好感度", "信任度", "兴奋度", "疲惫度", "欲望值", "敏感度")
    SAFE_KEYS: Sequence[str] = ("衣着", "仪态", "情绪", "环境", "动作", "语气", "好感度", "信任度", "兴奋度", "疲惫度")
    ALLOWED_KEYS: Sequence[str] = tuple(dict.fromkeys(NSFW_KEYS + SAFE_KEYS))

    # Quantifiable state keys that should have numeric values
    QUANTIFIABLE_KEYS: Sequence[str] = ("情绪", "好感度", "信任度", "兴奋度", "疲惫度", "欲望值", "敏感度")

    ENGLISH_KEY_MAP: Dict[str, str] = {
        "Clothing": "衣着",
        "Demeanor": "仪态",
        "Mood": "情绪",
        "Emotion": "情绪",
        "Favorability": "好感度",
        "Trust": "信任度",
        "Excitement": "兴奋度",
        "Fatigue": "疲惫度",
        "Environment": "环境",
        "Action": "动作",
        "Tone": "语气",
        "Attire": "衣着",
        "Chest": "胸部",
        "Lower_Body": "下体",
        "Lower Body": "下体",
        "Outfit": "衣服",
        "Posture": "姿势",
    }

    def __init__(self, session: AsyncSession):
        self.session = session
        self.logger = logging.getLogger(__name__)

    @staticmethod
    def _normalize_language(language: Optional[str]) -> Optional[str]:
        if not language:
            return None
        lowered = language.lower()
        primary = lowered.split("-")[0]
        if primary:
            return primary
        return None

    @staticmethod
    def _default_state_field(language: Optional[str]) -> str:
        if language == "zh":
            return "default_state_json_zh"
        if language:
            return "default_state_json_en"
        return "default_state_json"

    @classmethod
    def _remap_state_keys(cls, state: Dict[str, Any]) -> Dict[str, Any]:
        if not state:
            return {}
        remapped: Dict[str, Any] = {}
        for key, value in state.items():
            mapped_key = cls.ENGLISH_KEY_MAP.get(key, key)
            remapped[mapped_key] = value
        return remapped

    async def _localize_state_values(
        self,
        state: Dict[str, Any],
        target_lang: str,
        fallback_template: Dict[str, Union[str, Dict[str, Any]]],
    ) -> Dict[str, Any]:
        if not state or not target_lang:
            return state

        translator = get_translation_service()
        has_translator = bool(getattr(translator, "client", None))
        if has_translator:
            needs_translation = False
            if target_lang in {"zh", "en", "es", "ko"}:
                for value in state.values():
                    if isinstance(value, dict) and "description" in value:
                        description = value.get("description", "")
                        if isinstance(description, str) and description.strip():
                            if translator.detect_language(description) != target_lang:
                                needs_translation = True
                                break
                    elif isinstance(value, str) and value.strip():
                        if translator.detect_language(value) != target_lang:
                            needs_translation = True
                            break
            else:
                needs_translation = True

            if needs_translation:
                translated = await translator.translate_state_json_values(state, target_lang)
                if isinstance(translated, dict) and translated:
                    return translated
                self.logger.warning("State translation failed; returning original state")
                return state

        localized: Dict[str, Any] = {}
        for key, value in state.items():
            fallback = fallback_template.get(key)
            if isinstance(value, dict) and "description" in value:
                description = value.get("description", "")
                if isinstance(fallback, dict):
                    description = fallback.get("description", description) or description
                localized[key] = {"value": value.get("value"), "description": description}
            elif isinstance(value, str):
                if isinstance(fallback, str):
                    localized[key] = fallback
                elif isinstance(fallback, dict):
                    localized[key] = fallback.get("description", value)
                else:
                    localized[key] = value
            else:
                localized[key] = value

        return localized

    @staticmethod
    def _normalize_state_value(value: Union[None, str, Dict[str, Any]]) -> Union[str, Dict[str, Any]]:
        """Normalize state value, supporting both string and quantified format."""
        if not value:
            return ""

        # Handle quantified format (dict with 'value' and 'description')
        if isinstance(value, dict):
            if 'value' in value and 'description' in value:
                # Validate value is in 0-10 range
                numeric_value = value.get('value', 5)
                if not isinstance(numeric_value, (int, float)) or numeric_value < 0 or numeric_value > 10:
                    numeric_value = 5  # Default to neutral
                desc = value.get('description', '').strip()
                if not desc or desc in {"未设定", "Not set"}:
                    return ""
                return {"value": int(numeric_value), "description": desc}
            return ""

        # Handle string format (legacy)
        if isinstance(value, str):
            normalized = value.strip()
            return "" if not normalized or normalized in {"未设定", "Not set"} else normalized

        return ""

    def _filter_state_keys(
        self,
        state: Optional[Dict[str, Any]],
        keys_to_use: Sequence[str],
    ) -> Dict[str, Union[str, Dict[str, Any]]]:
        """Return normalized subset of state limited to the allowed keys."""
        if not state:
            return {}

        filtered: Dict[str, Union[str, Dict[str, Any]]] = {}
        for key in keys_to_use:
            normalized = self._normalize_state_value(state.get(key))
            if normalized:
                filtered[key] = normalized
        return filtered

    async def get_state(self, chat_id: int) -> Dict[str, Union[str, Dict[str, Any]]]:
        stmt = select(CharacterChatState).where(CharacterChatState.chat_id == chat_id)
        result = await self.session.execute(stmt)
        state_row = result.scalars().first()
        if not state_row or not state_row.state_json:
            return {}
        try:
            return json.loads(state_row.state_json)
        except json.JSONDecodeError as exc:
            self.logger.warning("Invalid state JSON for chat %s: %s", chat_id, exc)
            return {}

    async def _load_character(self, chat_id: int) -> Optional[Character]:
        chat_stmt = select(Chat).where(Chat.id == chat_id)
        chat_result = await self.session.execute(chat_stmt)
        chat = chat_result.scalars().first()
        if not chat:
            return None
        return await self.session.get(Character, chat.character_id)

    def _select_keys(self, character: Optional[Character]) -> Sequence[str]:
        if character is not None and getattr(character, "nsfw_level", 0) == 0:
            return self.SAFE_KEYS
        return self.NSFW_KEYS

    def _fallback_state_map(
        self,
        safe_mode: bool,
        language: Optional[str] = None,
    ) -> Dict[str, Union[str, Dict[str, Any]]]:
        target_lang = self._normalize_language(language) or "zh"
        if safe_mode:
            base = {
                "衣着": "穿搭整洁得体，色调温和",
                "仪态": "站姿放松，自信自然",
                "情绪": {"value": 6, "description": "心情愉悦，对交流充满期待"},
                "好感度": {"value": 4, "description": "初次见面，保持礼貌的距离感"},
                "信任度": {"value": 3, "description": "略有戒备，需要时间建立信任"},
                "兴奋度": {"value": 5, "description": "保持平稳的心态"},
                "疲惫度": {"value": 3, "description": "精力充沛，状态良好"},
                "环境": "温暖明亮的室内空间，布置舒适",
                "动作": "双手自然垂放，偶尔整理袖口",
                "语气": "亲切柔和，带着一丝兴奋",
            }
        else:
            base = {
                "胸部": "柔软饱满，布料轻贴，伴随呼吸微微起伏",
                "下体": "带着余热与敏感，隐约透出渴望",
                "衣服": "贴身衣物略显凌乱，勾勒出诱人曲线",
                "姿势": "身体微微前倾，呈现出主动亲近的姿态",
                "情绪": {"value": 6, "description": "期待、雀跃并带着羞怯的悸动"},
                "好感度": {"value": 5, "description": "对你充满好奇，愿意进一步了解"},
                "信任度": {"value": 4, "description": "在这个私密空间中略显放松"},
                "兴奋度": {"value": 5, "description": "内心涌动着期待感"},
                "疲惫度": {"value": 3, "description": "精力充沛，身体充满活力"},
                "欲望值": {"value": 4, "description": "身体开始感受到微妙的渴望"},
                "敏感度": {"value": 6, "description": "肌肤对触碰的反应敏锐"},
                "环境": "私密空间光线暖柔，空气中弥漫甜香",
            }

        if target_lang != "zh":
            if safe_mode:
                base = {
                    "衣着": "Neat, modest outfit in soft tones",
                    "仪态": "Relaxed posture, confident and natural",
                    "情绪": {"value": 6, "description": "Cheerful mood, eager to engage"},
                    "好感度": {"value": 4, "description": "First impressions, polite distance"},
                    "信任度": {"value": 3, "description": "Slightly cautious, trust needs time"},
                    "兴奋度": {"value": 5, "description": "Steady and composed"},
                    "疲惫度": {"value": 3, "description": "Energetic and well-rested"},
                    "环境": "Warm, well-lit indoor space with cozy decor",
                    "动作": "Hands relaxed at the sides, occasionally tidies sleeves",
                    "语气": "Warm and gentle, with a hint of excitement",
                }
            else:
                base = {
                    "胸部": "Soft and full, fabric lightly pressed, subtly rising with breath",
                    "下体": "Warm and sensitive, a faint trace of desire",
                    "衣服": "Close-fitting garments slightly disheveled, outlining enticing curves",
                    "姿势": "Leaning forward a little, an inviting, intimate posture",
                    "情绪": {"value": 6, "description": "Anticipation and shy excitement beneath a warm smile"},
                    "好感度": {"value": 5, "description": "Curious about you, willing to grow closer"},
                    "信任度": {"value": 4, "description": "Relaxing in this private space, still a little guarded"},
                    "兴奋度": {"value": 5, "description": "A steady undercurrent of excitement"},
                    "疲惫度": {"value": 3, "description": "Plenty of energy, body feels lively"},
                    "欲望值": {"value": 4, "description": "A subtle, growing desire"},
                    "敏感度": {"value": 6, "description": "Skin responds keenly to touch"},
                    "环境": "Soft, warm lighting in a private space, air sweet with perfume",
                }

        return base

    async def _ensure_character_default_state(
        self,
        character: Character,
        keys_to_use: Sequence[str],
        safe_mode: bool,
        language: Optional[str] = None,
    ) -> Dict[str, str]:
        normalized_language = self._normalize_language(language)
        fallback_template = self._fallback_state_map(safe_mode, normalized_language)
        try:
            ai_manager = await get_ai_model_manager()
            state_seed = await ai_manager.generate_character_state_seed(
                character,
                language=normalized_language,
            )
            if not isinstance(state_seed, dict):
                state_seed = {}
        except Exception as exc:
            self.logger.warning(
                "Failed to generate default state template for character %s: %s",
                character.id,
                exc,
            )
            state_seed = {}

        merged = fallback_template.copy()
        for key in keys_to_use:
            value = state_seed.get(key)
            normalized = self._normalize_state_value(value)
            if not normalized:
                continue
            if key in self.QUANTIFIABLE_KEYS and isinstance(normalized, dict):
                merged[key] = normalized
            elif key not in self.QUANTIFIABLE_KEYS and isinstance(normalized, str):
                merged[key] = normalized

        target_field = self._default_state_field(normalized_language)
        serialized = json.dumps(merged, ensure_ascii=False)
        setattr(character, target_field, serialized)
        if normalized_language == "zh" and not getattr(character, "default_state_json", None):
            character.default_state_json = serialized
        self.session.add(character)
        await self.session.flush()

        return merged

    def _load_character_template(
        self,
        character: Character,
        language: Optional[str] = None,
    ) -> Optional[Dict[str, str]]:
        normalized_language = self._normalize_language(language)
        if normalized_language == "zh":
            raw = getattr(character, "default_state_json_zh", None) or getattr(
                character, "default_state_json", None
            )
        else:
            raw = getattr(character, "default_state_json_en", None) or getattr(
                character, "default_state_json", None
            )
        if not raw:
            return None
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return self._remap_state_keys(parsed)
        except json.JSONDecodeError:
            self.logger.warning(
                "Invalid default_state_json for character %s; ignoring stored template",
                character.id,
            )
        return None

    async def initialize_state(
        self,
        chat_id: int,
        character: Optional[Character],
        *,
        language: Optional[str] = None,
    ) -> Dict[str, str]:
        if character is None:
            character = await self._load_character(chat_id)

        if character is not None:
            self.logger.debug("Initializing state for chat %s (character=%s)", chat_id, character.name)

        normalized_language = self._normalize_language(language)
        keys_to_use = self._select_keys(character)
        safe_mode = character is not None and getattr(character, "nsfw_level", 0) == 0
        fallback_template = self._fallback_state_map(safe_mode, normalized_language)

        stmt = select(CharacterChatState).where(CharacterChatState.chat_id == chat_id)
        result = await self.session.execute(stmt)
        state_row = result.scalars().first()

        current_state_raw: Dict[str, str] = {}
        if state_row and state_row.state_json:
            try:
                parsed = json.loads(state_row.state_json)
                if isinstance(parsed, dict):
                    current_state_raw = parsed
            except json.JSONDecodeError:
                self.logger.warning("Invalid state JSON for chat %s; regenerating defaults", chat_id)

        filtered_existing = self._filter_state_keys(current_state_raw, keys_to_use)

        base_state = fallback_template.copy()

        if character is not None:
            template = self._load_character_template(character, normalized_language)
            if template is None:
                template = await self._ensure_character_default_state(
                    character,
                    keys_to_use,
                    safe_mode,
                    language=normalized_language,
                )
            for key in keys_to_use:
                normalized = self._normalize_state_value(template.get(key))
                if normalized:
                    base_state[key] = normalized

        # Overlay existing state on top of defaults/template
        base_state.update(filtered_existing)

        if normalized_language:
            base_state = await self._localize_state_values(
                base_state,
                normalized_language,
                fallback_template,
            )

        serialized = json.dumps(base_state, ensure_ascii=False)
        if state_row is None:
            state_row = CharacterChatState(chat_id=chat_id, state_json=serialized)
            self.session.add(state_row)
        else:
            state_row.state_json = serialized

        await self.session.flush()
        return base_state

    async def update_state(
        self,
        chat_id: int,
        state_update: Dict[str, str],
        *,
        language: Optional[str] = None,
    ) -> Dict[str, str]:
        if not state_update:
            raise ValueError("state_update cannot be empty")

        character = await self._load_character(chat_id)
        normalized_language = self._normalize_language(language)
        keys_to_use = self._select_keys(character)
        safe_mode = character is not None and getattr(character, "nsfw_level", 0) == 0

        invalid_keys = set(state_update.keys()) - set(keys_to_use)
        if invalid_keys:
            raise ValueError(f"Invalid state keys: {', '.join(sorted(invalid_keys))}")

        # Ensure we are working with a sanitized baseline state
        current_state = await self.initialize_state(
            chat_id,
            character,
            language=normalized_language,
        )

        fallback_template = self._fallback_state_map(safe_mode, normalized_language)

        for key, value in state_update.items():
            normalized = self._normalize_state_value(value)
            if normalized:
                current_state[key] = normalized
            elif key not in current_state or not current_state[key]:
                current_state[key] = fallback_template.get(key, "")

        if normalized_language:
            current_state = await self._localize_state_values(
                current_state,
                normalized_language,
                fallback_template,
            )

        stmt = (
            select(CharacterChatState)
            .where(CharacterChatState.chat_id == chat_id)
        )
        result = await self.session.execute(stmt)
        state_row = result.scalars().first()
        if state_row is None:
            raise RuntimeError("Failed to load character chat state record after initialization")

        state_row.state_json = json.dumps(current_state, ensure_ascii=False)
        await self.session.flush()
        return current_state
