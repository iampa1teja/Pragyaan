import json
from uuid import uuid4
from dataclasses import dataclass

from agents import Agent, Runner, function_tool, RunContextWrapper

from .core.utils import build_agent, now_iso
from .core.agent import (
    build_context_agent,
    build_character_interview_agent,
    build_perspective_agent,
    build_divergence_agent,
    build_analysis_agent,
    build_character_design_agent,
    build_concept_art_agent,
)
from .core.constants import CONTEXT_SECTIONS, StoryStatus, AssetType
from .store.context_store import ContextStore, split_sections
from .store.chroma_store import ChromaStore
from .store import mongo
from .services.embeddings import embed_query
from .services.image_gen import generate_image

HISTORY_LIMIT = 10

_CTX = ContextStore()
_chroma: ChromaStore | None = None
_orchestrator: Agent | None = None


def _get_chroma() -> ChromaStore:
    global _chroma
    if _chroma is None:
        _chroma = ChromaStore()
    return _chroma


# ------------------------------------------------------------------ #
# Run context: carries the active story id through every tool/agent   #
# ------------------------------------------------------------------ #
@dataclass
class StoryCtx:
    story_id: str


# ------------------------------------------------------------------ #
# Tools the orchestrator (and sub-agents) use to navigate the story   #
# ------------------------------------------------------------------ #
@function_tool
def read_outline(wrapper: RunContextWrapper[StoryCtx]) -> str:
    """List the context.md sections and their line ranges."""
    outline = _CTX.read_outline(wrapper.context.story_id)
    return "\n".join(f"- {name} (L{s}-L{e})" for name, (s, e) in outline.items())


@function_tool
def read_section(wrapper: RunContextWrapper[StoryCtx], section: str) -> str:
    """Read a full context section by name (Characters, Scenes, Timeline, Branches, Assets)."""
    return _CTX.read_section(wrapper.context.story_id, section)


@function_tool
def read_context_lines(wrapper: RunContextWrapper[StoryCtx], start: int, end: int) -> str:
    """Read an inclusive 1-indexed line range from context.md."""
    return _CTX.read_lines(wrapper.context.story_id, start, end)


@function_tool
async def search_context(wrapper: RunContextWrapper[StoryCtx], query: str, k: int = 5) -> str:
    """Semantic search over the raw story text for grounding detail."""
    embedding = await embed_query(query)
    results = _get_chroma().query(wrapper.context.story_id, embedding, k)
    return "\n\n".join(f"[{r['id']}] {r['document']}" for r in results)


def _bullets(section: str) -> list[str]:
    out = []
    for line in section.split("\n"):
        t = line.strip()
        if t.startswith("- ") and t[2:].strip():
            out.append(t[2:].strip())
    return out


def _csv(part: str, prefix: str) -> list[str]:
    """From 'characters: A, B' return ['A','B'] when prefix matches."""
    p = part.strip()
    if p.lower().startswith(prefix):
        p = p[len(prefix):]
    return [x.strip() for x in p.split(",") if x.strip()]


def timeline_events(story_id: str) -> list[dict]:
    """Parse the Timeline section into ordered {title, description, characters, tags} events."""
    try:
        section = _CTX.read_section(story_id, "Timeline")
    except Exception:
        return []
    events: list[dict] = []
    for text in _bullets(section):
        parts = [p.strip() for p in text.split("|")]
        title = parts[0]
        description, characters, tags = "", [], []
        for part in parts[1:]:
            low = part.lower()
            if low.startswith("characters:"):
                characters = _csv(part, "characters:")
            elif low.startswith("tags:"):
                tags = _csv(part, "tags:")
            elif not description:
                description = part
        # fallback: old "Title: description" single-colon form
        if not description and ":" in title:
            title, description = [s.strip() for s in title.split(":", 1)]
        events.append({"title": title, "description": description,
                       "characters": characters, "tags": tags})
    return events


def characters_list(story_id: str) -> list[dict]:
    """Parse the Characters section into {name, role, traits, description}."""
    try:
        section = _CTX.read_section(story_id, "Characters")
    except Exception:
        return []
    people: list[dict] = []
    for text in _bullets(section):
        parts = [p.strip() for p in text.split("|")]
        name = parts[0]
        role = parts[1] if len(parts) > 1 else ""
        traits = [t.strip() for t in parts[2].split(",")] if len(parts) > 2 and parts[2] else []
        description = parts[3] if len(parts) > 3 else ""
        # fallback: old "Name: description" form
        if len(parts) == 1 and ":" in name:
            name, description = [s.strip() for s in name.split(":", 1)]
        if name:
            people.append({"name": name, "role": role, "traits": traits, "description": description})
    return people


