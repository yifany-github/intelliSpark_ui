from __future__ import annotations
import json
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text

from .models import SessionState, PlayerState, StoryPack


class StoryService:
    """Persistence for story sessions using existing DB connection."""

    def __init__(self, db: Session):
        self.db = db

    def create_session(self, user_id: int, pack: StoryPack, state: SessionState) -> int:
        vars_json = json.dumps({
            "flags": state.player.flags,
            "history": state.history,
        }, ensure_ascii=False)
        relationships_json = json.dumps({k: v.model_dump() for k, v in state.player.relationships.items()}, ensure_ascii=False)

        res = self.db.execute(
            text(
                """
                INSERT INTO story_sessions (user_id, pack_id, chapter_id, scene_id, vars_json, relationships_json, nsfw_mode)
                VALUES (:user_id, :pack_id, :chapter_id, :scene_id, :vars_json, :relationships_json, :nsfw_mode)
                """
            ),
            {
                "user_id": user_id,
                "pack_id": pack.id,
                "chapter_id": None,
                "scene_id": state.current_scene_id,
                "vars_json": vars_json,
                "relationships_json": relationships_json,
                "nsfw_mode": 1 if state.nsfw_mode else 0,
            },
        )
        session_id = res.lastrowid if hasattr(res, "lastrowid") else self.db.execute(text("SELECT last_insert_rowid()")).scalar()
        self.db.commit()
        return int(session_id)

    def load_session(self, session_id: int) -> Optional[SessionState]:
        row = self.db.execute(
            text(
                "SELECT id, user_id, pack_id, scene_id, vars_json, relationships_json, nsfw_mode FROM story_sessions WHERE id = :sid"
            ),
            {"sid": session_id},
        ).mappings().first()
        if not row:
            return None
        vars_obj: Dict[str, Any] = json.loads(row["vars_json"]) if row["vars_json"] else {}
        rels_obj: Dict[str, Any] = json.loads(row["relationships_json"]) if row["relationships_json"] else {}
        player = PlayerState(
            role_name="",
            flags=vars_obj.get("flags", {}),
            relationships={},
        )
        state = SessionState(
            session_id=str(row["id"]),
            user_id=row["user_id"],
            pack_id=row["pack_id"],
            current_scene_id=row["scene_id"],
            nsfw_mode=bool(row["nsfw_mode"]),
            player=player,
            history=vars_obj.get("history", []),
        )
        return state

    def save_session(self, session_id: int, state: SessionState) -> None:
        vars_json = json.dumps({
            "flags": state.player.flags,
            "history": state.history,
        }, ensure_ascii=False)
        relationships_json = json.dumps({k: v.model_dump() for k, v in state.player.relationships.items()}, ensure_ascii=False)
        self.db.execute(
            text(
                """
                UPDATE story_sessions
                SET scene_id = :scene_id,
                    vars_json = :vars_json,
                    relationships_json = :relationships_json,
                    nsfw_mode = :nsfw
                WHERE id = :sid
                """
            ),
            {
                "scene_id": state.current_scene_id,
                "vars_json": vars_json,
                "relationships_json": relationships_json,
                "nsfw": 1 if state.nsfw_mode else 0,
                "sid": int(session_id),
            },
        )
        self.db.commit()

