from openai import AsyncOpenAI
from agents import OpenAIChatCompletionsModel, set_tracing_disabled
from ..core.config import get_settings

def _client(base_url: str) -> AsyncOpenAI:
    # Generous timeout for slow local models, but finite + few retries so a
    # dropped SSH tunnel / dead Ollama fails fast instead of hanging forever.
    return AsyncOpenAI(base_url=base_url, api_key="ollama", timeout=300.0, max_retries=1)


def get_client():
    """Primary endpoint (orchestrator, context agent, embeddings)."""
    return _client(get_settings().ollama_base_url)


def get_subagent_client():
    """Fast secondary endpoint for specialized sub-agents."""
    return _client(get_settings().subagent_base_url)


def get_model(name: str | None = None) -> OpenAIChatCompletionsModel:
    settings = get_settings()
    return OpenAIChatCompletionsModel(
        model=name or settings.llm_model,
        openai_client=get_client(),
    )


def get_subagent_model(name: str | None = None) -> OpenAIChatCompletionsModel:
    settings = get_settings()
    return OpenAIChatCompletionsModel(
        model=name or settings.subagent_model,
        openai_client=get_subagent_client(),
    )

async def raw_chat(messages: list[dict], model: str | None = None,) -> str:
    client = get_client()
    response = await client.chat.completions.create(
        model=model or get_settings().llm_model,
        messages=messages,
    )

    return response.choices[0].message.content or ""