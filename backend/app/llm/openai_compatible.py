"""OpenAI-compatible inference provider (B2).

Works with Groq, Ollama, vLLM, OpenAI, and other standard completions endpoints.
Includes host allowlist enforcement, timeouts, and exponential backoff retries.
"""

from __future__ import annotations

import json
import time
from urllib.parse import urlparse
from typing import Any
import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.llm.base import LLMProvider


class OpenAICompatibleProvider(LLMProvider):
    """OpenAI-compatible chat completion provider."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        allowed_hosts: tuple[str, ...] | None = None,
        timeout_seconds: float | None = None,
        max_retries: int | None = None,
    ):
        self.base_url = (base_url or settings.llm_base_url).rstrip("/")
        self.api_key = api_key or settings.llm_api_key
        self.model = model or settings.llm_model
        self.allowed_hosts = allowed_hosts or settings.llm_allowed_hosts
        self.timeout_seconds = timeout_seconds or settings.llm_timeout_seconds
        self.max_retries = max_retries or settings.llm_max_retries

        self._validate_host()

    def _validate_host(self) -> None:
        """Validate that target base_url host is in allowed hosts."""
        parsed = urlparse(self.base_url)
        host = parsed.hostname or ""
        if host not in self.allowed_hosts and not any(host.endswith("." + h) for h in self.allowed_hosts):
            raise ValueError(
                f"LLM host '{host}' is not in allowed hosts list: {self.allowed_hosts}. Access blocked."
            )

    def ping(self) -> dict[str, Any]:
        """Test provider connectivity and return latency."""
        self._validate_host()
        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5,
        }

        start = time.perf_counter()
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(url, headers=headers, json=payload)
                res.raise_for_status()
            elapsed_ms = (time.perf_counter() - start) * 1000
            return {
                "status": "healthy",
                "provider": "openai_compatible",
                "model": self.model,
                "latency_ms": round(elapsed_ms, 2),
                "base_url": self.base_url,
            }
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start) * 1000
            return {
                "status": "unhealthy",
                "provider": "openai_compatible",
                "model": self.model,
                "latency_ms": round(elapsed_ms, 2),
                "error": str(e),
                "base_url": self.base_url,
            }

    def evaluate(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel] | None = None,
    ) -> dict[str, Any]:
        """Execute chat completion with retries and return parsed JSON."""
        self._validate_host()

        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }

        last_err: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout_seconds) as client:
                    res = client.post(url, headers=headers, json=payload)
                    res.raise_for_status()
                    data = res.json()
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)

                    if response_schema is not None:
                        validated = response_schema.model_validate(parsed)
                        return validated.model_dump()
                    return parsed
            except (httpx.HTTPError, json.JSONDecodeError, ValidationError, KeyError) as e:
                last_err = e
                if attempt < self.max_retries:
                    time.sleep(1.0 * (2 ** attempt))

        raise RuntimeError(f"LLM inference failed after {self.max_retries + 1} attempts: {last_err}")
