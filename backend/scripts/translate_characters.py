"""Script to automatically translate character data between Chinese and English.

Usage:
    python scripts/translate_characters.py --all           # Translate all characters
    python scripts/translate_characters.py --id 1          # Translate specific character
    python scripts/translate_characters.py --target en     # Translate to English only
    python scripts/translate_characters.py --target zh     # Translate to Chinese only
"""

import asyncio
import argparse
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, text
from sqlalchemy.orm import Session
from database import sync_engine
from models import Character
from services.translation_service import get_translation_service


async def translate_character(
    character: Character,
    session: Session,
    target_lang: str = "both",
    dry_run: bool = False,
    force_names: bool = False
):
    """Translate a single character.

    Args:
        character: Character model instance
        session: Database session
        target_lang: "en", "zh", or "both"
        dry_run: If True, print what would be translated without saving
        force_names: If True, overwrite name translations even if present
    """
    translation_service = get_translation_service()

    print(f"\n{'='*60}")
    print(f"Translating character: {character.name} (ID: {character.id})")
    print(f"{'='*60}")

    # Detect source language for longer fields and for name
    source_lang = translation_service.detect_language(character.backstory or character.description or "")
    name_source_lang = translation_service.detect_language(character.name or "")
    print(f"Detected source language: {source_lang}")

    needs_translation = []
    name_needs_en = target_lang in ["en", "both"] and name_source_lang == "zh"
    name_needs_zh = target_lang in ["zh", "both"] and name_source_lang == "en"

    # Check which translations are needed
    if name_needs_en and (force_names or not character.name_en):
        needs_translation.append("name → name_en")
    if name_needs_zh and (force_names or not character.name_zh):
        needs_translation.append("name → name_zh")

    if target_lang in ["en", "both"] and source_lang == "zh":
        if not character.description_en and character.description:
            needs_translation.append("description → description_en")
        if not character.backstory_en:
            needs_translation.append("backstory → backstory_en")
        if not character.opening_line_en and character.opening_line:
            needs_translation.append("opening_line → opening_line_en")
        if not character.default_state_json_en and character.default_state_json:
            needs_translation.append("default_state_json → default_state_json_en")

    if target_lang in ["zh", "both"] and source_lang == "en":
        # For English source characters, populate Chinese fields
        if not character.description_zh and character.description:
            needs_translation.append("description → description_zh")
        if not character.backstory_zh:
            needs_translation.append("backstory → backstory_zh")
        if not character.opening_line_zh and character.opening_line:
            needs_translation.append("opening_line → opening_line_zh")
        if not character.default_state_json_zh and character.default_state_json:
            needs_translation.append("default_state_json → default_state_json_zh")

    if not needs_translation:
        print("✓ No translation needed - all target fields already populated")
        return

    print(f"\nFields to translate: {', '.join(needs_translation)}")

    if dry_run:
        print("\n[DRY RUN] Would translate the following:")
        for field in needs_translation:
            print(f"  - {field}")
        return

    # Prepare character data for translation
    character_data = {
        "name": character.name,
        "description": character.description,
        "backstory": character.backstory,
        "opening_line": character.opening_line,
        "default_state_json": character.default_state_json,
    }

    # Translate to English
    if target_lang in ["en", "both"] and (source_lang == "zh" or name_needs_en):
        print("\n📝 Translating to English...")
        translated_en = await translation_service.translate_character_data(
            character_data,
            target_lang="en"
        )

        # Update English fields
        if "name" in translated_en and name_needs_en and (force_names or not character.name_en):
            character.name_en = translated_en["name"]
            print(f"  ✓ name_en: {translated_en['name'][:50]}...")

        if "description" in translated_en and not character.description_en:
            character.description_en = translated_en["description"]
            print(f"  ✓ description_en: {translated_en['description'][:50]}...")

        if "backstory" in translated_en and not character.backstory_en:
            character.backstory_en = translated_en["backstory"]
            print(f"  ✓ backstory_en: {translated_en['backstory'][:50]}...")

        if "opening_line" in translated_en and not character.opening_line_en:
            character.opening_line_en = translated_en["opening_line"]
            print(f"  ✓ opening_line_en: {translated_en['opening_line'][:50]}...")

        if "default_state_json" in translated_en and not character.default_state_json_en:
            character.default_state_json_en = translated_en["default_state_json"]
            print(f"  ✓ default_state_json_en translated")

    # Translate to Chinese
    if target_lang in ["zh", "both"] and (source_lang == "en" or name_needs_zh):
        print("\n📝 Translating to Chinese...")
        translated_zh = await translation_service.translate_character_data(
            character_data,
            target_lang="zh"
        )

        # Update Chinese fields
        if "name" in translated_zh and name_needs_zh and (force_names or not character.name_zh):
            character.name_zh = translated_zh["name"]
            print(f"  ✓ name_zh: {translated_zh['name'][:50]}...")

        if "description" in translated_zh and not character.description_zh:
            character.description_zh = translated_zh["description"]
            print(f"  ✓ description_zh: {translated_zh['description'][:50]}...")

        if "backstory" in translated_zh and not character.backstory_zh:
            character.backstory_zh = translated_zh["backstory"]
            print(f"  ✓ backstory_zh: {translated_zh['backstory'][:50]}...")

        if "opening_line" in translated_zh and not character.opening_line_zh:
            character.opening_line_zh = translated_zh["opening_line"]
            print(f"  ✓ opening_line_zh: {translated_zh['opening_line'][:50]}...")

        if "default_state_json" in translated_zh and not character.default_state_json_zh:
            character.default_state_json_zh = translated_zh["default_state_json"]
            print(f"  ✓ default_state_json_zh translated")

    # Commit changes
    try:
        session.commit()
        print(f"\n✅ Successfully translated character {character.id}")
    except Exception as e:
        session.rollback()
        print(f"\n❌ Error saving translations: {e}")
        raise


