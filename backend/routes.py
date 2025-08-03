from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import logging
import uuid
import shutil
from pathlib import Path

from database import get_db
from models import Character, Chat, ChatMessage, User
from schemas import (
    Character as CharacterSchema, CharacterCreate,
    Chat as ChatSchema, ChatMessage as ChatMessageSchema,
    EnrichedChat, ChatCreate, ChatMessageCreate, MessageResponse
)
from gemini_service import GeminiService
from auth.routes import get_current_user
from utils.character_utils import transform_character_to_response, transform_character_list_to_response

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Initialize Gemini service
gemini_service = GeminiService()


# ===== CHARACTERS ROUTES =====

@router.get("/characters")
async def get_characters(db: Session = Depends(get_db)):
    """Get all characters"""
    try:
        characters = db.query(Character).all()
        return transform_character_list_to_response(characters)
    except Exception as e:
        logger.error(f"Error fetching characters: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch characters")

@router.get("/characters/{character_id}")
async def get_character(character_id: int, db: Session = Depends(get_db)):
    """Get a single character by ID"""
    try:
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        
        return transform_character_to_response(character)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching character {character_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch character")

@router.post("/characters")
async def create_character(
    character_data: CharacterCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Create a new character"""
    try:
        # Convert frontend data to database format
        character = Character(
            name=character_data.name,
            description=character_data.description,
            avatar_url=character_data.avatarUrl,
            backstory=character_data.backstory,
            voice_style=character_data.voiceStyle,
            traits=character_data.traits,
            personality_traits=character_data.personalityTraits,
            category=character_data.category,
            gender=character_data.gender,
            age=character_data.age,
            occupation=character_data.occupation,
            hobbies=character_data.hobbies,
            catchphrase=character_data.catchphrase,
            conversation_style=character_data.conversationStyle,
            is_public=character_data.isPublic,
            nsfw_level=character_data.nsfwLevel,
            created_by=current_user.id
        )
        
        db.add(character)
        db.commit()
        db.refresh(character)
        
        # Return in frontend-compatible format
        return transform_character_to_response(character)
    except Exception as e:
        logger.error(f"Error creating character: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create character")

@router.post("/characters/upload-avatar")
async def upload_character_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a character avatar image and return the URL"""
    try:
        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type '{file.content_type}'. Allowed types: {', '.join(allowed_types)}"
            )
        
        # Validate file size (5MB limit)
        max_size = 5 * 1024 * 1024  # 5MB in bytes
        if file.size and file.size > max_size:
            raise HTTPException(
                status_code=400, 
                detail=f"File too large ({file.size} bytes). Maximum size is {max_size} bytes (5MB)"
            )
        
        # Generate unique filename
        file_extension = file.filename.split('.')[-1].lower() if file.filename else 'jpg'
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        
        # Ensure upload directory exists
        current_dir = Path(__file__).parent
        upload_dir = current_dir.parent / "attached_assets" / "user_characters_img"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Save file to disk
        file_path = upload_dir / unique_filename
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            logger.error(f"Failed to save uploaded file: {e}")
            raise HTTPException(status_code=500, detail="Failed to save file")
        
        # Return local URL
        avatar_url = f"/assets/user_characters_img/{unique_filename}"
        logger.info(f"Successfully uploaded avatar: {avatar_url}")
        
        return {
            "avatarUrl": avatar_url,
            "filename": unique_filename,
            "message": "Avatar uploaded successfully"
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error during file upload: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file")

# ===== CHAT ROUTES =====

@router.get("/chats", response_model=List[EnrichedChat])
async def get_chats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all chats with enriched character data"""
    try:
        chats = db.query(Chat).filter(Chat.user_id == current_user.id).all()
        
        # Enrich chats with character data
        enriched_chats = []
        for chat in chats:
            character = db.query(Character).filter(Character.id == chat.character_id).first()
            
            enriched_chat = EnrichedChat(
                id=chat.id,
                user_id=chat.user_id,
                character_id=chat.character_id,
                title=chat.title,
                created_at=chat.created_at,
                updated_at=chat.updated_at,
                character={
                    "id": character.id,
                    "name": character.name,
                    "avatarUrl": character.avatar_url  # Frontend expects avatarUrl
                } if character else None
            )
            enriched_chats.append(enriched_chat)
        
        return enriched_chats
    except Exception as e:
        logger.error(f"Error fetching chats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chats")

@router.get("/chats/{chat_id}")
async def get_chat(chat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get a single chat by ID"""
    try:
        chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Convert to frontend-compatible format
        return {
            "id": chat.id,
            "userId": chat.user_id,
            "characterId": chat.character_id,
            "title": chat.title,
            "createdAt": chat.created_at.isoformat() + "Z",
            "updatedAt": chat.updated_at.isoformat() + "Z"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat")

@router.post("/chats", response_model=ChatSchema)
async def create_chat(chat_data: ChatCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new chat"""
    try:
        # Validate character exists  
        character = db.query(Character).filter(Character.id == chat_data.characterId).first()
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        
        # Use authenticated user instead of hardcoded user_id
        chat = Chat(
            user_id=current_user.id,
            character_id=chat_data.characterId,  # Use frontend field names
            title=chat_data.title
        )
        
        db.add(chat)
        db.commit()
        db.refresh(chat)
        
        if character:
            # Generate character-specific opening line using AI
            opening_line = await gemini_service.generate_opening_line(character)
            
            initial_message = ChatMessage(
                chat_id=chat.id,
                role="assistant",
                content=opening_line
            )
            db.add(initial_message)
            db.commit()
        
        return chat
    except Exception as e:
        logger.error(f"Error creating chat: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create chat")

@router.get("/chats/{chat_id}/messages", response_model=List[ChatMessageSchema])
async def get_chat_messages(chat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all messages for a chat"""
    try:
        # First check if chat belongs to current user
        chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        messages = db.query(ChatMessage).filter(
            ChatMessage.chat_id == chat_id
        ).order_by(ChatMessage.id).all()
        
        return messages
    except Exception as e:
        logger.error(f"Error fetching messages for chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat messages")

@router.post("/chats/{chat_id}/messages", response_model=ChatMessageSchema)
async def add_chat_message(
    chat_id: int, 
    message_data: ChatMessageCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a message to a chat"""
    try:
        # First check if chat belongs to current user
        chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        message = ChatMessage(
            chat_id=chat_id,
            role=message_data.role,
            content=message_data.content
        )
        
        db.add(message)
        db.commit()
        db.refresh(message)
        
        return message
    except Exception as e:
        logger.error(f"Error adding message to chat {chat_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create message")

@router.post("/chats/{chat_id}/generate", response_model=ChatMessageSchema)
async def generate_ai_response(chat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generate AI response for a chat"""
    try:
        # Get the chat and verify it belongs to current user
        chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Check token balance before generating response
        from payment.token_service import TokenService
        token_service = TokenService(db)
        
        TOKENS_PER_MESSAGE = 1  # Cost per AI generation
        
        if not token_service.has_sufficient_balance(current_user.id, TOKENS_PER_MESSAGE):
            raise HTTPException(
                status_code=402,  # Payment Required
                detail="Insufficient tokens. Please purchase more tokens to continue."
            )
        
        # Get recent messages and character
        messages = db.query(ChatMessage).filter(
            ChatMessage.chat_id == chat_id
        ).order_by(ChatMessage.id).all()
        
        character = db.query(Character).filter(Character.id == chat.character_id).first()
        
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        
        # Get user preferences for AI generation
        user_preferences = {
            'temperature': getattr(current_user, 'temperature', 0.8),
            'nsfw_level': getattr(current_user, 'nsfw_level', 1)
        }
        
        # Generate response using Enhanced Gemini
        response_content, token_info = await gemini_service.generate_response(
            character=character,
            messages=messages,
            user_preferences=user_preferences
        )
        
        # Log token usage information
        if token_info:
            logger.info(f"Token usage for chat {chat_id}: Input={token_info.get('input_tokens', 0)}, Output={token_info.get('output_tokens', 0)}, Total={token_info.get('total_tokens', 0)}")
        
        # Deduct tokens after successful generation
        token_deduction_success = token_service.deduct_tokens(
            user_id=current_user.id,
            amount=TOKENS_PER_MESSAGE,
            description=f"AI response generation for chat {chat_id} (Input: {token_info.get('input_tokens', 0)}, Output: {token_info.get('output_tokens', 0)})"
        )
        
        if not token_deduction_success:
            logger.error(f"Failed to deduct tokens for user {current_user.id} after AI generation")
            # We could either raise an error here or log it and continue
            # For now, let's continue but log the error
        
        # Save the AI response
        ai_message = ChatMessage(
            chat_id=chat_id,
            role="assistant",
            content=response_content
        )
        
        db.add(ai_message)
        db.commit()
        db.refresh(ai_message)
        
        return ai_message
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating AI response for chat {chat_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to generate AI response")

@router.post("/chats/{chat_id}/opening-line")
async def generate_opening_line(chat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generate an opening line for a new chat"""
    try:
        # Get the chat and verify it belongs to current user
        chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Get character
        character = db.query(Character).filter(Character.id == chat.character_id).first()
        
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        
        # Generate opening line
        opening_line = await gemini_service.generate_opening_line(character)
        
        # Save the opening line as the first assistant message
        opening_message = ChatMessage(
            chat_id=chat_id,
            role="assistant", 
            content=opening_line
        )
        
        db.add(opening_message)
        db.commit()
        db.refresh(opening_message)
        
        return opening_message
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating opening line for chat {chat_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to generate opening line")

@router.delete("/chats", response_model=MessageResponse)
async def clear_all_chats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Clear all chat history for the current user"""
    try:
        # Get all chats for the current user
        user_chats = db.query(Chat).filter(Chat.user_id == current_user.id).all()
        chat_ids = [chat.id for chat in user_chats]
        
        # Delete all chat messages for these chats first (due to foreign key constraints)
        if chat_ids:
            db.query(ChatMessage).filter(ChatMessage.chat_id.in_(chat_ids)).delete()
            # Delete all chats for this user
            db.query(Chat).filter(Chat.user_id == current_user.id).delete()
        
        db.commit()
        
        return MessageResponse(message="Chat history cleared successfully")
    except Exception as e:
        logger.error(f"Error clearing chat history: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to clear chat history")

@router.delete("/chats/{chat_id}", response_model=MessageResponse)
async def delete_single_chat(chat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a specific chat and all its messages"""
    try:
        # Check if chat exists and belongs to current user
        chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
        
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Delete all messages for this chat first (due to foreign key constraints)
        db.query(ChatMessage).filter(ChatMessage.chat_id == chat_id).delete()
        
        # Delete the chat itself
        db.query(Chat).filter(Chat.id == chat_id).delete()
        
        db.commit()
        
        return MessageResponse(message="Chat deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat {chat_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete chat")