"""
Chat Routes for IntelliSpark AI Chat Application

This module contains HTTP route handlers for chat-related operations.
All business logic is delegated to the ChatService and MessageService.

Routes:
- GET /chats - Get user's chats
- GET /chats/{chat_id} - Get specific chat
- POST /chats - Create new chat
- GET /chats/{chat_id}/messages - Get chat messages
- POST /chats/{chat_id}/messages - Add message to chat
- POST /chats/{chat_id}/generate - Generate AI response
- POST /chats/{chat_id}/opening-line - Generate opening line
- DELETE /chats - Delete all chats
- DELETE /chats/{chat_id} - Delete specific chat
"""

import asyncio
from sqlalchemy import select

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Union, Optional
import logging
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from uuid import UUID
import re

logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

def parse_chat_identifier(chat_id: str) -> tuple[bool, Union[int, UUID]]:
    """
    Parse chat identifier to determine if it's an integer ID or UUID.
    
    Returns:
        tuple: (is_uuid: bool, parsed_value: int | UUID)
    """
    # Check if it's a valid UUID format (accepts both uppercase and lowercase)
    uuid_pattern = r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    if re.match(uuid_pattern, chat_id):
        try:
            return True, UUID(chat_id)
        except ValueError:
            pass
    
    # Try to parse as integer
    try:
        return False, int(chat_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid chat identifier format")

from config import settings
from database import get_async_db
from auth.routes import get_current_user
from backend.services.chat_service import ChatService, ChatServiceError
from backend.services.message_service import MessageService, MessageServiceError
from schemas import (
    Chat as ChatSchema, 
    ChatCreate, 
    EnrichedChat,
    ChatMessage as ChatMessageSchema,
    ChatMessageCreate,
    ChatGenerationSuccess,
    MessageResponse,
    ChatState,
    ChatStateUpdate,
)
from models import User, Chat, Character, CharacterChatState
from backend.services.character_state_manager import CharacterStateManager

# Create router with prefix and tags
router = APIRouter(prefix="/chats", tags=["chats"])

ERROR_STATUS_BY_CODE = {
    "database_error": 500,
    "timeout": 504,
    "rate_limit": 429,
    "breaker_open": 503,
    "moderation_blocked": 400,
    "insufficient_tokens": 402,
    "chat_not_found": 404,
    "user_not_found": 404,
    "character_not_found": 404,
    "state_invalid": 400,
    "unknown": 500,
}


def _log_background_task_result(task: asyncio.Task) -> None:
    """Ensure background tasks surface exceptions in logs."""
    try:
        task.result()
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Background task %s failed: %s", task.get_name() or "chat-task", exc, exc_info=exc)


@router.get("", response_model=List[EnrichedChat])
async def get_chats(
    character_id: Optional[int] = None,
    idempotency_key: Optional[str] = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's chats with character data"""
    try:
        service = ChatService(db)
        return await service.get_user_chats(current_user.id, character_id=character_id, idempotency_key=idempotency_key)
    except ChatServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{chat_id}", response_model=ChatSchema)
async def get_chat(
    chat_id: str,  # Accept string to handle both int and UUID
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific chat by ID or UUID"""
    try:
        # Parse the identifier 
        is_uuid, parsed_id = parse_chat_identifier(chat_id)
        
        service = ChatService(db)
        if is_uuid:
            # Use UUID-based lookup (more secure)
            chat = await service.get_chat_by_uuid(parsed_id, current_user.id)
        else:
            # Legacy integer ID lookup (backward compatibility)
            chat = await service.get_chat(parsed_id, current_user.id)
            
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        return chat
    except ChatServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{chat_id}/status")
async def get_chat_status(
    chat_id: str,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """Return lightweight status metadata for a chat."""
    try:
        is_uuid, parsed_id = parse_chat_identifier(chat_id)
        service = ChatService(db)
        status = await service.get_chat_status(parsed_id, current_user.id, by_uuid=is_uuid)
        if status is None:
            raise HTTPException(status_code=404, detail="Chat not found")
        return status
    except ChatServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=ChatSchema)
async def create_chat(
    chat_data: ChatCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """Create new chat immediately and trigger background AI opening line generation"""
    try:
        service = ChatService(db)
        
        # ✅ FAST: Create chat immediately without waiting for AI generation
        success, chat, error, created = await service.create_chat_immediate(chat_data, current_user.id)

        if not success:
            raise HTTPException(status_code=400, detail=error)

        if chat is None:
            raise HTTPException(status_code=500, detail="Failed to create chat")

        # 🚀 BACKGROUND: Trigger async opening line generation
        if created:
            task = asyncio.create_task(
                service.generate_opening_line_async(
                    chat_id=chat.id,
                    character_id=chat_data.characterId,
                ),
                name=f"generate-opening-line:{getattr(chat, 'uuid', chat.id)}",
            )
            task.add_done_callback(_log_background_task_result)

        # ✅ IMMEDIATE: Return chat for instant navigation
        return chat
        
    except ChatServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{chat_id}/messages", response_model=List[ChatMessageSchema])
async def get_chat_messages(
    chat_id: str,  # Accept string to handle both int and UUID
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """Get messages for a specific chat by ID or UUID"""
    try:
        # Parse the identifier
        is_uuid, parsed_id = parse_chat_identifier(chat_id)
        
        service = MessageService(db)
        if is_uuid:
            return await service.get_chat_messages_by_uuid(parsed_id, current_user.id)
        else:
            return await service.get_chat_messages(parsed_id, current_user.id)
    except MessageServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{chat_id}/messages", response_model=ChatMessageSchema)
@limiter.limit("20/minute")  # 20 messages per minute per IP to prevent spam
async def add_message_to_chat(
    request: Request,
    chat_id: str,  # Accept string to handle both int and UUID
    message_data: ChatMessageCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """Add a message to a chat by ID or UUID"""
    try:
        # Parse the identifier
        is_uuid, parsed_id = parse_chat_identifier(chat_id)
        
        service = MessageService(db)
        if is_uuid:
            success, message, error = await service.create_message_by_uuid(message_data, parsed_id, current_user.id)
        else:
            success, message, error = await service.create_message(message_data, parsed_id, current_user.id)
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        return message
    except MessageServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{chat_id}/generate", response_model=ChatGenerationSuccess)
@limiter.limit("15/minute")  # 15 AI generations per minute per IP (more restrictive)
async def generate_ai_response(
    request: Request,
    chat_id: str,  # Accept string to handle both int and UUID
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """Generate AI response for chat by ID or UUID"""
    try:
        # Parse the identifier
        is_uuid, parsed_id = parse_chat_identifier(chat_id)

        logger.info(f"Generating AI response for chat_id={chat_id}, user_id={current_user.id}")

        service = ChatService(db)
        debug_force_error: Optional[str] = None
        if settings.chat_debug_force_error_header and settings.debug:
            header_value = request.headers.get("X-Debug-Force-Error")
            client_host = request.client.host if request.client else None
            if header_value:
                if getattr(current_user, "is_admin", False) or client_host in {"127.0.0.1", "::1", "localhost"}:
                    debug_force_error = header_value
                else:
                    logger.warning(
                        "Ignoring X-Debug-Force-Error header from host %s (user %s)",
                        client_host or "unknown",
                        getattr(current_user, "id", "anonymous"),
                    )

        if is_uuid:
            success, response, error = await service.generate_ai_response_by_uuid(
                parsed_id,
                current_user.id,
                debug_force_error=debug_force_error,
            )
        else:
            success, response, error = await service.generate_ai_response(
                parsed_id,
                current_user.id,
                debug_force_error=debug_force_error,
            )

        if not success:
            error_code = response.get("code", "unknown")
            status_code = ERROR_STATUS_BY_CODE.get(error_code, 500)
            headers = None
            retry_after = response.get("retryAfterSeconds")
            if retry_after is not None:
                headers = {"Retry-After": str(retry_after)}
            return JSONResponse(status_code=status_code, content={"error": response}, headers=headers)

        return response
    except ChatServiceError as e:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "unknown",
                    "messageKey": "chat.error.unknown",
                    "detail": str(e),
                }
            },
        )


@router.post("/{chat_id}/opening-line")
@limiter.limit("10/minute")  # 10 opening line generations per minute per IP
async def generate_opening_line(
    request: Request,
    chat_id: str,  # Accept string to handle both int and UUID
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """Generate opening line for chat by ID or UUID"""
    try:
        # Parse the identifier
        is_uuid, parsed_id = parse_chat_identifier(chat_id)
        
        service = ChatService(db)
        if is_uuid:
            success, message, error = await service.generate_opening_line_by_uuid(parsed_id, current_user.id)
        else:
            success, message, error = await service.generate_opening_line(parsed_id, current_user.id)
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        return message
    except ChatServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{chat_id}/state", response_model=ChatState)
async def get_chat_state(
    chat_id: str,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
):
    is_uuid, parsed_id = parse_chat_identifier(chat_id)

    stmt = select(Chat).where(Chat.user_id == current_user.id)
    if is_uuid:
        stmt = stmt.where(Chat.uuid == parsed_id)
    else:
        stmt = stmt.where(Chat.id == parsed_id)

    chat = (await db.execute(stmt)).scalars().first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    manager = CharacterStateManager(db)
    character = await db.get(Character, chat.character_id)
    state = await manager.initialize_state(chat.id, character)

    state_row = (
        await db.execute(
            select(CharacterChatState).where(CharacterChatState.chat_id == chat.id)
        )
    ).scalars().first()
    updated_at = (
        state_row.updated_at.isoformat() + "Z" if state_row and state_row.updated_at else None
    )

    return {"chat_id": chat.id, "state": state, "updated_at": updated_at}


@router.post("/{chat_id}/state", response_model=ChatState)
async def update_chat_state(
    chat_id: str,
    payload: ChatStateUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
):
    is_uuid, parsed_id = parse_chat_identifier(chat_id)

    stmt = select(Chat).where(Chat.user_id == current_user.id)
    if is_uuid:
        stmt = stmt.where(Chat.uuid == parsed_id)
    else:
        stmt = stmt.where(Chat.id == parsed_id)

    chat = (await db.execute(stmt)).scalars().first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    manager = CharacterStateManager(db)
    try:
        state = await manager.update_state(chat.id, payload.state_update)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    state_row = (
        await db.execute(
            select(CharacterChatState).where(CharacterChatState.chat_id == chat.id)
        )
    ).scalars().first()
    updated_at = (
        state_row.updated_at.isoformat() + "Z" if state_row and state_row.updated_at else None
    )

    return {"chat_id": chat.id, "state": state, "updated_at": updated_at}


@router.delete("", response_model=MessageResponse)
async def delete_all_chats(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all chats for the current user"""
    try:
        service = ChatService(db)
        success, error = await service.delete_all_chats(current_user.id)
        
        if not success:
            raise HTTPException(status_code=500, detail=error)
        
        return MessageResponse(message="All chats deleted successfully")
    except ChatServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{chat_id}", response_model=MessageResponse)
async def delete_chat(
    chat_id: str,  # Accept string to handle both int and UUID
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a specific chat by ID or UUID"""
    try:
        # Parse the identifier
        is_uuid, parsed_id = parse_chat_identifier(chat_id)
        
        service = ChatService(db)
        if is_uuid:
            success, error = await service.delete_chat_by_uuid(parsed_id, current_user.id)
        else:
            success, error = await service.delete_chat(parsed_id, current_user.id)
        
        if not success:
            raise HTTPException(status_code=500, detail=error)
        
        return MessageResponse(message="Chat deleted successfully")
    except ChatServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))
