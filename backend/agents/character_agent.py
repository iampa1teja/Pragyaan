import json
import os
import time
from datetime import datetime, timezone
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

def get_story(title="Test Story"):
    story = stories_collection.find_one(
        {"title": title},
        sort=[("_id", -1)]
    )
    if not story:
        story = stories_collection.find_one({}, sort=[("_id", -1)])
    if not story:
        raise ValueError(f"Story '{title}' not found in MongoDB.")
    return story

def add_event_positions(events):
    ordered = []
    for index, event in enumerate(events, start=1):
        if isinstance(event, dict) and "description" in event:
            ordered.append({"position": index, "description": event["description"]})
        else:
            ordered.append({"position": index, "description": str(event)})
    return ordered

def build_character_profile_prompt(story_text, characters):
    characters_json = json.dumps(characters, ensure_ascii=False)
    return f"""You are a character analysis system.

Analyze the story below and create a profile for each character listed.
Only use information explicitly supported by the story.

Return ONLY valid JSON.
Do not include markdown.
Do not include ```json.

Structure:
{{
    "Character Name": {{
        "personality": ["trait 1"],
        "relationships": [{{"character": "Other", "relationship": "relation"}}]
    }}
}}

CHARACTERS:
{characters_json}

STORY:
{story_text[:8000]}
"""

def generate_character_profiles(story_text, characters):
    if not characters:
        characters = ["Protagonist"]

    prompt = build_character_profile_prompt(story_text, characters)

    for model_name in MODELS:
        for attempt in range(2):
            try:
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={"response_mime_type": "application/json"}
                )
                profiles = json.loads(response.text.strip())
                if isinstance(profiles, dict):
                    return profiles
            except Exception:
                time.sleep(1)

    return {
        char: {
            "personality": ["Analytical", "Determined"],
            "relationships": []
        }
        for char in characters
    }

def save_character_data(story_id, ordered_events, character_profiles):
    stories_collection.update_one(
        {"_id": story_id},
        {
            "$set": {
                "ordered_events": ordered_events,
                "character_profiles": character_profiles,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

def get_character_knowledge(character_name, timeline_point, ordered_events, character_profiles):
    profile = character_profiles.get(character_name, {})
    known_events = [
        event for event in ordered_events
        if event["position"] <= timeline_point
    ]
    return {
        "character": character_name,
        "timeline_point": timeline_point,
        "profile": profile,
        "known_events": known_events
    }