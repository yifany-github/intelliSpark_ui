"""
Unit tests for cache component classes.

This module tests the individual components that handle cache creation responsibilities:
- SystemInstructionBuilder
- ContentFormatConverter  
- CacheManager
"""

import pytest
import logging
from unittest.mock import Mock, AsyncMock
from cache_components import SystemInstructionBuilder, ContentFormatConverter, CacheManager
from google.genai import types


class TestSystemInstructionBuilder:
    """Test cases for SystemInstructionBuilder class."""
    
    def test_init(self):
        """Test SystemInstructionBuilder initialization."""
        system_prompt = "test_system_prompt"
        builder = SystemInstructionBuilder(system_prompt)
        assert builder.system_prompt == system_prompt
    
    def test_build_instruction_with_persona(self):
        """Test building instruction with persona prompt."""
        builder = SystemInstructionBuilder("test_system")
        character_prompt = {"persona_prompt": "test_persona"}
        
        result = builder.build_instruction(character_prompt)
        
        assert "system_prompt: test_system" in result
        assert "persona prompt: test_persona" in result
    
    def test_build_instruction_without_persona(self):
        """Test building instruction without persona prompt."""
        builder = SystemInstructionBuilder("test_system")
        character_prompt = {}
        
        result = builder.build_instruction(character_prompt)
        
        assert "system_prompt: test_system" in result
        assert "persona prompt:" not in result
    
    def test_build_instruction_empty_persona(self):
        """Test building instruction with empty persona prompt."""
        builder = SystemInstructionBuilder("test_system")
        character_prompt = {"persona_prompt": ""}
        
        result = builder.build_instruction(character_prompt)
        
        assert "system_prompt: test_system" in result
        assert "persona prompt:" not in result
    
    def test_validate_character_prompt_valid(self):
        """Test validation with valid character prompt."""
        builder = SystemInstructionBuilder("test_system")
        character_prompt = {"persona_prompt": "test"}
        
        result = builder.validate_character_prompt(character_prompt)
        
        assert result is True
    
    def test_validate_character_prompt_empty_dict(self):
        """Test validation with empty dictionary."""
        builder = SystemInstructionBuilder("test_system")
        character_prompt = {}
        
        result = builder.validate_character_prompt(character_prompt)
        
        assert result is True
    
    def test_validate_character_prompt_invalid(self):
        """Test validation with invalid character prompt."""
        builder = SystemInstructionBuilder("test_system")
        
        # Test with non-dict values
        assert builder.validate_character_prompt(None) is False
        assert builder.validate_character_prompt("string") is False
        assert builder.validate_character_prompt([]) is False
        assert builder.validate_character_prompt(123) is False


