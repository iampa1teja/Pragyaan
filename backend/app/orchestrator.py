from dataclasses import dataclass

from agents import Agent, Runner, function_tool, RunContextWrapper

from .core.utils import build_agent, now_iso
from .core.agent import (
    build_context_agent,
    build_character_interview_agent,
    build_perspective_agent,
    build_divergence_agent,
    build_analysis_agent,
)
from .core.constants import CONTEXT_SECTIONS, StoryStatus
from .store.context_store import ContextStore, split_sections
from .store.chroma_store import ChromaStore
from .store import mongo
from .services.embeddings import embed_query

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


CONTEXT_TOOLS = [read_outline, read_section, read_context_lines, search_context]


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
async def build_context(story_id: str) -> None:
    """Run the context agent over the story's chunks and write context.md."""
    got = _get_chroma().collection(story_id).get(include=["documents", "metadatas"])
    pairs = sorted(
        zip(got["documents"], got["metadatas"]),
        key=lambda p: (p[1] or {}).get("char_start", 0),
    )
    text = "\n\n".join(doc for doc, _ in pairs)

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


def read_outline_text(story_id: str) -> str:
    """Format the outline as a plain-text overview for the orchestrator input."""
    outline = _CTX.read_outline(story_id)
    return "\n".join(f"- {name} (L{s}-L{e})" for name, (s, e) in outline.items())
