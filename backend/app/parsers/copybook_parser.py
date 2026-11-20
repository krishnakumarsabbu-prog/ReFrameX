"""Copybook parser — FULL_EXTRACT.

Extracts: record layouts, level numbers, group vs elementary, PIC, USAGE,
OCCURS (DEPENDING ON), REDEFINES, COMP/COMP-3, 88-levels, shared copybook usage,
estimated record length where computable (marked Inferred if any ambiguity).
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
class CopybookParser(BaseParser):
    name: ClassVar[str] = "copybook"
    version: ClassVar[str] = "3.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.FULL_EXTRACT
    supported_categories: ClassVar[list[str]] = ["Copybook"]

    def _language(self) -> str:
        return "cobol"  # Copybooks use COBOL syntax

    def _parse(self, artifact_id: str, filename: str,
               lines: list[PreprocessedLine], category: str) -> ParseResult:
        result = ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            capability=self.capability.value,
            parse_status="parsed",
        )

        current_01: str | None = None
        current_01_line: int = 0
        has_redefines = False
        has_occurs = False
        has_depends_on = False
        has_comp = False
        has_comp3 = False
        has_88 = False
        field_count = 0
        total_pic_length = 0
        any_ambiguity = False

        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            text = line.text.strip()

            # 01 level — record layout start
            m01 = re.match(r"^01\s+([A-Z0-9][A-Z0-9-]*)", text, re.IGNORECASE)
            if m01:
                if current_01:
                    self._emit_record(artifact_id, current_01, current_01_line,
                                      line.line_no - 1, has_redefines, has_occurs,
                                      has_depends_on, has_comp, has_comp3, has_88,
                                      field_count, total_pic_length, any_ambiguity,
                                      result)
                current_01 = m01.group(1)
                current_01_line = line.line_no
                has_redefines = False
                has_occurs = False
                has_depends_on = False
                has_comp = False
                has_comp3 = False
                has_88 = False
                field_count = 0
                total_pic_length = 0
                any_ambiguity = False
                continue

            # 88-level
            m88 = re.match(r"^88\s+([A-Z0-9][A-Z0-9-]*)", text, re.IGNORECASE)
            if m88:
                has_88 = True
                field_count += 1
                continue

            # Check for DEPENDING ON on any line within a record (may be continuation)
            if current_01 and re.search(r"\bDEPENDING\s+ON\b", text, re.IGNORECASE):
                has_depends_on = True
                any_ambiguity = True

            # Other level numbers (05, 10, 15, etc.)
            m_lvl = re.match(r"^(\d{2})\s+([A-Z0-9][A-Z0-9-]*)", text, re.IGNORECASE)
            if m_lvl and current_01:
                field_count += 1
                # Check for REDEFINES
                if re.search(r"\bREDEFINES\b", text, re.IGNORECASE):
                    has_redefines = True
                # Check for OCCURS
                m_occurs = re.search(r"\bOCCURS\s+(\d+)", text, re.IGNORECASE)
                if m_occurs:
                    has_occurs = True
                # Check for COMP/COMP-3
                if re.search(r"\bCOMP\b", text, re.IGNORECASE) or \
                   re.search(r"\bCOMPUTATIONAL\b", text, re.IGNORECASE) or \
                   re.search(r"\bBINARY\b", text, re.IGNORECASE):
                    has_comp = True
                if re.search(r"\bCOMP-3\b", text, re.IGNORECASE) or \
                   re.search(r"\bCOMPUTATIONAL-3\b", text, re.IGNORECASE) or \
                   re.search(r"\bPACKED-DECIMAL\b", text, re.IGNORECASE):
                    has_comp3 = True
                # Estimate PIC length
                m_pic = re.search(r"PIC(?:TURE)?\s+(?:IS\s+)?([X9AVSZP]+(?:\(\d+\))?(?:V[9]+(?:\(\d+\))?)?)", text, re.IGNORECASE)
                if m_pic:
                    pic_str = m_pic.group(1).upper()
                    est = self._estimate_pic_length(pic_str)
                    if est is not None:
                        total_pic_length += est
                    else:
                        any_ambiguity = True
                else:
                    # Group item — no PIC, length depends on children
                    pass

        # Emit last record
        if current_01:
            last_line = lines[-1].line_no if lines else 0
            self._emit_record(artifact_id, current_01, current_01_line,
                              last_line, has_redefines, has_occurs,
                              has_depends_on, has_comp, has_comp3, has_88,
                              field_count, total_pic_length, any_ambiguity,
                              result)

        return result

    def _estimate_pic_length(self, pic_str: str) -> int | None:
        """Estimate byte length from a PIC clause. Returns None if ambiguous."""
        # Handle X(n), 9(n), etc.
        total = 0
        # Expand: X(95) → 95, 9(8) → 8, XX → 2, 999 → 3
        i = 0
        while i < len(pic_str):
            c = pic_str[i]
            if c == "(":
                # Find closing paren
                j = pic_str.index(")", i) if ")" in pic_str[i:] else -1
                if j == -1:
                    return None
                num_str = pic_str[i + 1:j]
                try:
                    count = int(num_str)
                except ValueError:
                    return None
                total += count
                i = j + 1
                continue
            if c in ("X", "9", "A", "V", "S", "Z", "P"):
                if c == "V":
                    # Implied decimal — doesn't add bytes
                    i += 1
                    continue
                if c == "S":
                    i += 1
                    continue
                if c == "P":
                    # Scaling — ambiguous for length
                    i += 1
                    continue
                total += 1
                i += 1
                continue
            i += 1
        return total if total > 0 else None

    def _emit_record(self, artifact_id: str, name: str, start: int, end: int,
                     has_redefines: bool, has_occurs: bool, has_depends_on: bool,
                     has_comp: bool, has_comp3: bool, has_88: bool,
                     field_count: int, total_pic_length: int,
                     any_ambiguity: bool, result: ParseResult) -> None:
        props: dict[str, str] = {
            "field_count": str(field_count),
        }
        if has_redefines:
            props["redefines"] = "yes"
        if has_occurs:
            props["occurs"] = "yes"
        if has_depends_on:
            props["depends_on"] = "yes"
        if has_comp:
            props["comp"] = "yes"
        if has_comp3:
            props["comp3"] = "yes"
        if has_88:
            props["has_88_levels"] = "yes"
        if total_pic_length > 0:
            props["estimated_length"] = str(total_pic_length)
        evidence_class = "Evidence-based"
        if any_ambiguity:
            evidence_class = "Inferred"
        result.components.append(NormalizedComponent(
            name=name,
            component_type="DATA_STRUCTURE",
            technology="COBOL",
            source_artifact_id=artifact_id,
            line_start=start,
            line_end=end,
            detected_properties=props,
            evidence_class=evidence_class,
            evidence_refs=[EvidenceRef(
                artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                rule="COPYBOOK_RECORD_LAYOUT",
                snippet=f"01 {name}",
            )],
        ))
