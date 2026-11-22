"""Pydantic schemas for LLM Evaluation Layer tasks (B4)."""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class T1FindingReviewResponse(BaseModel):
    concurrence: Literal["concurs", "dissents", "uncertain"] = Field(
        ..., description="Agreement with deterministic finding"
    )
    rationale: str = Field(..., description="Technical justification based strictly on provided snippet")
    cited_lines: list[int] = Field(
        default_factory=list, description="Line numbers within the snippet that justify the conclusion"
    )
    suggested_reclassification: Literal["Verified", "Inferred", "Assumed", "Unknown"] | None = Field(
        None, description="Suggested reclassification if dissenting"
    )


class T2ComponentReviewResponse(BaseModel):
    summary: str = Field(..., description="Summary of component purpose based on code")
    complexity_critique: str = Field(..., description="Evaluation of complexity factors")
    missing_aspects: list[str] = Field(
        default_factory=list, description="Architectural or operational aspects not captured"
    )
    cited_lines: list[int] = Field(
        default_factory=list, description="Line numbers within the snippet supporting critique"
    )


class T3RecommendationCritiqueResponse(BaseModel):
    critique: str = Field(..., description="Critique of proposed candidate hypothesis")
    alternative_options: list[str] = Field(
        default_factory=list, description="Alternative modernization options to evaluate"
    )
    risks: list[str] = Field(
        default_factory=list, description="Identified modernization risks"
    )
    cited_lines: list[int] = Field(
        default_factory=list, description="Line numbers within the snippet supporting critique"
    )


def validate_citations(cited_lines: list[int], start_line: int, end_line: int) -> bool:
    """Validate that every cited line is within [start_line, end_line] (inclusive).

    If cited_lines is empty, returns True (no false citations).
    """
    if not cited_lines:
        return True
    return all(start_line <= line <= end_line for line in cited_lines)
