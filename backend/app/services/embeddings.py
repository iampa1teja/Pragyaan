import httpx
from ..core.config import get_settings

async def embed_texts(texts: list[str]) -> list[list[float]]:
    settings = get_settings()

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.ollama_base_url}/api/embed",
            json={
                "model": settings.embed_model,
                "input": texts,
            },
        )

        response.raise_for_status()
        data = response.json()
    return data["embeddings"]

async def embed_query(text: str) -> list[float]:
    embeddings = await embed_texts([text])
    return embeddings[0]