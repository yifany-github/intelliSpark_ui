from __future__ import annotations
from typing import List, Dict, Any
from .models import SessionState, Scene, StoryPack


def build_multi_speaker_prompt(pack: StoryPack, state: SessionState, scene: Scene) -> Dict[str, Any]:
    """Return a model-agnostic prompt payload for multi-speaker generation.
    Later phases can adapt this to specific providers.
    """
    system = (
        "你是一个叙事引擎，用多人物对话推进剧情。保持角色人设与世界观一致，必要时简述场景。"
    )
    context = {
        "pack": {"id": pack.id, "title": pack.title},
        "player": state.player.model_dump(),
        "nsfw_mode": state.nsfw_mode,
    }
    messages: List[Dict[str, str]] = []

    # Include short history (truncated in later phase)
    for h in state.history[-8:]:
        messages.append({"role": h.get("role", "system"), "content": h.get("content", "")})

    if scene.text:
        # Treat scene text as narrator/system content
        messages.append({"role": "system", "content": scene.text})

    return {
        "system": system,
        "context": context,
        "messages": messages,
    }

