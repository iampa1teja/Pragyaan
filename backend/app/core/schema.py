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


# --- Mode pages (Characters / Perspective / Divergence) ---
class Msg(BaseModel):
    role: str
    content: str


class InterviewRequest(BaseModel):
    character: str
    story_point: str = ""
    message: str
    history: list[Msg] = []


class PerspectiveRequest(BaseModel):
    character: str
    event: str = ""
    message: str
    history: list[Msg] = []


class DivergenceRequest(BaseModel):
    event: str
    change: str
    message: str = ""
    history: list[Msg] = []


# --- Data (Characters / Timeline) ---
class CharacterOut(BaseModel):
    name: str
    role: str = ""
    traits: list[str] = []
    description: str = ""


class TimelineEvent(BaseModel):
    title: str
    description: str = ""
    characters: list[str] = []
    tags: list[str] = []


# --- Generative Studio ---
class GenerateImageRequest(BaseModel):
    kind: str = "character"   # "character" or "concept"
    subject: str


# --- Save / Data ---
class SaveStoryRequest(BaseModel):
    name: str | None = None


class DataEntry(BaseModel):
    id: str
    name: str
    type: str = "Note"
    description: str = ""
    created_at: str = ""
    deletable: bool = True
    path: str | None = None


class AddEntryRequest(BaseModel):
    name: str
    type: str = "Note"
    description: str = ""


# --- Assets ---
class AssetOut(BaseModel):
    id: str
    story_id: str
    type: AssetType
    path: str
    prompt: str | None = None
    created_at: str
