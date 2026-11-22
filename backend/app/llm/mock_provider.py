"""Deterministic offline mock provider for testing (B2, B9).

Guarantees 100% offline testing with reproducible, valid responses.
"""

from __future__ import annotations

import re
import time
from typing import Any
from pydantic import BaseModel

from app.llm.base import LLMProvider
from app.llm.schemas import (
    T1FindingReviewResponse,
    T2ComponentReviewResponse,
    T3RecommendationCritiqueResponse,
)


class MockLLMProvider(LLMProvider):
    """Deterministic offline provider."""

    def __init__(self, model: str = "mock-model-v1"):
        self.model = model

    def ping(self) -> dict[str, Any]:
        return {
            "status": "healthy",
            "provider": "mock",
            "model": self.model,
            "latency_ms": 1.0,
            "message": "Mock provider operational (offline mode)",
        }

    def evaluate(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: type[BaseModel] | None = None,
    ) -> dict[str, Any]:
        # Extract snippet line range if present in prompt to cite valid lines
        range_match = re.search(r"Snippet Line Range:\s*lines\s*(\d+)\s*to\s*(\d+)", user_prompt)
        start_line = int(range_match.group(1)) if range_match else 1
        end_line = int(range_match.group(2)) if range_match else 10
        mid_line = start_line + max(0, (end_line - start_line) // 2)

        # Planted false-positive detection trigger
        is_planted_fp = "PLANTED_FALSE_POSITIVE" in user_prompt

        if response_schema is T1FindingReviewResponse:
            if is_planted_fp:
                resp = T1FindingReviewResponse(
                    concurrence="dissents",
                    rationale="Analysis of snippet reveals this is a benign test pattern or false positive.",
                    cited_lines=[mid_line],
                    suggested_reclassification="Inferred",
                )
            else:
                resp = T1FindingReviewResponse(
                    concurrence="concurs",
                    rationale="Deterministic finding is corroborated by procedural logic in snippet.",
                    cited_lines=[mid_line],
                    suggested_reclassification=None,
                )
            return resp.model_dump()

        elif response_schema is T2ComponentReviewResponse:
            resp = T2ComponentReviewResponse(
                summary="Component performs core business calculations and file I/O operations.",
                complexity_critique="Structural branching and call patterns align with detected complexity score.",
                missing_aspects=["EBCDIC record alignment", "implicit error status handling"],
                cited_lines=[mid_line],
            )
            return resp.model_dump()

        elif response_schema is T3RecommendationCritiqueResponse:
            resp = T3RecommendationCritiqueResponse(
                critique="Candidate hypothesis is viable assuming external dependencies are decoupled.",
                alternative_options=[
                    "Containerized microservice on OpenShift",
                    "Modular refactoring in place",
                    "Batch processing extraction",
                ],
                risks=["Coupling with shared copybook layouts", "State persistence latency"],
                cited_lines=[mid_line],
            )
            return resp.model_dump()

        return {
            "status": "success",
            "mock": True,
            "cited_lines": [mid_line],
        }
