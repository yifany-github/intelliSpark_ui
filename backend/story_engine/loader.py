"""Load story packs from YAML files with validation."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Iterable, Optional

import yaml
from pydantic import ValidationError

from .models import RoleSpec, Scene, StoryPack


class StoryPackLoaderError(RuntimeError):
    """Raised when a story pack cannot be loaded or validated."""


class StoryPackLoader:
    """Discover and parse story packs stored on disk."""

    def __init__(self, base_path: Path | str) -> None:
        self.base_path = Path(base_path)
        self._cache: Dict[str, StoryPack] = {}
        if not self.base_path.exists():
            raise StoryPackLoaderError(f"Story pack path does not exist: {self.base_path}")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def available_story_ids(self) -> Iterable[str]:
        for entry in self.base_path.iterdir():
            if entry.is_dir() and not entry.name.startswith("."):
                story_path = entry / "story.yaml"
                if story_path.exists():
                    yield entry.name

    def load(self, story_id: str, *, use_cache: bool = True) -> StoryPack:
        if use_cache and story_id in self._cache:
            return self._cache[story_id]

        story_dir = self.base_path / story_id
        if not story_dir.exists():
            raise StoryPackLoaderError(f"Story pack not found: {story_id}")

        story_data = self._read_yaml(story_dir / "story.yaml", required=True)
        roles_data = self._read_yaml(story_dir / "roles.yaml", required=True)
        rules_data = self._read_yaml(story_dir / "rules.yaml", required=False) or {}

        try:
            pack = self._build_pack(story_id, story_data, roles_data, rules_data)
        except ValidationError as exc:  # pragma: no cover - surfaced as loader error
            raise StoryPackLoaderError(str(exc)) from exc

        self._cache[story_id] = pack
        return pack

    def load_all(self, *, use_cache: bool = True) -> Dict[str, StoryPack]:
        return {story_id: self.load(story_id, use_cache=use_cache) for story_id in self.available_story_ids()}

    def clear_cache(self) -> None:
        self._cache.clear()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _build_pack(
        self,
        default_story_id: str,
        story_data: Dict,
        roles_data: Dict,
        rules_data: Dict,
    ) -> StoryPack:
        story_data = dict(story_data or {})
        roles_data = dict(roles_data or {})

        self._rename(story_data, {"startScene": "start_scene", "coverImage": "cover_image"})
        for scene in story_data.get("scenes", []) or []:
            if isinstance(scene, dict):
                self._rename(scene, {"onEnter": "on_enter"})
                self._normalize_effects(scene.get("on_enter", []))
                for choice in scene.get("choices", []) or []:
                    if isinstance(choice, dict):
                        self._rename(choice, {"gotoScene": "goto"})
                        self._normalize_effects(choice.get("effects", []))
        for role in roles_data.get("roles", []) or []:
            if isinstance(role, dict):
                self._rename(role, {"promptTags": "prompt_tags"})

        story_id = story_data.get("id") or default_story_id
        start_scene = story_data.get("start_scene")
        if not start_scene:
            raise StoryPackLoaderError(f"Story pack '{story_id}' missing 'start_scene'")

        scenes = [Scene(**scene_dict) for scene_dict in story_data.get("scenes", [])]
        roles = [RoleSpec(**role_dict) for role_dict in roles_data.get("roles", [])]
        if not roles:
            raise StoryPackLoaderError(f"Story pack '{story_id}' defines no roles")
        scene_ids = {scene.id for scene in scenes}
        if start_scene not in scene_ids:
            raise StoryPackLoaderError(
                f"Story pack '{story_id}' start_scene '{start_scene}' not found in scenes"
            )

        return StoryPack(
            id=story_id,
            title=story_data.get("title", story_id),
            start_scene=start_scene,
            roles=roles,
            scenes=scenes,
            variables=story_data.get("variables", {}),
            flags=story_data.get("flags", {}),
            locale=story_data.get("locale"),
            rules=rules_data,
            cover_image=story_data.get("cover_image"),
        )

    def _read_yaml(self, path: Path, *, required: bool) -> Optional[Dict]:
        if not path.exists():
            if required:
                raise StoryPackLoaderError(f"Missing required file: {path}")
            return None
        try:
            with path.open("r", encoding="utf-8") as handle:
                data = yaml.safe_load(handle) or {}
        except yaml.YAMLError as exc:  # pragma: no cover - library error
            raise StoryPackLoaderError(f"Failed to parse YAML: {path}\n{exc}") from exc
        if not isinstance(data, dict):
            raise StoryPackLoaderError(f"Expected mapping at root of {path}, got {type(data).__name__}")
        return data

    @staticmethod
    def _rename(container: Dict, mapping: Dict[str, str]) -> None:
        for old_key, new_key in mapping.items():
            if old_key in container and new_key not in container:
                container[new_key] = container.pop(old_key)

    @staticmethod
    def _normalize_effects(effects: Iterable[Dict]) -> None:
        for effect in effects or []:
            if isinstance(effect, dict):
                for old_key, new_key in (
                    ("setFlag", "set_flag"),
                    ("setVar", "set_var"),
                    ("giveItem", "give_item"),
                    ("removeItem", "remove_item"),
                    ("setLocation", "set_location"),
                    ("timeAdvance", "time_advance"),
                ):
                    if old_key in effect and new_key not in effect:
                        effect[new_key] = effect.pop(old_key)
