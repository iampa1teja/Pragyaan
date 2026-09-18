from pathlib import Path
from datetime import datetime, timezone
from agents import Agent, ModelSettings
from .config import get_settings
from ..services.llm import get_model

def load_prompt(name: str) -> str:
    path = Path("prompts") / f"{name}.txt"
    return path.read_text(encoding="utf-8")

def build_agent(name: str, prompt_file: str, tools: list | None = None, model=None) -> Agent:
    """Build an Agent with a configured model, prompt, and tools."""
    return Agent(
        name=name,
        instructions=load_prompt(prompt_file),
        model=model or get_model(),
        tools=tools or [],
        model_settings=ModelSettings(),
    )

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