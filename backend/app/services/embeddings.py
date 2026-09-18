from .llm import get_client
from ..core.config import get_settings

async def embed_texts(texts: list[str]) -> list[list[float]]:
    resp = await get_client().embeddings.create(
        model=get_settings().embed_model,
        input=texts,
    )
    return [d.embedding for d in resp.data]

async def embed_query(text: str) -> list[float]:
    embeddings = await embed_texts([text])
    return embeddings[0]
