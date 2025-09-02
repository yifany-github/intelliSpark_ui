"""
Character Gallery Service for IntelliSpark AI Chat Application

This service handles all character gallery operations including:
- Multi-image management for characters
- Gallery data retrieval and formatting
- Image upload and processing
- Gallery statistics and metadata
- Thumbnail generation and optimization

Features:
- Backward compatibility with single avatar_url system
- Automatic thumbnail generation
- Image categorization and ordering
- Bulk gallery operations
- Performance optimization with caching
"""

from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, asc
from pathlib import Path
import logging
import asyncio
from datetime import datetime

from models import Character, CharacterGalleryImage, User
from services.upload_service import UploadService
from utils.file_validation import comprehensive_image_validation


class CharacterGalleryServiceError(Exception):
    """Character gallery service specific errors"""
    pass


class CharacterGalleryService:
    """Service for handling character gallery operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.logger = logging.getLogger(__name__)
        self.upload_service = UploadService()
        self.gallery_base_path = Path(__file__).parent.parent.parent / "attached_assets" / "character_galleries"
    
    async def get_character_gallery(self, character_id: int, include_avatar_in_images: bool = False) -> Dict[str, Any]:
        """
        Get complete gallery data for a character
        
        Args:
            character_id: ID of the character
            
        Returns:
            Dictionary containing gallery data and images
            
        Raises:
            CharacterGalleryServiceError: If character not found or error occurs
        """
        try:
            # Get character with gallery data
            character = self.db.query(Character).filter(Character.id == character_id).first()
            if not character:
                raise CharacterGalleryServiceError(f"Character with ID {character_id} not found")
            
            # Get all active gallery images ordered by display_order
            gallery_images = self.db.query(CharacterGalleryImage).filter(
                and_(
                    CharacterGalleryImage.character_id == character_id,
                    CharacterGalleryImage.is_active == True
                )
            ).order_by(
                desc(CharacterGalleryImage.is_primary),  # Primary images first
                asc(CharacterGalleryImage.display_order),
                asc(CharacterGalleryImage.created_at)
            ).all()
            
            # Determine primary/profile image
            primary = await self._get_primary_image(gallery_images, character)

            # Format images
            formatted_images = [await self._format_gallery_image(img) for img in gallery_images]

            # Optionally ensure avatar/primary is first (for user gallery display),
            # but do not inject into admin lists to avoid non-DB items
            if include_avatar_in_images:
                # Force profile to be the character avatar if available
                if character.avatar_url:
                    primary = {
                        "id": None,
                        "url": character.avatar_url,
                        "thumbnail_url": None,
                        "alt_text": f"{character.name} character image",
                        "category": "portrait",
                        "display_order": 0,
                        "is_primary": True,
                        "file_size": None,
                        "dimensions": None,
                        "file_format": None,
                        "created_at": None,
                        "is_gallery_image": False
                    }

                # Ensure avatar/primary is first in images for user-facing gallery
                
                if primary.get("id") is not None:
                    # Primary is a real gallery image — move it to front
                    try:
                        idx = next(i for i, img in enumerate(formatted_images) if img.get("id") == primary.get("id"))
                        if idx != 0:
                            formatted_images.insert(0, formatted_images.pop(idx))
                    except StopIteration:
                        pass
                else:
                    # Primary is avatar fallback; inject as first if not duplicate by URL
                    if not any(img.get("url") == primary.get("url") for img in formatted_images):
                        formatted_images.insert(0, primary)

            # Format gallery response
            gallery_data = {
                "character_id": character_id,
                "character_name": character.name,
                "total_images": len(gallery_images),
                "gallery_enabled": character.gallery_enabled or len(gallery_images) > 1,
                "primary_image": primary,
                "images": formatted_images,
                "categories": await self._get_image_categories(gallery_images),
                "last_updated": character.gallery_updated_at.isoformat() + "Z" if character.gallery_updated_at else None,
                "fallback_avatar": character.avatar_url  # Backward compatibility
            }
            
            self.logger.info(f"Retrieved gallery for character '{character.name}': {len(gallery_images)} images")
            return gallery_data
            
        except CharacterGalleryServiceError:
            raise
        except Exception as e:
            self.logger.error(f"Error getting character gallery: {e}")
            raise CharacterGalleryServiceError(f"Failed to get character gallery: {e}")
    
    async def add_gallery_image(
        self,
        character_id: int,
        image_data: Dict[str, Any],
        uploaded_by: int,
        is_primary: bool = False
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Add new image to character gallery
        
        Args:
            character_id: ID of the character
            image_data: Image data including URL, metadata, etc.
            uploaded_by: ID of user uploading the image
            is_primary: Whether this should be the primary image
            
        Returns:
            (success, image_data, error_message)
        """
        try:
            # Verify character exists
            character = self.db.query(Character).filter(Character.id == character_id).first()
            if not character:
                return False, {}, f"Character with ID {character_id} not found"
            
            # If caller requested primary, unset others
            if is_primary:
                await self._unset_primary_images(character_id)
            
            # Determine display order
            display_order = await self._get_next_display_order(character_id)
            
            # Create gallery image record
            gallery_image = CharacterGalleryImage(
                character_id=character_id,
                image_url=image_data.get('image_url'),
                thumbnail_url=image_data.get('thumbnail_url'),
                alt_text=image_data.get('alt_text') or f"{character.name} gallery image",
                category=image_data.get('category', 'general'),
                display_order=display_order,
                is_primary=is_primary,
                file_size=image_data.get('file_size'),
                dimensions=image_data.get('dimensions'),
                file_format=image_data.get('file_format'),
                uploaded_by=uploaded_by
            )
            
            self.db.add(gallery_image)
            self.db.commit()
            self.db.refresh(gallery_image)
            
            # Update character gallery statistics
            await self._update_character_gallery_stats(character_id)
            
            # Format response
            response_data = await self._format_gallery_image(gallery_image)
            
            self.logger.info(f"Added gallery image for character '{character.name}': {gallery_image.id}")
            return True, response_data, None
            
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error adding gallery image: {e}")
            return False, {}, f"Failed to add gallery image: {e}"
    
    async def update_primary_image(self, character_id: int, image_id: int) -> Tuple[bool, Optional[str]]:
        """
        Set a specific image as the primary image for a character
        
        Args:
            character_id: ID of the character
            image_id: ID of the image to set as primary
            
        Returns:
            (success, error_message)
        """
        try:
            # Verify image exists and belongs to character
            gallery_image = self.db.query(CharacterGalleryImage).filter(
                and_(
                    CharacterGalleryImage.id == image_id,
                    CharacterGalleryImage.character_id == character_id,
                    CharacterGalleryImage.is_active == True
                )
            ).first()
            
            if not gallery_image:
                return False, f"Gallery image with ID {image_id} not found for character {character_id}"
            
            # Unset other primary images
            await self._unset_primary_images(character_id)
            
            # Set this image as primary
            gallery_image.is_primary = True
            gallery_image.updated_at = datetime.utcnow()
            
            self.db.commit()
            
            # Update character gallery stats
            await self._update_character_gallery_stats(character_id)
            
            self.logger.info(f"Set image {image_id} as primary for character {character_id}")
            return True, None
            
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error updating primary image: {e}")
            return False, f"Failed to update primary image: {e}"
    
    async def delete_gallery_image(self, character_id: int, image_id: int) -> Tuple[bool, Optional[str]]:
        """
        Soft delete a gallery image
        
        Args:
            character_id: ID of the character
            image_id: ID of the image to delete
            
        Returns:
            (success, error_message)
        """
        try:
            # Find and verify image
            gallery_image = self.db.query(CharacterGalleryImage).filter(
                and_(
                    CharacterGalleryImage.id == image_id,
                    CharacterGalleryImage.character_id == character_id,
                    CharacterGalleryImage.is_active == True
                )
            ).first()
            
            if not gallery_image:
                return False, f"Gallery image with ID {image_id} not found"
            
            # Soft delete
            gallery_image.is_active = False
            gallery_image.updated_at = datetime.utcnow()
            
            self.db.commit()
            
            # Update character gallery stats
            await self._update_character_gallery_stats(character_id)
            
            self.logger.info(f"Soft deleted gallery image {image_id} for character {character_id}")
            return True, None
            
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error deleting gallery image: {e}")
            return False, f"Failed to delete gallery image: {e}"
    
    async def reorder_gallery_images(
        self,
        character_id: int,
        image_order: List[Dict[str, int]]
    ) -> Tuple[bool, Optional[str]]:
        """
        Reorder gallery images
        
        Args:
            character_id: ID of the character
            image_order: List of {image_id, display_order} dictionaries
            
        Returns:
            (success, error_message)
        """
        try:
            # Update display orders
            for order_item in image_order:
                image_id = order_item.get('image_id')
                display_order = order_item.get('display_order')
                
                gallery_image = self.db.query(CharacterGalleryImage).filter(
                    and_(
                        CharacterGalleryImage.id == image_id,
                        CharacterGalleryImage.character_id == character_id,
                        CharacterGalleryImage.is_active == True
                    )
                ).first()
                
                if gallery_image:
                    gallery_image.display_order = display_order
                    gallery_image.updated_at = datetime.utcnow()
            
            self.db.commit()
            
            self.logger.info(f"Reordered {len(image_order)} gallery images for character {character_id}")
            return True, None
            
        except Exception as e:
            self.db.rollback()
            self.logger.error(f"Error reordering gallery images: {e}")
            return False, f"Failed to reorder gallery images: {e}"
    
    # Private helper methods
    
    async def _get_primary_image(self, gallery_images: List[CharacterGalleryImage], character: Character) -> Dict[str, Any]:
        """Get the primary/default image for character"""
        # Look for primary image in gallery
        primary_image = next((img for img in gallery_images if img.is_primary), None)
        
        if primary_image:
            return await self._format_gallery_image(primary_image)
        
        # Fallback to first gallery image
        if gallery_images:
            return await self._format_gallery_image(gallery_images[0])
        
        # Final fallback to character avatar_url
        if character.avatar_url:
            return {
                "id": None,
                "url": character.avatar_url,
                "thumbnail_url": None,
                "alt_text": f"{character.name} character image",
                "category": "portrait",
                "is_primary": True,
                "is_gallery_image": False
            }
        
        # No image available
        return {
            "id": None,
            "url": "/assets/default-character.png",  # Default placeholder
            "thumbnail_url": None,
            "alt_text": f"{character.name}",
            "category": "default",
            "is_primary": True,
            "is_gallery_image": False
        }
    
    async def _format_gallery_image(self, gallery_image: CharacterGalleryImage) -> Dict[str, Any]:
        """Format gallery image for API response"""
        return {
            "id": gallery_image.id,
            "url": gallery_image.image_url,
            "thumbnail_url": gallery_image.thumbnail_url,
            "alt_text": gallery_image.alt_text,
            "category": gallery_image.category,
            "display_order": gallery_image.display_order,
            "is_primary": gallery_image.is_primary,
            "file_size": gallery_image.file_size,
            "dimensions": gallery_image.dimensions,
            "file_format": gallery_image.file_format,
            "created_at": gallery_image.created_at.isoformat() + "Z" if gallery_image.created_at else None,
            "is_gallery_image": True
        }
    
    async def _get_image_categories(self, gallery_images: List[CharacterGalleryImage]) -> List[str]:
        """Get unique categories from gallery images"""
        categories = list(set(img.category for img in gallery_images if img.category))
        return sorted(categories) if categories else ["general"]
    
    async def _unset_primary_images(self, character_id: int):
        """Unset all primary images for a character"""
        self.db.query(CharacterGalleryImage).filter(
            and_(
                CharacterGalleryImage.character_id == character_id,
                CharacterGalleryImage.is_primary == True
            )
        ).update({"is_primary": False, "updated_at": datetime.utcnow()})
    
    async def _get_next_display_order(self, character_id: int) -> int:
        """Get the next display order number for a character's gallery"""
        max_order = self.db.query(CharacterGalleryImage.display_order).filter(
            and_(
                CharacterGalleryImage.character_id == character_id,
                CharacterGalleryImage.is_active == True
            )
        ).order_by(desc(CharacterGalleryImage.display_order)).first()
        
        return (max_order[0] + 1) if max_order and max_order[0] is not None else 0
    
    async def _update_character_gallery_stats(self, character_id: int):
        """Update character gallery statistics"""
        # Count active images
        active_images_count = self.db.query(CharacterGalleryImage).filter(
            and_(
                CharacterGalleryImage.character_id == character_id,
                CharacterGalleryImage.is_active == True
            )
        ).count()
        
        # Get primary image URL
        primary_image = self.db.query(CharacterGalleryImage).filter(
            and_(
                CharacterGalleryImage.character_id == character_id,
                CharacterGalleryImage.is_primary == True,
                CharacterGalleryImage.is_active == True
            )
        ).first()
        
        # Update character record
        character = self.db.query(Character).filter(Character.id == character_id).first()
        if character:
            character.gallery_images_count = active_images_count
            character.gallery_enabled = active_images_count > 0
            character.gallery_primary_image = primary_image.image_url if primary_image else None
            character.gallery_updated_at = datetime.utcnow()

            self.db.commit()
    
    async def get_gallery_stats(self) -> Dict[str, Any]:
        """Get overall gallery statistics"""
        try:
            # Total characters with galleries
            characters_with_galleries = self.db.query(Character).filter(
                Character.gallery_enabled == True
            ).count()
            
            # Total gallery images
            total_images = self.db.query(CharacterGalleryImage).filter(
                CharacterGalleryImage.is_active == True
            ).count()
            
            # Average images per character
            avg_images_per_character = round(
                total_images / characters_with_galleries if characters_with_galleries > 0 else 0, 
                2
            )
            
            # Categories distribution
            category_stats = {}
            categories = self.db.query(CharacterGalleryImage.category).filter(
                CharacterGalleryImage.is_active == True
            ).all()
            
            for category in categories:
                cat_name = category[0] or 'general'
                category_stats[cat_name] = category_stats.get(cat_name, 0) + 1
            
            return {
                "characters_with_galleries": characters_with_galleries,
                "total_gallery_images": total_images,
                "average_images_per_character": avg_images_per_character,
                "category_distribution": category_stats,
                "last_updated": datetime.utcnow().isoformat() + "Z"
            }
            
        except Exception as e:
            self.logger.error(f"Error getting gallery stats: {e}")
            raise CharacterGalleryServiceError(f"Failed to get gallery stats: {e}")
