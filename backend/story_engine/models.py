from __future__ import annotations
from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field


SceneType = Literal["text", "choice", "event"]


class Choice(BaseModel):
    id: str
    text: str
    next_scene_id: Optional[str] = None
    conditions: Optional[List[Dict[str, Any]]] = None  # e.g., [{"flag": "met_huangrong", "eq": True}]
    effects: Optional[List[Dict[str, Any]]] = None     # e.g., [{"relation": {"npc": "huangrong", "delta": +5}}]


class Scene(BaseModel):
    id: str
    type: SceneType = "text"
    title: Optional[str] = None
    speaker: Optional[str] = None          # for text scene
    text: Optional[str] = None             # narrative or dialogue
    choices: Optional[List[Choice]] = None # for choice scene
    meta: Dict[str, Any] = Field(default_factory=dict) # {nsfwLevel: 0-3, location: str, ...}


class NPC(BaseModel):
    id: str
    name: str
    traits: List[str] = Field(default_factory=list)
    backstory: Optional[str] = None
    avatar_url: Optional[str] = None


class StoryPack(BaseModel):
    id: str
    title: str
    language: str = "zh"
    nsfw_allowed: bool = False
    npcs: List[NPC]
    scenes: List[Scene]
    start_scene_id: str


class Relationship(BaseModel):
    npc_id: str
    value: int = 0  # -100..+100


class PlayerState(BaseModel):
    role_name: str = ""
    flags: Dict[str, Any] = Field(default_factory=dict)
    relationships: Dict[str, Relationship] = Field(default_factory=dict)


class SessionState(BaseModel):
    session_id: str
    user_id: int
    pack_id: str
    current_scene_id: str
    nsfw_mode: bool = False
    player: PlayerState = Field(default_factory=PlayerState)
    history: List[Dict[str, Any]] = Field(default_factory=list)  # simple message log for now

