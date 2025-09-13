from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pathlib import Path
from sqlalchemy.orm import Session
from .pack_loader import PackLoader
from .runtime import StoryRuntime
from .service import StoryService
from .models import SessionState
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
    return {"sessionId": sid, "scene": scene.model_dump() if scene else None}


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
    return {"sessionId": session_id, "scene": scene.model_dump() if scene else None}


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
    return {"sessionId": session_id, "scene": next_scene.model_dump()}
