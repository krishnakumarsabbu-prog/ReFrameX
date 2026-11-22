"""Parser base classes, normalized records, and registry.

Each parser declares supported types, a version string, and a capability level.
Adding a parser requires only registering it — the engine discovers it via the
registry, no engine changes needed.
"""

from __future__ import annotations

import enum
import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import ClassVar

from app.parsers.preprocessor import PreprocessedLine, preprocess_text


class CapabilityLevel(enum.Enum):
    FULL_EXTRACT = "FULL_EXTRACT"
    PARTIAL_EXTRACT = "PARTIAL_EXTRACT"
    DETECT_ONLY = "DETECT_ONLY"


# Component type enum — used in normalized records and DB
COMPONENT_TYPES = [
    "PROGRAM", "MODULE", "COPYBOOK", "JOB", "PROC", "DATABASE", "TABLE",
    "FILE", "DATASET", "TRANSACTION", "MAP", "API", "MQ", "EXTERNAL_SYSTEM",
    "INTERFACE", "SECURITY_RESOURCE", "SCHEDULE", "UNKNOWN",
]

EVIDENCE_CLASSES = ["Evidence-based", "Inferred", "Assumed", "Unknown"]


@dataclass
class EvidenceRef:
    """A single piece of evidence backing a finding."""
    artifact_id: str
    line_start: int
    line_end: int
    rule: str
    snippet: str = ""


@dataclass
class NormalizedComponent:
    """A normalized component extracted from an artifact."""
    name: str
    component_type: str
    technology: str
    source_artifact_id: str
    line_start: int
    line_end: int
    detected_properties: dict[str, str] = field(default_factory=dict)
    evidence_class: str = "Evidence-based"
    evidence_refs: list[EvidenceRef] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def deterministic_id(
        self,
        application_id: str,
        artifact_relative_path: str = "",
        ordinal: int | None = None,
    ) -> str:
        """Stable deterministic component ID.
        Formula: sha256(app_id | component_type | normalized_name | artifact_relative_path | ordinal)[:16]
        Does NOT include artifact UUID or line numbers so that line shifts or re-uploads
        do not churn component identity.
        """
        path = (artifact_relative_path or self.detected_properties.get("relative_path") or "").strip().lower()
        norm_name = self.name.strip().upper()
        ord_val = int(ordinal if ordinal is not None else self.detected_properties.get("ordinal", 1))
        raw = f"{application_id}|{self.component_type}|{norm_name}|{path}|{ord_val}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


@dataclass
class ParseWarning:
    line: int
    code: str
    message: str


@dataclass
class ParseResult:
    """Output of a single parser run on one artifact."""
    parser_name: str
    parser_version: str
    capability: str
    components: list[NormalizedComponent] = field(default_factory=list)
    warnings: list[ParseWarning] = field(default_factory=list)
    unsupported_syntax: list[str] = field(default_factory=list)
    parse_status: str = "parsed"  # parsed, partial, detected, unsupported, error
    error: str | None = None


class BaseParser:
    """Base class for all parsers. Subclasses implement _parse()."""

    name: ClassVar[str] = "base"
    version: ClassVar[str] = "1.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.DETECT_ONLY
    supported_categories: ClassVar[list[str]] = []

    def parse(self, artifact_id: str, filename: str, content: bytes, category: str) -> ParseResult:
        """Parse artifact content and return normalized result."""
        try:
            text = self._decode(content)
            if text is None:
                return ParseResult(
                    parser_name=self.name,
                    parser_version=self.version,
                    capability=self.capability.value,
                    parse_status="unsupported",
                    error="Could not decode content as text",
                )
            lines = preprocess_text(text, self._language())
            res = self._parse(artifact_id, filename, lines, category)
            # Assign ordinals within file for each (component_type, normalized_name) (A6)
            counts: dict[tuple[str, str], int] = {}
            for comp in res.components:
                key = (comp.component_type, comp.name.strip().upper())
                counts[key] = counts.get(key, 0) + 1
                if "ordinal" not in comp.detected_properties:
                    comp.detected_properties["ordinal"] = str(counts[key])
            return res
        except Exception as exc:
            return ParseResult(
                parser_name=self.name,
                parser_version=self.version,
                capability=self.capability.value,
                parse_status="error",
                error=str(exc),
            )

    def _parse(self, artifact_id: str, filename: str, lines: list[PreprocessedLine], category: str) -> ParseResult:
        raise NotImplementedError

    def _language(self) -> str:
        """Hint for preprocessor: 'cobol', 'jcl', 'sql', 'asm', or 'generic'."""
        return "generic"

    def _decode(self, data: bytes) -> str | None:
        """Decode bytes to text. Returns None if not decodable."""
        for enc in ("utf-8", "latin-1", "cp037"):
            try:
                return data.decode(enc)
            except (UnicodeDecodeError, LookupError):
                continue
        return None

    @staticmethod
    def _strip_comments_and_blanks(lines: list[PreprocessedLine]) -> list[PreprocessedLine]:
        """Return only non-comment, non-blank lines."""
        return [l for l in lines if not l.is_comment and l.text.strip()]


# ---- Registry ----

_REGISTRY: dict[str, type[BaseParser]] = {}
_CATEGORY_MAP: dict[str, list[str]] = {}


def register_parser(parser_cls: type[BaseParser]) -> type[BaseParser]:
    """Register a parser class. Can be used as a decorator."""
    _REGISTRY[parser_cls.name] = parser_cls
    for cat in parser_cls.supported_categories:
        _CATEGORY_MAP.setdefault(cat, []).append(parser_cls.name)
    return parser_cls


def get_parser_for_category(category: str) -> BaseParser | None:
    """Return the best (highest-capability) parser for a category, or None."""
    names = _CATEGORY_MAP.get(category, [])
    if not names:
        return None
    # Sort by capability priority: FULL > PARTIAL > DETECT
    priority = {
        CapabilityLevel.FULL_EXTRACT: 3,
        CapabilityLevel.PARTIAL_EXTRACT: 2,
        CapabilityLevel.DETECT_ONLY: 1,
    }
    best = sorted(_REGISTRY[n] for n in names if n in _REGISTRY)  # noqa: F841 — wrong, fix below
    classes = [_REGISTRY[n] for n in names if n in _REGISTRY]
    classes.sort(key=lambda c: priority.get(c.capability, 0), reverse=True)
    if not classes:
        return None
    return classes[0]()


def list_parsers() -> list[dict[str, str]]:
    """Return metadata for all registered parsers."""
    return [
        {
            "name": cls.name,
            "version": cls.version,
            "capability": cls.capability.value,
            "supported_categories": ", ".join(cls.supported_categories),
        }
        for cls in _REGISTRY.values()
    ]


def clear_registry() -> None:
    """Clear the registry — used in tests."""
    _REGISTRY.clear()
    _CATEGORY_MAP.clear()