class TestContentFormatConverter:
    """Test cases for ContentFormatConverter class."""
    
    def test_init(self):
        """Test ContentFormatConverter initialization."""
        converter = ContentFormatConverter()
        assert converter is not None
    
    def test_is_gemini_format_true(self):
        """Test detection of Gemini format examples."""
        converter = ContentFormatConverter()
        gemini_example = {"parts": [{"text": "test"}], "role": "user"}
        
        result = converter._is_gemini_format(gemini_example)
        
        assert result is True
    
    def test_is_gemini_format_false(self):
        """Test detection of non-Gemini format examples."""
        converter = ContentFormatConverter()
        legacy_example = {"role": "user", "content": "test"}
        
        result = converter._is_gemini_format(legacy_example)
        
        assert result is False
    
    def test_convert_legacy_format(self):
        """Test conversion from legacy format to Gemini format."""
        converter = ContentFormatConverter()
        legacy_example = {"role": "user", "content": "test_content"}
        
        result = converter._convert_legacy_format(legacy_example)
        
        assert result["role"] == "user"
        assert result["parts"] == [{"text": "test_content"}]
    
    def test_convert_legacy_format_default_role(self):
        """Test conversion with missing role defaults to 'user'."""
        converter = ContentFormatConverter()
        legacy_example = {"content": "test_content"}
        
        result = converter._convert_legacy_format(legacy_example)
        
        assert result["role"] == "user"
        assert result["parts"] == [{"text": "test_content"}]
    
    def test_convert_legacy_format_empty_content(self):
        """Test conversion with missing content defaults to empty string."""
        converter = ContentFormatConverter()
        legacy_example = {"role": "assistant"}
        
        result = converter._convert_legacy_format(legacy_example)
        
        assert result["role"] == "assistant"
        assert result["parts"] == [{"text": ""}]
    
    def test_convert_to_gemini_format_mixed(self):
        """Test conversion of mixed format examples."""
        converter = ContentFormatConverter()
        examples = [
            {"parts": [{"text": "already_gemini"}], "role": "user"},  # Already Gemini
            {"role": "assistant", "content": "legacy_format"}          # Needs conversion
        ]
        
        result = converter.convert_to_gemini_format(examples)
        
        assert len(result) == 2
        # First example unchanged
        assert result[0]["parts"] == [{"text": "already_gemini"}]
        # Second example converted
        assert result[1]["parts"] == [{"text": "legacy_format"}]
        assert result[1]["role"] == "assistant"
    
    def test_convert_to_gemini_format_empty_list(self):
        """Test conversion of empty examples list."""
        converter = ContentFormatConverter()
        examples = []
        
        result = converter.convert_to_gemini_format(examples)
        
        assert result == []
    
    def test_validate_examples_valid(self):
        """Test validation with valid examples list."""
        converter = ContentFormatConverter()
        examples = [
            {"role": "user", "content": "test1"},
            {"parts": [{"text": "test2"}]}
        ]
        
        result = converter.validate_examples(examples)
        
        assert result is True
    
    def test_validate_examples_empty_list(self):
        """Test validation with empty examples list."""
        converter = ContentFormatConverter()
        examples = []
        
        result = converter.validate_examples(examples)
        
        assert result is True
    
    def test_validate_examples_invalid(self):
        """Test validation with invalid examples."""
        converter = ContentFormatConverter()
        
        # Test with non-list
        assert converter.validate_examples("not_a_list") is False
        assert converter.validate_examples(None) is False
        assert converter.validate_examples(123) is False
        
        # Test with list containing non-dict
        assert converter.validate_examples(["string", 123]) is False
        assert converter.validate_examples([{"valid": "dict"}, "invalid"]) is False


