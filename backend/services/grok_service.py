"""
Grok AI Service for IntelliSpark AI Chat Application

This service provides integration with xAI's Grok 3 Mini model as an alternative
to Gemini. Grok offers different conversational characteristics and serves as
a backup when Gemini is unavailable.

Features:
- Grok 3 Mini model integration
- Character-aware conversations
- Fallback response simulation
- Consistent API with other AI services

API Documentation: https://docs.x.ai/api
"""

import asyncio
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import openai  # xAI uses OpenAI-compatible API

from models import Character, ChatMessage
from prompts.system import SYSTEM_PROMPT
from utils.prompt_selector import select_system_prompt
from .ai_service_base import AIServiceBase, AIServiceError

logger = logging.getLogger(__name__)

class GrokService(AIServiceBase):
    """xAI Grok service implementation"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize Grok service"""
        super().__init__("grok-3-mini", api_key)
        self.base_url = "https://api.x.ai/v1"  # xAI API endpoint
        
    async def initialize(self) -> bool:
        """Initialize Grok service client"""
        try:
            if not self.api_key:
                self.logger.warning("No xAI API key provided. Grok service will use simulated responses.")
                return True  # Allow fallback mode
            
            # Initialize OpenAI client with xAI configuration
            self.client = openai.AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )
            
            # Test API connection with a simple request
            await self._test_connection()
            
            self.logger.info("✅ Grok AI service initialized successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize Grok service: {e}")
            self.client = None
            return False
    
    async def _test_connection(self):
        """Test API connection with minimal request"""
        try:
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=10
            )
            if response and response.choices:
                self.logger.info("🔗 Grok API connection test successful")
            else:
                raise AIServiceError("Empty response from Grok API")
        except Exception as e:
            raise AIServiceError(f"Grok API connection test failed: {e}")
    
    @property
    def is_available(self) -> bool:
        """Check if Grok service is available"""
        return self.client is not None and self.api_key is not None
    
    @property 
    def service_name(self) -> str:
        """Get service display name"""
        return "xAI Grok"
    
    async def generate_response(
        self,
        character: Character,
        messages: List[ChatMessage],
        user_preferences: Optional[dict] = None,
        state: Optional[Dict[str, str]] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """Generate AI response using Grok"""
        
        if not self.is_available:
            return self._simulate_response(character, messages), {"tokens_used": 1}

        try:
            # Extract chat_language from user_preferences for prompt generation
            chat_language = None
            if user_preferences and 'chat_language' in user_preferences:
                chat_language = user_preferences['chat_language']

            # Get character prompt configuration
            character_prompt = self._get_character_prompt(character, chat_language=chat_language)
            
            # Log character loading info
            if character:
                few_shot_count = len(character_prompt.get("few_shot_contents", []))
                if self._is_hardcoded_character(character):
                    self.logger.info(f"🎭 Grok loading hardcoded character: {character.name} with {few_shot_count} examples")
                else:
                    self.logger.info(f"🎭 Grok loading user-created character: {character.name} (few-shot: {few_shot_count})")
            else:
                self.logger.info("🎭 Grok generating response without character context")
            
            # Manage conversation length
            managed_messages = self._manage_conversation_length(messages)
            
            # Build messages for Grok API
            grok_messages = self._build_grok_messages(character_prompt, managed_messages, character, state)
            
            # Apply user preferences
            generation_config = self._build_generation_config(user_preferences)
            
            # Generate response using Grok API
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=grok_messages,
                **generation_config
            )
            
            if response and response.choices and response.choices[0].message:
                raw_text = response.choices[0].message.content.strip()
                response_text, state_update = self._extract_state_update(raw_text)
                
                # Calculate token usage
                token_info = {
                    "input_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "output_tokens": response.usage.completion_tokens if response.usage else 0,
                    "total_tokens": response.usage.total_tokens if response.usage else 0
                }
                if state_update:
                    token_info["state_update"] = state_update
                
                self.logger.info(f"✅ Grok response generated: {token_info['total_tokens']} tokens")
                return response_text, token_info
            else:
                self.logger.warning("⚠️ Empty response from Grok, using fallback")
                return self._simulate_response(character, messages), {"tokens_used": 1}
                
        except Exception as e:
            self.logger.error(f"❌ Error generating Grok response: {e}")
            return self._simulate_response(character, messages), {"tokens_used": 1}
    
    async def generate_opening_line(self, character: Character) -> str:
        """Generate opening line for character using Grok"""
        self.logger.info(f"🚀 Grok generating opening line for: {character.name}")
        
        if not self.is_available:
            return f"Hello! I'm {character.name}. {character.backstory[:100] if character.backstory else 'Nice to meet you!'}..."
        
        try:
            # Get character prompt configuration
            character_prompt = self._get_character_prompt(character)
            
            # Create opening line prompt
            system_message = self._build_system_message(character_prompt, character)
            user_message = f"Generate an engaging opening line for {character.name}. Stay in character and create an immersive first impression."
            
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
            
            # Generate opening line
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                max_tokens=150,
                temperature=0.8
            )
            
            if response and response.choices and response.choices[0].message:
                opening_line = response.choices[0].message.content.strip()
                self.logger.info(f"✅ Grok opening line generated for {character.name}")
                return opening_line
            else:
                self.logger.warning("⚠️ Empty opening line response from Grok")
                return f"Hello! I'm {character.name}. {character.backstory[:100] if character.backstory else 'Nice to meet you!'}..."
                
        except Exception as e:
            self.logger.error(f"❌ Error generating Grok opening line: {e}")
            return f"Hello! I'm {character.name}. {character.backstory[:100] if character.backstory else 'Nice to meet you!'}..."

    async def generate_scene_bootstrap(
        self,
        character: Character,
        *,
        safe_mode: bool,
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Atomically generate opening_line + default state for one shared scene."""
        from prompts.scene_bootstrap import (
            build_scene_bootstrap_prompt,
            parse_scene_bootstrap_response,
            scene_pair_looks_coherent,
        )
        from prompts.state_initialization import STATE_KEYS as NSFW_STATE_KEYS
        from prompts.state_initialization_safe import SAFE_STATE_KEYS
        from utils.language_utils import normalize_language_code

        if not self.is_available:
            return {}

        allowed_keys = SAFE_STATE_KEYS if safe_mode else NSFW_STATE_KEYS
        raw_language = normalize_language_code(language or "zh")
        target_language = "zh" if raw_language == "zh" else "en"
        persona_text = (
            (getattr(character, "persona_prompt", None) or "").strip()
            or (getattr(character, "backstory", None) or "").strip()
            or (character.description or "")
            or ""
        )
        scenario_hook = (getattr(character, "scenario_hook", None) or "").strip()
        prompt_bundle = build_scene_bootstrap_prompt(
            character_name=character.name or "",
            description=character.description or "",
            persona_text=persona_text,
            voice_style=getattr(character, "voice_style", None) or "",
            safe_mode=safe_mode,
            state_keys=list(allowed_keys),
            language=target_language,
            scenario_hook=scenario_hook,
        )

        async def _once(user_prompt: str) -> Dict[str, Any]:
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": prompt_bundle.system_instruction},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=1200,
                temperature=0.7,
            )
            text = ""
            if response and response.choices and response.choices[0].message:
                text = response.choices[0].message.content or ""
            parsed = parse_scene_bootstrap_response(text, allowed_keys)
            if not parsed.get("opening_line") or not parsed.get("state"):
                return {}
            return parsed

        try:
            result = await _once(prompt_bundle.user_prompt)
            if result and scene_pair_looks_coherent(
                result["opening_line"], result["state"], safe_mode=safe_mode
            ):
                self.logger.info("✅ Grok scene bootstrap for %s", character.name)
                return result

            missing_hint = (
                "你必须补全 state 里每一个键，尤其是非空的：环境、衣服、姿势、胸部、下体"
                if not safe_mode
                else "你必须补全 state 里每一个键，尤其是非空的：环境、衣着、仪态、动作、语气"
            )
            self.logger.warning("⚠️ Grok scene bootstrap incomplete for %s; retrying", character.name)
            retry_prompt = (
                prompt_bundle.user_prompt
                + f"\n\n【重试强调】上一版不合格。{missing_hint}。"
                "opening_line 必须与这些描述字段处于同一现场。"
            )
            result = await _once(retry_prompt)
            # Second attempt still requires coherence — never return incoherent partials.
            if result and scene_pair_looks_coherent(
                result["opening_line"], result["state"], safe_mode=safe_mode
            ):
                return result
        except Exception as exc:
            self.logger.error("❌ Grok scene bootstrap failed: %s", exc)

        return {}

    def _build_grok_messages(
        self, 
        character_prompt: dict, 
        messages: List[ChatMessage], 
        character: Optional[Character],
        state: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, str]]:
        """
        Build message format for Grok API
        
        Args:
            character_prompt: Character prompt configuration
            messages: Conversation messages
            character: Character context
            
        Returns:
            List[Dict]: Messages in Grok API format
        """
        grok_messages = []
        
        # Add system message with character context
        system_message = self._build_system_message(character_prompt, character)
        grok_messages.append({"role": "system", "content": system_message})

        if state:
            try:
                state_json = json.dumps(state, ensure_ascii=False)
            except (TypeError, ValueError):
                state_json = ""
            if state_json:
                grok_messages.append({"role": "system", "content": f"[当前状态: {state_json}]"})
        
        # Add few-shot examples as conversation history
        few_shot_contents = character_prompt.get("few_shot_contents", [])
        if few_shot_contents:
            # Add a subset of few-shot examples to avoid context length issues
            selected_examples = few_shot_contents[:5]  # Limit to first 5 examples
            for example in selected_examples:
                if isinstance(example, dict) and "parts" in example:
                    for part in example["parts"]:
                        if "text" in part:
                            # Parse the few-shot format and add as messages
                            self._parse_few_shot_to_messages(part["text"], grok_messages, character)
        
        # Add conversation history
        character_name = self._extract_character_name(character)
        for message in messages:
            if message.role == 'user':
                grok_messages.append({"role": "user", "content": message.content})
            elif message.role == 'assistant':
                grok_messages.append({"role": "assistant", "content": message.content})

        # Beat progression + turn contract (same policy as Gemini path)
        try:
            from prompts.beat_progression import build_beat_hint, detect_beat_mode
            from prompts.turn_contract import build_turn_contract

            mode = detect_beat_mode(messages)
            persona_for_contract = ""
            if character is not None:
                persona_for_contract = (
                    (getattr(character, "persona_prompt", None) or "").strip()
                    or (getattr(character, "backstory", None) or "").strip()
                    or (getattr(character, "description", None) or "").strip()
                )
            contract = build_turn_contract(
                messages,
                state,
                language="zh",
                persona_text=persona_for_contract,
            )
            if contract.mode in {"intimacy", "conflict", "execute", "lead"}:
                mode = contract.mode
            grok_messages.append(
                {"role": "system", "content": build_beat_hint(mode, "zh")}
            )
            grok_messages.append(
                {"role": "system", "content": contract.to_prompt("zh")}
            )
        except Exception as exc:
            self.logger.debug("Beat/contract skipped for Grok: %s", exc)

        return grok_messages
    
    def _build_system_message(self, character_prompt: dict, character: Optional[Character] = None) -> str:
        """
        Build system message from character prompt
        
        Args:
            character_prompt: Character prompt configuration
            
        Returns:
            str: System message content
        """
        system_parts = []
        
        # Add base system prompt selected via SAFE/NSFW toggle
        try:
            selected_system_prompt, prompt_type = select_system_prompt(character)  # defaults to SAFE when character is None
            self.logger.info(f"🧭 Grok using {prompt_type} system prompt")
            system_parts.append(selected_system_prompt)
        except Exception:
            # Fallback to original NSFW system prompt if selection fails
            system_parts.append(SYSTEM_PROMPT)
        
        # Add character persona
        persona_prompt = character_prompt.get("persona_prompt", "")
        if persona_prompt:
            system_parts.append(f"\nCharacter Persona:\n{persona_prompt}")
        
        # Add Grok-specific instructions
        system_parts.append("""
Grok AI Instructions:
- Respond naturally and engagingly as the character
- Maintain consistency with the character's personality and backstory
- Use appropriate tone and style for the character
- Keep responses conversational and immersive
- Avoid breaking character or mentioning AI limitations
""")
        
        return "\n".join(system_parts)
    
    def _parse_few_shot_to_messages(
        self, 
        few_shot_text: str, 
        messages: List[Dict[str, str]], 
        character: Optional[Character]
    ):
        """
        Parse few-shot example text into message format
        
        Args:
            few_shot_text: Few-shot example text
            messages: Message list to append to
            character: Character context
        """
        # Simple parsing - split by user/character indicators
        lines = few_shot_text.split('\n')
        current_role = None
        current_content = []
        
        character_name = self._extract_character_name(character)
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith('用户:') or line.startswith('User:'):
                if current_role and current_content:
                    messages.append({"role": current_role, "content": '\n'.join(current_content)})
                current_role = "user"
                current_content = [line.split(':', 1)[1].strip()]
            elif line.startswith(f'{character_name}:') or any(line.startswith(f'{name}:') for name in ['艾莉丝', 'Assistant']):
                if current_role and current_content:
                    messages.append({"role": current_role, "content": '\n'.join(current_content)})
                current_role = "assistant"
                current_content = [line.split(':', 1)[1].strip()]
        else:
            if current_content:
                current_content.append(line)
        
        # Add final message
        if current_role and current_content:
            messages.append({"role": current_role, "content": '\n'.join(current_content)})

    def _extract_state_update(self, response_text: str) -> Tuple[str, Dict[str, str]]:
        from utils.state_block import extract_state_update

        return extract_state_update(response_text or "")
    
    def _build_generation_config(self, user_preferences: Optional[dict]) -> dict:
        """
        Build generation configuration from user preferences
        
        Args:
            user_preferences: User settings
            
        Returns:
            dict: Generation configuration
        """
        config = {
            "max_tokens": 1000,
            "temperature": 0.8,
            "top_p": 0.9,
        }
        
        if user_preferences:
            # Apply temperature preference
            if "temperature" in user_preferences:
                config["temperature"] = max(0.1, min(1.0, user_preferences["temperature"]))
            
            # Apply other preferences as needed
            # Note: Grok may have different parameter names than Gemini
        
        return config
