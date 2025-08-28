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
import aiofiles
import logging
from slowapi.util import get_remote_address

from utils.file_validation import comprehensive_image_validation


class UploadServiceError(Exception):
    """Upload service specific errors"""
    pass


class UploadService:
    """Service for handling file uploads with security validation"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.security_logger = logging.getLogger('security')
        self.upload_base_dir = Path(__file__).parent.parent.parent / "attached_assets"
    
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
        """Save validated file to appropriate directory"""
        try:
            # Determine upload directory based on type
            upload_dir = self._get_upload_directory(upload_type, character_id)
            upload_dir.mkdir(parents=True, exist_ok=True)
            
            # Security check: verify directory is within expected bounds
            if not self._is_safe_upload_path(upload_dir, upload_type):
                self.security_logger.error(f"Directory traversal attempt: {upload_dir}")
                raise HTTPException(status_code=500, detail="Invalid upload directory")
            
            # Extract validated data
            processed_content = validation_result['processed_content']
            secure_filename = validation_result['secure_filename']
            dimensions = validation_result['dimensions']
            was_resized = validation_result['was_resized']
            
            # Save file securely using async I/O
            file_path = upload_dir / secure_filename
            
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(processed_content)
            
            # Verify file was written correctly
            if not file_path.exists() or file_path.stat().st_size == 0:
                self.security_logger.error(f"File upload verification failed: {file_path}")
                raise HTTPException(status_code=500, detail="File upload verification failed")
            
            # Generate response data
            asset_url = f"/assets/{self._get_asset_path(upload_type, character_id)}/{secure_filename}"
            
            response_data = {
                'avatarUrl': asset_url,
                'filename': secure_filename,
                'size': len(processed_content),
                'dimensions': f"{dimensions[0]}x{dimensions[1]}",
                'message': 'Upload successful'
            }
            
            # Add optimization info if resized
            if was_resized and validation_result.get('warnings'):
                response_data['optimized'] = True
                response_data['optimization_info'] = validation_result['warnings'][0]
            
            return {
                'success': True, 
                'data': response_data, 
                'error': None,
                'processed_content': processed_content,
                'was_resized': was_resized,
                'dimensions': dimensions
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Failed to save uploaded file: {e}")
            return {'success': False, 'error': f'File save failed: {str(e)}'}
    
    def _get_upload_directory(self, upload_type: str, character_id: int = None) -> Path:
        """Get appropriate upload directory for file type"""
        upload_dirs = {
            'character_avatar': 'user_characters_img',
            'character_gallery': f'character_galleries/character_{character_id}' if character_id else 'character_galleries',
            'chat_image': 'chat_images', 
            'user_profile': 'user_profiles'
        }
        
        subdir = upload_dirs.get(upload_type, 'general')
        return self.upload_base_dir / subdir
    
    def _get_asset_path(self, upload_type: str, character_id: int = None) -> str:
        """Get asset path for URL generation"""
        asset_paths = {
            'character_avatar': 'user_characters_img',
            'character_gallery': f'character_galleries/character_{character_id}' if character_id else 'character_galleries',
            'chat_image': 'chat_images',
            'user_profile': 'user_profiles'
        }
        
        return asset_paths.get(upload_type, 'general')
    
    def _is_safe_upload_path(self, upload_path: Path, upload_type: str) -> bool:
        """Verify upload path is within expected bounds (path traversal protection)"""
        try:
            resolved_path = upload_path.resolve()
            expected_base = self.upload_base_dir.resolve()
            return str(resolved_path).startswith(str(expected_base))
        except Exception:
            return False
    
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