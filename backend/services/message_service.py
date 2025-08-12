"""
Message Service for IntelliSpark AI Chat Application

This service handles all message-related business logic including message creation,
retrieval, and conversation management.

Features:
- Message CRUD operations
- Conversation history management
- Message validation and formatting
- Integration with chat service
"""

from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
import logging

try:
    from ..models import ChatMessage
    from ..schemas import ChatMessageCreate
except ImportError:
    from models import ChatMessage
    from schemas import ChatMessageCreate


class MessageServiceError(Exception):
    """Message service specific errors"""
    pass


class MessageService:
    """Service for handling message operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.logger = logging.getLogger(__name__)
    
    async def get_chat_messages(
        self, 
        chat_id: int, 
        user_id: int,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get messages for a specific chat
        
        Args:
            chat_id: ID of chat whose messages to retrieve
            user_id: ID of user requesting messages (for authorization)
            limit: Maximum number of messages to return
            offset: Number of messages to skip
            
        Returns:
            List of message dictionaries
            
        Raises:
            MessageServiceError: If database operation fails
        """
        try:
            # First check if chat belongs to current user
            from models import Chat
            chat = self.db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
            if not chat:
                raise MessageServiceError("Chat not found or access denied")
            
            # Get messages for the chat
            query = self.db.query(ChatMessage).filter(ChatMessage.chat_id == chat_id).order_by(ChatMessage.id)
            
            if offset:
                query = query.offset(offset)
            if limit:
                query = query.limit(limit)
            
            messages = query.all()
            
            # Convert to response format
            message_list = []
            for message in messages:
                message_dict = {
                    "id": message.id,
                    "chat_id": message.chat_id,
                    "role": message.role,
                    "content": message.content,
                    "timestamp": message.timestamp.isoformat() + "Z" if message.timestamp else None
                }
                message_list.append(message_dict)
            
            return message_list
        except MessageServiceError:
            raise
        except Exception as e:
            self.logger.error(f"Error fetching messages for chat {chat_id}: {e}")
            raise MessageServiceError(f"Failed to fetch messages: {e}")
    
    async def create_message(
        self,
        message_data: ChatMessageCreate,
        chat_id: int,
        user_id: int
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Create new message in chat
        
        Args:
            message_data: Message creation data
            chat_id: ID of chat to add message to
            user_id: ID of user creating the message
            
        Returns:
            (success, message_data, error_message)
        """
        try:
            # Validate chat exists and user has access
            from models import Chat
            chat = self.db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
            if not chat:
                return False, {}, "Chat not found or access denied"
            
            # Create message
            message = ChatMessage(
                chat_id=chat_id,
                role=message_data.role,
                content=message_data.content
            )
            
            self.db.add(message)
            self.db.commit()
            self.db.refresh(message)
            
            # Return message data
            message_dict = {
                "id": message.id,
                "chat_id": message.chat_id,
                "role": message.role,
                "content": message.content,
                "timestamp": message.timestamp.isoformat() + "Z" if message.timestamp else None
            }
            
            self.logger.info(f"Message created successfully: {message.id} in chat {chat_id}")
            return True, message_dict, None
            
        except Exception as e:
            self.logger.error(f"Error creating message: {e}")
            self.db.rollback()
            return False, {}, f"Message creation failed: {e}"
    
    async def delete_message(
        self,
        message_id: int,
        user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Delete specific message
        
        Args:
            message_id: ID of message to delete
            user_id: ID of user requesting deletion
            
        Returns:
            (success, error_message)
        """
        # TODO: Implement message deletion with ownership validation
        # This will be implemented in Phase 2
        return False, "Message deletion not yet implemented"