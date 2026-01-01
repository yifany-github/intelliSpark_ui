"""Async message service for IntelliSpark."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Tuple, Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Chat, ChatMessage, Character
from schemas import ChatMessageCreate
from .character_state_manager import CharacterStateManager


class MessageServiceError(Exception):
    """Message service specific errors."""


class MessageService:
    """Async service for handling message operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.logger = logging.getLogger(__name__)

    @staticmethod
    def _deserialize_state_snapshot(state_json: Optional[str]) -> Optional[Dict[str, Any]]:
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
    def _filter_snapshot_keys(
        snapshot: Optional[Dict[str, Any]],
        keys_to_use: Sequence[str],
    ) -> Optional[Dict[str, Union[str, Dict[str, Any]]]]:
        if not snapshot:
            return None

        filtered: Dict[str, Union[str, Dict[str, Any]]] = {}
        for key in keys_to_use:
            value = snapshot.get(key)
            # Support both string values (descriptive) and dict values (quantified)
            if isinstance(value, str):
                trimmed = value.strip()
                if trimmed:
                    filtered[key] = trimmed
            elif isinstance(value, dict):
                # Quantified state format: {"value": number, "description": string}
                if 'value' in value and 'description' in value:
                    filtered[key] = value

        return filtered if filtered else None

    def _validate_uuid_format(self, uuid_value: UUID) -> None:
        if not isinstance(uuid_value, UUID):
            raise MessageServiceError("Invalid UUID format: must be UUID type")

        try:
            str(uuid_value)
        except (ValueError, TypeError):
            raise MessageServiceError("Invalid UUID format: corrupted UUID object")

    async def _ensure_chat_access(self, chat_id: int, user_id: int) -> Chat:
        stmt = select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
        chat = (await self.db.execute(stmt)).scalars().first()
        if not chat:
            raise MessageServiceError("Chat not found or access denied")
        return chat

    async def get_chat_messages(
        self,
        chat_id: int,
        user_id: int,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        try:
            chat = await self._ensure_chat_access(chat_id, user_id)
            character = await self.db.get(Character, chat.character_id) if chat else None
            keys_to_use = (
                CharacterStateManager.SAFE_KEYS
                if character is not None and getattr(character, "nsfw_level", 0) == 0
                else CharacterStateManager.NSFW_KEYS
            )

            stmt = select(ChatMessage).where(ChatMessage.chat_id == chat_id).order_by(ChatMessage.id)
            if offset:
                stmt = stmt.offset(offset)
            if limit:
                stmt = stmt.limit(limit)

            messages = (await self.db.execute(stmt)).scalars().all()

            return [
                {
                    "id": message.id,
                    "chat_id": message.chat_id,
                    "role": message.role,
                    "content": message.content,
                    "timestamp": message.timestamp.isoformat() + "Z" if message.timestamp else None,
                    "state_snapshot": self._filter_snapshot_keys(
                        self._deserialize_state_snapshot(message.state_snapshot),
                        keys_to_use,
                    ),
                }
                for message in messages
            ]

        except MessageServiceError:
            raise
        except Exception as exc:
            self.logger.error("Error fetching messages for chat %s: %s", chat_id, exc)
            raise MessageServiceError(f"Failed to fetch messages: {exc}") from exc

    async def create_message(
        self,
        message_data: ChatMessageCreate,
        chat_id: int,
        user_id: int,
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        try:
            chat = await self._ensure_chat_access(chat_id, user_id)

            message = ChatMessage(
                chat_id=chat_id,
                chat_uuid=chat.uuid,
                user_id=user_id,
                role=message_data.role,
                content=message_data.content,
            )

            self.db.add(message)
            await self.db.commit()
            await self.db.refresh(message)

            payload = {
                "id": message.id,
                "chat_id": message.chat_id,
                "role": message.role,
                "content": message.content,
                "timestamp": message.timestamp.isoformat() + "Z" if message.timestamp else None,
                "state_snapshot": self._deserialize_state_snapshot(message.state_snapshot),
            }

            self.logger.info("Message created successfully: %s in chat %s", message.id, chat_id)
            return True, payload, None

        except MessageServiceError as exc:
            await self.db.rollback()
            return False, {}, str(exc)
        except Exception as exc:
            await self.db.rollback()
            self.logger.error("Error creating message in chat %s: %s", chat_id, exc)
            return False, {}, f"Message creation failed: {exc}"

    async def get_chat_messages_by_uuid(
        self,
        chat_uuid: UUID,
        user_id: int,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        self._validate_uuid_format(chat_uuid)

        stmt = select(Chat).where(Chat.uuid == chat_uuid, Chat.user_id == user_id)
        chat = (await self.db.execute(stmt)).scalars().first()
        if not chat:
            raise MessageServiceError("Chat not found or access denied")

        return await self.get_chat_messages(chat.id, user_id, limit, offset)

    async def create_message_by_uuid(
        self,
        message_data: ChatMessageCreate,
        chat_uuid: UUID,
        user_id: int,
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        self._validate_uuid_format(chat_uuid)

        stmt = select(Chat).where(Chat.uuid == chat_uuid, Chat.user_id == user_id)
        chat = (await self.db.execute(stmt)).scalars().first()
        if not chat:
            return False, {}, "Chat not found or access denied"

        return await self.create_message(message_data, chat.id, user_id)

    async def delete_message(self, message_id: int, user_id: int) -> Tuple[bool, Optional[str]]:
        # Not yet implemented (legacy behaviour retained)
        return False, "Message deletion not yet implemented"
