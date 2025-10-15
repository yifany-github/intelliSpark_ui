"""Async chat service for IntelliSpark."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID

import anyio
from sqlalchemy import delete, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, SessionLocal
from models import Chat, ChatMessage, Character, User
from payment.token_service import TokenService
from schemas import ChatCreate, EnrichedChat
from services.ai_service import AIService
from utils.character_utils import ensure_avatar_url


class ChatServiceError(Exception):
    """Chat service specific errors."""


class ChatService:
    """Async service for handling chat operations."""

    TOKENS_PER_MESSAGE = 1

    def __init__(self, db: AsyncSession):
        """Initialize with a session managed by FastAPI's dependency system."""
        self.db = db
        self.logger = logging.getLogger(__name__)
        self.ai_service = AIService()

    async def get_user_chats(self, user_id: int, character_id: Optional[int] = None, idempotency_key: Optional[str] = None) -> List[Dict[str, Any]]:
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
                        "created_at": chat.created_at.isoformat() + "Z" if chat.created_at else None,
                        "updated_at": chat.updated_at.isoformat() + "Z" if chat.updated_at else None,
                        "character": (
                            {
                                "id": character.id,
                                "name": character.name,
                                "avatarUrl": ensure_avatar_url(character),
                                "description": character.description,
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
                                "timestamp": latest_message.timestamp.isoformat() + "Z"
                                if latest_message.timestamp
                                else None,
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
                "created_at": chat.created_at.isoformat() + "Z" if chat.created_at else None,
                "updated_at": chat.updated_at.isoformat() + "Z" if chat.updated_at else None,
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
                "created_at": chat.created_at.isoformat() + "Z" if chat.created_at else None,
                "updated_at": chat.updated_at.isoformat() + "Z" if chat.updated_at else None,
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
                "lastMessageTimestamp": latest_message.timestamp.isoformat() + "Z"
                if latest_message and latest_message.timestamp
                else None,
                "updatedAt": chat.updated_at.isoformat() + "Z" if chat.updated_at else None,
            }
        except Exception as exc:
            self.logger.error("Error fetching chat status %s: %s", identifier, exc)
            raise ChatServiceError(f"Failed to fetch chat status: {exc}") from exc

    async def create_chat_immediate(
        self,
        chat_data: ChatCreate,
        user_id: int,
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

    async def generate_opening_line_async(self, chat_id: int, character_id: int) -> None:
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

                from .ai_model_manager import get_ai_model_manager

                ai_manager = await get_ai_model_manager()
                opening_line = await ai_manager.generate_opening_line(character)

                session.add(
                    ChatMessage(
                        chat_id=chat_id,
                        chat_uuid=chat.uuid,
                        user_id=chat.user_id,
                        role="assistant",
                        content=opening_line,
                    )
                )
                await session.commit()

                self.logger.info("Background opening line created for chat %s", chat_id)

        except Exception as exc:
            self.logger.error("Background opening line generation failed for chat %s: %s", chat_id, exc)

    async def generate_ai_response(self, chat_id: int, user_id: int) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        try:
            chat_stmt = select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
            chat = (await self.db.execute(chat_stmt)).scalars().first()
            if not chat:
                return False, {}, "Chat not found"

            user_obj = await self.db.get(User, user_id)
            if not user_obj:
                return False, {}, "User not found"

            if not await self._has_sufficient_tokens(user_id, self.TOKENS_PER_MESSAGE):
                return False, {}, "Insufficient tokens. Please purchase more tokens to continue."

            msg_stmt = (
                select(ChatMessage)
                .where(ChatMessage.chat_id == chat_id)
                .order_by(ChatMessage.id)
            )
            messages = (await self.db.execute(msg_stmt)).scalars().all()

            character = await self.db.get(Character, chat.character_id)
            if not character:
                return False, {}, "Character not found"

            from .ai_model_manager import get_ai_model_manager

            ai_manager = await get_ai_model_manager()
            response_content, token_info = await ai_manager.generate_response(
                character=character,
                messages=messages,
                user=user_obj,
            )

            if token_info:
                self.logger.info(
                    "Token usage for chat %s: Input=%s Output=%s Total=%s",
                    chat_id,
                    token_info.get("input_tokens", 0),
                    token_info.get("output_tokens", 0),
                    token_info.get("total_tokens", 0),
                )

            deduction_description = (
                f"AI response generation for chat {chat_id} (Input: {token_info.get('input_tokens', 0)}, "
                f"Output: {token_info.get('output_tokens', 0)})"
                if token_info
                else f"AI response generation for chat {chat_id}"
            )

            success = await self._deduct_tokens(user_id, self.TOKENS_PER_MESSAGE, deduction_description)
            if not success:
                self.logger.error("Failed to deduct tokens for user %s after AI generation", user_id)

            ai_message = ChatMessage(
                chat_id=chat_id,
                chat_uuid=chat.uuid,
                user_id=user_id,
                role="assistant",
                content=response_content,
            )
            self.db.add(ai_message)
            await self.db.commit()
            await self.db.refresh(ai_message)

            message_payload = {
                "id": ai_message.id,
                "chat_id": ai_message.chat_id,
                "role": ai_message.role,
                "content": ai_message.content,
                "timestamp": ai_message.timestamp.isoformat() + "Z" if ai_message.timestamp else None,
            }

            self.logger.info("AI response generated successfully for chat %s", chat_id)
            return True, message_payload, None

        except Exception as exc:
            await self.db.rollback()
            self.logger.error("Error generating AI response for chat %s: %s", chat_id, exc)
            return False, {}, f"AI response generation failed: {exc}"

    async def generate_ai_response_by_uuid(self, chat_uuid: UUID, user_id: int) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        stmt = select(Chat).where(Chat.uuid == chat_uuid, Chat.user_id == user_id)
        chat = (await self.db.execute(stmt)).scalars().first()
        if not chat:
            return False, {}, "Chat not found or access denied"
        return await self.generate_ai_response(chat.id, user_id)

    async def generate_opening_line_by_uuid(self, chat_uuid: UUID, user_id: int) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        stmt = select(Chat).where(Chat.uuid == chat_uuid, Chat.user_id == user_id)
        chat = (await self.db.execute(stmt)).scalars().first()
        if not chat:
            return False, {}, "Chat not found or access denied"
        return await self.generate_opening_line(chat.id, user_id)

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

    async def generate_opening_line(self, chat_id: int, user_id: int) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        try:
            stmt = select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
            chat = (await self.db.execute(stmt)).scalars().first()
            if not chat:
                return False, {}, "Chat not found"

            character = await self.db.get(Character, chat.character_id)
            if not character:
                return False, {}, "Character not found"

            from .ai_model_manager import get_ai_model_manager

            ai_manager = await get_ai_model_manager()
            opening_line = await ai_manager.generate_opening_line(character)

            opening_message = ChatMessage(
                chat_id=chat_id,
                chat_uuid=chat.uuid,
                user_id=user_id,
                role="assistant",
                content=opening_line,
            )
            self.db.add(opening_message)
            await self.db.commit()
            await self.db.refresh(opening_message)

            message_payload = {
                "id": opening_message.id,
                "chat_id": opening_message.chat_id,
                "role": opening_message.role,
                "content": opening_message.content,
                "timestamp": opening_message.timestamp.isoformat() + "Z" if opening_message.timestamp else None,
            }

            self.logger.info("Opening line generated for chat %s", chat_id)
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
