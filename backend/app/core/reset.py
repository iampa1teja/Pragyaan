"""Dev utility: wipe ALL StoryForge data (Mongo + Chroma + files).

Run from the backend directory:

    uv run python -m app.core.reset          # asks for confirmation
    uv run python -m app.core.reset --yes    # skip confirmation

Stop the backend server first, or Chroma files may be locked on Windows.
"""
import asyncio
import shutil
import sys
from pathlib import Path

if __package__:
    from .config import get_settings
    from .utils import data_dir
    from ..store import mongo
else:
    # Allow `python app/core/reset.py` when run from the backend directory.
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from app.core.config import get_settings
    from app.core.utils import data_dir
    from app.store import mongo

COLLECTIONS = ["stories", "chats", "assets", "entries", "users"]


def _rm(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)


async def reset_all() -> dict:
    """Delete every Mongo document, the Chroma store, and all story files."""
    db = mongo.get_db()
    counts = {}
    for name in COLLECTIONS:
        res = await db[name].delete_many({})
        counts[name] = res.deleted_count
    await mongo.close()

    settings = get_settings()
    _rm(Path(settings.chroma_path))     # vector store
    _rm(data_dir() / "stories")         # uploads + context.md + generated assets

    return counts


def main() -> None:
    if not any(flag in sys.argv for flag in ("--yes", "-y")):
        ans = input(
            "This DELETES all stories, chats, assets, entries and Chroma data. "
            "Type 'yes' to continue: "
        )
        if ans.strip().lower() != "yes":
            print("Aborted.")
            return

    counts = asyncio.run(reset_all())
    print("Database reset complete.")
    for name, n in counts.items():
        print(f"  {name}: {n} deleted")
    print("  chroma + data/stories: removed")


if __name__ == "__main__":
    main()
