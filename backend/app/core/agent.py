from agents import Agent
from .utils import build_agent


def build_context_agent() -> Agent:
    """Turns raw story text into the 5 markdown sections (bodies only)."""
    return build_agent(name="context", prompt_file="context_agent")


def build_character_interview_agent(tools: list | None = None) -> Agent:
    """Answers in-character at a selected story point, using only knowledge up to then."""
    return build_agent(name="interview", prompt_file="character_interview", tools=tools)


def build_perspective_agent(tools: list | None = None) -> Agent:
    """Retells a scene strictly from a chosen character's point of view."""
    return build_agent(name="perspective", prompt_file="perspective", tools=tools)


def build_divergence_agent(tools: list | None = None) -> Agent:
    """Changes a story event and generates logically connected alternate consequences."""
    return build_agent(name="divergence", prompt_file="divergence", tools=tools)


def build_analysis_agent(tools: list | None = None) -> Agent:
    """Analyzes characters, relationships, plot structure, and contradictions."""
    return build_agent(name="analysis", prompt_file="analysis", tools=tools)


# --- Stretch: visual agents ---

def build_character_design_agent(tools: list | None = None) -> Agent:
    """Produces image prompts for a character's design, outfits, and look."""
    return build_agent(name="character_design", prompt_file="character_design", tools=tools)


def build_concept_art_agent(tools: list | None = None) -> Agent:
    """Converts scenes and environments into concept-art image prompts."""
    return build_agent(name="concept_art", prompt_file="concept_art", tools=tools)


def build_video_agent(tools: list | None = None) -> Agent:
    """Converts selected scenes into storyboard/video descriptions."""
    return build_agent(name="video", prompt_file="video", tools=tools)
