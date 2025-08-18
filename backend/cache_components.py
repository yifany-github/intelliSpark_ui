"""
Cache Component Classes for Gemini Service

This module contains focused classes that handle specific responsibilities
of the cache creation process, following the Single Responsibility Principle.

Classes:
    SystemInstructionBuilder: Handles system prompt formatting and assembly
    ContentFormatConverter: Handles data format detection and conversion  
    CacheManager: Handles cache creation and management with Gemini API
"""

from google.genai import types
from typing import List, Dict, Optional
import logging


class SystemInstructionBuilder:
    """
    Builds system instructions by combining system prompt and persona.
    
    Responsibilities:
    - Combine system prompt with character persona
    - Validate character prompt structure
    - Format instruction strings for API consumption
    """
    
    def __init__(self, system_prompt: str):
        """
        Initialize with base system prompt.
        
        Args:
            system_prompt: Base system prompt to use for all instructions
        """
        self.system_prompt = system_prompt
    
    def build_instruction(self, character_prompt: dict) -> str:
        """
        Build complete system instruction by combining system prompt and persona.
        
        Args:
            character_prompt: Dictionary containing persona_prompt and other character data
            
        Returns:
            Formatted system instruction string ready for API use
        """
        instruction = f"system_prompt: {self.system_prompt}\n"
        
        if character_prompt.get("persona_prompt"):
            instruction += f"persona prompt: {character_prompt['persona_prompt']}"
            
        return instruction
    
    def validate_character_prompt(self, character_prompt: dict) -> bool:
        """
        Validate character prompt structure.
        
        Args:
            character_prompt: Character prompt dictionary to validate
            
        Returns:
            True if valid, False otherwise
        """
        return isinstance(character_prompt, dict)


class ContentFormatConverter:
    """
    Converts between different content formats for API compatibility.
    
    Responsibilities:
    - Detect content format (Gemini vs legacy)
    - Convert legacy format to Gemini API format
    - Validate content structure
    """
    
    def convert_to_gemini_format(self, examples: List[Dict]) -> List[Dict]:
        """
        Convert examples to Gemini API format.
        
        Args:
            examples: List of example dictionaries in various formats
            
        Returns:
            List of examples converted to Gemini API format
        """
        converted_contents = []
        
        for example in examples:
            if self._is_gemini_format(example):
                # Already in correct format
                converted_contents.append(example)
            else:
                # Convert from legacy format
                converted_contents.append(self._convert_legacy_format(example))
                
        return converted_contents
    
    def _is_gemini_format(self, example: Dict) -> bool:
        """
        Check if example is already in Gemini API format.
        
        Args:
            example: Example dictionary to check
            
        Returns:
            True if already in Gemini format (has 'parts' key)
        """
        return "parts" in example
    
    def _convert_legacy_format(self, example: Dict) -> Dict:
        """
        Convert legacy format to Gemini API format.
        
        Args:
            example: Legacy format example with 'role' and 'content' keys
            
        Returns:
            Example converted to Gemini format with 'parts' structure
        """
        return {
            "role": example.get("role", "user"),
            "parts": [{"text": example.get("content", "")}]
        }
    
    def validate_examples(self, examples: List[Dict]) -> bool:
        """
        Validate example structure.
        
        Args:
            examples: List of examples to validate
            
        Returns:
            True if all examples are valid dictionaries
        """
        if not isinstance(examples, list):
            return False
            
        return all(isinstance(ex, dict) for ex in examples)


class CacheManager:
    """
    Manages Gemini API cache creation and lifecycle.
    
    Responsibilities:
    - Create cache with Gemini API
    - Handle cache creation errors gracefully
    - Provide detailed logging for cache operations
    - Validate cache creation inputs
    """
    
    def __init__(self, client, model_name: str, logger: logging.Logger):
        """
        Initialize cache manager with API client and configuration.
        
        Args:
            client: Gemini API client instance
            model_name: Name of the model to use for cache creation
            logger: Logger instance for operation logging
        """
        self.client = client
        self.model_name = model_name
        self.logger = logger
    
    async def create_cache(self, system_instruction: str, contents: List[Dict]) -> Optional[object]:
        """
        Create cache with proper error handling and logging.
        
        Args:
            system_instruction: Formatted system instruction string
            contents: List of content examples in Gemini format
            
        Returns:
            Cache object if successful, None if failed
        """
        try:
            # Log cache creation attempt
            if contents:
                self.logger.info(f"✅ Cache creation: {len(contents)} few-shot examples")
            else:
                self.logger.warning("⚠️ Cache creation: No few-shot contents available")
            
            # Create cache via Gemini API
            cache = self.client.caches.create(
                model=self.model_name,
                config=types.CreateCachedContentConfig(
                    system_instruction=system_instruction,
                    contents=contents
                )
            )
            
            # Log successful creation
            self.logger.info(f"🎯 Cache created successfully: {cache.name}")
            return cache
            
        except Exception as e:
            # Log failure with context
            self.logger.warning(f"⚠️ Cache creation failed (likely due to minimum token requirement): {e}")
            return None
    
    def validate_cache_inputs(self, system_instruction: str, contents: List[Dict]) -> bool:
        """
        Validate inputs for cache creation.
        
        Args:
            system_instruction: System instruction string to validate
            contents: Content list to validate
            
        Returns:
            True if inputs are valid for cache creation
        """
        return bool(system_instruction) and isinstance(contents, list)