"""Core data models for the multi-role story engine."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

RoleId = str
SceneId = str


class InventoryTransfer(BaseModel):
    """Represents an inventory move between world entities."""

    to: Optional[RoleId] = None
    from_: Optional[RoleId] = Field(default=None, alias="from")
    item: str

    class Config:
        allow_population_by_field_name = True


class Effect(BaseModel):
    """State mutation applied when advancing the story."""

    set_flag: Optional[Dict[str, bool]] = None
    set_var: Optional[Dict[str, Any]] = None
    give_item: Optional[InventoryTransfer] = None
    remove_item: Optional[InventoryTransfer] = None
    set_location: Optional[str] = None
    time_advance: Optional[str] = None

    class Config:
        extra = "forbid"


class Choice(BaseModel):
    """An available action for the user or AI within a scene."""

    id: str
    prompt: str
    when: Optional[str] = None
    effects: List[Effect] = Field(default_factory=list)
    goto: Optional[SceneId] = None

    class Config:
        extra = "forbid"


class Scene(BaseModel):
    """Story scene comprised of narrative description and choices."""

    id: SceneId
    title: str
    desc: str
    on_enter: List[Effect] = Field(default_factory=list)
    choices: List[Choice]

    class Config:
        extra = "forbid"


class RoleSpec(BaseModel):
    """Playable or AI-controlled role definition."""

    id: RoleId
    name: str
    traits: List[str] = Field(default_factory=list)
    inventory: List[str] = Field(default_factory=list)
    prompt_tags: List[str] = Field(default_factory=list)

    class Config:
        extra = "forbid"


class StoryPack(BaseModel):
    """Story blueprint consumed by the engine."""

    id: str
    title: str
    start_scene: SceneId
    roles: List[RoleSpec]
    scenes: List[Scene]
    variables: Dict[str, Any] = Field(default_factory=dict)
    flags: Dict[str, bool] = Field(default_factory=dict)
    rules: Dict[str, Any] = Field(default_factory=dict)
    locale: Optional[str] = None
    cover_image: Optional[str] = None

    class Config:
        extra = "forbid"


class MemoryEntry(BaseModel):
    """Narrative memory element accessible to narrators or characters."""

    timestamp: int
    text: str
    tags: List[str] = Field(default_factory=list)

    class Config:
        extra = "forbid"


class Memories(BaseModel):
    """Collection of memory streams tracked during a story session."""

    global_: List[MemoryEntry] = Field(default_factory=list, alias="global")
    per_role: Dict[RoleId, List[MemoryEntry]] = Field(default_factory=dict)
    user: List[MemoryEntry] = Field(default_factory=list)

    class Config:
        allow_population_by_field_name = True
        extra = "forbid"


class WorldState(BaseModel):
    """Persisted story session state shared by all actors."""

    session_id: str
    story_id: str
    scene_id: SceneId
    time: Optional[str] = None
    location: Optional[str] = None
    flags: Dict[str, bool] = Field(default_factory=dict)
    variables: Dict[str, Any] = Field(default_factory=dict)
    inventories: Dict[RoleId, List[str]] = Field(default_factory=dict)
    stats: Dict[RoleId, Dict[str, Any]] = Field(default_factory=dict)
    memories: Memories = Field(default_factory=Memories)

    class Config:
        extra = "forbid"
