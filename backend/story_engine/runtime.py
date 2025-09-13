from __future__ import annotations
from typing import Optional, Dict, Any, List
from .models import StoryPack, SessionState, PlayerState, Scene, Choice


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

    # --- Basic branching mechanics ---
    def evaluate_conditions(self, conditions: Optional[List[Dict[str, Any]]], state: SessionState) -> bool:
        if not conditions:
            return True
        flags = state.player.flags or {}
        for cond in conditions:
            if "flag" in cond:
                key = cond["flag"]
                val = flags.get(key)
                if "eq" in cond and val != cond["eq"]:
                    return False
                if "neq" in cond and val == cond["neq"]:
                    return False
                if isinstance(val, (int, float)):
                    if "gte" in cond and not (val >= cond["gte"]):
                        return False
                    if "lte" in cond and not (val <= cond["lte"]):
                        return False
        return True

    def apply_effects(self, effects: Optional[List[Dict[str, Any]]], state: SessionState):
        if not effects:
            return
        flags = state.player.flags
        for eff in effects:
            if "set_flag" in eff:
                data = eff["set_flag"]
                for k, v in data.items():
                    flags[k] = v
            if "relation" in eff:
                rel = eff["relation"]
                # Minimal relation store as numeric value inside flags
                npc = rel.get("npc")
                delta = int(rel.get("delta", 0))
                key = f"rel_{npc}"
                flags[key] = int(flags.get(key, 0)) + delta
            if "jump" in eff:
                target = eff["jump"]
                if isinstance(target, str):
                    state.current_scene_id = target

    def choose(self, state: SessionState, choice_id: str) -> Optional[Scene]:
        scene = self.get_scene(state.current_scene_id)
        if not scene or not scene.choices:
            return None
        # find choice
        sel: Optional[Choice] = None
        for c in scene.choices:
            if c.id == choice_id:
                sel = c
                break
        if not sel:
            return None
        # check conditions
        if not self.evaluate_conditions(sel.conditions, state):
            return None
        # apply effects
        self.apply_effects(sel.effects, state)
        # jump to next scene
        if sel.next_scene_id:
            state.current_scene_id = sel.next_scene_id
        return self.get_scene(state.current_scene_id)
