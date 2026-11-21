"""AnalysisAssistant — optional AI-assistance extension point.

The default product is fully deterministic and rules-based, with zero outbound
network calls. This interface defines an extension point for optional AI
assistance. The NoOp implementation is the default and is always disabled in
configuration.

Rules:
- Only local or explicitly approved endpoints from an allowlist; no public AI services.
- No outbound network calls by default.
- Any AI output is stored as classification Inferred with generated_by, model
  name/version, and prompt hash.
- AI output never changes scores or recommendations until a human confirms it.
- The UI shows an 'AI-assisted (Inferred)' badge for any AI-derived content.

Endevor constraint: source in Endevor SCM must be replicated to an approved Git
repository before approved AI tools may use it. This is documented in
docs/AUTOMATION_MODEL.md.
"""

from __future__ import annotations

import abc
import hashlib
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AIAssistanceResult:
    """Result of an AI-assisted analysis operation."""
    content: str
    classification: str = "Inferred"
    generated_by: str = "AI-assistant"
    model_name: str = ""
    model_version: str = ""
    prompt_hash: str = ""
    confirmed: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


class AnalysisAssistant(abc.ABC):
    """Abstract interface for optional AI-assisted analysis.

    The default implementation is NoOpAnalysisAssistant, which does nothing
    and makes no network calls. This interface is an extension point only.
    """

    @abc.abstractmethod
    def is_enabled(self) -> bool:
        """Return True if AI assistance is enabled."""
        ...

    @abc.abstractmethod
    def analyze_finding(self, finding_data: dict, prompt: str) -> AIAssistanceResult | None:
        """Analyze a finding with AI assistance. Returns None if disabled."""
        ...

    @abc.abstractmethod
    def suggest_refactoring_pattern(self, component_data: dict, prompt: str) -> AIAssistanceResult | None:
        """Suggest a refactoring pattern hypothesis. Returns None if disabled."""
        ...

    @abc.abstractmethod
    def get_allowlist(self) -> list[str]:
        """Return the allowlist of approved endpoints. Empty by default."""
        ...


class NoOpAnalysisAssistant(AnalysisAssistant):
    """Default no-operation implementation. Disabled, no network calls."""

    def is_enabled(self) -> bool:
        return False

    def analyze_finding(self, finding_data: dict, prompt: str) -> AIAssistanceResult | None:
        return None

    def suggest_refactoring_pattern(self, component_data: dict, prompt: str) -> AIAssistanceResult | None:
        return None

    def get_allowlist(self) -> list[str]:
        return []


def _compute_prompt_hash(prompt: str) -> str:
    """Compute a SHA-256 hash of a prompt for audit trail."""
    return hashlib.sha256(prompt.encode()).hexdigest()[:16]


# Default instance — always disabled
default_assistant: AnalysisAssistant = NoOpAnalysisAssistant()


def get_assistant() -> AnalysisAssistant:
    """Get the configured AnalysisAssistant instance. Default is NoOp (disabled)."""
    return default_assistant
