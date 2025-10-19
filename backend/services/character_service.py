"""
Character Service for IntelliSpark AI Chat Application

This service handles all character-related business logic including CRUD operations,
character creation with AI enhancement, and character data transformation.

Features:
- Character CRUD operations
- Data validation for character creation
- Character data transformation for API responses
- Error handling and logging
- Integration with AI service for character enhancement (future)
"""

from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
import logging

from models import Character
from schemas import CharacterCreate
from utils.character_utils import transform_character_to_response, transform_character_list_to_response
from .storage_manager import get_storage_manager, StorageManagerError


class CharacterServiceError(Exception):
    """Character service specific errors"""
    pass


class ValidationResult:
    """Result of character data validation"""
    def __init__(self, is_valid: bool, error: Optional[str] = None):
        self.is_valid = is_valid
        self.error = error


class CharacterService:
    """Service for handling character operations"""
    
    def __init__(self, db: Session, admin_context: bool = False):
        self.db = db
        self.admin_context = admin_context
        self.logger = logging.getLogger(__name__)
    
    async def get_all_characters(self, include_private: bool = None, include_deleted: bool = False) -> List[Dict[str, Any]]:
        """
        Get all characters with proper transformation
        
        Args:
            include_private: Whether to include private characters. 
                           If None, uses admin_context (admin sees all, users see public only)
        
        Returns:
            List of character dictionaries in API response format
            
        Raises:
            CharacterServiceError: If database operation fails
        """
        try:
            query = self.db.query(Character)
            # Exclude soft-deleted characters by default (allow admin override)
            if not include_deleted:
                query = query.filter(Character.is_deleted == False)
            
            # Determine if we should include private characters
            if include_private is None:
                include_private = self.admin_context  # Admin sees all, users see public only
                
            if not include_private:
                query = query.filter(Character.is_public == True)
                
            characters = query.all()
            
            # Only sync from files if explicitly enabled
            from config import settings
            if settings.enable_character_file_sync:
                # Ensure all characters have CSV archetype-based traits (Issue #112) and persona descriptions (Issue #119)
                # Also sync gender/NSFW/category metadata from prompt files
                from utils.character_utils import (
                    get_character_traits_from_archetype_weights, 
                    get_character_description_from_persona,
                    get_character_gender_from_prompt,
                    get_character_category_from_prompt
                )
                
                needs_update = []
                for character in characters:
                    character_updated = False
                    
                    # Update traits to match archetype sampling
                    expected_traits = get_character_traits_from_archetype_weights(character.name)
                    if expected_traits and character.traits != expected_traits:
                        character.traits = expected_traits
                        character_updated = True
                    
                    # Update description and backstory to match persona prompt
                    expected_description = get_character_description_from_persona(character.name)
                    if expected_description and (character.description != expected_description or character.backstory != expected_description):
                        character.description = expected_description
                        character.backstory = expected_description
                        character_updated = True
                    
                    # Update gender from prompt file (only if different)
                    expected_gender = get_character_gender_from_prompt(character.name)
                    if expected_gender and character.gender != expected_gender:
                        self.logger.info(f"Updating {character.name} gender: {character.gender} -> {expected_gender}")
                        character.gender = expected_gender
                        character_updated = True
                    
                    # Update category from prompt file (only if different)
                    expected_category = get_character_category_from_prompt(character.name)
                    if expected_category and character.category != expected_category:
                        self.logger.info(f"Updating {character.name} category: {character.category} -> {expected_category}")
                        character.category = expected_category
                        character_updated = True
                    
                    if character_updated:
                        needs_update.append(character.name)
                
                # Single commit for all updates (performance optimization)
                if needs_update:
                    self.db.commit()
                    self.logger.info(f"Updated metadata (traits/descriptions/gender/category) for characters: {needs_update}")
            else:
                self.logger.debug("Character file sync disabled via config - skipping file-based updates")

            return transform_character_list_to_response(characters, self.db)
        except Exception as e:
            self.logger.error(f"Error fetching characters: {e}")
            raise CharacterServiceError(f"Failed to fetch characters: {e}")
    
    async def get_character(self, character_id: int) -> Optional[Dict[str, Any]]:
        """
        Get single character by ID with CSV archetype-based traits
        
        Args:
            character_id: ID of character to retrieve
            
        Returns:
            Character dictionary in API response format, or None if not found
            
        Raises:
            CharacterServiceError: If database operation fails
        """
        try:
            character = self.db.query(Character).filter(Character.id == character_id, Character.is_deleted == False).first()
            if not character:
                return None
            
            # Only sync from files if explicitly enabled
            from config import settings
            if settings.enable_character_file_sync:
                # Ensure traits match CSV archetype sampling (Issue #112)
                from utils.character_utils import get_character_traits_from_archetype_weights, get_character_description_from_persona
                expected_traits = get_character_traits_from_archetype_weights(character.name)
                
                needs_update = False
                
                if expected_traits and character.traits != expected_traits:
                    # Update traits to match archetype sampling in real-time
                    self.logger.info(f"Updating {character.name} traits to match archetype sampling: {expected_traits}")
                    character.traits = expected_traits
                    needs_update = True
                
                # Ensure description matches persona prompt (Issue #119)
                expected_description = get_character_description_from_persona(character.name)
                
                if expected_description and (character.description != expected_description or character.backstory != expected_description):
                    # Update both description and backstory to match persona prompt in real-time
                    self.logger.info(f"Updating {character.name} description and backstory from persona prompt")
                    character.description = expected_description
                    character.backstory = expected_description
                    needs_update = True
                
                if needs_update:
                    self.db.commit()
            else:
                self.logger.debug("Character file sync disabled via config - skipping file-based updates for individual character")

            return transform_character_to_response(character, self.db)
        except Exception as e:
            self.logger.error(f"Error fetching character {character_id}: {e}")
            raise CharacterServiceError(f"Failed to fetch character {character_id}: {e}")
    
    async def create_character(
        self, 
        character_data: CharacterCreate, 
        user_id: int
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Create new character with validation and AI enhancement
        
        Args:
            character_data: Character creation data from API request
            user_id: ID of user creating the character
            
        Returns:
            (success, character_data, error_message)
        """
        try:
            # Validate character data
            validation_result = self._validate_character_data(character_data)
            if not validation_result.is_valid:
                return False, {}, validation_result.error
            
            # 处理分类标签 - 将多个分类合并到traits中用于搜索
            enhanced_traits = character_data.traits.copy()
            if character_data.categories:
                # 将分类标签添加到traits中，以便搜索和过滤能正常工作
                enhanced_traits.extend(character_data.categories)
                # 去重
                enhanced_traits = list(set(enhanced_traits))

            # Determine persona/backstory values
            backstory_value = character_data.backstory
            if (not backstory_value or backstory_value.strip() == "") and getattr(character_data, 'personaPrompt', None):
                # Mirror persona prompt to backstory for compatibility
                backstory_value = character_data.personaPrompt

            # Create character in database
            character = Character(
                name=character_data.name,
                description=character_data.description,
                avatar_url=character_data.avatarUrl,
                backstory=backstory_value,
                persona_prompt=character_data.personaPrompt,
                voice_style=character_data.voiceStyle,
                traits=enhanced_traits,  # 包含分类标签的扩展traits
                personality_traits=character_data.personalityTraits or {},  # Default to empty dict if None
                category=character_data.category or (character_data.categories[0] if character_data.categories else 'original'),  # 向后兼容
                gender=character_data.gender,
                age=character_data.age,
                nsfw_level=character_data.nsfwLevel or 0,
                conversation_style=character_data.conversationStyle,
                is_public=character_data.isPublic,
                created_by=user_id
            )
            
            self.db.add(character)
            self.db.commit()
            self.db.refresh(character)
            
            # Transform for API response
            response_data = transform_character_to_response(character)
            
            self.logger.info(f"Character created successfully: {character.id} by user {user_id}")
            return True, response_data, None
            
        except Exception as e:
            self.logger.error(f"Error creating character: {e}")
            self.db.rollback()
            return False, {}, f"Character creation failed: {e}"
    
    def _validate_character_data(self, data: CharacterCreate) -> ValidationResult:
        """
        Validate character creation data
        
        Args:
            data: Character creation data to validate
            
        Returns:
            ValidationResult indicating success or failure with error message
        """
        # Check required fields
        if not data.name or len(data.name.strip()) < 2:
            return ValidationResult(False, "Character name must be at least 2 characters")
        
        if len(data.name.strip()) > 100:
            return ValidationResult(False, "Character name must be less than 100 characters")
        
        if not data.description or len(data.description.strip()) < 10:
            return ValidationResult(False, "Description must be at least 10 characters")
        
        if len(data.description.strip()) > 2000:
            return ValidationResult(False, "Description must be less than 2000 characters")
        
        # Category validation disabled - accept any category value
        
        # 验证分类标签
        if data.categories:
            if len(data.categories) > 5:
                return ValidationResult(False, "最多只能选择5个分类标签")
            
            # 验证每个分类标签的格式
            for category in data.categories:
                if not isinstance(category, str) or len(category.strip()) == 0:
                    return ValidationResult(False, "分类标签不能为空")
                if len(category.strip()) > 20:
                    return ValidationResult(False, "分类标签长度不能超过20个字符")
        
        # Check gender if provided
        valid_genders = ['male', 'female', 'non-binary', 'other']
        if data.gender and data.gender not in valid_genders:
            return ValidationResult(
                False,
                f"Gender must be one of: {', '.join(valid_genders)}"
            )
        
        # Check NSFW level
        if data.nsfwLevel is not None and (data.nsfwLevel < 0 or data.nsfwLevel > 3):
            return ValidationResult(False, "NSFW level must be between 0 and 3")
        
        # Check age if provided
        if data.age is not None and (data.age < 1 or data.age > 200):
            return ValidationResult(False, "Age must be between 1 and 200")
        
        # Age requirement for NSFW characters
        if (data.nsfwLevel or 0) > 0:
            if data.age is None or data.age < 18:
                return ValidationResult(False, "NSFW characters must have age 18 or above")
        
        # Check backstory length if provided
        if data.backstory and len(data.backstory) > 3000:
            return ValidationResult(False, "Backstory must be less than 3000 characters")

        # Persona prompt length constraint (server-side enforcement to match UI guidance)
        if getattr(data, 'personaPrompt', None) and len(data.personaPrompt) > 5000:
            return ValidationResult(False, "Persona prompt must be less than or equal to 5000 characters")
        
        # Check traits length if provided
        if data.traits and len(data.traits) > 1000:
            return ValidationResult(False, "Traits must be less than 1000 characters")
        
        return ValidationResult(True)
    
    async def _enhance_character_with_ai(self, data: CharacterCreate) -> Dict[str, Any]:
        """
        Enhance character with AI-generated content (future implementation)
        
        Args:
            data: Character creation data
            
        Returns:
            Enhanced character data with AI-generated prompts and conversation starters
        """
        # TODO: Implement AI enhancement using AIService
        # For now, return original data
        return data.dict()
    
    async def update_character(
        self, 
        character_id: int, 
        character_data, 
        user_id: int,
        is_admin: bool = False
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Update existing character with ownership validation
        
        Args:
            character_id: ID of character to update
            character_data: Updated character data
            user_id: ID of user making the update
            is_admin: Whether the user is an admin (bypasses ownership checks)
            
        Returns:
            (success, character_data, error_message)
        """
        try:
            # Get the character
            character = self.db.query(Character).filter(Character.id == character_id).first()
            if not character:
                return False, {}, "Character not found"
            
            # Check ownership (owner or admin)
            if not is_admin and character.created_by != user_id:
                return False, {}, "You can only edit characters you created"
            
            # Validate required fields if provided
            if hasattr(character_data, 'name') and character_data.name is not None:
                if len(character_data.name.strip()) < 2:
                    return False, {}, "Character name must be at least 2 characters"
                character.name = character_data.name.strip()
            
            if hasattr(character_data, 'description') and character_data.description is not None:
                if len(character_data.description.strip()) < 10:
                    return False, {}, "Description must be at least 10 characters"
                character.description = character_data.description.strip()
            
            if hasattr(character_data, 'personaPrompt') and character_data.personaPrompt is not None:
                if len(character_data.personaPrompt) > 5000:
                    return False, {}, "Persona prompt must be 5000 characters or less"
                character.persona_prompt = character_data.personaPrompt
                # Update backstory if not explicitly provided
                if not (hasattr(character_data, 'backstory') and character_data.backstory):
                    character.backstory = character_data.personaPrompt
            
            if hasattr(character_data, 'backstory') and character_data.backstory is not None:
                character.backstory = character_data.backstory
                
            if hasattr(character_data, 'avatarUrl') and character_data.avatarUrl is not None:
                character.avatar_url = character_data.avatarUrl
                
            if hasattr(character_data, 'voiceStyle') and character_data.voiceStyle is not None:
                character.voice_style = character_data.voiceStyle
                
            if hasattr(character_data, 'traits') and character_data.traits is not None:
                character.traits = character_data.traits
                
            if hasattr(character_data, 'category') and character_data.category is not None:
                character.category = character_data.category
                
            if hasattr(character_data, 'gender') and character_data.gender is not None:
                character.gender = character_data.gender
                
            if hasattr(character_data, 'age') and character_data.age is not None:
                if character_data.age < 1 or character_data.age > 200:
                    return False, {}, "Age must be between 1 and 200"
                character.age = character_data.age
                
            if hasattr(character_data, 'nsfwLevel') and character_data.nsfwLevel is not None:
                if character_data.nsfwLevel not in [0, 1]:
                    return False, {}, "NSFW level must be 0 or 1"
                character.nsfw_level = character_data.nsfwLevel
                
            if hasattr(character_data, 'conversationStyle') and character_data.conversationStyle is not None:
                character.conversation_style = character_data.conversationStyle
                
            if hasattr(character_data, 'isPublic') and character_data.isPublic is not None:
                character.is_public = character_data.isPublic
            
            # Enforce age >= 18 when NSFW is enabled (effective values)
            effective_nsfw = character_data.nsfwLevel if hasattr(character_data, 'nsfwLevel') and character_data.nsfwLevel is not None else character.nsfw_level
            effective_age = character_data.age if hasattr(character_data, 'age') and character_data.age is not None else character.age
            if (effective_nsfw or 0) > 0 and (effective_age is None or effective_age < 18):
                return False, {}, "NSFW characters must have age 18 or above"

            self.db.commit()
            self.db.refresh(character)
            
            # Transform for API response
            response_data = transform_character_to_response(character)
            
            self.logger.info(f"Character updated successfully: {character.id} by user {user_id}")
            return True, response_data, None
            
        except Exception as e:
            self.logger.error(f"Error updating character {character_id}: {e}")
            self.db.rollback()
            return False, {}, f"Character update failed: {e}"
    
    async def delete_character(
        self, 
        character_id: int, 
        user_id: int,
        is_admin: bool = False
    ) -> Tuple[bool, Optional[str]]:
        """
        Delete character with ownership validation
        
        Args:
            character_id: ID of character to delete
            user_id: ID of user requesting deletion
            is_admin: Whether the user is an admin (bypasses ownership checks)
            
        Returns:
            (success, error_message)
        """
        try:
            # Get the character
            character = self.db.query(Character).filter(Character.id == character_id).first()
            if not character:
                return False, "Character not found"
            
            # Check ownership (owner or admin)
            if not is_admin and character.created_by != user_id:
                return False, "You can only delete characters you created"
            
            # Check for dependent chats by other users (safety check)
            from models import Chat
            other_user_chats = self.db.query(Chat).filter(
                Chat.character_id == character_id,
                Chat.user_id != user_id
            ).count()
            
            if other_user_chats > 0:
                return False, "Cannot delete character - other users have active chats with this character. Consider unpublishing instead."
            
            # Safe to delete - remove own chats first
            from models import ChatMessage
            own_chats = self.db.query(Chat).filter(
                Chat.character_id == character_id,
                Chat.user_id == user_id
            ).all()
            
            # Delete chat messages and chats
            for chat in own_chats:
                self.db.query(ChatMessage).filter(ChatMessage.chat_id == chat.id).delete()
                self.db.delete(chat)
            
            # Delete the character (commit first, then cleanup files)
            self.db.delete(character)
            self.db.commit()
            # Cleanup files after successful commit to avoid orphaning DB on cleanup failures
            try:
                await self._cleanup_character_files(character)
            except Exception as fs_err:
                # Non-fatal: we prefer a consistent DB state and can run a later purge
                self.logger.warning(f"Post-commit filesystem cleanup failed for character {character_id}: {fs_err}")
            
            self.logger.info(f"Character deleted: {character_id} by user {user_id} (deleted {len(own_chats)} associated chats)")
            return True, None
            
        except Exception as e:
            self.logger.error(f"Error deleting character {character_id}: {e}")
            self.db.rollback()
            return False, f"Character deletion failed: {e}"
    
    async def get_user_characters(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Get all characters created by a specific user
        
        Args:
            user_id: ID of the user
            
        Returns:
            List of character dictionaries created by the user
        """
        try:
            characters = self.db.query(Character).filter(
                Character.created_by == user_id,
                Character.is_deleted == False
            ).all()
            return transform_character_list_to_response(characters, self.db)
        except Exception as e:
            self.logger.error(f"Error fetching user characters for user {user_id}: {e}")
            raise CharacterServiceError(f"Failed to fetch user characters: {e}")
    
    async def toggle_character_publish(
        self, 
        character_id: int, 
        user_id: int,
        is_admin: bool = False
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Toggle character public/private status
        
        Args:
            character_id: ID of character to toggle
            user_id: ID of user making the request
            is_admin: Whether the user is an admin (bypasses ownership checks)
            
        Returns:
            (success, character_data, error_message)
        """
        try:
            # Get the character
            character = self.db.query(Character).filter(Character.id == character_id).first()
            if not character:
                return False, {}, "Character not found"
            
            # Check ownership (owner or admin)
            if not is_admin and character.created_by != user_id:
                return False, {}, "You can only modify characters you created"
            
            # Toggle public status
            character.is_public = not character.is_public
            
            self.db.commit()
            self.db.refresh(character)
            
            # Transform for API response
            response_data = transform_character_to_response(character)
            
            status = "published" if character.is_public else "unpublished"
            self.logger.info(f"Character {status}: {character.id} by user {user_id}")
            return True, response_data, None
            
        except Exception as e:
            self.logger.error(f"Error toggling publish status for character {character_id}: {e}")
            self.db.rollback()
            return False, {}, f"Failed to toggle publish status: {e}"
    
    # Admin-specific operations
    async def get_admin_character_stats(self) -> Dict[str, Any]:
        """
        Get character statistics for admin dashboard
        
        Returns:
            Dictionary with character usage statistics
            
        Raises:
            CharacterServiceError: If not admin context or database operation fails
        """
        if not self.admin_context:
            raise CharacterServiceError("Admin access required for character statistics")
        
        try:
            from sqlalchemy import func
            from models import Chat
            
            # Get total counts
            total_characters = self.db.query(Character).count()
            public_characters = self.db.query(Character).filter(Character.is_public == True).count()
            private_characters = total_characters - public_characters
            
            # Get most popular characters (by chat count)
            popular_characters = self.db.query(
                Character.name,
                func.count(Chat.id).label('chat_count')
            ).outerjoin(Chat).group_by(Character.id, Character.name).order_by(
                func.count(Chat.id).desc()
            ).limit(5).all()
            
            return {
                "totals": {
                    "total_characters": total_characters,
                    "public_characters": public_characters,
                    "private_characters": private_characters
                },
                "popular_characters": [
                    {"name": char.name, "chat_count": char.chat_count} 
                    for char in popular_characters
                ]
            }
        except Exception as e:
            self.logger.error(f"Error fetching admin character stats: {e}")
            raise CharacterServiceError(f"Failed to fetch character statistics: {e}")
    
    async def admin_update_character(
        self, 
        character_id: int, 
        character_data: CharacterCreate
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Admin-only character update (bypasses ownership checks)
        
        Args:
            character_id: ID of character to update
            character_data: Updated character data
            
        Returns:
            (success, character_data, error_message)
        """
        if not self.admin_context:
            raise CharacterServiceError("Admin access required for character updates")
        
        try:
            character = self.db.query(Character).filter(Character.id == character_id).first()
            if not character:
                return False, {}, "Character not found"
            
            # Update character fields
            character.name = character_data.name
            character.description = character_data.description
            character.avatar_url = character_data.avatarUrl
            # Backstory handling: preserve existing unless an explicit backstory is provided
            if character_data.backstory and character_data.backstory.strip():
                character.backstory = character_data.backstory
            elif getattr(character_data, 'personaPrompt', None) and (not character.backstory or not character.backstory.strip()):
                # Only mirror persona → backstory if current backstory is empty
                character.backstory = character_data.personaPrompt
            character.persona_prompt = character_data.personaPrompt
            character.voice_style = character_data.voiceStyle
            character.traits = character_data.traits
            character.personality_traits = character_data.personalityTraits or {}
            character.category = character_data.category
            character.gender = character_data.gender
            character.age = character_data.age
            character.nsfw_level = character_data.nsfwLevel or 0
            character.conversation_style = character_data.conversationStyle
            character.is_public = character_data.isPublic
            
            self.db.commit()
            self.db.refresh(character)
            
            # Transform for API response
            response_data = transform_character_to_response(character)
            
            self.logger.info(f"Admin updated character: {character.id}")
            return True, response_data, None
            
        except Exception as e:
            self.logger.error(f"Error updating character {character_id}: {e}")
            self.db.rollback()
            return False, {}, f"Character update failed: {e}"
    
    async def admin_delete_character(self, character_id: int) -> Tuple[bool, Optional[str]]:
        """
        Admin-only character deletion (legacy hard delete)
        Prefer using admin_soft_delete_character unless force deletion is required.
        """
        if not self.admin_context:
            raise CharacterServiceError("Admin access required for character deletion")
        
        try:
            character = self.db.query(Character).filter(Character.id == character_id).first()
            if not character:
                return False, "Character not found"
            
            # First, handle any dependent records (chats that reference this character)
            from models import Chat, ChatMessage
            
            # Check if there are any chats using this character
            dependent_chats = self.db.query(Chat).filter(Chat.character_id == character_id).all()
            
            if dependent_chats:
                # Option 1: Delete the dependent chats and their messages
                for chat in dependent_chats:
                    # Delete chat messages first
                    self.db.query(ChatMessage).filter(ChatMessage.chat_id == chat.id).delete()
                    # Delete the chat
                    self.db.delete(chat)
                
                self.logger.info(f"Deleted {len(dependent_chats)} dependent chats for character {character_id}")
            
            # Now delete the character (commit first, then cleanup files)
            self.db.delete(character)
            self.db.commit()
            try:
                await self._cleanup_character_files(character)
            except Exception as fs_err:
                self.logger.warning(f"Post-commit filesystem cleanup failed for character {character_id}: {fs_err}")
            
            self.logger.info(f"Admin deleted character: {character_id} and {len(dependent_chats)} associated chats")
            return True, None
            
        except Exception as e:
            self.logger.error(f"Error deleting character {character_id}: {e}")
            self.db.rollback()
            return False, f"Character deletion failed: {e}"

    async def _cleanup_character_files(self, character) -> None:
        """Remove character gallery directory and avatar file from attached_assets.

        This only runs for hard deletes. Soft-deleted characters retain files.
        """
        storage = get_storage_manager()

        # Remove gallery objects stored under character-specific prefix
        gallery_prefix = f"character_galleries/character_{character.id}"
        try:
            await storage.delete_prefix(gallery_prefix)
            self.logger.info(
                f"Removed gallery assets for character {character.id}: {gallery_prefix}"
            )
        except StorageManagerError as error:
            self.logger.warning(
                f"Failed to remove gallery assets for character {character.id}: {error}"
            )

        # Remove avatar file if it was stored in our managed storage
        try:
            if character.avatar_url:
                storage_path = storage.path_from_public_url(character.avatar_url)
                if storage_path:
                    await storage.delete_object(storage_path)
                    self.logger.info(
                        f"Removed avatar asset for character {character.id}: {storage_path}"
                    )
        except StorageManagerError as error:
            self.logger.warning(
                f"Failed to remove avatar asset for character {character.id}: {error}"
            )

    async def admin_soft_delete_character(self, character_id: int, admin_user_id: int, reason: Optional[str] = None) -> Tuple[bool, Optional[str]]:
        """
        Soft delete a character (mark as deleted without removing data)
        """
        try:
            character = self.db.query(Character).filter(Character.id == character_id).first()
            if not character:
                return False, "Character not found"

            # Mark as deleted and unpublish
            from datetime import datetime
            character.is_deleted = True
            character.deleted_at = datetime.utcnow()
            character.deleted_by = admin_user_id
            character.delete_reason = reason
            character.is_public = False

            self.db.commit()
            self.logger.info(f"Soft-deleted character {character_id} by admin {admin_user_id}")
            return True, None
        except Exception as e:
            self.logger.error(f"Error soft-deleting character {character_id}: {e}")
            self.db.rollback()
            return False, f"Soft delete failed: {e}"

    async def admin_restore_character(self, character_id: int) -> Tuple[bool, Optional[str]]:
        """Restore a soft-deleted character"""
        try:
            character = self.db.query(Character).filter(Character.id == character_id).first()
            if not character:
                return False, "Character not found"
            if not character.is_deleted:
                return False, "Character is not deleted"

            character.is_deleted = False
            character.deleted_at = None
            character.deleted_by = None
            character.delete_reason = None
            # Do not auto-publish; let admin choose visibility explicitly

            self.db.commit()
            self.logger.info(f"Restored character {character_id}")
            return True, None
        except Exception as e:
            self.logger.error(f"Error restoring character {character_id}: {e}")
            self.db.rollback()
            return False, f"Restore failed: {e}"

    async def get_character_impact(self, character_id: int) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """Return counts of users, chats, and messages referencing this character"""
        try:
            from models import Chat, ChatMessage
            # Number of distinct users with chats for this character
            distinct_users = self.db.query(Chat.user_id).filter(Chat.character_id == character_id).distinct().count()
            chats_count = self.db.query(Chat).filter(Chat.character_id == character_id).count()
            # Messages count via join
            messages_count = self.db.query(ChatMessage).join(Chat, ChatMessage.chat_id == Chat.id).filter(Chat.character_id == character_id).count()
            return True, {
                "users_with_chats": distinct_users,
                "chats_count": chats_count,
                "messages_count": messages_count
            }, None
        except Exception as e:
            self.logger.error(f"Error computing impact for character {character_id}: {e}")
            return False, {}, f"Failed to compute impact: {e}"
    
    async def sync_all_discovered_characters(self) -> Dict[str, Any]:
        """
        Sync all discovered character files to database
        
        This method auto-discovers character files and ensures they are properly
        synced to the database with up-to-date metadata.
        
        Returns:
            Dict with sync results: {
                "discovered": int,
                "created": List[str],
                "updated": List[str],
                "errors": List[str]
            }
        """
        from utils.character_discovery import discover_character_files, validate_character_file
        
        try:
            # Discover all character files
            discovered_characters = discover_character_files()
            sync_results = {
                "discovered": len(discovered_characters),
                "created": [],
                "updated": [],
                "renamed": [],
                "errors": []
            }
            
            self.logger.info(f"Starting sync for {len(discovered_characters)} discovered characters")
            
            # First pass: Handle renames by checking for orphaned database characters
            await self._handle_character_renames(discovered_characters, sync_results)
            
            # Second pass: Create or update characters
            for char_name, module_path in discovered_characters.items():
                try:
                    # Check if character exists in database
                    existing = self.db.query(Character).filter(Character.name == char_name).first()
                    
                    if not existing:
                        # Create new character from file
                        success = await self._create_character_from_file(char_name, module_path)
                        if success:
                            sync_results["created"].append(char_name)
                            self.logger.info(f"Created character from file: {char_name}")
                        else:
                            sync_results["errors"].append(f"Failed to create {char_name}")
                    else:
                        # Update existing character from file
                        updates_made = await self._update_character_from_file(existing, module_path)
                        if updates_made:
                            sync_results["updated"].append(char_name)
                            self.logger.debug(f"Updated character from file: {char_name}")
                        else:
                            # No updates needed - this is normal, not an error
                            self.logger.debug(f"No updates needed for character: {char_name}")
                
                except Exception as e:
                    error_msg = f"Error syncing {char_name}: {e}"
                    self.logger.error(error_msg)
                    sync_results["errors"].append(error_msg)
            
            # Single commit for all changes
            if sync_results["created"] or sync_results["updated"] or sync_results["renamed"]:
                self.db.commit()
                self.logger.info(f"Character sync completed - Created: {len(sync_results['created'])}, Updated: {len(sync_results['updated'])}, Renamed: {len(sync_results['renamed'])}, Errors: {len(sync_results['errors'])}")
            
            return sync_results
            
        except Exception as e:
            self.logger.error(f"Error during character sync: {e}")
            self.db.rollback()
            raise CharacterServiceError(f"Character sync failed: {e}")
    
    async def _create_character_from_file(self, char_name: str, module_path: str) -> bool:
        """
        Create new character from file metadata
        
        Args:
            char_name: Name of the character
            module_path: Python module path (e.g., "prompts.characters.艾莉丝")
            
        Returns:
            True if character was created successfully, False otherwise
        """
        try:
            # Import the character module
            import importlib
            module = importlib.import_module(module_path)
            
            # Extract metadata from file
            character_data = {
                "name": char_name,
                "description": getattr(module, 'PERSONA_PROMPT', '')[:500],  # Truncate for description
                "backstory": getattr(module, 'PERSONA_PROMPT', '')[:1000],   # Full backstory  
                "gender": getattr(module, 'CHARACTER_GENDER', 'unknown'),
                "category": getattr(module, 'CHARACTER_CATEGORY', 'general'),
                "voice_style": "default",  # Default voice style for auto-discovered characters
                "is_public": True,  # Auto-discovered characters are public by default
                "created_by": None,  # System-created character
                "traits": [],  # Empty array - will be updated by existing sync system
            }
            
            # Extract persona description if available
            from utils.character_utils import extract_description_from_persona
            persona_description = extract_description_from_persona(character_data["backstory"])
            if persona_description:
                character_data["description"] = persona_description[:500]
                character_data["backstory"] = persona_description
            
            # Create character in database
            new_character = Character(**character_data)
            self.db.add(new_character)
            # Don't commit here - will be committed by sync_all_discovered_characters
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error creating character {char_name} from file: {e}")
            return False
    
    async def _update_character_from_file(self, character: Character, module_path: str) -> bool:
        """
        Update existing character from file metadata
        
        Args:
            character: Existing character database record
            module_path: Python module path (e.g., "prompts.characters.艾莉丝")
            
        Returns:
            True if character was updated successfully, False otherwise
        """
        try:
            # Import the character module
            import importlib
            module = importlib.import_module(module_path)
            
            # Check if any metadata needs updating
            updates_made = False
            
            # Update gender if different
            file_gender = getattr(module, 'CHARACTER_GENDER', None)
            if file_gender and character.gender != file_gender:
                character.gender = file_gender
                updates_made = True
            
            # Note: NSFW level is not stored in Character model, handled at character file level
            
            # Update category if different
            file_category = getattr(module, 'CHARACTER_CATEGORY', None)
            if file_category and character.category != file_category:
                character.category = file_category
                updates_made = True
            
            # Update description/backstory from persona if available
            file_persona = getattr(module, 'PERSONA_PROMPT', None)
            if file_persona:
                from utils.character_utils import extract_description_from_persona
                persona_description = extract_description_from_persona(file_persona)
                
                if persona_description:
                    new_description = persona_description[:500]
                    new_backstory = persona_description
                    
                    if character.description != new_description:
                        character.description = new_description
                        updates_made = True
                    
                    if character.backstory != new_backstory:
                        character.backstory = new_backstory  
                        updates_made = True
            
            # Note: Traits will be updated by the existing sync system in get_all_characters()
            
            return updates_made
            
        except Exception as e:
            self.logger.error(f"Error updating character {character.name} from file: {e}")
            return False
    
    async def _handle_character_renames(self, discovered_characters: dict, sync_results: dict) -> None:
        """
        Handle cases where CHARACTER_NAME in .py file was changed, creating orphaned database records
        
        Args:
            discovered_characters: Dict mapping character names to module paths from files
            sync_results: Sync results dict to update
        """
        try:
            # Get all existing characters from database
            existing_chars = self.db.query(Character).all()
            
            for db_char in existing_chars:
                # Skip if this character name is still in discovered files
                if db_char.name in discovered_characters:
                    continue
                
                # This character is in database but not in discovered files
                # Check if any .py file might have been renamed by checking creation patterns
                potential_match = await self._find_renamed_character(db_char, discovered_characters)
                
                if potential_match:
                    old_name = db_char.name
                    new_name = potential_match["name"]
                    
                    # Update the database character with new name
                    db_char.name = new_name
                    
                    # Update other metadata from the .py file
                    import importlib
                    module = importlib.import_module(potential_match["module_path"])
                    
                    # Update metadata from file
                    if hasattr(module, 'CHARACTER_GENDER'):
                        db_char.gender = getattr(module, 'CHARACTER_GENDER')
                    if hasattr(module, 'CHARACTER_CATEGORY'):
                        db_char.category = getattr(module, 'CHARACTER_CATEGORY')
                    
                    # Update description/backstory from persona
                    if hasattr(module, 'PERSONA_PROMPT'):
                        file_persona = getattr(module, 'PERSONA_PROMPT')
                        from utils.character_utils import extract_description_from_persona
                        persona_description = extract_description_from_persona(file_persona)
                        
                        if persona_description:
                            db_char.description = persona_description[:500]
                            db_char.backstory = persona_description
                    
                    sync_results["renamed"].append(f"{old_name} → {new_name}")
                    self.logger.info(f"Renamed character: {old_name} → {new_name}")
                    
                    # Remove from discovered_characters to prevent duplicate creation
                    discovered_characters.pop(new_name, None)
                    
        except Exception as e:
            self.logger.error(f"Error handling character renames: {e}")
    
    async def _find_renamed_character(self, db_char: Character, discovered_characters: dict) -> Optional[dict]:
        """
        Find if a database character corresponds to a renamed .py file
        
        Uses heuristics like similar metadata, creation time, etc.
        
        Args:
            db_char: Database character that's not in discovered files
            discovered_characters: Dict of discovered character names to module paths
            
        Returns:
            Dict with name and module_path if match found, None otherwise
        """
        try:
            import importlib
            
            for char_name, module_path in discovered_characters.items():
                # Skip if this discovered character already exists in database
                if self.db.query(Character).filter(Character.name == char_name).first():
                    continue
                
                # Load the module to check metadata
                try:
                    module = importlib.import_module(module_path)
                    
                    # Heuristic 1: Check if gender matches
                    file_gender = getattr(module, 'CHARACTER_GENDER', None)
                    if file_gender and db_char.gender and file_gender == db_char.gender:
                        # Additional check: category matches
                        file_category = getattr(module, 'CHARACTER_CATEGORY', None) 
                        if file_category and db_char.category and file_category == db_char.category:
                            return {"name": char_name, "module_path": module_path}
                    
                    # Heuristic 2: Check if persona description partially matches
                    file_persona = getattr(module, 'PERSONA_PROMPT', '')
                    if file_persona and db_char.description:
                        # Simple substring check (first 50 chars)
                        if file_persona[:50].strip() in db_char.description or db_char.description[:50] in file_persona:
                            return {"name": char_name, "module_path": module_path}
                    
                except ImportError:
                    continue
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error finding renamed character for {db_char.name}: {e}")
            return None
