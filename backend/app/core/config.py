from functools import lru_cache 
from pydantic_settings import BaseSettings, SettingsConfigDict 

class Settings(BaseSettings): 
    app_env: str
    ollama_base_url: str
    llm_model: str 
    embed_model: str 
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