class TestCacheManager:
    """Test cases for CacheManager class."""
    
    def test_init(self):
        """Test CacheManager initialization."""
        mock_client = Mock()
        mock_logger = Mock()
        model_name = "test_model"
        
        manager = CacheManager(mock_client, model_name, mock_logger)
        
        assert manager.client == mock_client
        assert manager.model_name == model_name
        assert manager.logger == mock_logger
    
    @pytest.mark.asyncio
    async def test_create_cache_success(self):
        """Test successful cache creation."""
        # Setup mocks
        mock_client = Mock()
        mock_cache = Mock()
        mock_cache.name = "test_cache_123"
        mock_client.caches.create.return_value = mock_cache
        mock_logger = Mock()
        
        manager = CacheManager(mock_client, "test_model", mock_logger)
        
        # Test data
        system_instruction = "test instruction"
        contents = [{"parts": [{"text": "test"}]}]
        
        # Execute
        result = await manager.create_cache(system_instruction, contents)
        
        # Verify
        assert result == mock_cache
        mock_client.caches.create.assert_called_once()
        mock_logger.info.assert_called()
        
        # Check that success logging occurred
        success_calls = [call for call in mock_logger.info.call_args_list 
                        if "Cache created successfully" in str(call)]
        assert len(success_calls) > 0
    
    @pytest.mark.asyncio
    async def test_create_cache_with_contents_logging(self):
        """Test cache creation logging with contents."""
        mock_client = Mock()
        mock_cache = Mock()
        mock_cache.name = "test_cache"
        mock_client.caches.create.return_value = mock_cache
        mock_logger = Mock()
        
        manager = CacheManager(mock_client, "test_model", mock_logger)
        contents = [{"parts": [{"text": "test1"}]}, {"parts": [{"text": "test2"}]}]
        
        await manager.create_cache("test", contents)
        
        # Check that logging with content count occurred
        info_calls = [str(call) for call in mock_logger.info.call_args_list]
        content_log_found = any("2 few-shot examples" in call for call in info_calls)
        assert content_log_found
    
    @pytest.mark.asyncio
    async def test_create_cache_empty_contents_warning(self):
        """Test cache creation warning with empty contents."""
        mock_client = Mock()
        mock_cache = Mock()
        mock_cache.name = "test_cache"
        mock_client.caches.create.return_value = mock_cache
        mock_logger = Mock()
        
        manager = CacheManager(mock_client, "test_model", mock_logger)
        contents = []
        
        await manager.create_cache("test", contents)
        
        # Check that warning for empty contents occurred
        mock_logger.warning.assert_called()
        warning_calls = [str(call) for call in mock_logger.warning.call_args_list]
        empty_warning_found = any("No few-shot contents available" in call for call in warning_calls)
        assert empty_warning_found
    
    @pytest.mark.asyncio
    async def test_create_cache_failure(self):
        """Test cache creation failure handling."""
        mock_client = Mock()
        mock_client.caches.create.side_effect = Exception("API Error")
        mock_logger = Mock()
        
        manager = CacheManager(mock_client, "test_model", mock_logger)
        
        result = await manager.create_cache("test", [])
        
        assert result is None
        mock_logger.warning.assert_called()
        
        # Check that failure logging occurred
        warning_calls = [str(call) for call in mock_logger.warning.call_args_list]
        failure_warning_found = any("Cache creation failed" in call for call in warning_calls)
        assert failure_warning_found
    
    def test_validate_cache_inputs_valid(self):
        """Test cache input validation with valid inputs."""
        manager = CacheManager(Mock(), "test_model", Mock())
        
        result = manager.validate_cache_inputs("valid_instruction", [])
        
        assert result is True
    
    def test_validate_cache_inputs_invalid_instruction(self):
        """Test cache input validation with invalid instruction."""
        manager = CacheManager(Mock(), "test_model", Mock())
        
        # Empty string should be invalid
        assert manager.validate_cache_inputs("", []) is False
        assert manager.validate_cache_inputs(None, []) is False
    
    def test_validate_cache_inputs_invalid_contents(self):
        """Test cache input validation with invalid contents."""
        manager = CacheManager(Mock(), "test_model", Mock())
        
        # Non-list contents should be invalid
        assert manager.validate_cache_inputs("valid", "not_a_list") is False
        assert manager.validate_cache_inputs("valid", None) is False
        assert manager.validate_cache_inputs("valid", 123) is False


# Integration test to verify components work together
class TestCacheComponentsIntegration:
    """Integration tests for cache components working together."""
    
    def test_components_integration_flow(self):
        """Test that components can work together in the expected flow."""
        # Initialize components
        system_prompt = "test_system_prompt"
        instruction_builder = SystemInstructionBuilder(system_prompt)
        format_converter = ContentFormatConverter()
        
        # Test data
        character_prompt = {
            "persona_prompt": "test_persona",
            "few_shot_contents": [
                {"role": "user", "content": "test_legacy"},
                {"parts": [{"text": "test_gemini"}], "role": "assistant"}
            ]
        }
        
        # Execute the flow as in the refactored method
        assert instruction_builder.validate_character_prompt(character_prompt)
        
        system_instruction = instruction_builder.build_instruction(character_prompt)
        assert "test_system_prompt" in system_instruction
        assert "test_persona" in system_instruction
        
        few_shot_examples = character_prompt.get("few_shot_contents", [])
        assert format_converter.validate_examples(few_shot_examples)
        
        converted_contents = format_converter.convert_to_gemini_format(few_shot_examples)
        assert len(converted_contents) == 2
        assert all("parts" in content for content in converted_contents)
        
        # Mock cache manager validation
        mock_cache_manager = CacheManager(Mock(), "test_model", Mock())
        assert mock_cache_manager.validate_cache_inputs(system_instruction, converted_contents)