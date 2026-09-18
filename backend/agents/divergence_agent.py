import os
import json
import time
from dotenv import load_dotenv
from google import genai
from agents.character_agent import get_story, add_event_positions

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment variables.")

gemini_client = genai.Client(api_key=GOOGLE_API_KEY)

MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]

def generate_divergence(event_position: int, proposed_change: str, story_title: str = "Test Story"):
    story = get_story(story_title)
    ordered_events = story.get("ordered_events")
    if not ordered_events:
        ordered_events = add_event_positions(story.get("events", []))

    characters = story.get("characters", [])
    relationships = story.get("relationships", [])

    events_str = "\n".join([f"- Event {e['position']}: {e['description']}" for e in ordered_events])
    target_event = next((e["description"] for e in ordered_events if e["position"] == event_position), f"Event {event_position}")

    prompt = f"""You are an advanced narrative branching and causal divergence engine.

ORIGINAL STORY EVENTS:
{events_str}

ORIGINAL CHARACTERS:
{json.dumps(characters, ensure_ascii=False)}

ORIGINAL RELATIONSHIPS:
{json.dumps(relationships, ensure_ascii=False)}

POINT OF DIVERGENCE:
Original Event {event_position}: "{target_event}"
PROPOSED USER CHANGE:
"{proposed_change}"

TASK:
Simulate the ripple effects of this change from Event {event_position} onward.
Reason through:
1. Direct consequences of the change
2. Impact on character motivations and relationships
3. Modified subsequent events (replacing or altering later events)
4. New story resolution / climax / ending

Return ONLY a valid JSON object matching EXACTLY this structure:
{{
    "divergence_point": {event_position},
    "original_event": "{target_event}",
    "proposed_change": "{proposed_change}",
    "direct_consequences": ["consequence 1", "consequence 2"],
    "affected_characters": ["Character A", "Character B"],
    "relationship_shifts": ["Shift description 1"],
    "branched_timeline": [
        {{
            "position": {event_position},
            "description": "The altered event description",
            "is_altered": true
        }}
    ],
    "new_ending": "Summary of new story conclusion",
    "consistency_status": "Valid causal branch"
}}"""

    for model_name in MODELS:
        for attempt in range(2):
            try:
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={"response_mime_type": "application/json"}
                )
                data = json.loads(response.text.strip())
                if isinstance(data, dict):
                    return data
            except Exception:
                time.sleep(1)

    return {
        "divergence_point": event_position,
        "original_event": target_event,
        "proposed_change": proposed_change,
        "direct_consequences": [f"The course of events shifts immediately following the decision at Event {event_position}."],
        "affected_characters": characters if characters else ["Protagonist"],
        "relationship_shifts": ["Tension increases due to unexpected actions."],
        "branched_timeline": [
            {
                "position": event_position,
                "description": proposed_change,
                "is_altered": True
            }
        ],
        "new_ending": f"The story diverges from Event {event_position}, leading to a resolution shaped by: {proposed_change}.",
        "consistency_status": "Fallback causal branch"
    }
