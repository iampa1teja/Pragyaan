from uuid import uuid4
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException

from .schema import (
    StoryUploadResponse, StoryOut, ChatRequest, ChatResponse, AssetOut,
    InterviewRequest, PerspectiveRequest, DivergenceRequest,
    CharacterOut, TimelineEvent, GenerateImageRequest,
    SaveStoryRequest, DataEntry, AddEntryRequest,
)
from .utils import story_dir, ensure_dir, now_iso
from .constants import StoryStatus
from ..services.ingestion import ingest_story
from ..orchestrator import (
    build_context, run_orchestrator, timeline_events, characters_list,
    run_interview, run_perspective, run_divergence, reset_context,
    run_generate_image, save_story, story_data, add_entry, delete_data,
    list_stories, delete_story_full,
)
from ..store import mongo

router = APIRouter()


async def _get_ready_story(story_id: str) -> dict:
    doc = await mongo.stories().find_one({"_id": story_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Story not found")
    if doc["status"] != StoryStatus.READY.value:
        raise HTTPException(status_code=409, detail=f"Story not ready (status: {doc['status']})")
    return doc


async def _process_story(story_id: str, paths: list[str]) -> None:
    """Background: ingest into Chroma, then build context.md. Marks failed on error."""
    try:
        await ingest_story(story_id, [Path(p) for p in paths])
        await build_context(story_id)
    except Exception:
        await mongo.stories().update_one(
            {"_id": story_id},
            {"$set": {"status": StoryStatus.FAILED.value, "updated_at": now_iso()}},
        )


# ------------------------------------------------------------------ #
# Upload & status                                                     #
# ------------------------------------------------------------------ #
@router.post("/stories", response_model=StoryUploadResponse)
async def upload_story(background: BackgroundTasks, files: list[UploadFile] = File(...)):
    story_id = uuid4().hex
    source_dir = ensure_dir(story_dir(story_id) / "source")

    saved, names = [], []
    for f in files:
        name = f.filename or "story.txt"
        path = source_dir / name
        path.write_bytes(await f.read())
        saved.append(str(path))
        names.append(name)

    title = names[0].rsplit(".", 1)[0] if names else "Untitled"
    if len(names) > 1:
        title = f"{title} (+{len(names) - 1})"

    now = now_iso()
    await mongo.stories().insert_one({
        "_id": story_id,
        "title": title,
        "status": StoryStatus.INGESTING.value,
        "files": names,
        "n_chunks": 0,
        "created_at": now,
        "updated_at": now,
    })

    background.add_task(_process_story, story_id, saved)
    return StoryUploadResponse(id=story_id, status=StoryStatus.INGESTING)


@router.get("/stories")
async def get_stories():
    return await list_stories()


@router.delete("/stories/{story_id}")
async def delete_story(story_id: str):
    await delete_story_full(story_id)
    return {"deleted": True, "id": story_id}


@router.get("/stories/{story_id}", response_model=StoryOut)
async def get_story(story_id: str):
    doc = await mongo.stories().find_one({"_id": story_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Story not found")
    return StoryOut(
        id=doc["_id"], title=doc["title"], status=doc["status"],
        n_chunks=doc.get("n_chunks", 0), created_at=doc["created_at"],
    )


@router.get("/stories/{story_id}/files")
async def get_files(story_id: str):
    doc = await mongo.stories().find_one({"_id": story_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Story not found")
    return {"story_id": story_id, "files": doc.get("files", [])}


# ------------------------------------------------------------------ #
# Home: main-agent chat + reset context                              #
# ------------------------------------------------------------------ #
@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    await _get_ready_story(req.story_id)
    reply = await run_orchestrator(req.story_id, req.message)
    return ChatResponse(reply=reply)


@router.post("/stories/{story_id}/reset")
async def reset(story_id: str):
    await mongo.stories().find_one({"_id": story_id})  # existence not required to clear
    cleared = await reset_context(story_id)
    return {"story_id": story_id, "cleared_messages": cleared}


@router.post("/stories/{story_id}/save")
async def save(story_id: str, req: SaveStoryRequest):
    doc = await mongo.stories().find_one({"_id": story_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Story not found")
    return await save_story(story_id, req.name)


# ------------------------------------------------------------------ #
# Data page: list / add / delete entries                              #
# ------------------------------------------------------------------ #
@router.get("/stories/{story_id}/data", response_model=list[DataEntry])
async def get_data(story_id: str):
    await _get_ready_story(story_id)
    return [DataEntry(**r) for r in await story_data(story_id)]


@router.post("/stories/{story_id}/data", response_model=DataEntry)
async def post_data(story_id: str, req: AddEntryRequest):
    await _get_ready_story(story_id)
    return DataEntry(**await add_entry(story_id, req.name, req.type, req.description))


@router.delete("/stories/{story_id}/data/{row_id:path}")
async def del_data(story_id: str, row_id: str):
    ok = await delete_data(story_id, row_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"deleted": True, "id": row_id}


# ------------------------------------------------------------------ #
# Data: characters + timeline                                        #
# ------------------------------------------------------------------ #
@router.get("/stories/{story_id}/characters", response_model=list[CharacterOut])
async def get_characters(story_id: str):
    await _get_ready_story(story_id)
    return [CharacterOut(**c) for c in characters_list(story_id)]


@router.get("/stories/{story_id}/timeline")
async def get_timeline(story_id: str):
    await _get_ready_story(story_id)
    return {"story_id": story_id, "events": [TimelineEvent(**e).model_dump() for e in timeline_events(story_id)]}


# ------------------------------------------------------------------ #
# Tools: interview / perspective / divergence                        #
# ------------------------------------------------------------------ #
@router.post("/stories/{story_id}/interview", response_model=ChatResponse)
async def interview(story_id: str, req: InterviewRequest):
    await _get_ready_story(story_id)
    history = [m.model_dump() for m in req.history]
    reply = await run_interview(story_id, req.character, req.story_point, req.message, history)
    return ChatResponse(reply=reply)


@router.post("/stories/{story_id}/perspective", response_model=ChatResponse)
async def perspective(story_id: str, req: PerspectiveRequest):
    await _get_ready_story(story_id)
    history = [m.model_dump() for m in req.history]
    reply = await run_perspective(story_id, req.character, req.event, req.message, history)
    return ChatResponse(reply=reply)


@router.post("/stories/{story_id}/divergence", response_model=ChatResponse)
async def divergence(story_id: str, req: DivergenceRequest):
    await _get_ready_story(story_id)
    history = [m.model_dump() for m in req.history]
    reply = await run_divergence(story_id, req.event, req.change, req.message, history)
    return ChatResponse(reply=reply)


# ------------------------------------------------------------------ #
# Generative Studio: image generation                                 #
# ------------------------------------------------------------------ #
@router.post("/stories/{story_id}/generate-image", response_model=AssetOut)
async def generate_image_ep(story_id: str, req: GenerateImageRequest):
    await _get_ready_story(story_id)
    asset = await run_generate_image(story_id, req.kind, req.subject)
    return AssetOut(**asset)


# ------------------------------------------------------------------ #
# Assets                                                             #
# ------------------------------------------------------------------ #
@router.get("/stories/{story_id}/assets", response_model=list[AssetOut])
async def list_assets(story_id: str):
    cursor = mongo.assets().find({"story_id": story_id}).sort("created_at", -1)
    return [
        AssetOut(
            id=doc["_id"], story_id=doc["story_id"], type=doc["type"],
            path=doc["path"], prompt=doc.get("prompt"), created_at=doc["created_at"],
        )
        async for doc in cursor
    ]
