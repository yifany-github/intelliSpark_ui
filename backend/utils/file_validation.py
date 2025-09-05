"""
File validation utilities for secure file upload handling.

This module provides comprehensive security validation for uploaded files,
including MIME type validation, magic byte verification, image dimension
checking, and secure filename sanitization.
"""

import io
import uuid
import os
from typing import Tuple, Optional
from PIL import Image
import magic


# Allowed MIME types and their corresponding magic byte signatures
ALLOWED_MIME_TYPES = {
    'image/jpeg': [b'\xFF\xD8\xFF'],
    'image/png': [b'\x89PNG\r\n\x1a\n'],
    'image/webp': [b'RIFF'],  # WebP files start with RIFF, followed by WEBP
    'image/gif': [b'GIF87a', b'GIF89a']
}

# Maximum allowed dimensions (in pixels)
MAX_DIMENSION = 4096
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB per image
OPTIMIZE_THRESHOLD = 1024  # Auto-resize images larger than 1024px


def validate_image_file(file_content: bytes, declared_mime_type: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that uploaded file is actually an image by checking:
    1. MIME type against whitelist
    2. File magic bytes/signature
    3. File structure integrity using python-magic
    
    Args:
        file_content: Raw file content as bytes
        declared_mime_type: MIME type declared by client
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    
    # Check declared MIME type against whitelist
    if declared_mime_type not in ALLOWED_MIME_TYPES:
        return False, f"Unsupported file type: {declared_mime_type}"
    
    # Validate file content is not empty
    if not file_content or len(file_content) < 10:
        return False, "File content is empty or too small"
    
    # Check file magic bytes
    magic_bytes = ALLOWED_MIME_TYPES[declared_mime_type]
    file_header = file_content[:20]  # First 20 bytes for magic number check
    
    valid_magic = False
    for magic_byte in magic_bytes:
        if magic_byte == b'RIFF':
            # Special case for WebP: check for RIFF + WEBP signature
            if file_header.startswith(b'RIFF') and len(file_content) > 12:
                if file_content[8:12] == b'WEBP':
                    valid_magic = True
                    break
        else:
            if file_header.startswith(magic_byte):
                valid_magic = True
                break
    
    if not valid_magic:
        return False, "File content doesn't match declared type (invalid magic bytes)"
    
    # Additional validation using python-magic for deep file type detection
    try:
        detected_mime = magic.from_buffer(file_content, mime=True)
        
        # Allow some MIME type variations that are still valid
        valid_variations = {
            'image/jpeg': ['image/jpeg', 'image/jpg'],
            'image/png': ['image/png'],
            'image/webp': ['image/webp'],
            'image/gif': ['image/gif']
        }
        
        expected_variations = valid_variations.get(declared_mime_type, [declared_mime_type])
        
        if detected_mime not in expected_variations:
            return False, f"File type mismatch: declared {declared_mime_type}, detected {detected_mime}"
            
    except Exception as e:
        # python-magic not available or failed, continue with basic validation
        # This is not a hard failure since we already validated magic bytes
        pass
    
    return True, None


def validate_image_dimensions(file_content: bytes) -> Tuple[bool, Optional[str], Optional[Tuple[int, int]]]:
    """
    Validate image dimensions and return size information.
    
    Args:
        file_content: Raw image file content
        
    Returns:
        Tuple of (is_valid, error_message, dimensions)
    """
    try:
        image = Image.open(io.BytesIO(file_content))
        width, height = image.size
        
        # Check dimensions against maximum limits
        if width > MAX_DIMENSION or height > MAX_DIMENSION:
            return False, f"Image too large. Maximum dimensions: {MAX_DIMENSION}x{MAX_DIMENSION}px", (width, height)
        
        # Check for minimum dimensions (avoid 0x0 or extremely small images)
        if width < 1 or height < 1:
            return False, "Invalid image dimensions", (width, height)
            
        return True, None, (width, height)
        
    except Exception as e:
        return False, f"Cannot process image: {str(e)}", None


def resize_image_if_needed(file_content: bytes, max_size: int = OPTIMIZE_THRESHOLD) -> Tuple[bytes, Tuple[int, int]]:
    """
    Resize image if it's larger than the specified threshold.
    
    Args:
        file_content: Original image content
        max_size: Maximum dimension for resizing (default: 1024px)
        
    Returns:
        Tuple of (processed_content, new_dimensions)
    """
    try:
        image = Image.open(io.BytesIO(file_content))
        original_width, original_height = image.size
        
        # Check if resizing is needed
        if original_width <= max_size and original_height <= max_size:
            return file_content, (original_width, original_height)
        
        # Calculate new dimensions maintaining aspect ratio
        if original_width > original_height:
            new_width = max_size
            new_height = int((original_height * max_size) / original_width)
        else:
            new_height = max_size
            new_width = int((original_width * max_size) / original_height)
        
        # Resize the image with high-quality resampling
        resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Save to bytes buffer with optimized quality
        img_buffer = io.BytesIO()
        
        # Maintain original format
        save_format = image.format or 'JPEG'
        if save_format == 'JPEG':
            resized_image.save(img_buffer, format=save_format, quality=85, optimize=True)
        else:
            resized_image.save(img_buffer, format=save_format, optimize=True)
        
        return img_buffer.getvalue(), (new_width, new_height)
        
    except Exception as e:
        # If resizing fails, return original content
        return file_content, (0, 0)


def sanitize_filename(filename: str) -> str:
    """
    Generate secure filename, never use user input directly.
    
    Args:
        filename: Original filename from user
        
    Returns:
        Secure UUID-based filename with safe extension
    """
    
    # Extract extension safely
    _, ext = os.path.splitext(filename) if filename else ('', '')
    ext = ext.lower()
    
    # Validate extension against whitelist
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    if ext not in allowed_extensions:
        ext = '.jpg'  # Default to JPEG extension
    
    # Generate secure UUID-based filename
    return f"{uuid.uuid4()}{ext}"


def validate_file_size(file_size: int) -> Tuple[bool, Optional[str]]:
    """
    Validate file size against limits.
    
    Args:
        file_size: Size of file in bytes
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if file_size <= 0:
        return False, "File is empty"
    
    if file_size > MAX_FILE_SIZE:
        return False, f"File too large ({file_size} bytes). Maximum size is {MAX_FILE_SIZE} bytes (5MB)"
    
    return True, None


def _recompress_jpeg_to_target_size(image: Image.Image, target_size: int, start_quality: int = 85, min_quality: int = 60) -> Optional[bytes]:
    """Try to recompress a JPEG image to be under target_size by reducing quality."""
    quality = start_quality
    while quality >= min_quality:
        buf = io.BytesIO()
        try:
            image.save(buf, format='JPEG', quality=quality, optimize=True)
        except Exception:
            return None
        data = buf.getvalue()
        if len(data) <= target_size:
            return data
        quality -= 10
    return None


def _convert_to_webp_under_target(image: Image.Image, target_size: int, quality: int = 80) -> Optional[bytes]:
    """Try converting to WebP to reduce size under target."""
    try:
        buf = io.BytesIO()
        image.save(buf, format='WEBP', quality=quality, method=6)
        data = buf.getvalue()
        if len(data) <= target_size:
            return data
    except Exception:
        return None
    return None


def comprehensive_image_validation(file_content: bytes, declared_mime_type: str, filename: str) -> dict:
    """
    Perform comprehensive validation of uploaded image file.
    
    Args:
        file_content: Raw file content
        declared_mime_type: MIME type declared by client
        filename: Original filename
        
    Returns:
        Dictionary with validation results and processed data
    """
    result = {
        'is_valid': False,
        'errors': [],
        'warnings': [],
        'processed_content': file_content,
        'secure_filename': '',
        'dimensions': None,
        'file_size': len(file_content),
        'was_resized': False
    }
    
    # 1. File type validation (validate early to avoid processing bad files)
    type_valid, type_error = validate_image_file(file_content, declared_mime_type)
    if not type_valid:
        result['errors'].append(type_error)
        return result
    
    # 2. Image dimension validation
    dim_valid, dim_error, dimensions = validate_image_dimensions(file_content)
    if not dim_valid:
        result['errors'].append(dim_error)
        return result
    
    result['dimensions'] = dimensions
    
    # 3. Image optimization (resize if needed)
    if dimensions and (dimensions[0] > OPTIMIZE_THRESHOLD or dimensions[1] > OPTIMIZE_THRESHOLD):
        try:
            optimized_content, new_dimensions = resize_image_if_needed(file_content)
            result['processed_content'] = optimized_content
            result['dimensions'] = new_dimensions
            result['was_resized'] = True
            result['warnings'].append(f"Image resized from {dimensions[0]}x{dimensions[1]} to {new_dimensions[0]}x{new_dimensions[1]} for optimization")
        except Exception as e:
            result['warnings'].append(f"Could not optimize image: {str(e)}")

    # 4. File size validation AFTER optimization
    # If still too large, attempt gentle recompression where possible
    final_size = len(result['processed_content'])
    size_valid, size_error = validate_file_size(final_size)
    if not size_valid:
        try:
            img = Image.open(io.BytesIO(result['processed_content']))
            fmt = (img.format or '').upper()
            recompressed: Optional[bytes] = None
            if fmt == 'JPEG' or declared_mime_type == 'image/jpeg':
                recompressed = _recompress_jpeg_to_target_size(img, MAX_FILE_SIZE)
            elif fmt in ('PNG', 'WEBP', 'GIF'):
                # Try converting to WebP to reduce size
                recompressed = _convert_to_webp_under_target(img, MAX_FILE_SIZE, quality=80)
                if recompressed:
                    # Update filename extension to .webp
                    filename = os.path.splitext(filename or 'upload')[0] + '.webp'
            if recompressed:
                result['processed_content'] = recompressed
                result['dimensions'] = img.size
                result['was_resized'] = True
                final_size = len(recompressed)
                size_valid, size_error = validate_file_size(final_size)
        except Exception:
            # If recompression fails, keep original error
            pass
    
    if not size_valid:
        result['errors'].append(size_error)
        return result
    
    # 5. Generate secure filename
    result['secure_filename'] = sanitize_filename(filename)
    
    # All validations passed
    result['is_valid'] = True
    
    return result