async def main():
    """Main entry point for translation script."""
    parser = argparse.ArgumentParser(description="Translate character data")
    parser.add_argument("--all", action="store_true", help="Translate all characters")
    parser.add_argument("--id", type=int, help="Translate specific character by ID")
    parser.add_argument(
        "--target",
        choices=["en", "zh", "both"],
        default="both",
        help="Target language (default: both)"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview without saving")
    parser.add_argument("--skip-existing", action="store_true", help="Skip characters that already have translations")
    parser.add_argument(
        "--force-names",
        action="store_true",
        help="Overwrite name_en/name_zh even if already set"
    )

    args = parser.parse_args()

    if not args.all and not args.id:
        parser.error("Must specify either --all or --id")

    print("🌐 Character Translation Service")
    print("="*60)

    with Session(sync_engine) as session:
        # Get characters to translate
        if args.id:
            characters = [session.get(Character, args.id)]
            if not characters[0]:
                print(f"❌ Character with ID {args.id} not found")
                return
        else:
            stmt = select(Character).where(Character.is_deleted == False)
            characters = session.execute(stmt).scalars().all()

        if not characters:
            print("No characters found to translate")
            return

        print(f"Found {len(characters)} character(s) to process\n")

        # Translate each character
        for character in characters:
            try:
                # Skip if already translated and skip_existing is set
                if args.skip_existing:
                    translation_service = get_translation_service()
                    source_lang = translation_service.detect_language(
                        character.backstory or character.description or ""
                    )
                    if source_lang == "zh" and character.backstory_en:
                        print(f"⏭️  Skipping {character.name} - already has English translation")
                        continue
                    elif source_lang == "en" and character.backstory_zh:
                        print(f"⏭️  Skipping {character.name} - already has Chinese translation")
                        continue

                await translate_character(
                    character,
                    session,
                    target_lang=args.target,
                    dry_run=args.dry_run,
                    force_names=args.force_names
                )

            except Exception as e:
                print(f"❌ Error translating character {character.id}: {e}")
                continue

    print("\n" + "="*60)
    print("✅ Translation process completed")


if __name__ == "__main__":
    asyncio.run(main())
