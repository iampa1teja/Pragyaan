from uuid import uuid4

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException

from .schema import StoryUploadResponse, StoryOut, ChatRequest, ChatResponse, AssetOut
from .utils import story_dir, ensure_dir, now_iso
from .constants import StoryStatus
from ..services.ingestion import ingest_story
from ..orchestrator import build_context, run_orchestrator
from ..store import mongo

router = APIRouter()


async def _process_story(story_id: str, path: str) -> None:
    """Background: ingest into Chroma, then build context.md. Marks failed on error."""
    from pathlib import Path
    try:
        await ingest_story(story_id, Path(path))
        await build_context(story_id)
    except Exception:
        await mongo.stories().update_one(
            {"_id": story_id},
            {"$set": {"status": StoryStatus.FAILED.value, "updated_at": now_iso()}},
        )


@router.post("/stories", response_model=StoryUploadResponse)
async def upload_story(background: BackgroundTasks, file: UploadFile = File(...)):
    story_id = uuid4().hex
    source_dir = ensure_dir(story_dir(story_id) / "source")
    path = source_dir / (file.filename or "story.txt")
    path.write_bytes(await file.read())

    now = now_iso()
    await mongo.stories().insert_one({
        "_id": story_id,
        "title": (file.filename or "Untitled").rsplit(".", 1)[0],
        "status": StoryStatus.INGESTING.value,
        "source_path": str(path),
        "n_chunks": 0,
        "created_at": now,
        "updated_at": now,
    })

    background.add_task(_process_story, story_id, str(path))
    return StoryUploadResponse(id=story_id, status=StoryStatus.INGESTING)


@router.get("/stories/{story_id}", response_model=StoryOut)
async def get_story(story_id: str):
    doc = await mongo.stories().find_one({"_id": story_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Story not found")
    return StoryOut(
        id=doc["_id"],
        title=doc["title"],
        status=doc["status"],
        n_chunks=doc.get("n_chunks", 0),
        created_at=doc["created_at"],
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    doc = await mongo.stories().find_one({"_id": req.story_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Story not found")
    if doc["status"] != StoryStatus.READY.value:
        raise HTTPException(status_code=409, detail=f"Story not ready (status: {doc['status']})")
    reply = await run_orchestrator(req.story_id, req.message)
    return ChatResponse(reply=reply)


@router.get("/stories/{story_id}/assets", response_model=list[AssetOut])
async def list_assets(story_id: str):
    cursor = mongo.assets().find({"story_id": story_id}).sort("created_at", -1)
    return [
        AssetOut(
            id=doc["_id"],
            story_id=doc["story_id"],
            type=doc["type"],
            path=doc["path"],
            prompt=doc.get("prompt"),
            created_at=doc["created_at"],
        )
        async for doc in cursor
    ]
