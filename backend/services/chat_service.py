"""Async chat service for IntelliSpark."""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID

import anyio
from sqlalchemy import delete, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from asyncpg import exceptions as asyncpg_exceptions

from ..database import AsyncSessionLocal, SessionLocal
from ..models import Chat, ChatMessage, Character, User
from ..payment.token_service import TokenService
from ..schemas import ChatCreate, EnrichedChat
from .ai_service import AIService
from .ai_model_manager import get_ai_model_manager
from .circuit_breaker import BreakerState, CircuitBreaker
from .telemetry import log_chat_generation_attempt
from ..utils.character_utils import ensure_avatar_url
from ..utils.datetime_utils import format_datetime
from ..utils.language_utils import normalize_language_code
from .character_state_manager import CharacterStateManager
from .translation_service import get_translation_service

logger = logging.getLogger(__name__)


class ChatServiceError(Exception):
    """Chat service specific errors."""


class ChatService:
    """Async service for handling chat operations."""

    TOKENS_PER_MESSAGE = 1
    MAX_GENERATION_ATTEMPTS = 3
    RETRY_BACKOFF_SECONDS = (1, 2, 4)

    BREAKER = CircuitBreaker(max_failures=5, reset_timeout=30.0)

    ERROR_MESSAGES = {
        "database_error": "chat.error.database",
        "timeout": "chat.error.timeout",
        "rate_limit": "chat.error.rateLimit",
        "breaker_open": "chat.error.breaker",
        "moderation_blocked": "chat.error.moderation",
        "insufficient_tokens": "chat.error.tokens",
        "chat_not_found": "chat.error.notFound",
        "user_not_found": "chat.error.userNotFound",
        "character_not_found": "chat.error.characterNotFound",
        "state_invalid": "chat.error.stateInvalid",
        "unknown": "chat.error.unknown",
    }

    def __init__(self, db: AsyncSession):
        """Initialize with a session managed by FastAPI's dependency system."""
        self.db = db
        self.logger = logging.getLogger(__name__)
        self.ai_service = AIService()
        self.state_manager = CharacterStateManager(db)

    @staticmethod
    def _serialize_state_snapshot(state: Optional[Dict[str, str]]) -> Optional[str]:
        if not state:
            return None
        try:
            return json.dumps(state, ensure_ascii=False)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _deserialize_state_snapshot(state_json: Optional[str]) -> Optional[Dict[str, str]]:
        if not state_json:
            return None
        try:
            parsed = json.loads(state_json)
            if isinstance(parsed, dict):
                return parsed
        except (TypeError, ValueError, json.JSONDecodeError):
            return None
        return None

    @staticmethod
    def _extract_state_update_from_text(response_text: str) -> Tuple[str, Dict[str, Any]]:
        if not response_text:
            return "", {}

        pattern = r"\[\[STATE_UPDATE\]\](?P<content>.*?)\[\[/STATE_UPDATE\]\]"
        matches = list(re.finditer(pattern, response_text, re.DOTALL))
        if not matches:
            if "[[STATE_UPDATE]]" in response_text:
                cleaned = response_text.split("[[STATE_UPDATE]]", 1)[0].strip()
                return cleaned, {}
            return response_text, {}

        raw_content = matches[0].group("content")
        state_update: Dict[str, Any] = {}

        if raw_content:
            start = raw_content.find("{")
            end = raw_content.rfind("}")
            if start != -1 and end != -1 and start < end:
                candidate = raw_content[start : end + 1]
                try:
                    state_update = json.loads(candidate)
                    if not isinstance(state_update, dict):
                        state_update = {}
                except json.JSONDecodeError:
                    logger.warning("Failed to parse state update block: %s", candidate)

        cleaned = re.sub(pattern, "", response_text, flags=re.DOTALL).strip()
        return cleaned, state_update

    @staticmethod
    def _normalize_language(language: Optional[str]) -> Optional[str]:
        if not language:
            return None
        return normalize_language_code(language)

    def _localized_character_field(
        self,
        character: Character,
        field: str,
        preferred_lang: Optional[str],
    ) -> Optional[str]:
        if not character:
            return None
        lang = self._normalize_language(preferred_lang)
        if lang == "zh":
            localized = getattr(character, f"{field}_zh", None)
            return localized or getattr(character, field, None)
        localized = getattr(character, f"{field}_en", None)
        return localized or getattr(character, field, None)

    async def _ensure_response_language(self, text: str, target_lang: Optional[str]) -> str:
        if not text or not target_lang:
            return text

        translator = get_translation_service()
        if not getattr(translator, "client", None):
            return text

        normalized = self._normalize_language(target_lang) or target_lang
        detected = translator.detect_language(text)
        if normalized in {"zh", "en", "es", "ko"} and detected == normalized:
            return text

        try:
            return await translator.translate_text(text, normalized, context="assistant response")
        except Exception as exc:
            self.logger.warning("Response translation failed: %s", exc)
            return text

    async def get_user_chats(
        self,
        user_id: int,
        character_id: Optional[int] = None,
        idempotency_key: Optional[str] = None,
        preferred_lang: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        try:
            stmt = (
                select(Chat)
                .where(Chat.user_id == user_id)
                .order_by(Chat.updated_at.desc())
            )
            if character_id is not None:
                stmt = stmt.where(Chat.character_id == character_id)
            if idempotency_key is not None:
                stmt = stmt.where(Chat.idempotency_key == idempotency_key)
            chats = (await self.db.execute(stmt)).scalars().all()

            enriched: List[Dict[str, Any]] = []
            needs_commit = False

            for chat in chats:
                character = await self.db.get(Character, chat.character_id)

                if character:
                    from utils.character_utils import get_character_description_from_persona

                    expected_description = get_character_description_from_persona(character.name)
                    if expected_description and (
                        character.description != expected_description
                        or character.backstory != expected_description
                    ):
                        character.description = expected_description
                        character.backstory = expected_description
                        needs_commit = True

                latest_stmt = (
                    select(ChatMessage)
                    .where(ChatMessage.chat_id == chat.id)
                    .order_by(ChatMessage.id.desc())
                    .limit(1)
                )
                latest_message = (await self.db.execute(latest_stmt)).scalars().first()

                count_stmt = select(func.count(ChatMessage.id)).where(ChatMessage.chat_id == chat.id)
                message_count = (await self.db.execute(count_stmt)).scalar() or 0

                enriched.append(
                    {
                        "id": chat.id,
                        "user_id": chat.user_id,
                        "character_id": chat.character_id,
                        "idempotency_key": chat.idempotency_key,
                        "idempotencyKey": chat.idempotency_key,
                        "title": chat.title,
                        "created_at": format_datetime(chat.created_at),
                        "updated_at": format_datetime(chat.updated_at),
                        "character": (
                            {
                                "id": character.id,
                                "name": self._localized_character_field(character, "name", preferred_lang),
                                "avatarUrl": ensure_avatar_url(character),
                                "description": self._localized_character_field(character, "description", preferred_lang),
                            }
                            if character
                            else None
                        ),
                        "lastMessage": (
                            {
                                "role": latest_message.role,
                                "content": (
                                    latest_message.content[:100] + "..."
                                    if len(latest_message.content) > 100
                                    else latest_message.content
                                ),
                                "timestamp": format_datetime(latest_message.timestamp),
                            }
                            if latest_message
                            else None
                        ),
                        "messageCount": message_count,
                    }
                )

            if needs_commit:
                await self.db.commit()

            return enriched

        except Exception as exc:
            self.logger.error("Error fetching user chats: %s", exc)
            raise ChatServiceError(f"Failed to fetch user chats: {exc}") from exc

    async def get_chat(self, chat_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        try:
            stmt = select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
            chat = (await self.db.execute(stmt)).scalars().first()
            if not chat:
                return None

            return {
                "id": chat.id,
                "uuid": chat.uuid,
                "user_id": chat.user_id,
                "character_id": chat.character_id,
                "idempotency_key": chat.idempotency_key,
                "idempotencyKey": chat.idempotency_key,
                "title": chat.title,
                "created_at": format_datetime(chat.created_at),
                "updated_at": format_datetime(chat.updated_at),
            }

        except Exception as exc:
            self.logger.error("Error fetching chat %s: %s", chat_id, exc)
            raise ChatServiceError(f"Failed to fetch chat {chat_id}: {exc}") from exc

    async def get_chat_by_uuid(self, chat_uuid: UUID, user_id: int) -> Optional[Dict[str, Any]]:
        try:
            stmt = select(Chat).where(Chat.uuid == chat_uuid, Chat.user_id == user_id)
            chat = (await self.db.execute(stmt)).scalars().first()
            if not chat:
                return None

            return {
                "id": chat.id,
                "uuid": str(chat.uuid) if chat.uuid else None,
                "user_id": chat.user_id,
                "character_id": chat.character_id,
                "idempotency_key": chat.idempotency_key,
                "idempotencyKey": chat.idempotency_key,
                "title": chat.title,
                "created_at": format_datetime(chat.created_at),
                "updated_at": format_datetime(chat.updated_at),
            }

        except Exception as exc:
            self.logger.error("Error fetching chat by UUID %s: %s", chat_uuid, exc)
            raise ChatServiceError(f"Failed to fetch chat by UUID {chat_uuid}: {exc}") from exc

    async def get_chat_status(
        self,
        identifier: Union[int, UUID],
        user_id: int,
        *,
        by_uuid: bool,
    ) -> Optional[Dict[str, Any]]:
        try:
            if by_uuid:
                stmt = select(Chat).where(Chat.uuid == identifier, Chat.user_id == user_id)
            else:
                stmt = select(Chat).where(Chat.id == identifier, Chat.user_id == user_id)

            chat = (await self.db.execute(stmt)).scalars().first()
            if not chat:
                return None

            count_stmt = select(func.count(ChatMessage.id)).where(ChatMessage.chat_id == chat.id)
            message_count = (await self.db.execute(count_stmt)).scalar() or 0

            latest_message = (
                await self.db.execute(
                    select(ChatMessage)
                    .where(ChatMessage.chat_id == chat.id)
                    .order_by(ChatMessage.id.desc())
                    .limit(1)
                )
            ).scalars().first()

            return {
                "id": chat.id,
                "uuid": str(chat.uuid) if chat.uuid else None,
                "messageCount": message_count,
                "lastMessageId": latest_message.id if latest_message else None,
                "lastMessageRole": latest_message.role if latest_message else None,
                "lastMessageTimestamp": format_datetime(
                    latest_message.timestamp if latest_message else None
                ),
                "updatedAt": format_datetime(chat.updated_at),
            }
        except Exception as exc:
            self.logger.error("Error fetching chat status %s: %s", identifier, exc)
            raise ChatServiceError(f"Failed to fetch chat status: {exc}") from exc

    async def create_chat_immediate(
        self,
        chat_data: ChatCreate,
        user_id: int,
        chat_language: Optional[str] = None,
    ) -> Tuple[bool, Optional[Chat], Optional[str], bool]:
        try:
            if chat_data.idempotencyKey:
                stmt = select(Chat).where(
                    Chat.user_id == user_id,
                    Chat.idempotency_key == chat_data.idempotencyKey,
                )
                existing_chat = (await self.db.execute(stmt)).scalars().first()
                if existing_chat:
                    self.logger.info(
                        "Returning existing chat %s for idempotency key %s",
                        existing_chat.id,
                        chat_data.idempotencyKey,
                    )
                    return True, existing_chat, None, False

            character = await self.db.get(Character, chat_data.characterId)
            if not character:
                return False, None, "Character not found", False

            chat = Chat(
                user_id=user_id,
                character_id=chat_data.characterId,
                title=chat_data.title,
                idempotency_key=chat_data.idempotencyKey,
            )
            self.db.add(chat)
            await self.db.commit()
            await self.db.refresh(chat)

            # Seed persistent state for the chat
            await self.state_manager.initialize_state(chat.id, character, language=chat_language)
            await self.db.commit()

            if not chat.uuid:
                chat.uuid = uuid.uuid4()
                await self.db.commit()
                await self.db.refresh(chat)

            self.logger.info("Chat created immediately: %s (UUID: %s)", chat.id, chat.uuid)
            return True, chat, None, True

        except SQLAlchemyError as exc:
            await self.db.rollback()
            self.logger.error("Error creating chat: %s", exc)
            return False, None, f"Chat creation failed: {exc}", False

    async def generate_opening_line_async(
        self, chat_id: int, character_id: int, chat_language: Optional[str] = None
    ) -> None:
        session: Optional[AsyncSession] = None
        try:
            async with AsyncSessionLocal() as session:
                chat = await session.get(Chat, chat_id)
                if not chat:
                    self.logger.error("Chat %s not found for opening line generation", chat_id)
                    return

                character = await session.get(Character, character_id)
                if not character:
                    self.logger.error("Character %s not found for opening line generation", character_id)
                    return

                existing_assistant = await session.execute(
                    select(func.count())
                    .select_from(ChatMessage)
                    .where(ChatMessage.chat_id == chat_id, ChatMessage.role == "assistant")
                )
                if existing_assistant.scalar() > 0:
                    self.logger.info("Skipping opening line for chat %s; assistant message already exists", chat_id)
                    return

                state_manager = CharacterStateManager(session)
                state = await state_manager.initialize_state(
                    chat_id,
                    character,
                    language=chat_language,
                )

                # Select opening line based on language preference
                opening_line_base = character.opening_line
                if chat_language == "en" and hasattr(character, "opening_line_en") and character.opening_line_en:
                    opening_line_base = character.opening_line_en
                elif chat_language == "zh" and hasattr(character, "opening_line_zh") and character.opening_line_zh:
                    opening_line_base = character.opening_line_zh

                reused = bool(opening_line_base and opening_line_base.strip())
                if reused:
                    opening_line = opening_line_base
                else:
                    ai_manager = await get_ai_model_manager()
                    opening_line = await ai_manager.generate_opening_line(character)
                    if not opening_line or not opening_line.strip():
                        # Fallback opening line in appropriate language
                        if chat_language == "en":
                            opening_line = f"Hello, I'm {character.name}. Nice to meet you."
                        else:
                            opening_line = f"你好，我是{character.name}，很高兴认识你。"
                    character.opening_line = opening_line

                session.add(
                    ChatMessage(
                        chat_id=chat_id,
                        chat_uuid=chat.uuid,
                        user_id=chat.user_id,
                        role="assistant",
                        content=opening_line,
                        state_snapshot=self._serialize_state_snapshot(state),
                    )
                )
                if not reused:
                    session.add(character)
                await session.commit()

                self.ai_service.log_opening_line_usage(
                    character_id=character.id,
                    character_name=character.name,
                    chat_id=chat.id,
                    reused=reused,
                )

                self.logger.info(
                    "Background opening line %s for chat %s", "reused" if reused else "generated", chat_id
                )

        except Exception as exc:
            if session is not None:
                try:
                    await session.rollback()
                except Exception:
                    pass
            self.logger.error("Background opening line generation failed for chat %s: %s", chat_id, exc)

    async def generate_ai_response(
        self,
        chat_id: int,
        user_id: int,
        *,
        chat_language: Optional[str] = None,
        debug_force_error: Optional[str] = None,
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        chat_stmt = select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
        chat = (await self.db.execute(chat_stmt)).scalars().first()
        if not chat:
            return False, self._error_payload("chat_not_found"), "Chat not found"

        chat_uuid_value = getattr(chat, "uuid", None)
        chat_uuid_str = str(chat_uuid_value) if chat_uuid_value else None
        chat_character_id = chat.character_id

        user_obj = await self.db.get(User, user_id)
        if not user_obj:
            return False, self._error_payload("user_not_found"), "User not found"

        if not await self._has_sufficient_tokens(user_id, self.TOKENS_PER_MESSAGE):
            return False, self._error_payload("insufficient_tokens"), "Insufficient tokens"

        character = await self.db.get(Character, chat.character_id)
        if not character:
            return False, self._error_payload("character_not_found"), "Character not found"

        state = await self.state_manager.initialize_state(
            chat.id,
            character,
            language=chat_language,
        )

        msg_stmt = (
            select(ChatMessage)
            .where(ChatMessage.chat_id == chat_id)
            .order_by(ChatMessage.id)
        )
        messages = (await self.db.execute(msg_stmt)).scalars().all()

        breaker_key = chat_uuid_str or str(chat_id)
        breaker_status = await self.BREAKER.before_call(breaker_key)
        if breaker_status.blocked:
            payload = self._error_payload(
                "breaker_open",
                retry_after=breaker_status.retry_after,
                breaker_state=breaker_status.state,
            )
            log_chat_generation_attempt(
                chat_id=chat_id,
                chat_uuid=chat_uuid_str,
                user_id=user_id,
                character_id=chat_character_id,
                breaker_state=breaker_status.state.value,
                attempt=0,
                max_attempts=self.MAX_GENERATION_ATTEMPTS,
                latency_ms=0.0,
                result="blocked",
                error_code="breaker_open",
                retry_after_seconds=breaker_status.retry_after,
            )
            return False, payload, "Circuit breaker open"

        ai_manager = await get_ai_model_manager()

        # Optional debug shortcut to open the breaker immediately.
        if debug_force_error == "breaker":
            forced_status = await self._force_open_breaker(breaker_key)
            payload = self._error_payload(
                "breaker_open",
                retry_after=forced_status.retry_after,
                breaker_state=forced_status.state,
            )
            return False, payload, "Breaker forced open for debug"

        for attempt in range(1, self.MAX_GENERATION_ATTEMPTS + 1):
            start = time.perf_counter()
            try:
                if debug_force_error and attempt == 1 and debug_force_error != "breaker":
                    forced_code = (
                        "database_error" if debug_force_error == "duplicate_statement" else debug_force_error
                    )
                    if forced_code not in self.ERROR_MESSAGES:
                        forced_code = "unknown"
                    raise DebugForcedError(forced_code)

                # Prepare user preferences including chat language
                user_prefs = {}
                if chat_language:
                    user_prefs['chat_language'] = chat_language

                response_content, token_info = await ai_manager.generate_response(
                    character=character,
                    messages=messages,
                    user=user_obj,
                    user_preferences=user_prefs,
                    state=state,
                )

                if token_info and token_info.get("model") in {"error", "fallback"}:
                    raise ChatServiceError("AI service unavailable")

                if chat_language:
                    response_content = await self._ensure_response_language(response_content, chat_language)

                state_update = token_info.pop("state_update", {}) if token_info else {}
                cleaned_content, parsed_update = self._extract_state_update_from_text(response_content)
                if parsed_update:
                    if state_update:
                        state_update = {**parsed_update, **state_update}
                    else:
                        state_update = parsed_update
                response_content = cleaned_content

                try:
                    if state_update:
                        state = await self.state_manager.update_state(
                            chat.id,
                            state_update,
                            language=chat_language,
                        )
                    state_json = self._serialize_state_snapshot(state)

                    message_model = ChatMessage(
                        chat_id=chat_id,
                        chat_uuid=chat_uuid_value,
                        user_id=user_id,
                        role="assistant",
                        content=response_content,
                        state_snapshot=state_json,
                    )
                    self.db.add(message_model)
                    await self.db.commit()
                    await self.db.refresh(message_model)

                except ValueError as exc:
                    await self.db.rollback()
                    latency_ms = (time.perf_counter() - start) * 1000
                    breaker_status = await self.BREAKER.after_success(breaker_key)

                    payload = self._error_payload("state_invalid")
                    payload["detail"] = str(exc)
                    retry_meta = self._retry_meta(
                        attempts=attempt,
                        breaker_state=breaker_status.state,
                    )

                    self.logger.warning("Invalid state update for chat %s: %s", chat.id, exc)
                    log_chat_generation_attempt(
                        chat_id=chat_id,
                        chat_uuid=chat_uuid_str,
                        user_id=user_id,
                        character_id=chat_character_id,
                        breaker_state=breaker_status.state.value,
                        attempt=attempt,
                        max_attempts=self.MAX_GENERATION_ATTEMPTS,
                        latency_ms=latency_ms,
                        result="failure",
                        error_code="state_invalid",
                    )
                    payload["retryMeta"] = retry_meta
                    return False, payload, str(exc)

                deduction_description = (
                    f"AI response generation for chat {chat_id} (Input: {token_info.get('input_tokens', 0)}, "
                    f"Output: {token_info.get('output_tokens', 0)})"
                    if token_info
                    else f"AI response generation for chat {chat_id}"
                )

                token_deducted = await self._deduct_tokens(
                    user_id,
                    self.TOKENS_PER_MESSAGE,
                    deduction_description,
                )
                if not token_deducted:
                    self.logger.error("Failed to deduct tokens for user %s after AI generation", user_id)

                await self.BREAKER.after_success(breaker_key)

                latency_ms = (time.perf_counter() - start) * 1000
                log_chat_generation_attempt(
                    chat_id=chat_id,
                    chat_uuid=chat_uuid_str,
                    user_id=user_id,
                    character_id=chat_character_id,
                    breaker_state=BreakerState.CLOSED.value,
                    attempt=attempt,
                    max_attempts=self.MAX_GENERATION_ATTEMPTS,
                    latency_ms=latency_ms,
                    result="success",
                )

                message_payload = {
                    "id": message_model.id,
                    "chat_id": message_model.chat_id,
                    "role": message_model.role,
                    "content": message_model.content,
                    "audio_url": message_model.audio_url,
                    "audio_status": message_model.audio_status,
                    "audio_error": message_model.audio_error,
                    "timestamp": format_datetime(message_model.timestamp),
                    "state_snapshot": state,
                }

                retry_meta = self._retry_meta(
                    attempts=attempt,
                    breaker_state=BreakerState.CLOSED,
                )

                return True, {"message": message_payload, "retryMeta": retry_meta}, None

            except Exception as exc:
                await self.db.rollback()
                latency_ms = (time.perf_counter() - start) * 1000

                error_code = self._classify_exception(exc)
                breaker_after_failure = await self.BREAKER.after_failure(breaker_key)

                log_chat_generation_attempt(
                    chat_id=chat_id,
                    chat_uuid=chat_uuid_str,
                    user_id=user_id,
                    character_id=chat_character_id,
                    breaker_state=breaker_after_failure.state.value,
                    attempt=attempt,
                    max_attempts=self.MAX_GENERATION_ATTEMPTS,
                    latency_ms=latency_ms,
                    result="failure",
                    error_code=error_code,
                    retry_after_seconds=breaker_after_failure.retry_after,
                )

                should_stop = (
                    attempt == self.MAX_GENERATION_ATTEMPTS
                    or breaker_after_failure.state == BreakerState.OPEN
                )

                if should_stop:
                    payload = self._error_payload(
                        error_code,
                        retry_after=breaker_after_failure.retry_after,
                        breaker_state=breaker_after_failure.state,
                        request_id=f"{chat_uuid_str or chat_id}:attempt-{attempt}",
                    )
                    self.logger.error(
                        "AI response generation failed for chat %s (%s) after %s attempts: %s",
                        chat_id,
                        chat_uuid_str or "unknown",
                        attempt,
                        exc,
                    )
                    return False, payload, str(exc)

                # Backoff before retrying
                backoff = self.RETRY_BACKOFF_SECONDS[min(attempt - 1, len(self.RETRY_BACKOFF_SECONDS) - 1)]
                await anyio.sleep(backoff)

        payload = self._error_payload("unknown")
        return False, payload, "AI response generation failed"

    async def generate_ai_response_by_uuid(
        self,
        chat_uuid: UUID,
        user_id: int,
        *,
        chat_language: Optional[str] = None,
        debug_force_error: Optional[str] = None,
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        stmt = select(Chat).where(Chat.uuid == chat_uuid, Chat.user_id == user_id)
        chat = (await self.db.execute(stmt)).scalars().first()
        if not chat:
            return False, {}, "Chat not found or access denied"
        return await self.generate_ai_response(
            chat.id, user_id, chat_language=chat_language, debug_force_error=debug_force_error
        )

    async def generate_opening_line_by_uuid(
        self, chat_uuid: UUID, user_id: int, *, chat_language: Optional[str] = None
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        stmt = select(Chat).where(Chat.uuid == chat_uuid, Chat.user_id == user_id)
        chat = (await self.db.execute(stmt)).scalars().first()
        if not chat:
            return False, {}, "Chat not found or access denied"
        return await self.generate_opening_line(chat.id, user_id, chat_language=chat_language)

    async def delete_chat(self, chat_id: int, user_id: int) -> Tuple[bool, Optional[str]]:
        try:
            stmt = select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
            chat = (await self.db.execute(stmt)).scalars().first()
            if not chat:
                return False, "Chat not found"

            await self.db.execute(delete(ChatMessage).where(ChatMessage.chat_id == chat_id))
            await self.db.execute(delete(Chat).where(Chat.id == chat_id))
            await self.db.commit()

            self.logger.info("Chat %s deleted by user %s", chat_id, user_id)
            return True, None

        except Exception as exc:
            await self.db.rollback()
            self.logger.error("Error deleting chat %s: %s", chat_id, exc)
            return False, f"Chat deletion failed: {exc}"

    async def delete_chat_by_uuid(self, chat_uuid: UUID, user_id: int) -> Tuple[bool, Optional[str]]:
        try:
            stmt = select(Chat).where(Chat.uuid == chat_uuid, Chat.user_id == user_id)
            chat = (await self.db.execute(stmt)).scalars().first()
            if not chat:
                return False, "Chat not found"

            await self.db.execute(delete(ChatMessage).where(ChatMessage.chat_id == chat.id))
            await self.db.execute(delete(Chat).where(Chat.uuid == chat_uuid))
            await self.db.commit()

            self.logger.info("Chat %s deleted by user %s", chat_uuid, user_id)
            return True, None

        except Exception as exc:
            await self.db.rollback()
            self.logger.error("Error deleting chat %s: %s", chat_uuid, exc)
            return False, f"Chat deletion failed: {exc}"

    async def delete_all_chats(self, user_id: int) -> Tuple[bool, Optional[str]]:
        try:
            stmt = select(Chat.id).where(Chat.user_id == user_id)
            chat_ids = (await self.db.execute(stmt)).scalars().all()

            if chat_ids:
                await self.db.execute(delete(ChatMessage).where(ChatMessage.chat_id.in_(chat_ids)))
                await self.db.execute(delete(Chat).where(Chat.user_id == user_id))

            await self.db.commit()
            self.logger.info("All chats cleared for user %s (%s chats)", user_id, len(chat_ids))
            return True, None

        except Exception as exc:
            await self.db.rollback()
            self.logger.error("Error clearing chats for user %s: %s", user_id, exc)
            return False, f"Failed to clear chat history: {exc}"

    async def generate_opening_line(
        self, chat_id: int, user_id: int, *, chat_language: Optional[str] = None
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        try:
            stmt = select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
            chat = (await self.db.execute(stmt)).scalars().first()
            if not chat:
                return False, {}, "Chat not found"

            chat_character_id = chat.character_id
            chat_uuid_value = getattr(chat, "uuid", None)

            character = await self.db.get(Character, chat_character_id)
            if not character:
                return False, {}, "Character not found"

            state = await self.state_manager.initialize_state(
                chat.id,
                character,
                language=chat_language,
            )

            existing_opening = (
                await self.db.execute(
                    select(ChatMessage)
                    .where(ChatMessage.chat_id == chat_id, ChatMessage.role == "assistant")
                    .order_by(ChatMessage.id)
                )
            ).scalars().first()
            if existing_opening:
                existing_state = self._deserialize_state_snapshot(existing_opening.state_snapshot) or state
                keys_to_use = (
                    CharacterStateManager.SAFE_KEYS
                    if getattr(character, "nsfw_level", 0) == 0
                    else CharacterStateManager.NSFW_KEYS
                )
                if existing_state:
                    existing_state = {
                        key: value
                        for key, value in existing_state.items()
                        if key in keys_to_use and isinstance(value, str) and value.strip()
                    }
                    # Fall back to sanitized state if legacy snapshot was empty after filtering
                    if not existing_state:
                        existing_state = state
                message_payload = {
                    "id": existing_opening.id,
                    "chat_id": existing_opening.chat_id,
                    "role": existing_opening.role,
                    "content": existing_opening.content,
                    "audio_url": existing_opening.audio_url,
                    "audio_status": existing_opening.audio_status,
                    "audio_error": existing_opening.audio_error,
                    "timestamp": format_datetime(existing_opening.timestamp),
                    "state_snapshot": existing_state,
                }
                return True, {"message": message_payload}, None

            # Select opening line based on language preference
            opening_line_base = character.opening_line
            if chat_language == "en" and hasattr(character, "opening_line_en") and character.opening_line_en:
                opening_line_base = character.opening_line_en
            elif chat_language == "zh" and hasattr(character, "opening_line_zh") and character.opening_line_zh:
                opening_line_base = character.opening_line_zh

            reused = bool(opening_line_base and opening_line_base.strip())
            if reused:
                opening_line = opening_line_base
            else:
                ai_manager = await get_ai_model_manager()
                opening_line = await ai_manager.generate_opening_line(character)
                if not opening_line or not opening_line.strip():
                    # Fallback opening line in appropriate language
                    if chat_language == "en":
                        opening_line = f"Hello, I'm {character.name}. Nice to meet you."
                    else:
                        opening_line = f"你好，我是{character.name}，很高兴认识你。"
                character.opening_line = opening_line

            opening_state_json = self._serialize_state_snapshot(state)

            opening_message = ChatMessage(
                chat_id=chat_id,
                chat_uuid=chat_uuid_value,
                user_id=user_id,
                role="assistant",
                content=opening_line,
                state_snapshot=opening_state_json,
            )
            self.db.add(opening_message)
            if not reused:
                self.db.add(character)
            await self.db.commit()
            await self.db.refresh(opening_message)

            message_payload = {
                "id": opening_message.id,
                "chat_id": opening_message.chat_id,
                "role": opening_message.role,
                "content": opening_message.content,
                "audio_url": opening_message.audio_url,
                "audio_status": opening_message.audio_status,
                "audio_error": opening_message.audio_error,
                "timestamp": format_datetime(opening_message.timestamp),
                "state_snapshot": state,
            }

            self.ai_service.log_opening_line_usage(
                character_id=character.id,
                character_name=character.name,
                chat_id=chat.id,
                reused=reused,
            )
            self.logger.info(
                "Opening line %s for chat %s",
                "reused" if reused else "generated",
                chat_id,
            )
            return True, message_payload, None

        except Exception as exc:
            await self.db.rollback()
            self.logger.error("Error generating opening line for chat %s: %s", chat_id, exc)
            return False, {}, f"Opening line generation failed: {exc}"

    async def _has_sufficient_tokens(self, user_id: int, amount: int) -> bool:
        def _worker() -> bool:
            with SessionLocal() as sync_session:
                token_service = TokenService(sync_session)
                return token_service.has_sufficient_balance(user_id, amount)

        return await anyio.to_thread.run_sync(_worker)

    async def _deduct_tokens(self, user_id: int, amount: int, description: str) -> bool:
        def _worker() -> bool:
            with SessionLocal() as sync_session:
                token_service = TokenService(sync_session)
                return token_service.deduct_tokens(user_id, amount, description)

        return await anyio.to_thread.run_sync(_worker)

    async def _force_open_breaker(self, breaker_key: str):
        status = None
        for _ in range(self.BREAKER.max_failures):
            status = await self.BREAKER.after_failure(breaker_key)
        return status

    def _classify_exception(self, exc: Exception) -> str:
        if isinstance(exc, DebugForcedError):
            return exc.code
        if isinstance(exc, asyncpg_exceptions.DuplicatePreparedStatementError):
            return "database_error"
        if isinstance(exc, TimeoutError):
            return "timeout"
        if isinstance(exc, SQLAlchemyError):
            return "database_error"
        return "unknown"

    def _error_payload(
        self,
        code: str,
        *,
        retry_after: Optional[float] = None,
        breaker_state: Optional[BreakerState] = None,
        request_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "code": code,
            "messageKey": self.ERROR_MESSAGES.get(code, self.ERROR_MESSAGES["unknown"]),
        }
        if retry_after is not None:
            payload["retryAfterSeconds"] = max(0, int(retry_after))
            next_allowed = datetime.now(timezone.utc) + timedelta(seconds=retry_after)
            payload["nextAllowedAt"] = next_allowed.isoformat()
        if breaker_state:
            payload["breakerState"] = breaker_state.value
        if request_id:
            payload["requestId"] = request_id
        return payload

    def _retry_meta(
        self,
        *,
        attempts: int,
        breaker_state: BreakerState,
        retry_after: Optional[float] = None,
    ) -> Dict[str, Any]:
        meta: Dict[str, Any] = {
            "attempts": attempts,
            "maxAttempts": self.MAX_GENERATION_ATTEMPTS,
            "breakerState": breaker_state.value,
        }
        if retry_after is not None:
            next_allowed = datetime.now(timezone.utc) + timedelta(seconds=retry_after)
            meta["nextAllowedAt"] = next_allowed.isoformat()
        else:
            meta["nextAllowedAt"] = None
        return meta


class DebugForcedError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code
