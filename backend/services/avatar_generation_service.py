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

            # Build optimized prompt
            full_prompt = self._build_prompt(prompt, gender, style)
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

    async def _generate_via_pollinations(self, prompt: str) -> Optional[bytes]:
        """
        Generate image using Pollinations.AI API

        Pollinations.AI is a free, open-source text-to-image service
        that doesn't require API keys or authentication.
        """
        try:
            # URL encode the prompt
            import urllib.parse
            encoded_prompt = urllib.parse.quote(prompt)
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=512&height=512&nologo=true"

            self.logger.info(f"Requesting image from Pollinations.AI...")

            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=60)) as response:
                    if response.status == 200:
                        image_data = await response.read()
                        self.logger.info(f"Image generated successfully, size: {len(image_data)} bytes")
                        return image_data
                    else:
                        self.logger.error(f"Pollinations.AI returned status {response.status}")
                        return None
        except asyncio.TimeoutError:
            self.logger.error("Timeout while generating image")
            return None
        except Exception as e:
            self.logger.error(f"Error generating image via Pollinations.AI: {str(e)}")
            return None

    def _build_prompt(self, base_prompt: str, gender: str, style: str) -> str:
        """
        Build optimized prompt for avatar generation

        Combines user input with style-specific modifiers and quality tags
        """
        # Style-specific modifiers
        style_modifiers = {
            "fantasy": "fantasy art style, detailed, high quality, beautiful lighting",
            "realistic": "photorealistic portrait, detailed, professional photography, studio lighting",
            "anime": "anime style, manga art, detailed, vibrant colors, clean lines",
            "chinese": "traditional chinese art style, elegant, ink painting style, artistic",
            "scifi": "sci-fi character, futuristic, detailed, high tech aesthetic",
            "medieval": "medieval fantasy, detailed armor or clothing, historical accuracy"
        }

        # Gender-specific terms
        gender_terms = {
            "female": "beautiful woman",
            "male": "handsome man",
            "non-binary": "person",
            "neutral": "person",
            "other": "person",
            "not-specified": "person"
        }

        # Get modifiers
        style_mod = style_modifiers.get(style.lower(), style_modifiers["fantasy"])
        gender_term = gender_terms.get(gender.lower(), gender_terms["neutral"])

        # Quality tags
        quality_tags = "masterpiece, best quality, highly detailed, sharp focus"

        # Portrait framing
        framing = "portrait, head and shoulders, centered, professional composition"

        # Construct final prompt
        if base_prompt and base_prompt.strip():
            # User provided custom prompt
            full_prompt = f"{gender_term}, {base_prompt}, {style_mod}, {framing}, {quality_tags}"
        else:
            # Generate generic prompt based on style
            full_prompt = f"{gender_term}, {style_mod}, {framing}, {quality_tags}"

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
