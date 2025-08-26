"""
Chat Service for IntelliSpark AI Chat Application

This service handles all chat-related business logic including chat creation,
management, AI response generation, and conversation handling.

Features:
- Chat CRUD operations
- AI response generation with token management
- Conversation history management
- Chat enrichment with character data
- User preference handling
"""

from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from uuid import UUID
import logging

try:
    from ..models import Chat, ChatMessage, Character, User
    from ..schemas import ChatCreate, EnrichedChat
    from .ai_service import AIService
    from ..utils.character_utils import ensure_avatar_url
except ImportError:
    from models import Chat, ChatMessage, Character, User
    from schemas import ChatCreate, EnrichedChat
    from services.ai_service import AIService
    from utils.character_utils import ensure_avatar_url


class ChatServiceError(Exception):
    """Chat service specific errors"""
    pass


class ChatService:
    """Service for handling chat operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.logger = logging.getLogger(__name__)
        self.ai_service = AIService()
    
    async def get_user_chats(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Get user's chats with character data enrichment
        
        Args:
            user_id: ID of user whose chats to retrieve
            
        Returns:
            List of enriched chat dictionaries
            
        Raises:
            ChatServiceError: If database operation fails
        """
        try:
            chats = self.db.query(Chat).filter(Chat.user_id == user_id).order_by(Chat.updated_at.desc()).all()
            
            # Enrich with character data
            enriched_chats = []
            for chat in chats:
                character = self.db.query(Character).filter(Character.id == chat.character_id).first()
                
                # Ensure character has up-to-date description from persona prompt (Issue #119)
                if character:
                    from utils.character_utils import get_character_description_from_persona
                    expected_description = get_character_description_from_persona(character.name)
                    
                    if expected_description and (character.description != expected_description or character.backstory != expected_description):
                        # Update description and backstory to match persona prompt in real-time
                        self.logger.info(f"Chat service updating {character.name} description and backstory from persona prompt")
                        character.description = expected_description
                        character.backstory = expected_description
                        self.db.commit()
                
                # Get latest message for preview
                latest_message = self.db.query(ChatMessage).filter(
                    ChatMessage.chat_id == chat.id
                ).order_by(ChatMessage.id.desc()).first()
                
                # Count total messages
                message_count = self.db.query(ChatMessage).filter(
                    ChatMessage.chat_id == chat.id
                ).count()
                
                enriched_chat = {
                    "id": chat.id,
                    "user_id": chat.user_id,
                    "character_id": chat.character_id,
                    "title": chat.title,
                    "created_at": chat.created_at.isoformat() + "Z" if chat.created_at else None,
                    "updated_at": chat.updated_at.isoformat() + "Z" if chat.updated_at else None,
                    "character": {
                        "id": character.id,
                        "name": character.name,
                        "avatarUrl": ensure_avatar_url(character),
                        "description": character.description
                    } if character else None,
                    "lastMessage": {
                        "role": latest_message.role,
                        "content": latest_message.content[:100] + "..." if len(latest_message.content) > 100 else latest_message.content,
                        "timestamp": latest_message.timestamp.isoformat() + "Z" if latest_message.timestamp else None
                    } if latest_message else None,
                    "messageCount": message_count
                }
                enriched_chats.append(enriched_chat)
            
            return enriched_chats
        except Exception as e:
            self.logger.error(f"Error fetching user chats: {e}")
            raise ChatServiceError(f"Failed to fetch user chats: {e}")
    
    async def get_chat(self, chat_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get specific chat with validation
        
        Args:
            chat_id: ID of chat to retrieve
            user_id: ID of user requesting the chat
            
        Returns:
            Chat dictionary or None if not found/unauthorized
            
        Raises:
            ChatServiceError: If database operation fails
        """
        try:
            chat = self.db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
            if not chat:
                return None
            
            # Return basic chat data
            chat_dict = {
                "id": chat.id,
                "user_id": chat.user_id,
                "character_id": chat.character_id,
                "title": chat.title,
                "created_at": chat.created_at.isoformat() + "Z" if chat.created_at else None,
                "updated_at": chat.updated_at.isoformat() + "Z" if chat.updated_at else None
            }
            
            return chat_dict
        except Exception as e:
            self.logger.error(f"Error fetching chat {chat_id}: {e}")
            raise ChatServiceError(f"Failed to fetch chat {chat_id}: {e}")
    
    async def get_chat_by_uuid(self, chat_uuid: UUID, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get specific chat by UUID with validation (secure method)
        
        Args:
            chat_uuid: UUID of chat to retrieve  
            user_id: ID of user requesting the chat
            
        Returns:
            Chat dictionary or None if not found/unauthorized
            
        Raises:
            ChatServiceError: If database operation fails
        """
        try:
            chat = self.db.query(Chat).filter(Chat.uuid == chat_uuid, Chat.user_id == user_id).first()
            if not chat:
                return None
            
            # Return basic chat data with UUID
            chat_dict = {
                "id": chat.id,
                "uuid": str(chat.uuid) if chat.uuid else None,
                "user_id": chat.user_id,
                "character_id": chat.character_id,
                "title": chat.title,
                "created_at": chat.created_at.isoformat() + "Z" if chat.created_at else None,
                "updated_at": chat.updated_at.isoformat() + "Z" if chat.updated_at else None
            }
            
            return chat_dict
        except Exception as e:
            self.logger.error(f"Error fetching chat by UUID {chat_uuid}: {e}")
            raise ChatServiceError(f"Failed to fetch chat by UUID {chat_uuid}: {e}")
    
    async def create_chat_immediate(
        self, 
        chat_data: ChatCreate, 
        user_id: int
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Create new chat immediately without waiting for AI opening line generation.
        AI opening line will be generated asynchronously in the background.
        
        Args:
            chat_data: Chat creation data
            user_id: ID of user creating the chat
            
        Returns:
            (success, chat_data, error_message)
        """
        try:
            # Validate character exists
            character = self.db.query(Character).filter(Character.id == chat_data.characterId).first()
            if not character:
                return False, {}, "Character not found"
            
            # Create chat immediately (fast operation ~50ms)
            chat = Chat(
                user_id=user_id,
                character_id=chat_data.characterId,
                title=chat_data.title
            )
            
            self.db.add(chat)
            self.db.commit()
            self.db.refresh(chat)
            
            self.logger.info(f"Chat created immediately: {chat.id} for user {user_id}")
            # Return immediately without waiting for AI generation
            return True, chat, None
            
        except Exception as e:
            self.logger.error(f"Error creating chat: {e}")
            self.db.rollback()
            return False, {}, f"Chat creation failed: {e}"

    async def generate_opening_line_async(self, chat_id: int, character_id: int):
        """
        Generate opening line asynchronously after chat creation.
        This method runs in the background without blocking chat creation.
        
        Args:
            chat_id: ID of the chat to generate opening line for
            character_id: ID of the character to generate opening line from
        """
        try:
            # Get character for opening line generation
            character = self.db.query(Character).filter(Character.id == character_id).first()
            if not character:
                self.logger.error(f"Character {character_id} not found for opening line generation")
                return
                
            from gemini_service import GeminiService
            gemini_service = GeminiService()
            
            self.logger.info(f"🚀 Generating opening line asynchronously for chat {chat_id}")
            opening_line = await gemini_service.generate_opening_line(character)
            self.logger.info(f"Opening line generated: {opening_line[:50]}...")
            
            # Save opening line as first message
            initial_message = ChatMessage(
                chat_id=chat_id,
                role="assistant",
                content=opening_line
            )
            self.db.add(initial_message)
            self.db.commit()
            
            self.logger.info(f"✅ Background opening line created successfully for chat {chat_id}")
            
        except Exception as e:
            self.logger.error(f"Background opening line generation failed for chat {chat_id}: {e}")
            # Don't raise exception - this is background processing
    
    async def generate_ai_response(
        self, 
        chat_id: int, 
        user_id: int
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Generate AI response for chat with token management
        
        Args:
            chat_id: ID of chat to generate response for
            user_id: ID of user requesting the response
            
        Returns:
            (success, response_data, error_message)
        """
        try:
            # Get the chat and verify it belongs to current user
            chat = self.db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
            if not chat:
                return False, {}, "Chat not found"
            
            # Check token balance before generating response
            try:
                from payment.token_service import TokenService
                token_service = TokenService(self.db)
                
                TOKENS_PER_MESSAGE = 1  # Cost per AI generation
                
                if not token_service.has_sufficient_balance(user_id, TOKENS_PER_MESSAGE):
                    return False, {}, "Insufficient tokens. Please purchase more tokens to continue."
            except ImportError:
                self.logger.warning("Token service not available, skipping token check")
            
            # Get recent messages and character
            messages = self.db.query(ChatMessage).filter(
                ChatMessage.chat_id == chat_id
            ).order_by(ChatMessage.id).all()
            
            character = self.db.query(Character).filter(Character.id == chat.character_id).first()
            
            if not character:
                return False, {}, "Character not found"
            
            # Generate response using Gemini service
            try:
                from gemini_service import GeminiService
                gemini_service = GeminiService()
                
                response_content, token_info = await gemini_service.generate_response(
                    character=character,
                    messages=messages
                )
                
                # Log token usage information
                if token_info:
                    self.logger.info(f"Token usage for chat {chat_id}: Input={token_info.get('input_tokens', 0)}, Output={token_info.get('output_tokens', 0)}, Total={token_info.get('total_tokens', 0)}")
                
                # Deduct tokens after successful generation
                try:
                    token_deduction_success = token_service.deduct_tokens(
                        user_id=user_id,
                        amount=TOKENS_PER_MESSAGE,
                        description=f"AI response generation for chat {chat_id} (Input: {token_info.get('input_tokens', 0)}, Output: {token_info.get('output_tokens', 0)})"
                    )
                    
                    if not token_deduction_success:
                        self.logger.error(f"Failed to deduct tokens for user {user_id} after AI generation")
                except NameError:
                    # token_service not available, skip deduction
                    pass
                
                # Save the AI response
                ai_message = ChatMessage(
                    chat_id=chat_id,
                    role="assistant",
                    content=response_content
                )
                
                self.db.add(ai_message)
                self.db.commit()
                self.db.refresh(ai_message)
                
                # Return message data
                message_dict = {
                    "id": ai_message.id,
                    "chat_id": ai_message.chat_id,
                    "role": ai_message.role,
                    "content": ai_message.content,
                    "timestamp": ai_message.timestamp.isoformat() + "Z" if ai_message.timestamp else None
                }
                
                self.logger.info(f"AI response generated successfully for chat {chat_id}")
                return True, message_dict, None
                
            except Exception as e:
                self.logger.error(f"Error generating AI response: {e}")
                return False, {}, f"AI response generation failed: {e}"
            
        except Exception as e:
            self.logger.error(f"Error in generate_ai_response: {e}")
            self.db.rollback()
            return False, {}, f"AI response generation failed: {e}"
    
    async def delete_chat(
        self, 
        chat_id: int, 
        user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Delete specific chat
        
        Args:
            chat_id: ID of chat to delete
            user_id: ID of user requesting deletion
            
        Returns:
            (success, error_message)
        """
        try:
            # Check if chat exists and belongs to current user
            chat = self.db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
            
            if not chat:
                return False, "Chat not found"
            
            # Delete all messages for this chat first (due to foreign key constraints)
            self.db.query(ChatMessage).filter(ChatMessage.chat_id == chat_id).delete()
            
            # Delete the chat itself
            self.db.query(Chat).filter(Chat.id == chat_id).delete()
            
            self.db.commit()
            
            self.logger.info(f"Chat {chat_id} deleted successfully by user {user_id}")
            return True, None
            
        except Exception as e:
            self.logger.error(f"Error deleting chat {chat_id}: {e}")
            self.db.rollback()
            return False, f"Chat deletion failed: {e}"
    
    async def delete_all_chats(self, user_id: int) -> Tuple[bool, Optional[str]]:
        """
        Delete all chats for a user
        
        Args:
            user_id: ID of user whose chats to delete
            
        Returns:
            (success, error_message)
        """
        try:
            # Get all chats for the current user
            user_chats = self.db.query(Chat).filter(Chat.user_id == user_id).all()
            chat_ids = [chat.id for chat in user_chats]
            
            # Delete all chat messages for these chats first (due to foreign key constraints)
            if chat_ids:
                self.db.query(ChatMessage).filter(ChatMessage.chat_id.in_(chat_ids)).delete()
                # Delete all chats for this user
                self.db.query(Chat).filter(Chat.user_id == user_id).delete()
            
            self.db.commit()
            
            self.logger.info(f"All chats cleared successfully for user {user_id} ({len(chat_ids)} chats deleted)")
            return True, None
            
        except Exception as e:
            self.logger.error(f"Error clearing all chats for user {user_id}: {e}")
            self.db.rollback()
            return False, f"Failed to clear chat history: {e}"
    
    async def generate_opening_line(
        self, 
        chat_id: int, 
        user_id: int
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Generate opening line for a chat
        
        Args:
            chat_id: ID of chat to generate opening line for
            user_id: ID of user requesting the opening line
            
        Returns:
            (success, message_data, error_message)
        """
        try:
            # Get the chat and verify it belongs to current user
            chat = self.db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
            if not chat:
                return False, {}, "Chat not found"
            
            # Get character
            character = self.db.query(Character).filter(Character.id == chat.character_id).first()
            
            if not character:
                return False, {}, "Character not found"
            
            # Generate opening line using Gemini service
            try:
                from gemini_service import GeminiService
                gemini_service = GeminiService()
                
                opening_line = await gemini_service.generate_opening_line(character)
                
                # Save the opening line as the first assistant message
                opening_message = ChatMessage(
                    chat_id=chat_id,
                    role="assistant", 
                    content=opening_line
                )
                
                self.db.add(opening_message)
                self.db.commit()
                self.db.refresh(opening_message)
                
                # Return message data
                message_dict = {
                    "id": opening_message.id,
                    "chat_id": opening_message.chat_id,
                    "role": opening_message.role,
                    "content": opening_message.content,
                    "timestamp": opening_message.timestamp.isoformat() + "Z" if opening_message.timestamp else None
                }
                
                self.logger.info(f"Opening line generated for chat {chat_id}")
                return True, message_dict, None
                
            except Exception as e:
                self.logger.error(f"Error generating opening line: {e}")
                return False, {}, f"Opening line generation failed: {e}"
            
        except Exception as e:
            self.logger.error(f"Error in generate_opening_line: {e}")
            self.db.rollback()
            return False, {}, f"Opening line generation failed: {e}"