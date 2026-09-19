from functools import lru_cache 
from pydantic_settings import BaseSettings, SettingsConfigDict 

class Settings(BaseSettings):
    app_env: str
    llm_provider: str = "ollama"   # "ollama" or "openai"
    openai_api_key: str = ""
    ollama_base_url: str
    llm_model: str
    embed_model: str
    vision_model: str = "qwen2.5vl:7b"
    # Fast secondary model for specialized sub-agents (offloads the heavy orchestrator)
    subagent_base_url: str = "http://localhost:11435/v1"
    subagent_model: str = "llama3.1:latest"
    chroma_path: str
    mongo_uri: str 
    mongo_db: str 
    data_dir: str 
    image_api_url: str = ""
    video_api_url: str = ""

    model_config = SettingsConfigDict(env_file = ".env")


@lru_cache
def get_settings() -> Settings:
    return Settings()

