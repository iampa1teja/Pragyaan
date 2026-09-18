import os
import json
from dotenv import load_dotenv
from google import genai
from pymongo import MongoClient
from rag.vector_store import search_chunks
from agents.character_agent import get_character_knowledge, get_story, add_event_positions, generate_character_profiles, save_character_data

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment variables.")

gemini_client = genai.Client(api_key=GOOGLE_API_KEY)

MONGODB_URI = os.getenv("MONGODB_URI")
if not MONGODB_URI:
    raise ValueError("MONGODB_URI not found in environment variables.")

mongo_client = MongoClient(MONGODB_URI)
db = mongo_client["narrative_engine"]
stories_collection = db["stories"]

def build_interview_prompt(character_name, timeline_point, profile, known_events, context_chunks, user_question):
    profile_str = json.dumps(profile, ensure_ascii=False)
    known_events_str = "\n".join([f"- Event {e['position']}: {e['description']}" for e in known_events])
    context_str = "\n---\n".join(context_chunks)

    return f"""You are roleplaying as {character_name}.

YOUR PROFILE:
{profile_str}

CURRENT TIMELINE POSITION:
Event {timeline_point}

EVENTS YOU KNOW ABOUT (CHRONOLOGICAL UP TO EVENT {timeline_point}):
{known_events_str}

RELEVANT STORY EXCERPTS:
{context_str}

RULES:
1. Stay strictly in character as {character_name}.
2. ONLY reference or acknowledge facts from the events listed above that you know.
3. You have ZERO knowledge of any events beyond Event {timeline_point}. Do not speculate, mention, or leak anything that happens later.
4. If asked about something you do know based on your known events, answer accurately in character reflecting your knowledge at this point in time.
5. If asked about something you do not know or hasn't happened yet, state clearly in character that you don't know anything about it.
6. Keep your response conversational, concise, and authentic.

USER QUESTION:
{user_question}

YOUR RESPONSE AS {character_name}:"""

def interview_character(character_name, timeline_point, user_question, title="Test Story", collection_name="story"):
    story = get_story(title)
    
    ordered_events = story.get("ordered_events")
    if not ordered_events:
        ordered_events = add_event_positions(story.get("events", []))
    
    character_profiles = story.get("character_profiles")
    if not character_profiles:
        story_text = "\n".join(e["description"] for e in ordered_events)
        characters = story.get("characters", [character_name])
        character_profiles = generate_character_profiles(story_text, characters)
        save_character_data(story["_id"], ordered_events, character_profiles)

    knowledge = get_character_knowledge(
        character_name=character_name,
        timeline_point=timeline_point,
        ordered_events=ordered_events,
        character_profiles=character_profiles
    )

    try:
        context_chunks = search_chunks(user_question, collection_name=collection_name, n_results=3)
    except Exception:
        context_chunks = []

    prompt = build_interview_prompt(
        character_name=character_name,
        timeline_point=timeline_point,
        profile=knowledge["profile"],
        known_events=knowledge["known_events"],
        context_chunks=context_chunks,
        user_question=user_question
    )

    response = gemini_client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    return response.text.strip()

if __name__ == "__main__":
    print("--- Test 1: Alice at Timeline Point 2 (Before Daniel mentions intruder) ---")
    q1 = "Did anyone break into the house?"
    ans1 = interview_character(
        character_name="Alice",
        timeline_point=2,
        user_question=q1
    )
    print(f"Question: {q1}")
    print(f"Alice (Event 2): {ans1}\n")

    print("--- Test 2: Alice at Timeline Point 4 (After Daniel told her & basement search) ---")
    q2 = "Did anyone break into the house?"
    ans2 = interview_character(
        character_name="Alice",
        timeline_point=4,
        user_question=q2
    )
    print(f"Question: {q2}")
    print(f"Alice (Event 4): {ans2}\n")
