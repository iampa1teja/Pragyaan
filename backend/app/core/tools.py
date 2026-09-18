"""
Agent tools.

This module exposes all application capabilities that agents can invoke:
- Story/context reading
- Semantic context retrieval
- Asset management
- Chat persistence
"""

import json

from agents import function_tool

from ..services.embeddings import embed_query
from ..store.context_store import ContextStore
from ..store.chroma_store import ChromaStore
from ..store import mongo
from ..store.models import Asset


# ============================================================
# Context Tools
# ============================================================

@function_tool
def read_outline(story_id: str) -> str:
    """
    Read the outline of a story.

    Use this when the agent needs the high-level structure,
    sections, or overall organization of a story.
    """
    store = ContextStore()
    return store.get_outline(story_id)


@function_tool
def read_context_lines(story_id: str, start: int, end: int,) -> str:
    """
    Read a specific range of lines from the story context.

    Use this when the agent needs an exact portion of the
    source context rather than a semantic search result.
    """
    store = ContextStore()
    return store.get_lines(story_id, start, end)


@function_tool
def read_section(story_id: str, section: str, ) ->str:
    """
    Read a named section from the story.

    Use this when the agent knows which section it needs.
    """
    store = ContextStore()
    return store.get_section(story_id, section)


# ============================================================
# Retrieval Tools
# ============================================================

@function_tool
def search_context(story_id: str, query: str, k: int = 5,) -> str:
    """
    Search story context using semantic similarity.

    The query is converted into an embedding and searched
    against the story's ChromaDB collection.
    """
    query_embedding = embed_query(query)

    store = ChromaStore()

    results = store.query(
        story_id=story_id,
        query_embedding=query_embedding,
        k=k,
    )

    if not results:
        return "No relevant context found."

    snippets = []

    for i, result in enumerate(results, start=1):
        metadata = result.get("metadata") or {}

        snippets.append(
            f"[Snippet {i}]\n"
            f"{result['document']}\n"
            f"Source: characters "
            f"{metadata.get('char_start', '?')}-"
            f"{metadata.get('char_end', '?')}"
        )

    return "\n\n".join(snippets)


# ============================================================
# Asset Tools
# ============================================================

@function_tool
async def save_asset(story_id: str, type: str, path: str, prompt: str, ) -> str:
    """
    Save a generated or uploaded asset for a story.

    Stores the asset metadata in MongoDB.
    """
    asset = Asset(
        story_id=story_id,
        type=type,
        path=path,
        prompt=prompt,
    )

    collection = mongo.assets()

    result = await collection.insert_one(
        asset.model_dump()
    )

    return str(result.inserted_id)


@function_tool
async def list_assets(story_id: str,) -> str:
    """
    List all assets associated with a story.
    """
    collection = mongo.assets()

    cursor = collection.find({
        "story_id": story_id
    })

    assets = await cursor.to_list(length=None)

    return json.dumps(
        assets,
        default=str,
        indent=2,
    )


# ============================================================
# Chat Tools
# ============================================================

@function_tool
async def save_chat(story_id: str, role: str, content: str,) -> str:
    """
    Save a chat message to the story's conversation history.
    """
    collection = mongo.chats()

    result = await collection.insert_one({
        "story_id": story_id,
        "role": role,
        "content": content,
    })

    return str(result.inserted_id)


# ============================================================
# Tool Registry
# ============================================================

ALL_TOOLS = [
    read_outline,
    read_context_lines,
    read_section,
    search_context,
    save_asset,
    list_assets,
    save_chat,
]