from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pathlib import Path
from sqlalchemy.orm import Session
from .pack_loader import PackLoader
from .runtime import StoryRuntime
from .service import StoryService
from .models import SessionState
from payment.token_service import TokenService
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
    # resolve auto scenes
    scene = rt.resolve_auto_scenes(state)
    # NSFW filter
    restricted = False
    if scene and not is_scene_allowed(scene, state.nsfw_mode):
        restricted = True
        scene_out = {"id": scene.id, "type": scene.type, "title": scene.title, "speaker": scene.speaker, "text": "此场景包含受限内容 (NSFW 已关闭)", "choices": []}
    else:
        scene_out = scene.model_dump() if scene else None
    requires = rt.requires_generation(scene) if scene else False
    safe_next = (scene.meta.get("safeNext") if (scene and scene.meta) else None)
    return {"sessionId": sid, "scene": scene_out, "restricted": restricted, "requiresGeneration": requires, "restrictedSafeNext": safe_next}


@router.get("/sessions/{session_id}")
def get_session(session_id: int, db: Session = Depends(get_db)):
    loader = PackLoader(Path(__file__).parent.parent / "story_packs")
    svc = StoryService(db)
    st = svc.load_session(session_id)
    if not st:
        raise HTTPException(status_code=404, detail="Session not found")
    pack = loader.load_pack(st.pack_id)
    rt = StoryRuntime(pack)
    scene = rt.resolve_auto_scenes(st)
    restricted = False
    if scene and not is_scene_allowed(scene, st.nsfw_mode):
        restricted = True
        scene_out = {"id": scene.id, "type": scene.type, "title": scene.title, "speaker": scene.speaker, "text": "此场景包含受限内容 (NSFW 已关闭)", "choices": []}
    else:
        scene_out = scene.model_dump() if scene else None
    requires = rt.requires_generation(scene) if scene else False
    safe_next = (scene.meta.get("safeNext") if (scene and scene.meta) else None)
    return {"sessionId": session_id, "scene": scene_out, "restricted": restricted, "requiresGeneration": requires, "restrictedSafeNext": safe_next}


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
    # resolve auto scenes post-choice
    next_scene = rt.resolve_auto_scenes(st)
    svc.save_session(session_id, st)
    restricted = False
    if next_scene and not is_scene_allowed(next_scene, st.nsfw_mode):
        restricted = True
        scene_out = {"id": next_scene.id, "type": next_scene.type, "title": next_scene.title, "speaker": next_scene.speaker, "text": "此场景包含受限内容 (NSFW 已关闭)", "choices": []}
    else:
        scene_out = next_scene.model_dump() if next_scene else None
    requires = rt.requires_generation(next_scene) if next_scene else False
    safe_next = (next_scene.meta.get("safeNext") if (next_scene and next_scene.meta) else None)
    return {"sessionId": session_id, "scene": scene_out, "restricted": restricted, "requiresGeneration": requires, "restrictedSafeNext": safe_next}


class SkipBody(BaseModel):
    targetSceneId: str | None = None


@router.post("/sessions/{session_id}/skip")
def skip_restricted(session_id: int, body: SkipBody, db: Session = Depends(get_db)):
    loader = PackLoader(Path(__file__).parent.parent / "story_packs")
    svc = StoryService(db)
    st = svc.load_session(session_id)
    if not st:
        raise HTTPException(status_code=404, detail="Session not found")
    pack = loader.load_pack(st.pack_id)
    rt = StoryRuntime(pack)
    scene = rt.get_scene(st.current_scene_id)
    target = body.targetSceneId or (scene.meta.get("safeNext") if scene and scene.meta else None)
    if not target:
        raise HTTPException(status_code=400, detail="No safe target provided")
    st.current_scene_id = target
    scene = rt.resolve_auto_scenes(st)
    svc.save_session(session_id, st)
    restricted = False
    if scene and not is_scene_allowed(scene, st.nsfw_mode):
        restricted = True
        scene_out = {"id": scene.id, "type": scene.type, "title": scene.title, "speaker": scene.speaker, "text": "此场景包含受限内容 (NSFW 已关闭)", "choices": []}
    else:
        scene_out = scene.model_dump() if scene else None
    requires = rt.requires_generation(scene) if scene else False
    safe_next = (scene.meta.get("safeNext") if (scene and scene.meta) else None)
    return {"sessionId": session_id, "scene": scene_out, "restricted": restricted, "requiresGeneration": requires, "restrictedSafeNext": safe_next}


@router.post("/sessions/{session_id}/generate")
def generate_turn(session_id: int, db: Session = Depends(get_db)):
    loader = PackLoader(Path(__file__).parent.parent / "story_packs")
    svc = StoryService(db)
    st = svc.load_session(session_id)
    if not st:
        raise HTTPException(status_code=404, detail="Session not found")
    pack = loader.load_pack(st.pack_id)
    rt = StoryRuntime(pack)
    scene = rt.get_scene(st.current_scene_id)
    if not scene or not rt.requires_generation(scene):
        raise HTTPException(status_code=400, detail="Scene does not require generation")

    # Deduct 1 token for generation
    token_service = TokenService(db)
    if not token_service.deduct_tokens(user_id=st.user_id, amount=1, description="Story generation"):
        raise HTTPException(status_code=402, detail="INSUFFICIENT_TOKENS")

    content = rt.generate_line(st)
    svc.save_session(session_id, st)
    return {"sessionId": session_id, "content": content}


@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db), user_id: int = 1, limit: int = 10):
    rows = db.execute(
        text("SELECT id, pack_id, updated_at FROM story_sessions WHERE user_id = :uid ORDER BY updated_at DESC LIMIT :lim"),
        {"uid": user_id, "lim": limit},
    ).mappings().all()
    return {"sessions": [{"id": r["id"], "packId": r["pack_id"], "updatedAt": str(r["updated_at"]) if r["updated_at"] else None} for r in rows]}
