"""
AI Model Manager for IntelliSpark AI Chat Application

This manager provides unified access to multiple AI services with intelligent
routing, fallback mechanisms, and preference management.

Key Features:
- Multi-model support (Gemini, Grok, future models)
- Intelligent model selection based on user/admin preferences
- Automatic fallback when primary model is unavailable
- Load balancing and health monitoring
- Admin controls for enabling/disabling models
- User preference tracking and model switching

Architecture:
- ServiceRegistry: Manages available AI services
- ModelSelector: Chooses optimal model based on preferences
- HealthMonitor: Tracks service availability and performance
- PreferenceManager: Handles user and admin preferences
"""

from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
from models import Character, ChatMessage, User
from .ai_service_base import AIServiceBase, AIServiceError
from .gemini_service_new import GeminiService
from .grok_service import GrokService
from .openai_service import OpenAIService
from config import settings
import logging
import asyncio
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class ModelStatus(Enum):
    """AI Model availability status"""
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    MAINTENANCE = "maintenance"
    DISABLED = "disabled"

class ModelProvider(Enum):
    """Supported AI model providers"""
    GEMINI = "gemini"
    GROK = "grok"
    OPENAI = "openai"

class AIModelManager:
    """Central manager for multiple AI services"""
    
    def __init__(self):
        """Initialize AI model manager"""
        self.services: Dict[ModelProvider, AIServiceBase] = {}
        self.service_status: Dict[ModelProvider, ModelStatus] = {}
        self.last_health_check: Dict[ModelProvider, datetime] = {}
        self.admin_settings = {
            "enabled_models": [ModelProvider.GEMINI, ModelProvider.GROK, ModelProvider.OPENAI],
            "default_model": ModelProvider.GEMINI,
            "fallback_enabled": True,
            "health_check_interval": 300  # 5 minutes
        }
        self.logger = logging.getLogger(__name__)
        
    async def initialize(self) -> bool:
        """Initialize all AI services"""
        self.logger.info("🚀 Initializing AI Model Manager...")
        
        success_count = 0
        
        # Initialize Gemini service
        try:
            gemini_service = GeminiService(api_key=settings.gemini_api_key)
            if await gemini_service.initialize():
                self.services[ModelProvider.GEMINI] = gemini_service
                self.service_status[ModelProvider.GEMINI] = ModelStatus.AVAILABLE
                success_count += 1
                self.logger.info("✅ Gemini service initialized")
            else:
                self.service_status[ModelProvider.GEMINI] = ModelStatus.UNAVAILABLE
                self.logger.warning("⚠️ Gemini service failed to initialize")
        except Exception as e:
            self.service_status[ModelProvider.GEMINI] = ModelStatus.UNAVAILABLE
            self.logger.error(f"❌ Gemini service initialization error: {e}")
        
        # Initialize Grok service
        try:
            grok_api_key = getattr(settings, 'grok_api_key', None)  # Optional for now
            grok_service = GrokService(api_key=grok_api_key)
            if await grok_service.initialize():
                self.services[ModelProvider.GROK] = grok_service
                self.service_status[ModelProvider.GROK] = ModelStatus.AVAILABLE
                success_count += 1
                self.logger.info("✅ Grok service initialized")
            else:
                self.service_status[ModelProvider.GROK] = ModelStatus.UNAVAILABLE
                self.logger.warning("⚠️ Grok service failed to initialize")
        except Exception as e:
            self.service_status[ModelProvider.GROK] = ModelStatus.UNAVAILABLE
            self.logger.error(f"❌ Grok service initialization error: {e}")

        # Initialize OpenAI service
        try:
            openai_api_key = getattr(settings, "openai_api_key", None)
            openai_service = OpenAIService(api_key=openai_api_key)
            if await openai_service.initialize():
                self.services[ModelProvider.OPENAI] = openai_service
                self.service_status[ModelProvider.OPENAI] = ModelStatus.AVAILABLE
                success_count += 1
                self.logger.info("✅ OpenAI service initialized")
            else:
                self.service_status[ModelProvider.OPENAI] = ModelStatus.UNAVAILABLE
                self.logger.warning("⚠️ OpenAI service failed to initialize")
        except Exception as e:
            self.service_status[ModelProvider.OPENAI] = ModelStatus.UNAVAILABLE
            self.logger.error(f"❌ OpenAI service initialization error: {e}")
        
        self.logger.info(f"✅ AI Model Manager initialized: {success_count}/{len(ModelProvider)} services available")
        return success_count > 0
    
    async def generate_response(
        self,
        character: Character,
        messages: List[ChatMessage],
        user_preferences: Optional[dict] = None,
        user: Optional[User] = None,
        state: Optional[Dict[str, str]] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generate AI response using optimal model selection
        
        Args:
            character: Character to roleplay as
            messages: Conversation history
            user_preferences: User settings (temperature, etc.)
            user: User object for preference tracking
            
        Returns:
            Tuple[str, Dict]: (response_text, generation_info)
        """
        # Select optimal model
        selected_provider = await self._select_model(user, character, user_preferences)
        
        if not selected_provider:
            return "抱歉，当前所有AI服务都不可用。请稍后再试。", {"model": "fallback", "tokens_used": 0}
        
        try:
            service = self.services[selected_provider]
            response, token_info = await service.generate_response(
                character,
                messages,
                user_preferences,
                state,
            )
            
            # Add model information to response
            enhanced_info = {
                **token_info,
                "model": selected_provider.value,
                "service_name": service.service_name
            }
            
            self.logger.info(f"✅ Response generated using {service.service_name}")
            return response, enhanced_info
            
        except AIServiceError as e:
            self.logger.error(f"❌ Error with {selected_provider.value}: {e}")
            # Scene/role hard fails must not hop providers or soft-succeed
            if not getattr(e, "retryable", True):
                return (
                    "抱歉，AI服务暂时不可用。请稍后再试。",
                    {"model": "error", "tokens_used": 0, "error": str(e)},
                )
            if self.admin_settings["fallback_enabled"]:
                fallback_provider = await self._get_fallback_model(selected_provider)
                if fallback_provider and fallback_provider in self.services:
                    try:
                        fallback_service = self.services[fallback_provider]
                        response, token_info = await fallback_service.generate_response(
                            character,
                            messages,
                            user_preferences,
                            state,
                        )
                        enhanced_info = {
                            **token_info,
                            "model": fallback_provider.value,
                            "service_name": fallback_service.service_name,
                            "fallback_used": True,
                        }
                        self.logger.info(
                            f"✅ Fallback response generated using {fallback_service.service_name}"
                        )
                        return response, enhanced_info
                    except AIServiceError as fallback_error:
                        self.logger.error(f"❌ Fallback also failed: {fallback_error}")
                        return (
                            "抱歉，AI服务暂时不可用。请稍后再试。",
                            {
                                "model": "error",
                                "tokens_used": 0,
                                "error": str(fallback_error),
                            },
                        )
                    except Exception as fallback_error:
                        self.logger.error(f"❌ Fallback also failed: {fallback_error}")
            return "抱歉，AI服务暂时不可用。请稍后再试。", {"model": "error", "tokens_used": 0}
        except Exception as e:
            self.logger.error(f"❌ Error with {selected_provider.value}: {e}")
            
            # Try fallback if enabled
            if self.admin_settings["fallback_enabled"]:
                fallback_provider = await self._get_fallback_model(selected_provider)
                if fallback_provider and fallback_provider in self.services:
                    try:
                        fallback_service = self.services[fallback_provider]
                        response, token_info = await fallback_service.generate_response(
                            character,
                            messages,
                            user_preferences,
                            state,
                        )
                        
                        enhanced_info = {
                            **token_info,
                            "model": fallback_provider.value,
                            "service_name": fallback_service.service_name,
                            "fallback_used": True
                        }
                        
                        self.logger.info(f"✅ Fallback response generated using {fallback_service.service_name}")
                        return response, enhanced_info
                    except Exception as fallback_error:
                        self.logger.error(f"❌ Fallback also failed: {fallback_error}")
            
            # All services failed
            return "抱歉，AI服务暂时不可用。请稍后再试。", {"model": "error", "tokens_used": 0}
    
    async def generate_opening_line(
        self,
        character: Character,
        user: Optional[User] = None
    ) -> str:
        """Generate opening line using optimal model"""
        
        selected_provider = await self._select_model(user, character)
        
        if not selected_provider:
            return f"Hello! I'm {character.name}. Nice to meet you!"
        
        try:
            service = self.services[selected_provider]
            opening_line = await service.generate_opening_line(character)
            self.logger.info(f"✅ Opening line generated using {service.service_name}")
            return opening_line

        except Exception as e:
            self.logger.error(f"❌ Error generating opening line with {selected_provider.value}: {e}")

            # Try fallback
            if self.admin_settings["fallback_enabled"]:
                fallback_provider = await self._get_fallback_model(selected_provider)
                if fallback_provider and fallback_provider in self.services:
                    try:
                        fallback_service = self.services[fallback_provider]
                        opening_line = await fallback_service.generate_opening_line(character)
                        self.logger.info(f"✅ Fallback opening line generated using {fallback_service.service_name}")
                        return opening_line
                    except Exception as e:
                        self.logger.warning(f"Fallback opening line generation failed: {e}")

            # Final fallback
            return f"Hello! I'm {character.name}. {character.backstory[:100] if character.backstory else 'Nice to meet you!'}..."

    async def generate_scene_bootstrap(
        self,
        character: Character,
        user: Optional[User] = None,
        language: Optional[str] = None,
        *,
        allow_split_fallback: bool = True,
    ) -> Dict[str, Any]:
        """
        Atomically generate opening_line + default state for one shared scene.

        Falls back to separate opening + state calls if the provider lacks
        generate_scene_bootstrap or the atomic call fails empty — unless
        allow_split_fallback is False (migration / strict atomic mode).
        """
        safe_mode = (character.nsfw_level or 0) == 0
        selected_provider = await self._select_model(user, character)

        async def _invoke(provider: ModelProvider) -> Dict[str, Any]:
            service = self.services.get(provider)
            if service and hasattr(service, "generate_scene_bootstrap"):
                return await service.generate_scene_bootstrap(
                    character,
                    safe_mode=safe_mode,
                    language=language,
                )
            return {}

        if selected_provider:
            try:
                bundle = await _invoke(selected_provider)
                if bundle.get("opening_line") and bundle.get("state"):
                    self.logger.info(
                        "✅ Scene bootstrap via %s",
                        self.services[selected_provider].service_name,
                    )
                    return bundle
            except Exception as exc:
                self.logger.error(
                    "❌ Scene bootstrap failed with %s: %s",
                    selected_provider.value,
                    exc,
                )

            if self.admin_settings["fallback_enabled"]:
                fallback_provider = await self._get_fallback_model(selected_provider)
                if fallback_provider and fallback_provider in self.services:
                    try:
                        bundle = await _invoke(fallback_provider)
                        if bundle.get("opening_line") and bundle.get("state"):
                            self.logger.info(
                                "✅ Scene bootstrap fallback via %s",
                                self.services[fallback_provider].service_name,
                            )
                            return bundle
                    except Exception as exc:
                        self.logger.warning("Scene bootstrap fallback failed: %s", exc)

        if not allow_split_fallback:
            self.logger.warning(
                "⚠️ Atomic scene bootstrap unavailable; refusing split fallback"
            )
            return {}

        # Legacy split path — better than nothing, but not atomic
        self.logger.warning("⚠️ Falling back to split opening + state seed generation")
        opening = await self.generate_opening_line(character, user=user)
        state = await self.generate_character_state_seed(
            character, user=user, language=language
        )
        return {
            "opening_line": opening,
            "state": state or {},
            "scene_summary": "",
        }

    async def generate_character_state_seed(
        self,
        character: Character,
        user: Optional[User] = None,
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate per-character default state template."""

        safe_mode = (character.nsfw_level or 0) == 0
        selected_provider = await self._select_model(user, character)

        async def _invoke(provider: ModelProvider) -> Dict[str, str]:
            service = self.services.get(provider)
            if service and hasattr(service, "generate_state_seed"):
                return await service.generate_state_seed(
                    character,
                    safe_mode=safe_mode,
                    language=language,
                )
            return {}

        if not selected_provider:
            return {}

        try:
            state_seed = await _invoke(selected_provider)
            if state_seed:
                self.logger.info(
                    "✅ State seed generated using %s", self.services[selected_provider].service_name
                )
                return state_seed
        except Exception as exc:
            self.logger.error("❌ Error generating state seed with %s: %s", selected_provider.value, exc)

        if self.admin_settings["fallback_enabled"]:
            fallback_provider = await self._get_fallback_model(selected_provider)
            if fallback_provider and fallback_provider in self.services:
                try:
                    state_seed = await _invoke(fallback_provider)
                    if state_seed:
                        self.logger.info(
                            "✅ Fallback state seed generated using %s",
                            self.services[fallback_provider].service_name,
                        )
                        return state_seed
                except Exception as exc:
                    self.logger.warning("Fallback state seed generation failed: %s", exc)

        return {}
    
    async def _select_model(
        self,
        user: Optional[User] = None,
        character: Optional[Character] = None,
        user_preferences: Optional[dict] = None
    ) -> Optional[ModelProvider]:
        """
        Select optimal AI model based on preferences and availability
        
        Selection Priority:
        1. User's preferred model (if set and available)
        2. Character-specific model preference (if any)
        3. Admin default model
        4. First available model
        """
        
        # Get user preferred model
        user_preferred = None
        if user and hasattr(user, 'preferred_ai_model'):
            try:
                user_preferred = ModelProvider(user.preferred_ai_model)
            except ValueError:
                pass
        
        # Check user preference first
        if user_preferred and await self._is_model_available(user_preferred):
            self.logger.info(f"🎯 Using user preferred model: {user_preferred.value}")
            return user_preferred
        
        # Use admin default if available
        default_model = self.admin_settings["default_model"]
        if await self._is_model_available(default_model):
            self.logger.info(f"🎯 Using default model: {default_model.value}")
            return default_model
        
        # Find first available model
        for provider in self.admin_settings["enabled_models"]:
            if await self._is_model_available(provider):
                self.logger.info(f"🎯 Using first available model: {provider.value}")
                return provider
        
        self.logger.warning("⚠️ No available AI models found")
        return None
    
    async def _is_model_available(self, provider: ModelProvider) -> bool:
        """
        Check if a specific model is available
        
        Args:
            provider: Model provider to check
            
        Returns:
            bool: True if model is available and enabled
        """
        # Check if model is enabled by admin
        if provider not in self.admin_settings["enabled_models"]:
            return False
        
        # Check service status
        if provider not in self.service_status:
            return False
        
        status = self.service_status[provider]
        if status in [ModelStatus.DISABLED, ModelStatus.MAINTENANCE]:
            return False
        
        # Check if service exists and is available
        if provider in self.services:
            return self.services[provider].is_available
        
        return False
    
    async def _get_fallback_model(self, failed_provider: ModelProvider) -> Optional[ModelProvider]:
        """Get fallback model when primary fails"""
        preferred_fallback = ModelProvider.GROK
        if failed_provider != preferred_fallback and await self._is_model_available(preferred_fallback):
            return preferred_fallback
        for provider in self.admin_settings["enabled_models"]:
            if provider != failed_provider and await self._is_model_available(provider):
                return provider
        return None
    
    # ADMIN FUNCTIONS
    
    def get_model_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all AI models (for admin dashboard)"""
        status_info = {}
        
        for provider in ModelProvider:
            service = self.services.get(provider)
            status_info[provider.value] = {
                "service_name": service.service_name if service else "Not Initialized",
                "status": self.service_status.get(provider, ModelStatus.UNAVAILABLE).value,
                "is_available": service.is_available if service else False,
                "enabled": provider in self.admin_settings["enabled_models"],
                "is_default": provider == self.admin_settings["default_model"]
            }
        
        return status_info
    
    def set_model_enabled(self, provider: ModelProvider, enabled: bool) -> bool:
        """Enable/disable specific model (admin function)"""
        try:
            if enabled:
                if provider not in self.admin_settings["enabled_models"]:
                    self.admin_settings["enabled_models"].append(provider)
            else:
                if provider in self.admin_settings["enabled_models"]:
                    self.admin_settings["enabled_models"].remove(provider)
            
            self.logger.info(f"🔧 Model {provider.value} {'enabled' if enabled else 'disabled'} by admin")
            return True
        except Exception as e:
            self.logger.error(f"❌ Failed to {'enable' if enabled else 'disable'} model {provider.value}: {e}")
            return False
    
    def set_default_model(self, provider: ModelProvider) -> bool:
        """Set default model (admin function)"""
        try:
            self.admin_settings["default_model"] = provider
            self.logger.info(f"🔧 Default model changed to {provider.value} by admin")
            return True
        except Exception as e:
            self.logger.error(f"❌ Failed to set default model to {provider.value}: {e}")
            return False
    
    def get_admin_settings(self) -> Dict[str, Any]:
        """Get admin settings"""
        return {
            **self.admin_settings,
            "enabled_models": [p.value for p in self.admin_settings["enabled_models"]],
            "default_model": self.admin_settings["default_model"].value
        }

# Dependency injection compatible instance
_ai_model_manager_instance: Optional[AIModelManager] = None

async def get_ai_model_manager() -> AIModelManager:
    """Get initialized AI model manager instance using dependency injection pattern"""
    global _ai_model_manager_instance
    
    if _ai_model_manager_instance is None:
        _ai_model_manager_instance = AIModelManager()
    
    if not _ai_model_manager_instance.services:
        await _ai_model_manager_instance.initialize()
    
    return _ai_model_manager_instance

def reset_ai_model_manager():
    """Reset the manager instance - useful for testing"""
    global _ai_model_manager_instance
    _ai_model_manager_instance = None
