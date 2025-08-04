"""
Integration tests for the file upload endpoint security features.

Tests the complete upload endpoint including rate limiting, authentication,
and all security validations in a realistic environment.
"""

import pytest
import asyncio
import tempfile
import os
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import FastAPI, UploadFile
import io
import time

# Mock the main app components for testing
from main import app
from routes import upload_character_avatar
from auth.routes import get_current_user
from utils.file_validation import MAX_FILE_SIZE


class TestUploadEndpointSecurity:
    """Test security features of the upload endpoint"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_user(self):
        """Mock authenticated user"""
        user = Mock()
        user.id = 1
        user.email = "test@example.com"
        return user
    
    @pytest.fixture
    def mock_auth(self, mock_user):
        """Mock authentication dependency"""
        def override_get_current_user():
            return mock_user
        
        app.dependency_overrides[get_current_user] = override_get_current_user
        yield mock_user
        app.dependency_overrides.clear()
    
    def create_test_image(self, content_type="image/jpeg", size=1000):
        """Create test image content"""
        if content_type == "image/jpeg":
            header = b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00'
        elif content_type == "image/png":
            header = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR'
        elif content_type == "image/gif":
            header = b'GIF87a'
        else:
            header = b''
        
        return header + b'\x00' * (size - len(header))
    
    def test_upload_valid_image_success(self, client, mock_auth):
        """Test successful upload of valid image"""
        image_content = self.create_test_image("image/jpeg", 1000)
        
        with patch('routes.comprehensive_image_validation') as mock_validation, \
             patch('aiofiles.open', create=True) as mock_file_open, \
             patch('pathlib.Path.exists', return_value=True), \
             patch('pathlib.Path.stat') as mock_stat:
            
            # Mock successful validation
            mock_validation.return_value = {
                'is_valid': True,
                'errors': [],
                'warnings': [],
                'processed_content': image_content,
                'secure_filename': 'test-uuid.jpg',
                'dimensions': (800, 600),
                'file_size': len(image_content),
                'was_resized': False
            }
            
            # Mock file operations
            mock_file_open.return_value.__aenter__ = AsyncMock()
            mock_file_open.return_value.__aexit__ = AsyncMock()
            mock_file_open.return_value.write = AsyncMock()
            
            mock_stat.return_value.st_size = len(image_content)
            
            response = client.post(
                "/api/characters/upload-avatar",
                files={"file": ("test.jpg", image_content, "image/jpeg")}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "avatarUrl" in data
            assert data["filename"] == "test-uuid.jpg"
            assert data["dimensions"] == "800x600"
    
    def test_upload_invalid_file_type_rejection(self, client, mock_auth):
        """Test rejection of invalid file types"""
        text_content = b"This is not an image file"
        
        response = client.post(
            "/api/characters/upload-avatar",
            files={"file": ("malicious.txt", text_content, "text/plain")}
        )
        
        assert response.status_code == 400
        assert "File validation failed" in response.json()["detail"]
    
    def test_upload_oversized_file_rejection(self, client, mock_auth):
        """Test rejection of oversized files"""
        # Create content larger than MAX_FILE_SIZE
        large_content = b'\x00' * (MAX_FILE_SIZE + 1000)
        
        response = client.post(
            "/api/characters/upload-avatar",
            files={"file": ("huge.jpg", large_content, "image/jpeg")}
        )
        
        assert response.status_code == 400
        assert "File validation failed" in response.json()["detail"]
    
    def test_upload_malicious_file_rejection(self, client, mock_auth):
        """Test rejection of malicious files"""
        # Script content with fake JPEG header
        malicious_content = b'\xFF\xD8\xFF\xE0#!/bin/bash\nrm -rf /' + b'\x00' * 100
        
        with patch('routes.comprehensive_image_validation') as mock_validation:
            mock_validation.return_value = {
                'is_valid': False,
                'errors': ['File content doesn\'t match declared type'],
                'warnings': [],
                'processed_content': malicious_content,
                'secure_filename': '',
                'dimensions': None,
                'file_size': len(malicious_content),
                'was_resized': False
            }
            
            response = client.post(
                "/api/characters/upload-avatar",
                files={"file": ("virus.jpg", malicious_content, "image/jpeg")}
            )
            
            assert response.status_code == 400
            assert "File validation failed" in response.json()["detail"]
    
    def test_upload_without_authentication(self, client):
        """Test upload rejection without authentication"""
        image_content = self.create_test_image("image/jpeg", 1000)
        
        # No authentication provided
        response = client.post(
            "/api/characters/upload-avatar",
            files={"file": ("test.jpg", image_content, "image/jpeg")}
        )
        
        assert response.status_code == 401  # Unauthorized
    
    def test_upload_directory_traversal_protection(self, client, mock_auth):
        """Test directory traversal protection"""
        image_content = self.create_test_image("image/jpeg", 1000)
        
        with patch('routes.comprehensive_image_validation') as mock_validation, \
             patch('pathlib.Path.resolve') as mock_resolve:
            
            # Mock path resolution to simulate traversal attempt
            mock_resolve.side_effect = [
                Path("/malicious/path"),  # Upload path
                Path("/safe/attached_assets/user_characters_img")  # Expected path
            ]
            
            mock_validation.return_value = {
                'is_valid': True,
                'errors': [],
                'warnings': [],
                'processed_content': image_content,
                'secure_filename': 'test-uuid.jpg',
                'dimensions': (800, 600),
                'file_size': len(image_content),
                'was_resized': False
            }
            
            response = client.post(
                "/api/characters/upload-avatar",
                files={"file": ("../../evil.jpg", image_content, "image/jpeg")}
            )
            
            assert response.status_code == 500
            assert "Invalid upload directory" in response.json()["detail"]
    
    def test_upload_file_save_failure(self, client, mock_auth):
        """Test handling of file save failures"""
        image_content = self.create_test_image("image/jpeg", 1000)
        
        with patch('routes.comprehensive_image_validation') as mock_validation, \
             patch('aiofiles.open', create=True) as mock_file_open:
            
            mock_validation.return_value = {
                'is_valid': True,
                'errors': [],
                'warnings': [],
                'processed_content': image_content,
                'secure_filename': 'test-uuid.jpg',
                'dimensions': (800, 600),
                'file_size': len(image_content),
                'was_resized': False
            }
            
            # Mock file save failure
            mock_file_open.side_effect = IOError("Disk full")
            
            response = client.post(
                "/api/characters/upload-avatar",
                files={"file": ("test.jpg", image_content, "image/jpeg")}
            )
            
            assert response.status_code == 500
            assert "Failed to save file" in response.json()["detail"]
    
    def test_upload_file_verification_failure(self, client, mock_auth):
        """Test handling of file verification failures"""
        image_content = self.create_test_image("image/jpeg", 1000)
        
        with patch('routes.comprehensive_image_validation') as mock_validation, \
             patch('aiofiles.open', create=True) as mock_file_open, \
             patch('pathlib.Path.exists', return_value=False):  # File doesn't exist after save
            
            mock_validation.return_value = {
                'is_valid': True,
                'errors': [],
                'warnings': [],
                'processed_content': image_content,
                'secure_filename': 'test-uuid.jpg',
                'dimensions': (800, 600),
                'file_size': len(image_content),
                'was_resized': False
            }
            
            mock_file_open.return_value.__aenter__ = AsyncMock()
            mock_file_open.return_value.__aexit__ = AsyncMock()
            mock_file_open.return_value.write = AsyncMock()
            
            response = client.post(
                "/api/characters/upload-avatar",
                files={"file": ("test.jpg", image_content, "image/jpeg")}
            )
            
            assert response.status_code == 500
            assert "File upload verification failed" in response.json()["detail"]
    
    def test_upload_with_image_resize(self, client, mock_auth):
        """Test upload with automatic image resizing"""
        image_content = self.create_test_image("image/jpeg", 2000)
        resized_content = self.create_test_image("image/jpeg", 1000)
        
        with patch('routes.comprehensive_image_validation') as mock_validation, \
             patch('aiofiles.open', create=True) as mock_file_open, \
             patch('pathlib.Path.exists', return_value=True), \
             patch('pathlib.Path.stat') as mock_stat:
            
            mock_validation.return_value = {
                'is_valid': True,
                'errors': [],
                'warnings': ['Image resized from 2048x2048 to 1024x1024 for optimization'],
                'processed_content': resized_content,
                'secure_filename': 'resized-uuid.jpg',
                'dimensions': (1024, 1024),
                'file_size': len(resized_content),
                'was_resized': True
            }
            
            mock_file_open.return_value.__aenter__ = AsyncMock()
            mock_file_open.return_value.__aexit__ = AsyncMock()
            mock_file_open.return_value.write = AsyncMock()
            mock_stat.return_value.st_size = len(resized_content)
            
            response = client.post(
                "/api/characters/upload-avatar",
                files={"file": ("large.jpg", image_content, "image/jpeg")}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["optimized"] is True
            assert "resized" in data["optimization_info"]
            assert data["dimensions"] == "1024x1024"


class TestRateLimiting:
    """Test rate limiting functionality"""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    @pytest.fixture
    def mock_auth(self):
        user = Mock()
        user.id = 1
        user.email = "test@example.com"
        
        def override_get_current_user():
            return user
        
        app.dependency_overrides[get_current_user] = override_get_current_user
        yield user
        app.dependency_overrides.clear()
    
    def test_rate_limit_enforcement(self, client, mock_auth):
        """Test that rate limiting is enforced"""
        image_content = b'\xFF\xD8\xFF\xE0' + b'\x00' * 1000
        
        with patch('routes.comprehensive_image_validation') as mock_validation, \
             patch('aiofiles.open', create=True) as mock_file_open, \
             patch('pathlib.Path.exists', return_value=True), \
             patch('pathlib.Path.stat') as mock_stat:
            
            mock_validation.return_value = {
                'is_valid': True,
                'errors': [],
                'warnings': [],
                'processed_content': image_content,
                'secure_filename': 'test-uuid.jpg',
                'dimensions': (800, 600),
                'file_size': len(image_content),
                'was_resized': False
            }
            
            mock_file_open.return_value.__aenter__ = AsyncMock()
            mock_file_open.return_value.__aexit__ = AsyncMock()
            mock_file_open.return_value.write = AsyncMock()
            mock_stat.return_value.st_size = len(image_content)
            
            # Make multiple rapid requests
            success_count = 0
            rate_limited_count = 0
            
            for i in range(15):  # Try 15 uploads (limit is 10/minute)
                response = client.post(
                    "/api/characters/upload-avatar",
                    files={"file": (f"test{i}.jpg", image_content, "image/jpeg")}
                )
                
                if response.status_code == 200:
                    success_count += 1
                elif response.status_code == 429:  # Too Many Requests
                    rate_limited_count += 1
            
            # Should have some successful uploads and some rate limited
            assert success_count > 0
            assert rate_limited_count > 0
            assert success_count <= 10  # Rate limit is 10/minute


class TestSecurityLogging:
    """Test security logging functionality"""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    @pytest.fixture
    def mock_auth(self):
        user = Mock()
        user.id = 1
        user.email = "test@example.com"
        
        def override_get_current_user():
            return user
        
        app.dependency_overrides[get_current_user] = override_get_current_user
        yield user
        app.dependency_overrides.clear()
    
    def test_security_logging_on_rejection(self, client, mock_auth):
        """Test that security events are logged on file rejection"""
        malicious_content = b"not an image"
        
        with patch('logging.getLogger') as mock_get_logger:
            mock_logger = Mock()
            mock_get_logger.return_value = mock_logger
            
            response = client.post(
                "/api/characters/upload-avatar",
                files={"file": ("malicious.txt", malicious_content, "text/plain")}
            )
            
            assert response.status_code == 400
            
            # Verify security logging was called
            mock_logger.warning.assert_called()
            call_args = mock_logger.warning.call_args[0][0]
            assert "File upload rejected" in call_args
            assert "user=1" in call_args
    
    def test_security_logging_on_success(self, client, mock_auth):
        """Test that successful uploads are logged"""
        image_content = b'\xFF\xD8\xFF\xE0' + b'\x00' * 1000
        
        with patch('routes.comprehensive_image_validation') as mock_validation, \
             patch('aiofiles.open', create=True) as mock_file_open, \
             patch('pathlib.Path.exists', return_value=True), \
             patch('pathlib.Path.stat') as mock_stat, \
             patch('logging.getLogger') as mock_get_logger:
            
            mock_logger = Mock()
            mock_get_logger.return_value = mock_logger
            
            mock_validation.return_value = {
                'is_valid': True,
                'errors': [],
                'warnings': [],
                'processed_content': image_content,
                'secure_filename': 'success-uuid.jpg',
                'dimensions': (800, 600),
                'file_size': len(image_content),
                'was_resized': False
            }
            
            mock_file_open.return_value.__aenter__ = AsyncMock()
            mock_file_open.return_value.__aexit__ = AsyncMock()
            mock_file_open.return_value.write = AsyncMock()
            mock_stat.return_value.st_size = len(image_content)
            
            response = client.post(
                "/api/characters/upload-avatar",
                files={"file": ("success.jpg", image_content, "image/jpeg")}
            )
            
            assert response.status_code == 200
            
            # Verify success logging was called
            mock_logger.info.assert_called()
            call_args = mock_logger.info.call_args[0][0]
            assert "File upload successful" in call_args
            assert "user=1" in call_args


if __name__ == "__main__":
    pytest.main([__file__, "-v"])