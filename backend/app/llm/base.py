"""Abstract base class for LLM providers (B2)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel


class LLMProvider(ABC):
    """Abstract interface for LLM inference providers."""

    @abstractmethod
    def evaluate(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel] | None = None,
    ) -> dict[str, Any]:
        """Send prompt to LLM and return parsed response dictionary."""
        pass

    @abstractmethod
    def ping(self) -> dict[str, Any]:
        """Health check and connectivity validation."""
        pass
