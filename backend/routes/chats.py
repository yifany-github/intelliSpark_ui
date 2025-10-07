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

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Union
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

from database import get_async_db
from auth.routes import get_current_user
from services.chat_service import ChatService, ChatServiceError
from services.message_service import MessageService, MessageServiceError
from schemas import (
    Chat as ChatSchema, 
    ChatCreate, 
    EnrichedChat,
    ChatMessage as ChatMessageSchema,
    ChatMessageCreate,
    MessageResponse
)
from models import User

# Create router with prefix and tags
router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=List[EnrichedChat])
async def get_chats(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's chats with character data"""
    try:
        service = ChatService(db)
        return await service.get_user_chats(current_user.id)
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
        success, chat, error = await service.create_chat_immediate(chat_data, current_user.id)
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        # 🚀 BACKGROUND: Trigger async opening line generation
        import asyncio
        asyncio.create_task(service.generate_opening_line_async(
            chat_id=chat.id,
            character_id=chat_data.characterId
        ))
        
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


@router.post("/{chat_id}/generate", response_model=ChatMessageSchema)
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
        if is_uuid:
            success, response, error = await service.generate_ai_response_by_uuid(parsed_id, current_user.id)
        else:
            success, response, error = await service.generate_ai_response(parsed_id, current_user.id)
        
        if not success:
            if "Insufficient tokens" in error:
                raise HTTPException(status_code=402, detail=error)
            else:
                raise HTTPException(status_code=400, detail=error)
        
        return response
    except ChatServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


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
