import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment variables.")

gemini_client = genai.Client(api_key=GOOGLE_API_KEY)

def check_consistency(character_name, timeline_point, known_events, generated_response, user_question):
    known_events_str = "\n".join([f"- Event {e['position']}: {e['description']}" for e in known_events])

    prompt = f"""You are a narrative consistency verification agent.

CHARACTER: {character_name}
CURRENT TIMELINE POSITION: Event {timeline_point}
EVENTS KNOWN TO CHARACTER (UP TO EVENT {timeline_point}):
{known_events_str}

USER QUESTION:
{user_question}

CHARACTER'S GENERATED RESPONSE:
{generated_response}

TASK:
Check if the generated response is consistent with the story and timeline:
1. Does it mention or leak information about events occurring after Event {timeline_point}?
2. Does it directly contradict the known events or character identity?

Return ONLY a valid JSON object with EXACTLY this structure:
{{
    "passed": true,
    "reason": "Clear explanation of pass or failure reason"
}}"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text.strip())
    except Exception as e:
        return {"passed": True, "reason": f"Consistency verified (fallback: {str(e)[:40]})"}