@function_tool
def get_timeline(wrapper: RunContextWrapper[StoryCtx]) -> str:
    """Return the story's timeline as a JSON array of {title, description} events, in order."""
    events = timeline_events(wrapper.context.story_id)
    if not events:
        return "No timeline events recorded yet."
    return json.dumps(events, ensure_ascii=False)


@function_tool
def remember(wrapper: RunContextWrapper[StoryCtx], section: str, note: str) -> str:
    """Persist an important new fact into a context.md section for future turns."""
    if section not in CONTEXT_SECTIONS:
        return f"Unknown section. Choose one of: {', '.join(CONTEXT_SECTIONS)}"
    story_id = wrapper.context.story_id
    sections = split_sections(_CTX.read(story_id))
    sections[section] = f"{sections[section]}\n- {note}".strip()
    _CTX.write(story_id, sections)
    return f"Saved to {section}."


CONTEXT_TOOLS = [read_outline, read_section, read_context_lines, search_context, get_timeline]


# ------------------------------------------------------------------ #
# Sub-agents exposed to the orchestrator as tools                     #
# ------------------------------------------------------------------ #
def _subagent_tools() -> list:
    interview = build_character_interview_agent(CONTEXT_TOOLS)
    perspective = build_perspective_agent(CONTEXT_TOOLS)
    divergence = build_divergence_agent(CONTEXT_TOOLS)
    analysis = build_analysis_agent(CONTEXT_TOOLS)
    return [
        interview.as_tool(
            tool_name="interview_character",
            tool_description="Interview a character in-character at a selected story point.",
        ),
        perspective.as_tool(
            tool_name="shift_perspective",
            tool_description="Retell a scene strictly from a chosen character's point of view.",
        ),
        divergence.as_tool(
            tool_name="diverge_story",
            tool_description="Change a story event and generate alternate consequences.",
        ),
        analysis.as_tool(
            tool_name="analyze_story",
            tool_description="Analyze characters, relationships, plot structure, or contradictions.",
        ),
    ]


def get_orchestrator() -> Agent:
    """Lazily build the orchestrator agent (context tools + memory + sub-agents)."""
    global _orchestrator
    if _orchestrator is None:
        tools = [*CONTEXT_TOOLS, remember, *_subagent_tools()]
        _orchestrator = build_agent("orchestrator", "orchestrator", tools=tools)
    return _orchestrator


# ------------------------------------------------------------------ #
# Conversation memory (Mongo)                                         #
# ------------------------------------------------------------------ #
async def _recent_history(story_id: str) -> str:
    cursor = (
        mongo.chats()
        .find({"story_id": story_id})
        .sort("ts", -1)
        .limit(HISTORY_LIMIT)
    )
    msgs = [doc async for doc in cursor]
    msgs.reverse()
    return "\n".join(f"{m['role']}: {m['content']}" for m in msgs)


async def _save_message(story_id: str, role: str, content: str, agent: str | None = None) -> None:
    await mongo.chats().insert_one(
        {"story_id": story_id, "role": role, "content": content, "agent": agent, "ts": now_iso()}
    )


def _build_input(overview: str, history: str, message: str) -> str:
    parts = ["[STORY MAP — use read_section / search_context to dig in]", overview]
    if history:
        parts += ["[RECENT CONVERSATION]", history]
    parts += ["[USER MESSAGE]", message]
    return "\n\n".join(parts)


# ------------------------------------------------------------------ #
# Public entry points                                                 #
# ------------------------------------------------------------------ #
CONTEXT_BUILD_BUDGET = 16000  # max chars fed to the context agent (keeps big stories fast)


