from pathlib import Path 
from datetime import datetime, timezone
from .config import get_settings 

def load_prompt(name: str) -> str:
    path = Path("prompts") / f"{name}.txt"
    return path.read_text(encoding="utf-8")

def data_dir() -> Path: 
    return  Path(get_settings().data_dir) 

def story_dir(story_id: str) -> Path:
    return data_dir() / "stories" / story_id

def ensure_dir(p: Path) -> Path:
    p.mkdir(parents=True, exist_ok=True)
    return p

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def slugify(s: str) -> str:
    return s.lower().replace(" ", "-")