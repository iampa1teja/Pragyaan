import base64
from uuid import uuid4

from .llm import get_image_client
from ..core.utils import story_dir, ensure_dir


async def generate_image(prompt: str, story_id: str, size: str = "1024x1024") -> str:
    """Generate an image from a prompt via OpenAI, save it, and return its served URL path."""
    client = get_image_client()
    resp = await client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size=size,
        n=1,
    )
    data = base64.b64decode(resp.data[0].b64_json)

    assets_dir = ensure_dir(story_dir(story_id) / "assets")
    fname = f"{uuid4().hex}.png"
    (assets_dir / fname).write_bytes(data)

    return f"/media/stories/{story_id}/assets/{fname}"
