import os
import shutil
from pathlib import Path
from typing import Optional
from bson import ObjectId
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pymongo import MongoClient

from config import MONGODB_URI
from ingestion.document_loader import process_and_index_document
from agents.lore_agent import extract_story_data, save_story_data
from agents.character_agent import add_event_positions, generate_character_profiles, save_character_data
from agents.interview_graph import run_interview_workflow
from agents.divergence_agent import generate_divergence

app = FastAPI(title="Narrative Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

mongo_client = MongoClient(MONGODB_URI)
db = mongo_client["narrative_engine"]
stories_collection = db["stories"]

class InterviewRequest(BaseModel):
    story_id: Optional[str] = None
    story_title: Optional[str] = "Test Story"
    character_name: str
    timeline_point: int
    user_question: str

class DivergenceRequest(BaseModel):
    story_id: Optional[str] = None
    story_title: Optional[str] = "Test Story"
    event_position: int
    proposed_change: str

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Narrative Engine backend is active"}

@app.get("/api/stories")
def list_stories():
    stories = list(stories_collection.find({}, {"_id": 1, "title": 1, "created_at": 1, "characters": 1, "events": 1}).sort("_id", -1))
    for s in stories:
        s["id"] = str(s["_id"])
        del s["_id"]
    return stories

@app.get("/api/story/{story_id}")
def get_story_by_id(story_id: str):
    query = {"_id": ObjectId(story_id)} if ObjectId.is_valid(story_id) else {"title": story_id}
    story = stories_collection.find_one(query)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    story["id"] = str(story["_id"])
    del story["_id"]
    return story

@app.post("/api/upload")
async def upload_story_file(file: UploadFile = File(...), title: Optional[str] = Form(None)):
    story_title = title if title and title.strip() else Path(file.filename).stem
    file_path = UPLOAD_DIR / file.filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    collection_name = f"story_{abs(hash(story_title)) % 1000000}"
    cleaned_text, chunks = process_and_index_document(str(file_path), collection_name=collection_name)
    
    extracted_data = extract_story_data(cleaned_text)
    story_id = save_story_data(extracted_data, title=story_title)
    
    ordered_events = add_event_positions(extracted_data.get("events", []))
    character_profiles = generate_character_profiles(cleaned_text, extracted_data.get("characters", []))
    save_character_data(story_id, ordered_events, character_profiles)
    
    stories_collection.update_one(
        {"_id": story_id},
        {"$set": {"collection_name": collection_name, "filename": file.filename}}
    )
    
    return {
        "id": str(story_id),
        "title": story_title,
        "characters": extracted_data.get("characters", []),
        "events": ordered_events,
        "character_profiles": character_profiles,
        "chunk_count": len(chunks)
    }

@app.post("/api/interview")
def interview_endpoint(req: InterviewRequest):
    collection_name = "story"
    title = req.story_title
    
    if req.story_id and ObjectId.is_valid(req.story_id):
        story = stories_collection.find_one({"_id": ObjectId(req.story_id)})
        if story:
            title = story.get("title", req.story_title)
            collection_name = story.get("collection_name", "story")
            
    result = run_interview_workflow(
        character_name=req.character_name,
        timeline_point=req.timeline_point,
        user_question=req.user_question,
        story_title=title,
        collection_name=collection_name
    )
    return result

@app.post("/api/divergence")
def divergence_endpoint(req: DivergenceRequest):
    title = req.story_title
    if req.story_id and ObjectId.is_valid(req.story_id):
        story = stories_collection.find_one({"_id": ObjectId(req.story_id)})
        if story:
            title = story.get("title", req.story_title)
            
    result = generate_divergence(
        event_position=req.event_position,
        proposed_change=req.proposed_change,
        story_title=title
    )
    return result

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")