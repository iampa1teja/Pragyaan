import os
import json
from typing import TypedDict, List, Dict, Any, Optional
from dotenv import load_dotenv
from google import genai
from langgraph.graph import StateGraph, END
from pymongo import MongoClient

from rag.vector_store import search_chunks
from agents.character_agent import get_character_knowledge, get_story, add_event_positions, generate_character_profiles, save_character_data
from agents.consistency_agent import check_consistency

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment variables.")

gemini_client = genai.Client(api_key=GOOGLE_API_KEY)

class InterviewState(TypedDict):
    story_title: str
    character_name: str
    timeline_point: int
    user_question: str
    collection_name: str
    profile: Dict[str, Any]
    known_events: List[Dict[str, Any]]
    context_chunks: List[str]
    generated_response: str
    consistency_passed: bool
    consistency_reason: str
    retry_count: int

def retrieve_context_node(state: InterviewState) -> Dict[str, Any]:
    try:
        chunks = search_chunks(state["user_question"], collection_name=state.get("collection_name", "story"), n_results=3)
    except Exception:
        chunks = []
    return {"context_chunks": chunks}

def load_knowledge_node(state: InterviewState) -> Dict[str, Any]:
    story = get_story(state.get("story_title", "Test Story"))
    ordered_events = story.get("ordered_events")
    if not ordered_events:
        ordered_events = add_event_positions(story.get("events", []))
    
    character_profiles = story.get("character_profiles")
    if not character_profiles:
        story_text = "\n".join(e["description"] for e in ordered_events)
        characters = story.get("characters", [state["character_name"]])
        character_profiles = generate_character_profiles(story_text, characters)
        save_character_data(story["_id"], ordered_events, character_profiles)

    knowledge = get_character_knowledge(
        character_name=state["character_name"],
        timeline_point=state["timeline_point"],
        ordered_events=ordered_events,
        character_profiles=character_profiles
    )
    return {
        "profile": knowledge["profile"],
        "known_events": knowledge["known_events"]
    }

def generate_response_node(state: InterviewState) -> Dict[str, Any]:
    profile_str = json.dumps(state.get("profile", {}), ensure_ascii=False)
    known_events_str = "\n".join([f"- Event {e['position']}: {e['description']}" for e in state.get("known_events", [])])
    context_str = "\n---\n".join(state.get("context_chunks", []))
    
    feedback_section = ""
    if state.get("consistency_reason") and not state.get("consistency_passed", True):
        feedback_section = f"\nPREVIOUS ATTEMPT REJECTED REASON: {state['consistency_reason']}\nPlease fix this and ensure you do not leak or contradict anything."

    prompt = f"""You are roleplaying as {state['character_name']}.

YOUR PROFILE:
{profile_str}

CURRENT TIMELINE POSITION:
Event {state['timeline_point']}

EVENTS YOU KNOW ABOUT (CHRONOLOGICAL UP TO EVENT {state['timeline_point']}):
{known_events_str}

RELEVANT STORY EXCERPTS:
{context_str}
{feedback_section}

RULES:
1. Stay strictly in character as {state['character_name']}.
2. ONLY reference or acknowledge facts from the events listed above that you know.
3. You have ZERO knowledge of any events beyond Event {state['timeline_point']}. Do not speculate, mention, or leak anything that happens later.
4. If asked about something you do know based on your known events, answer accurately in character.
5. If asked about something you do not know or hasn't happened yet, state clearly in character that you don't know anything about it.
6. Keep your response conversational, concise, and authentic.

USER QUESTION:
{state['user_question']}

YOUR RESPONSE AS {state['character_name']}:"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        text = response.text.strip()
    except Exception:
        text = f"I am currently here at the mansion, but I don't know much more about that right now."

    current_retries = state.get("retry_count", 0) + 1
    return {
        "generated_response": text,
        "retry_count": current_retries
    }

def check_consistency_node(state: InterviewState) -> Dict[str, Any]:
    result = check_consistency(
        character_name=state["character_name"],
        timeline_point=state["timeline_point"],
        known_events=state["known_events"],
        generated_response=state["generated_response"],
        user_question=state["user_question"]
    )
    return {
        "consistency_passed": result.get("passed", True),
        "consistency_reason": result.get("reason", "")
    }

def route_consistency(state: InterviewState) -> str:
    if state.get("consistency_passed", True) or state.get("retry_count", 0) >= 3:
        return END
    return "generate_response"

def build_interview_graph():
    workflow = StateGraph(InterviewState)
    
    workflow.add_node("retrieve_context", retrieve_context_node)
    workflow.add_node("load_knowledge", load_knowledge_node)
    workflow.add_node("generate_response", generate_response_node)
    workflow.add_node("check_consistency", check_consistency_node)
    
    workflow.set_entry_point("retrieve_context")
    workflow.add_edge("retrieve_context", "load_knowledge")
    workflow.add_edge("load_knowledge", "generate_response")
    workflow.add_edge("generate_response", "check_consistency")
    
    workflow.add_conditional_edges(
        "check_consistency",
        route_consistency,
        {
            END: END,
            "generate_response": "generate_response"
        }
    )
    
    return workflow.compile()

interview_app = build_interview_graph()

def run_interview_workflow(character_name: str, timeline_point: int, user_question: str, story_title: str = "Test Story", collection_name: str = "story"):
    initial_state: InterviewState = {
        "story_title": story_title,
        "character_name": character_name,
        "timeline_point": timeline_point,
        "user_question": user_question,
        "collection_name": collection_name,
        "profile": {},
        "known_events": [],
        "context_chunks": [],
        "generated_response": "",
        "consistency_passed": False,
        "consistency_reason": "",
        "retry_count": 0
    }
    
    final_state = interview_app.invoke(initial_state)
    return {
        "character": final_state["character_name"],
        "timeline_point": final_state["timeline_point"],
        "response": final_state["generated_response"],
        "consistency": {
            "passed": final_state["consistency_passed"],
            "reason": final_state["consistency_reason"],
            "retries": final_state["retry_count"]
        }
    }
