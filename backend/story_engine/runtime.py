from __future__ import annotations
from typing import Optional
from .models import StoryPack, SessionState, PlayerState


class StoryRuntime:
    """Minimal runtime skeleton: start session and basic getters.
    Full apply_choice/event logic will be implemented in later phases.
    """

    def __init__(self, pack: StoryPack):
        self.pack = pack

    def start_session(self, user_id: int, role_name: str = "") -> SessionState:
        state = SessionState(
            session_id="temp-local",  # persisted ID to be assigned later
            user_id=user_id,
            pack_id=self.pack.id,
            current_scene_id=self.pack.start_scene_id,
            nsfw_mode=False,
            player=PlayerState(role_name=role_name),
            history=[],
        )
        return state

    def get_scene(self, scene_id: str):
        for s in self.pack.scenes:
            if s.id == scene_id:
                return s
        return None

