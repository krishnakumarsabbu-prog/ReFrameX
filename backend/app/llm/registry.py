"""Provider registry and selector (B2)."""

from __future__ import annotations

from app.core.config import settings
from app.llm.base import LLMProvider
from app.llm.mock_provider import MockLLMProvider
from app.llm.openai_compatible import OpenAICompatibleProvider


def get_llm_provider(
    force_provider: str | None = None,
    allow_disabled_mock: bool = False,
) -> LLMProvider:
    """Return the configured LLMProvider.

    Raises RuntimeError if LLM is disabled and not using mock for testing.
    """
    provider_name = force_provider or settings.llm_provider

    if provider_name == "mock":
        return MockLLMProvider(model="mock-v1")

    if not settings.llm_enabled and not allow_disabled_mock:
        raise RuntimeError(
            "LLM Evaluation Layer is disabled. Set LLM_ENABLED=true in environment or use mock provider."
        )

    if provider_name == "openai_compatible":
        return OpenAICompatibleProvider()

    raise ValueError(f"Unknown LLM provider: {provider_name}")
