"""
File Upload Service for IntelliSpark AI Chat Application

This service handles all file upload operations with comprehensive security validation
and processing. It provides a clean interface for different types of uploads while
maintaining security best practices.

Features:
- Comprehensive security validation (MIME type, magic bytes, size limits)
- Path traversal protection
- Automatic image optimization and resizing
- Secure filename generation
- Detailed logging for security monitoring
- Support for multiple upload types (character avatars, chat images, etc.)
"""

from typing import Tuple, Dict, Any, Optional
from fastapi import UploadFile, Request, HTTPException
from pathlib import Path
import logging
import os
from slowapi.util import get_remote_address

from utils.file_validation import comprehensive_image_validation, resize_image_if_needed
from services.storage_manager import (
    StorageManagerError,
    get_storage_manager,
)


class UploadServiceError(Exception):
    """Upload service specific errors"""
    pass


class UploadService:
    """Service for handling file uploads with security validation"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.security_logger = logging.getLogger('security')
        try:
            self.storage = get_storage_manager()
        except StorageManagerError as error:
            self.logger.error(f"Storage manager initialization failed: {error}")
            raise
        
        # Local filesystem base directory is only used when Supabase Storage is disabled.
        self.upload_base_dir: Optional[Path] = None
        if not self.storage.using_supabase:
            fly_volume_path = Path("/app/attached_assets")
            local_dev_path = Path(__file__).parent.parent.parent / "attached_assets"

            is_deployed = (
                os.getenv('FLY_APP_NAME') is not None or
                Path('/.dockerenv').exists() or
                fly_volume_path.exists()
            )

            if is_deployed and fly_volume_path.exists():
                self.upload_base_dir = fly_volume_path
            elif local_dev_path.exists():
                self.upload_base_dir = local_dev_path
            else:
                local_dev_path.mkdir(parents=True, exist_ok=True)
                self.upload_base_dir = local_dev_path
    
    async def process_avatar_upload(
        self, 
        file: UploadFile, 
        user_id: int, 
        request: Request,
        upload_type: str = "character_avatar",
        character_id: int = None
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Process file upload with comprehensive security validation
        
        Args:
            file: Uploaded file object
            user_id: ID of uploading user
            request: HTTP request for IP tracking
            upload_type: Type of upload (character_avatar, chat_image, etc.)
            
        Returns:
            (success, upload_data, error_message)
        """
        client_ip = get_remote_address(request)
        
        try:
            # Read and validate file
            file_content = await file.read()
            validation_result = comprehensive_image_validation(
                file_content=file_content,
                declared_mime_type=file.content_type or 'application/octet-stream',
                filename=file.filename or 'upload'
            )
            
            # Check validation results
            if not validation_result['is_valid']:
                await self._log_upload_rejection(user_id, client_ip, file, validation_result)
                return False, {}, f"File validation failed: {'; '.join(validation_result['errors'])}"
            
            # Process validated file
            upload_result = await self._save_validated_file(
                validation_result, upload_type, user_id, client_ip, character_id
            )
            
            if not upload_result['success']:
                return False, {}, upload_result['error']
            
            # Log successful upload
            await self._log_upload_success(user_id, client_ip, upload_result, len(file_content))
            
            return True, upload_result['data'], None
            
        except HTTPException:
            # Re-raise HTTP exceptions as-is
            raise
        except Exception as e:
            self.security_logger.error(
                f"Upload service error: user={user_id}, ip={client_ip}, error={str(e)}"
            )
            return False, {}, "Internal upload processing error"
    
    async def _save_validated_file(
        self,
        validation_result: dict,
        upload_type: str,
        user_id: int,
        client_ip: str,
        character_id: int = None
    ) -> Dict[str, Any]:
        """Persist validated file and return upload metadata."""
        try:
            processed_content = validation_result['processed_content']
            secure_filename = validation_result['secure_filename']
            dimensions = validation_result.get('dimensions')
            was_resized = validation_result['was_resized']
            mimetype = validation_result.get('mime_type') or 'application/octet-stream'

            storage_path = self._build_storage_path(upload_type, secure_filename, character_id)
            stored_file = await self.storage.upload(storage_path, processed_content, mimetype)

            thumbnail_url = None
            try:
                thumb_content, _ = resize_image_if_needed(processed_content, max_size=256)
                if thumb_content and len(thumb_content) > 0:
                    thumb_filename = self._build_thumbnail_name(secure_filename)
                    thumb_path = self._build_storage_path(upload_type, thumb_filename, character_id)
                    thumb_mimetype = stored_file.mimetype or mimetype
                    thumb_file = await self.storage.upload(thumb_path, thumb_content, thumb_mimetype)
                    thumbnail_url = thumb_file.public_url
            except Exception:
                thumbnail_url = None

            dimensions_text = None
            if dimensions and dimensions[0] and dimensions[1]:
                dimensions_text = f"{dimensions[0]}x{dimensions[1]}"

            response_data = {
                'avatarUrl': stored_file.public_url,
                'url': stored_file.public_url,
                'filename': secure_filename,
                'size': stored_file.size,
                'dimensions': dimensions_text,
                'message': 'Upload successful',
            }

            if thumbnail_url:
                response_data['thumbnailUrl'] = thumbnail_url

            if was_resized and validation_result.get('warnings'):
                response_data['optimized'] = True
                response_data['optimization_info'] = validation_result['warnings'][0]

            # Include internal storage path for administrative tooling
            response_data['storagePath'] = stored_file.path

            return {
                'success': True,
                'data': response_data,
                'error': None,
                'processed_content': processed_content,
                'was_resized': was_resized,
                'dimensions': dimensions,
            }

        except HTTPException:
            raise
        except StorageManagerError as storage_error:
            self.logger.error(f"Storage error while saving file: {storage_error}")
            return {'success': False, 'error': str(storage_error)}
        except Exception as e:
            self.logger.error(f"Failed to save uploaded file: {e}")
            return {'success': False, 'error': f'File save failed: {str(e)}'}
    
    def _get_upload_directory(self, upload_type: str, character_id: int = None) -> Path:
        """Get appropriate upload directory for file type"""
        upload_dirs = {
            'character_avatar': 'user_characters_img',
            'character_gallery': f'character_galleries/character_{character_id}' if character_id else 'character_galleries',
            'chat_image': 'chat_images', 
            'user_profile': 'user_profiles',
            # Admin-curated character images for reuse across characters
            'admin_character_asset': 'characters_img'
        }
        
        subdir = upload_dirs.get(upload_type, 'general')
        if self.upload_base_dir is None:
            raise StorageManagerError("Local upload directory requested while external storage is active")
        return self.upload_base_dir / subdir

    def _get_asset_path(self, upload_type: str, character_id: int = None) -> str:
        """Get asset path for URL generation"""
        asset_paths = {
            'character_avatar': 'user_characters_img',
            'character_gallery': f'character_galleries/character_{character_id}' if character_id else 'character_galleries',
            'chat_image': 'chat_images',
            'user_profile': 'user_profiles',
            'admin_character_asset': 'characters_img'
        }
        
        return asset_paths.get(upload_type, 'general')

    def _build_storage_path(self, upload_type: str, filename: str, character_id: int = None) -> str:
        """Build the storage key for the current backend."""
        base = self._get_asset_path(upload_type, character_id)
        path = Path(base) / filename if base else Path(filename)
        return path.as_posix()

    @staticmethod
    def _build_thumbnail_name(filename: str) -> str:
        stem = Path(filename).stem
        suffix = Path(filename).suffix or '.jpg'
        return f"{stem}_thumb{suffix}"

    async def _log_upload_rejection(
        self, 
        user_id: int, 
        client_ip: str, 
        file: UploadFile, 
        validation_result: dict
    ):
        """Log rejected upload attempt for security monitoring"""
        self.security_logger.warning(
            f"File upload rejected: user={user_id}, ip={client_ip}, "
            f"filename={file.filename}, size={file.size}, "
            f"errors={', '.join(validation_result['errors'])}"
        )
    
    async def _log_upload_success(
        self, 
        user_id: int, 
        client_ip: str, 
        upload_result: dict, 
        original_size: int
    ):
        """Log successful upload for security monitoring"""
        data = upload_result['data']
        self.security_logger.info(
            f"File upload successful: user={user_id}, ip={client_ip}, "
            f"filename={data['filename']}, original_size={original_size}, "
            f"final_size={data['size']}, dimensions={data['dimensions']}, "
            f"resized={upload_result.get('was_resized', False)}"
        )
