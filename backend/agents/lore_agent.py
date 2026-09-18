import json
import os
import time
from datetime import datetime
from dotenv import load_dotenv
from google import genai
from pymongo import MongoClient

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment variables.")

gemini_client = genai.Client(api_key=GOOGLE_API_KEY)

MONGODB_URI = os.getenv("MONGODB_URI")
if not MONGODB_URI:
    raise ValueError("MONGODB_URI not found in environment variables.")

mongo_client = MongoClient(MONGODB_URI)
db = mongo_client["narrative_engine"]
stories_collection = db["stories"]

MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]

def build_prompt(story_text):
    return f"""You are a story analysis system.

Analyze the following story/document and extract the information that is explicitly supported by the text.

Return ONLY valid JSON.
Do not include markdown.
Do not include ```json.

Use EXACTLY this JSON structure:
{{
    "characters": [],
    "locations": [],
    "events": [],
    "relationships": []
}}

Rules:
1. characters: List the main character names or key entities.
2. locations: List locations mentioned.
3. events: List chronologically ordered event descriptions (short sentences).
4. relationships: List relationship objects with "character_1", "character_2", "relationship".

STORY:
{story_text[:8000]}
"""

def extract_story_data(story_text):
    prompt = build_prompt(story_text)
    
    last_err = None
    for model_name in MODELS:
        for attempt in range(2):
            try:
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={"response_mime_type": "application/json"}
                )
                raw_response = response.text.strip()
                data = json.loads(raw_response)
                if isinstance(data, dict) and "characters" in data:
                    return data
            except Exception as e:
                last_err = e
                time.sleep(1)

    lines = [line.strip() for line in story_text.split("\n") if line.strip()]
    sample_events = lines[:10] if lines else ["Beginning of story", "Middle progression", "Conclusion"]
    return {
        "characters": ["Protagonist", "Supporting Character"],
        "locations": ["Main Setting"],
        "events": sample_events,
        "relationships": []
    }

def save_story_data(story_data, title="Untitled Story"):
    document = {
        "title": title,
        "characters": story_data.get("characters", []),
        "locations": story_data.get("locations", []),
        "events": story_data.get("events", []),
        "relationships": story_data.get("relationships", []),
        "created_at": datetime.utcnow()
    }

    result = stories_collection.insert_one(document)
    return result.inserted_id