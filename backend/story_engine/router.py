from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pathlib import Path
from sqlalchemy.orm import Session
from .pack_loader import PackLoader
from .runtime import StoryRuntime
from .service import StoryService
from .models import SessionState
from .content_filter import is_scene_allowed
from database import get_db

router = APIRouter(prefix="/api/story", tags=["story"])


@router.get("/health")
def story_health():
    return {"status": "ok"}


@router.get("/packs")
def list_packs():
    loader = PackLoader(Path(__file__).parent.parent / "story_packs")
    return {"packs": list(loader.list_packs().keys())}


class CreateSessionBody(BaseModel):
    packId: str
    roleName: str | None = ""
    nsfwMode: bool | None = False
    userId: int | None = 1  # TODO: use auth later


@router.post("/sessions")
def create_session(body: CreateSessionBody, db: Session = Depends(get_db)):
    loader = PackLoader(Path(__file__).parent.parent / "story_packs")
    packs = loader.list_packs()
    if body.packId not in packs:
        raise HTTPException(status_code=404, detail="Pack not found")
    pack = loader.load_pack(body.packId)

    rt = StoryRuntime(pack)
    state = rt.start_session(user_id=body.userId or 1, role_name=body.roleName or "")
    state.nsfw_mode = bool(body.nsfwMode)

    svc = StoryService(db)
    sid = svc.create_session(user_id=state.user_id, pack=pack, state=state)
    state.session_id = str(sid)
    scene = rt.get_scene(state.current_scene_id)
    # NSFW filter
    restricted = False
    if scene and not is_scene_allowed(scene, state.nsfw_mode):
        restricted = True
        scene_out = {"id": scene.id, "type": scene.type, "title": scene.title, "speaker": scene.speaker, "text": "此场景包含受限内容 (NSFW 已关闭)", "choices": []}
    else:
        scene_out = scene.model_dump() if scene else None
    return {"sessionId": sid, "scene": scene_out, "restricted": restricted}


@router.get("/sessions/{session_id}")
def get_session(session_id: int, db: Session = Depends(get_db)):
    loader = PackLoader(Path(__file__).parent.parent / "story_packs")
    svc = StoryService(db)
    st = svc.load_session(session_id)
    if not st:
        raise HTTPException(status_code=404, detail="Session not found")
    pack = loader.load_pack(st.pack_id)
    rt = StoryRuntime(pack)
    scene = rt.get_scene(st.current_scene_id)
    restricted = False
    if scene and not is_scene_allowed(scene, st.nsfw_mode):
        restricted = True
        scene_out = {"id": scene.id, "type": scene.type, "title": scene.title, "speaker": scene.speaker, "text": "此场景包含受限内容 (NSFW 已关闭)", "choices": []}
    else:
        scene_out = scene.model_dump() if scene else None
    return {"sessionId": session_id, "scene": scene_out, "restricted": restricted}


class ChoiceBody(BaseModel):
    choiceId: str


@router.post("/sessions/{session_id}/choice")
def apply_choice(session_id: int, body: ChoiceBody, db: Session = Depends(get_db)):
    loader = PackLoader(Path(__file__).parent.parent / "story_packs")
    svc = StoryService(db)
    st = svc.load_session(session_id)
    if not st:
        raise HTTPException(status_code=404, detail="Session not found")
    pack = loader.load_pack(st.pack_id)
    rt = StoryRuntime(pack)
    next_scene = rt.choose(st, body.choiceId)
    if not next_scene:
        raise HTTPException(status_code=400, detail="Invalid choice or conditions not met")
    svc.save_session(session_id, st)
    restricted = False
    if next_scene and not is_scene_allowed(next_scene, st.nsfw_mode):
        restricted = True
        scene_out = {"id": next_scene.id, "type": next_scene.type, "title": next_scene.title, "speaker": next_scene.speaker, "text": "此场景包含受限内容 (NSFW 已关闭)", "choices": []}
    else:
        scene_out = next_scene.model_dump() if next_scene else None
    return {"sessionId": session_id, "scene": scene_out, "restricted": restricted}


@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db), user_id: int = 1, limit: int = 10):
    rows = db.execute(
        text("SELECT id, pack_id, updated_at FROM story_sessions WHERE user_id = :uid ORDER BY updated_at DESC LIMIT :lim"),
        {"uid": user_id, "lim": limit},
    ).mappings().all()
    return {"sessions": [{"id": r["id"], "packId": r["pack_id"], "updatedAt": str(r["updated_at"]) if r["updated_at"] else None} for r in rows]}
