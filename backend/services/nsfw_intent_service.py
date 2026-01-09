"""
Sexual Stage Detection Service for IntelliSpark AI Chat Application

This service detects objective sexual activity stages (not subjective intent) to inject
targeted reminders that prevent AI from assuming user state (e.g., "你快射了").

Goal: Keep AI reactive (describing what it observes) rather than predictive (narrating future states)

Stages aligned with system.py lines 148-162:
- 插入前, 准备插入, 插入时, 抽插时, 角色高潮（自然发生）, 其他

Key difference from intent detection:
- Stage = objective fact (what's happening now)
- Intent = subjective guess (what user wants)
- Stages map directly to system prompt sections
"""

from typing import List, Dict, Any, Optional
import os
import logging
import asyncio
from google import genai
from google.genai import types

from models import ChatMessage
from config import settings
from prompts.sexual_stage_detection import build_stage_detection_prompt
from prompts.sexual_stage_reminders import get_stage_reminder


class NSFWIntentService:
    """Service for detecting user sexual intent in NSFW conversations"""
    
    def __init__(self, gemini_client=None):
        self.logger = logging.getLogger(__name__)
        default_model = "gemini-2.0-flash-001"
        intent_override = os.getenv("GEMINI_INTENT_MODEL", "").strip()
        shared_override = os.getenv("GEMINI_MODEL", "").strip()
        self.model_name = intent_override or shared_override or default_model
        
        # Use shared client or create new one
        if gemini_client:
            self.client = gemini_client
            self.logger.info("NSFW Intent Service initialized with shared client")
        else:
            self.client = self._create_client()
    
    def _create_client(self):
        """Create Gemini client (matches GeminiService pattern)"""
        if not settings.gemini_api_key:
            self.logger.warning("No Gemini API key found for NSFW Intent Service")
            return None
        
        try:
            import os
            os.environ['GEMINI_API_KEY'] = settings.gemini_api_key
            client = genai.Client()
            self.logger.info("NSFW Intent Service initialized successfully")
            return client
        except Exception as e:
            self.logger.error(f"Failed to initialize NSFW Intent Service: {e}")
            return None
    
    async def detect_user_intent(self, recent_messages: List[ChatMessage]) -> str:
        """
        Detect sexual activity stage (objective, not subjective intent)

        Args:
            recent_messages: Last 2-3 messages from conversation

        Returns:
            Stage: "其他", "插入前", "准备插入", "插入时", "抽插时", "角色高潮（自然发生）"
        """

        if not self.client:
            self.logger.warning("No Gemini client available, returning default stage")
            return "其他"

        if not recent_messages:
            return "其他"
        
        try:
            # Format recent conversation for analysis
            conversation = self._format_messages_for_analysis(recent_messages[-3:])

            # Build stage detection prompt (centralized in prompts/)
            stage_prompt = build_stage_detection_prompt(conversation)

            # Generate stage classification
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[{"role": "user", "parts": [{"text": stage_prompt}]}],
                config=types.GenerateContentConfig(
                    max_output_tokens=10,
                    temperature=0.1,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                )
            )

            if response and response.text:
                detected_stage = response.text.strip()

                # Validate stage - must match system.py stages exactly
                valid_stages = ["其他", "插入前", "准备插入", "插入时", "抽插时", "角色高潮（自然发生）"]
                if detected_stage in valid_stages:
                    self.logger.info(f"🎯 Sexual stage detected: {detected_stage}")
                    return detected_stage
                else:
                    self.logger.warning(f"Invalid stage detected: {detected_stage}, defaulting to '其他'")
                    return "其他"
            else:
                self.logger.warning("Empty response from stage detection, defaulting to '其他'")
                return "其他"

        except (ConnectionError, TimeoutError) as e:
            self.logger.warning(f"Gemini API temporarily unavailable: {e}")
            return "其他"  # Safe fallback
        except Exception as e:
            self.logger.error(f"Unexpected error detecting stage: {e}")
            return "其他"  # Safe fallback
    
    def _format_messages_for_analysis(self, messages: List[ChatMessage]) -> str:
        """Format messages for intent analysis"""
        
        conversation_lines = []
        for message in messages:
            if message.role == 'user':
                conversation_lines.append(f"用户: {message.content}")
            elif message.role == 'assistant':
                # Truncate long assistant responses to focus on user intent
                content = message.content[:100] + "..." if len(message.content) > 100 else message.content
                conversation_lines.append(f"AI: {content}")
        
        return "\n".join(conversation_lines)
    
    def _build_intent_detection_prompt(self, conversation: str) -> str:
        """Legacy method - now delegates to centralized prompt"""
        # This method is kept for backward compatibility
        # Actual prompt is now in prompts/sexual_stage_detection.py
        return build_stage_detection_prompt(conversation)
    
    def build_intent_guidance(self, stage: str, language: Optional[str] = None) -> str:
        """
        Build SHORT stage-specific reminder (not long prescriptive guidance)

        Args:
            stage: Detected sexual activity stage

        Returns:
            Short reminder text (empty if low-risk stage)
        """
        # Delegate to centralized reminder mapping
        reminder = get_stage_reminder(stage, language=language or "zh")

        if reminder:
            self.logger.info(f"💡 Stage reminder for '{stage}': {reminder}")

        return reminder
    
    def should_prevent_auto_completion(self, stage: str) -> bool:
        """
        Determine if this is a high-risk stage requiring reminder

        Args:
            stage: Detected sexual activity stage

        Returns:
            True if this stage requires reminder injection
        """
        # High risk stages from prompts/sexual_stage_reminders.py
        high_risk_stages = ["准备插入", "插入时", "抽插时", "角色高潮（自然发生）"]

        return stage in high_risk_stages
