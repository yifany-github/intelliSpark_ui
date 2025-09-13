from __future__ import annotations
from .models import Scene


def is_scene_allowed(scene: Scene, nsfw_mode: bool) -> bool:
    level = int(scene.meta.get("nsfwLevel", 0)) if scene.meta else 0
    if level > 0 and not nsfw_mode:
        return False
    return True

