"""
Avatar Generation Service using Perchance AI

This service provides AI-powered avatar generation for character creation
using the Perchance text-to-image API.

Features:
- Generate avatars from text prompts
- Support for multiple styles (fantasy, realistic, anime, chinese)
- Gender-specific prompt optimization
- Automatic image resizing and optimization
- Secure file handling and storage
"""

import asyncio
import aiohttp
from PIL import Image
from pathlib import Path
import aiofiles
import logging
import io
from typing import Tuple, Optional
from datetime import datetime
import json
import re

class AvatarGenerationError(Exception):
    """Avatar generation specific errors"""
    pass


class AvatarGenerationService:
    """Service for AI-powered avatar generation using Perchance"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        # Use Pollinations.AI as a free, reliable alternative to Perchance
        self.api_url = "https://image.pollinations.ai/prompt/{prompt}"

        # Path resolution: prioritize Fly.io volume, fallback to local development
        fly_volume_path = Path("/app/attached_assets")
        local_dev_path = Path(__file__).parent.parent.parent / "attached_assets"

        # Check for deployment environment
        import os
        is_deployed = (
            os.getenv('FLY_APP_NAME') is not None or
            Path('/.dockerenv').exists() or
            fly_volume_path.exists()
        )

        if is_deployed and fly_volume_path.exists():
            base_dir = fly_volume_path
        elif local_dev_path.exists():
            base_dir = local_dev_path
        else:
            local_dev_path.mkdir(parents=True, exist_ok=True)
            base_dir = local_dev_path

        self.output_dir = base_dir / "generated_avatars"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def generate_avatar(
        self,
        prompt: str,
        character_name: str,
        gender: str = "female",
        style: str = "fantasy"
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Generate character avatar using AI

        Args:
            prompt: Custom prompt or character description
            character_name: Character name for filename
            gender: Character gender (female/male/neutral)
            style: Art style (fantasy/realistic/anime/chinese)

        Returns:
            (success, avatar_url, error_message)
        """
        try:
            self.logger.info(f"Generating avatar for {character_name} with style {style}")

            # Translate Chinese to English if needed
            translated_prompt = await self._translate_if_chinese(prompt)

            # Build optimized prompt
            full_prompt = self._build_prompt(translated_prompt, gender, style)
            self.logger.debug(f"Full prompt: {full_prompt}")

            # Generate image using Pollinations.AI
            image_data = await self._generate_via_pollinations(full_prompt)

            if not image_data:
                return False, None, "Failed to generate image from AI service"

            # Open image from bytes
            image = Image.open(io.BytesIO(image_data))

            # Process and optimize image
            processed_image = self._process_image(image)

            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = character_name.replace(' ', '_').replace('/', '_')[:50]
            filename = f"{safe_name}_{timestamp}_avatar.png"
            file_path = self.output_dir / filename

            # Save processed image
            processed_image.save(file_path, format='PNG', optimize=True, quality=85)

            self.logger.info(f"Avatar generated successfully: {filename}")

            # Return URL path for asset serving
            avatar_url = f"/assets/generated_avatars/{filename}"
            return True, avatar_url, None

        except Exception as e:
            error_msg = f"Failed to generate avatar: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            return False, None, error_msg

    async def _translate_if_chinese(self, text: str) -> str:
        """
        Detect and translate Chinese text to English for better AI image generation

        Uses a simple translation approach via Google Translate (free, no API key)
        """
        if not text or not text.strip():
            return text

        # Check if text contains Chinese characters
        chinese_char_pattern = re.compile(r'[\u4e00-\u9fff]+')
        if not chinese_char_pattern.search(text):
            # No Chinese characters, return as-is
            self.logger.debug("No Chinese characters detected, using original prompt")
            return text

        try:
            self.logger.info(f"Translating Chinese prompt to English: {text[:50]}...")

            # Use Google Translate via requests (free, no API key needed)
            import urllib.parse
            encoded_text = urllib.parse.quote(text)
            translate_url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q={encoded_text}"

            async with aiohttp.ClientSession() as session:
                async with session.get(translate_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        result = await response.json()
                        # Parse the response format: [[[translated_text, original_text, null, null, ...], ...], ...]
                        if result and len(result) > 0 and len(result[0]) > 0:
                            translated = result[0][0][0]
                            self.logger.info(f"Translated to: {translated}")
                            return translated
                        else:
                            self.logger.warning("Translation response format unexpected, using original")
                            return text
                    else:
                        self.logger.warning(f"Translation failed with status {response.status}, using original")
                        return text

        except Exception as e:
            self.logger.warning(f"Translation error: {str(e)}, using original prompt")
            return text

    async def _generate_via_pollinations(self, prompt: str) -> Optional[bytes]:
        """
        Generate image using Pollinations.AI API

        Pollinations.AI is a free, open-source text-to-image service
        that doesn't require API keys or authentication.

        Uses Flux model for better quality and prompt adherence.
        """
        try:
            # URL encode the prompt
            import urllib.parse
            encoded_prompt = urllib.parse.quote(prompt)

            # Use Flux model with specific parameters for better quality
            # model: flux for best quality and prompt following
            # width/height: 512x512 for avatar size
            # nologo: remove watermark
            # seed: random for variety
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=512&height=512&nologo=true&model=flux&enhance=true"

            self.logger.info(f"Requesting image from Pollinations.AI with Flux model...")
            self.logger.debug(f"URL: {url[:200]}...")  # Log first 200 chars of URL

            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=90)) as response:
                    if response.status == 200:
                        image_data = await response.read()
                        self.logger.info(f"Image generated successfully, size: {len(image_data)} bytes")
                        return image_data
                    else:
                        self.logger.error(f"Pollinations.AI returned status {response.status}")
                        # Try to get error message
                        try:
                            error_text = await response.text()
                            self.logger.error(f"Error response: {error_text[:200]}")
                        except:
                            pass
                        return None
        except asyncio.TimeoutError:
            self.logger.error("Timeout while generating image (90s limit exceeded)")
            return None
        except Exception as e:
            self.logger.error(f"Error generating image via Pollinations.AI: {str(e)}", exc_info=True)
            return None

    def _build_prompt(self, base_prompt: str, gender: str, style: str) -> str:
        """
        Build optimized prompt for avatar generation

        Combines user input with style-specific modifiers and quality tags
        """
        # Style-specific modifiers with detailed descriptions
        style_modifiers = {
            "fantasy": "fantasy art, magical atmosphere, ethereal lighting, epic, digital painting, artstation quality",
            "realistic": "photorealistic, professional portrait photography, studio lighting, 8k, dslr, bokeh background",
            "anime": "anime style, manga illustration, cel shaded, vibrant colors, detailed eyes, studio trigger style",
            "chinese": "traditional chinese ink painting, elegant watercolor, artistic, cultural attire, ming dynasty style",
            "scifi": "cyberpunk, futuristic, neon lights, high tech, sci-fi character design, concept art",
            "medieval": "medieval fantasy, rpg character, detailed armor, castle background, dramatic lighting"
        }

        # Gender-specific terms with more detail
        gender_terms = {
            "female": "beautiful young woman",
            "male": "handsome young man",
            "non-binary": "attractive person",
            "neutral": "person",
            "other": "person",
            "not-specified": "person"
        }

        # Get modifiers
        style_mod = style_modifiers.get(style.lower(), style_modifiers["fantasy"])
        gender_term = gender_terms.get(gender.lower(), gender_terms["neutral"])

        # Quality and technical tags for better results
        quality_tags = "highly detailed face, expressive eyes, masterpiece, best quality, 4k, sharp focus"

        # Portrait framing
        framing = "portrait, upper body, centered composition, facing camera"

        # Construct final prompt with proper structure
        if base_prompt and base_prompt.strip():
            # User provided custom prompt - give it priority
            full_prompt = f"{gender_term} {base_prompt}, {style_mod}, {framing}, {quality_tags}"
        else:
            # Generate generic prompt based on style and gender
            full_prompt = f"{gender_term} character portrait, {style_mod}, {framing}, {quality_tags}"

        # Log the prompt for debugging
        self.logger.info(f"Generated prompt: {full_prompt}")

        return full_prompt

    def _process_image(self, image: Image.Image) -> Image.Image:
        """
        Process and optimize generated image

        - Convert to RGB if needed
        - Resize to standard avatar dimensions
        - Apply optimization
        """
        # Convert RGBA to RGB if needed
        if image.mode == 'RGBA':
            # Create white background
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])  # Use alpha channel as mask
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')

        # Resize to standard avatar size (512x512)
        target_size = (512, 512)

        # Calculate aspect ratio
        aspect_ratio = image.width / image.height

        if aspect_ratio > 1:
            # Width > Height, crop width
            new_width = int(image.height * 1.0)
            left = (image.width - new_width) // 2
            image = image.crop((left, 0, left + new_width, image.height))
        elif aspect_ratio < 1:
            # Height > Width, crop height
            new_height = int(image.width * 1.0)
            top = (image.height - new_height) // 2
            image = image.crop((0, top, image.width, top + new_height))

        # Resize to target size with high-quality resampling
        image = image.resize(target_size, Image.Resampling.LANCZOS)

        return image

    async def generate_batch_avatars(
        self,
        prompts: list[dict],
        max_concurrent: int = 3
    ) -> list[dict]:
        """
        Generate multiple avatars concurrently

        Args:
            prompts: List of dicts with keys: prompt, character_name, gender, style
            max_concurrent: Maximum concurrent generations

        Returns:
            List of results with success/url/error for each
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def generate_with_semaphore(prompt_data):
            async with semaphore:
                success, url, error = await self.generate_avatar(
                    prompt=prompt_data.get('prompt', ''),
                    character_name=prompt_data.get('character_name', 'avatar'),
                    gender=prompt_data.get('gender', 'female'),
                    style=prompt_data.get('style', 'fantasy')
                )
                return {
                    'character_name': prompt_data.get('character_name'),
                    'success': success,
                    'url': url,
                    'error': error
                }

        tasks = [generate_with_semaphore(p) for p in prompts]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        return results
