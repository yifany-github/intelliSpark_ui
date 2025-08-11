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

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
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


@router.get("/", response_model=List[EnrichedChat])
async def get_chats(
    db: Session = Depends(get_db),
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
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific chat"""
    try:
        service = ChatService(db)
        chat = await service.get_chat(chat_id, current_user.id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        return chat
    except ChatServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=ChatSchema)
async def create_chat(
    chat_data: ChatCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new chat with AI opening line"""
    try:
        service = ChatService(db)
        success, chat, error = await service.create_chat(chat_data, current_user.id)
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        return chat
    except ChatServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{chat_id}/messages", response_model=List[ChatMessageSchema])
async def get_chat_messages(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get messages for a specific chat"""
    try:
        service = MessageService(db)
        return await service.get_chat_messages(chat_id, current_user.id)
    except MessageServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{chat_id}/messages", response_model=ChatMessageSchema)
async def add_message_to_chat(
    chat_id: int,
    message_data: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a message to a chat"""
    try:
        service = MessageService(db)
        success, message, error = await service.create_message(message_data, chat_id, current_user.id)
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        return message
    except MessageServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{chat_id}/generate", response_model=ChatMessageSchema)
async def generate_ai_response(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate AI response for chat"""
    try:
        service = ChatService(db)
        success, response, error = await service.generate_ai_response(chat_id, current_user.id)
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        return response
    except ChatServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{chat_id}/opening-line")
async def generate_opening_line(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate opening line for chat"""
    # TODO: Implement opening line generation in ChatService
    # This is a temporary implementation maintaining the same API
    raise HTTPException(status_code=501, detail="Opening line generation not yet implemented in service layer")


@router.delete("/", response_model=MessageResponse)
async def delete_all_chats(
    db: Session = Depends(get_db),
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
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a specific chat"""
    try:
        service = ChatService(db)
        success, error = await service.delete_chat(chat_id, current_user.id)
        
        if not success:
            raise HTTPException(status_code=500, detail=error)
        
        return MessageResponse(message="Chat deleted successfully")
    except ChatServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))