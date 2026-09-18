from pydantic import BaseModel, Field 
from ..core.utils import now_iso 
from ..core.constants import AssetType, StoryStatus
from typing import Literal

class Asset(BaseModel): 
    id: str 
    story_id: str 
    type: AssetType 
    path: str
    prompt: str | None = None
    scene_id: str | None = None
    meta: dict = Field(default_factory=dict) 
    created_at: str = Field(default_factory=now_iso)

class Character(BaseModel):
    name: str 
    description: str = "" 
    traits: list[str] = Field(default_factory=list) 
    aliases: list[str] = Field(default_factory=list)
    first_ref: str | None = None

class ChatMessage(BaseModel): 
    role: Literal["user", "assistant", "system"]
    content: str
    agent: str | None = None
    ts: str = Field(default_factory=now_iso)

class ChatSession(BaseModel): 
    id: str 
    story_id: str 
    messages: list[ChatMessage] = Field(default_factory=list) 
    created_at: str = Field(default_factory=now_iso) 

class Scene(BaseModel): 
    id: str 
    title: str = "" 
    summary: str = "" 
    chapter: str | int | None = None 
    order: int | None = None 
    characters: list[str] = Field(default_factory=list)
    refs: list[str] = Field(default_factory=list)

class Story(BaseModel): 
    id: str 
    title: str 
    status: StoryStatus = StoryStatus.INGESTING
    source_path: str | None = None 
    context_path: str | None = None 
    n_chunks: int = 0 
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso) 