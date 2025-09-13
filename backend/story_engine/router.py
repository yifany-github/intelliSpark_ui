from fastapi import APIRouter
from pathlib import Path
from .pack_loader import PackLoader

router = APIRouter(prefix="/api/story", tags=["story"])


@router.get("/health")
def story_health():
    return {"status": "ok"}


@router.get("/packs")
def list_packs():
    loader = PackLoader(Path(__file__).parent.parent / "story_packs")
    return {"packs": list(loader.list_packs().keys())}