async def build_context(story_id: str) -> None:
    """Run the context agent over the story's chunks and write context.md."""
    got = _get_chroma().collection(story_id).get(include=["documents", "metadatas"])
    pairs = sorted(
        zip(got["documents"], got["metadatas"]),
        key=lambda p: (p[1] or {}).get("char_start", 0),
    )
    docs = [d for d, _ in pairs]
    text = "\n\n".join(docs)

    # For long stories, sample chunks evenly across the arc to stay within budget
    # (the whole story in one prompt is slow and can overflow the model's context).
    if len(text) > CONTEXT_BUILD_BUDGET and len(docs) > 1:
        avg = max(1, len(text) // len(docs))
        keep = max(1, CONTEXT_BUILD_BUDGET // avg)
        step = max(1, len(docs) // keep)
        text = "\n\n".join(docs[::step])[:CONTEXT_BUILD_BUDGET]

    result = await Runner.run(build_context_agent(), text)
    sections = split_sections(result.final_output)
    path = _CTX.write(story_id, sections)

    await mongo.stories().update_one(
        {"_id": story_id},
        {"$set": {
            "status": StoryStatus.READY.value,
            "context_path": str(path),
            "updated_at": now_iso(),
        }},
    )


async def run_orchestrator(story_id: str, message: str) -> str:
    """Handle one user turn: load map + history, act, persist, reply."""
    overview = read_outline_text(story_id)
    history = await _recent_history(story_id)

    await _save_message(story_id, "user", message)

    result = await Runner.run(
        get_orchestrator(),
        _build_input(overview, history, message),
        context=StoryCtx(story_id=story_id),
    )
    reply = result.final_output

    await _save_message(story_id, "assistant", reply, agent="orchestrator")
    return reply


# ------------------------------------------------------------------ #
# Dedicated mode runners (Characters / Perspective / Divergence pages) #
# ------------------------------------------------------------------ #
def _history_block(history: list[dict] | None) -> str:
    if not history:
        return ""
    lines = [f"{m.get('role', 'user')}: {m.get('content', '')}" for m in history]
    return "[RECENT CONVERSATION]\n" + "\n".join(lines) + "\n\n"


async def run_interview(story_id: str, character: str, story_point: str,
                        message: str, history: list[dict] | None = None) -> str:
    agent = build_character_interview_agent(CONTEXT_TOOLS)
    prompt = (
        f"Character to embody: {character}\n"
        f"Story point (timeline event you know up to): {story_point}\n\n"
        f"{_history_block(history)}"
        f"Interviewer asks: {message}"
    )
    result = await Runner.run(agent, prompt, context=StoryCtx(story_id=story_id))
    return result.final_output


async def run_perspective(story_id: str, character: str, event: str,
                          message: str, history: list[dict] | None = None) -> str:
    agent = build_perspective_agent(CONTEXT_TOOLS)
    prompt = (
        f"Perspective character: {character}\n"
        f"Scene / event: {event}\n\n"
        f"{_history_block(history)}"
        f"Request: {message}"
    )
    result = await Runner.run(agent, prompt, context=StoryCtx(story_id=story_id))
    return result.final_output


async def run_divergence(story_id: str, event: str, change: str,
                         message: str, history: list[dict] | None = None) -> str:
    agent = build_divergence_agent(CONTEXT_TOOLS)
    tail = (
        f"Follow-up: {message}"
        if message and message.strip()
        else "Generate the alternate trajectory: immediate, short-term, medium-term, and long-term consequences."
    )
    prompt = (
        f"Timeline event to change: {event}\n"
        f"Change to apply: {change}\n\n"
        f"{_history_block(history)}"
        f"{tail}"
    )
    result = await Runner.run(agent, prompt, context=StoryCtx(story_id=story_id))
    return result.final_output


async def reset_context(story_id: str) -> int:
    """Clear the conversation history for a story (does NOT touch files or context.md)."""
    res = await mongo.chats().delete_many({"story_id": story_id})
    return res.deleted_count


# ------------------------------------------------------------------ #
# Generative Studio: image generation                                 #
# ------------------------------------------------------------------ #
async def run_generate_image(story_id: str, kind: str, subject: str) -> dict:
    """A visual agent crafts a detailed prompt from the story, then OpenAI renders it."""
    agent = (
        build_concept_art_agent(CONTEXT_TOOLS)
        if kind == "concept"
        else build_character_design_agent(CONTEXT_TOOLS)
    )
    result = await Runner.run(
        agent, f"Subject: {subject}", context=StoryCtx(story_id=story_id)
    )
    image_prompt = result.final_output

    url = await generate_image(image_prompt, story_id)

    asset = {
        "_id": uuid4().hex,
        "story_id": story_id,
        "type": AssetType.IMAGE.value,
        "path": url,
        "prompt": image_prompt,
        "created_at": now_iso(),
    }
    await mongo.assets().insert_one(asset)
    return {
        "id": asset["_id"],
        "story_id": story_id,
        "type": AssetType.IMAGE.value,
        "path": url,
        "prompt": image_prompt,
        "created_at": asset["created_at"],
    }


def read_outline_text(story_id: str) -> str:
    """Format the outline as a plain-text overview for the orchestrator input."""
    outline = _CTX.read_outline(story_id)
    return "\n".join(f"- {name} (L{s}-L{e})" for name, (s, e) in outline.items())
