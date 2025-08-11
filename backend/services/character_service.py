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

try:
    # Try relative imports first (when used as package)
    from ..models import Character
    from ..schemas import CharacterCreate
    from ..utils.character_utils import transform_character_to_response, transform_character_list_to_response
except ImportError:
    # Fall back to absolute imports (when used directly)
    from models import Character
    from schemas import CharacterCreate
    from utils.character_utils import transform_character_to_response, transform_character_list_to_response


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
    
    def __init__(self, db: Session):
        self.db = db
        self.logger = logging.getLogger(__name__)
    
    async def get_all_characters(self) -> List[Dict[str, Any]]:
        """
        Get all characters with proper transformation
        
        Returns:
            List of character dictionaries in API response format
            
        Raises:
            CharacterServiceError: If database operation fails
        """
        try:
            characters = self.db.query(Character).all()
            return transform_character_list_to_response(characters)
        except Exception as e:
            self.logger.error(f"Error fetching characters: {e}")
            raise CharacterServiceError(f"Failed to fetch characters: {e}")
    
    async def get_character(self, character_id: int) -> Optional[Dict[str, Any]]:
        """
        Get single character by ID
        
        Args:
            character_id: ID of character to retrieve
            
        Returns:
            Character dictionary in API response format, or None if not found
            
        Raises:
            CharacterServiceError: If database operation fails
        """
        try:
            character = self.db.query(Character).filter(Character.id == character_id).first()
            if not character:
                return None
            return transform_character_to_response(character)
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
            
            # Create character in database
            character = Character(
                name=character_data.name,
                description=character_data.description,
                avatar_url=character_data.avatarUrl,
                backstory=character_data.backstory,
                voice_style=character_data.voiceStyle,
                traits=character_data.traits,
                personality_traits=character_data.personalityTraits or {},  # Default to empty dict if None
                category=character_data.category,
                gender=character_data.gender,
                conversation_style=character_data.conversationStyle,
                is_public=character_data.isPublic,
                nsfw_level=character_data.nsfwLevel,
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
        
        # Check category if provided
        valid_categories = ['companion', 'assistant', 'roleplay', 'creative', 'educational']
        if data.category and data.category not in valid_categories:
            return ValidationResult(
                False, 
                f"Category must be one of: {', '.join(valid_categories)}"
            )
        
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
        
        # Check backstory length if provided
        if data.backstory and len(data.backstory) > 3000:
            return ValidationResult(False, "Backstory must be less than 3000 characters")
        
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
        character_data: CharacterCreate, 
        user_id: int
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Update existing character (future implementation)
        
        Args:
            character_id: ID of character to update
            character_data: Updated character data
            user_id: ID of user making the update
            
        Returns:
            (success, character_data, error_message)
        """
        # TODO: Implement character updates with ownership validation
        return False, {}, "Character updates not yet implemented"
    
    async def delete_character(
        self, 
        character_id: int, 
        user_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Delete character (future implementation)
        
        Args:
            character_id: ID of character to delete
            user_id: ID of user requesting deletion
            
        Returns:
            (success, error_message)
        """
        # TODO: Implement character deletion with ownership validation
        return False, "Character deletion not yet implemented"