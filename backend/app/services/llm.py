from openai import AsyncOpenAI
from agents import OpenAIChatCompletionsModel, set_tracing_disabled
from ..core.config import get_settings

def get_client():
    return AsyncOpenAI(base_url=get_settings().ollama_base_url, api_key="ollama")

def get_model(name: str | None = None) -> OpenAIChatCompletionsModel:
    settings = get_settings()
    model_name = name or settings.llm_model

    return OpenAIChatCompletionsModel(
        model=model_name,
        openai_client=get_client(),
    )

async def raw_chat(messages: list[dict], model: str | None = None,) -> str:
    client = get_client()
    response = await client.chat.completions.create(
        model=model or get_settings().llm_model,
        messages=messages,
    )

    return response.choices[0].message.content or ""