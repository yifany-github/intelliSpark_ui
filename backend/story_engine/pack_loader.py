from __future__ import annotations
import json
from pathlib import Path
from typing import Dict, Any
import logging

from .models import StoryPack, NPC, Scene

logger = logging.getLogger(__name__)

try:
    import jsonschema
except Exception:  # pragma: no cover
    jsonschema = None


class PackLoader:
    def __init__(self, packs_root: Path):
        self.packs_root = packs_root

    def list_packs(self) -> Dict[str, Path]:
        packs = {}
        if not self.packs_root.exists():
            return packs
        for p in self.packs_root.iterdir():
            if p.is_dir() and (p / "pack.json").exists() and (p / "scenes.json").exists():
                packs[p.name] = p
        return packs

    def load_pack(self, pack_id: str) -> StoryPack:
        pack_dir = self.packs_root / pack_id
        if not pack_dir.exists():
            raise FileNotFoundError(f"Story pack not found: {pack_id}")

        pack_meta = _read_json(pack_dir / "pack.json")
        npcs = _read_json(pack_dir / "npcs.json") if (pack_dir / "npcs.json").exists() else []
        scenes = _read_json(pack_dir / "scenes.json")

        document = {
            **pack_meta,
            "npcs": npcs,
            "scenes": scenes,
        }

        # Optional JSON schema validation
        schema_path = Path(__file__).parent / "schema" / "story_v1.json"
        if jsonschema and schema_path.exists():
            try:
                with open(schema_path, "r", encoding="utf-8") as f:
                    schema = json.load(f)
                jsonschema.validate(instance=document, schema=schema)
            except Exception as e:
                logger.warning(f"Pack schema validation warning for {pack_id}: {e}")
        else:
            logger.debug("jsonschema not available; skipping strict validation")

        # Pydantic validation
        story_pack = StoryPack(
            id=document["id"],
            title=document["title"],
            language=document.get("language", "zh"),
            nsfw_allowed=document.get("nsfw_allowed", False),
            npcs=[NPC(**n) for n in document.get("npcs", [])],
            scenes=[Scene(**s) for s in document.get("scenes", [])],
            start_scene_id=document["start_scene_id"],
        )
        return story_pack


def _read_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

