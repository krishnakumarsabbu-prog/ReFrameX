"""VSAM/IDCAMS parser — FULL_EXTRACT.

Extracts: DEFINE CLUSTER/ALIAS/GDG, dataset names, KSDS/ESDS/RRDS where stated,
key length and record size where stated.
"""

from __future__ import annotations

import re
from typing import ClassVar

from app.parsers.base import (
    BaseParser, CapabilityLevel, EvidenceRef, NormalizedComponent,
    ParseResult, register_parser,
)
from app.parsers.preprocessor import PreprocessedLine


@register_parser
class VsamParser(BaseParser):
    name: ClassVar[str] = "vsam"
    version: ClassVar[str] = "3.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.FULL_EXTRACT
    supported_categories: ClassVar[list[str]] = ["VSAM"]

    def _language(self) -> str:
        return "generic"

    def _parse(self, artifact_id: str, filename: str,
               lines: list[PreprocessedLine], category: str) -> ParseResult:
        result = ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            capability=self.capability.value,
            parse_status="parsed",
        )

        # Join all code lines, removing continuation dashes
        code_lines = [l for l in lines if not l.is_comment and not l.is_blank]
        # Remove trailing continuation dashes and join
        cleaned: list[str] = []
        for l in code_lines:
            text = l.text.strip()
            # Remove trailing dash (IDCAMS continuation)
            if text.endswith("-"):
                text = text[:-1].strip()
            cleaned.append(text)
        full_text = " ".join(cleaned)

        # Remove any remaining standalone dashes from continuation
        full_text = re.sub(r"\s*-\s*", " ", full_text)

        # DEFINE CLUSTER/ALIAS/GDG with NAME(...)
        found_names: set[str] = set()
        for m in re.finditer(r"DEFINE\s+(CLUSTER|ALIAS|GDG).*?NAME\s*\(([^)]+)\)", full_text, re.IGNORECASE):
            define_type = m.group(1).upper()
            ds_name = m.group(2).strip()
            if ds_name not in found_names:
                found_names.add(ds_name)
                self._emit_vsam(artifact_id, ds_name, define_type, lines, full_text, result)

        return result

    def _emit_vsam(self, artifact_id: str, name: str, define_type: str,
                   lines: list[PreprocessedLine], full_text: str,
                   result: ParseResult) -> None:
        # Find the line where this appears
        start_line = 1
        end_line = lines[-1].line_no if lines else 1
        for line in lines:
            if name in line.text:
                start_line = line.line_no
                break
        props: dict[str, str] = {"define_type": define_type}
        # KSDS / ESDS / RRDS
        if re.search(r"\bKSDS\b", full_text, re.IGNORECASE):
            props["organization"] = "KSDS"
        elif re.search(r"\bESDS\b", full_text, re.IGNORECASE):
            props["organization"] = "ESDS"
        elif re.search(r"\bRRDS\b", full_text, re.IGNORECASE):
            props["organization"] = "RRDS"
        # INDEXED → KSDS
        if re.search(r"\bINDEXED\b", full_text, re.IGNORECASE):
            props["organization"] = "KSDS"
        # Key length
        m_keylen = re.search(r"KEYS\s*\((\d+)\s+(\d+)\)", full_text, re.IGNORECASE)
        if m_keylen:
            props["key_length"] = m_keylen.group(1)
            props["key_offset"] = m_keylen.group(2)
        # Record size
        m_recsz = re.search(r"RECORDSIZE\s*\((\d+)\s+(\d+)\)", full_text, re.IGNORECASE)
        if m_recsz:
            props["record_size_avg"] = m_recsz.group(1)
            props["record_size_max"] = m_recsz.group(2)
        result.components.append(NormalizedComponent(
            name=name,
            component_type="DATASET",
            technology="VSAM",
            source_artifact_id=artifact_id,
            line_start=start_line,
            line_end=end_line,
            detected_properties=props,
            evidence_class="Evidence-based",
            evidence_refs=[EvidenceRef(
                artifact_id=artifact_id,
                line_start=start_line,
                line_end=end_line,
                rule="VSAM_DEFINE",
                snippet=f"DEFINE {define_type} NAME({name})",
            )],
        ))
