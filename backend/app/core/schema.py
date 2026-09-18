from pydantic import BaseModel

from .constants import StoryStatus, AssetType


# --- Stories ---
class StoryUploadResponse(BaseModel):
    id: str
    status: StoryStatus


class StoryOut(BaseModel):
    id: str
    title: str
    status: StoryStatus
    n_chunks: int = 0
    created_at: str


# --- Chat ---
class ChatRequest(BaseModel):
    story_id: str
    message: str


class ChatResponse(BaseModel):
    reply: str


# --- Assets ---
class AssetOut(BaseModel):
    id: str
    story_id: str
    type: AssetType
    path: str
    prompt: str | None = None
    created_at: str
