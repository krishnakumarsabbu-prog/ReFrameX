"""BMS/3270 map parser — FULL_EXTRACT.

Extracts: mapsets (DFHMSD), maps (DFHMDI), fields (DFHMDF), field attributes,
and links from programs that reference the map.
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
class BmsParser(BaseParser):
    name: ClassVar[str] = "bms"
    version: ClassVar[str] = "3.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.FULL_EXTRACT
    supported_categories: ClassVar[list[str]] = ["BMS"]

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

        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            text = line.text.strip()

            # DFHMSD — mapset definition
            m_msd = re.search(r"(\S+)\s+DFHMSD\b", text)
            if m_msd:
                mapset_name = m_msd.group(1)
                props: dict[str, str] = {}
                # TYPE
                m_type = re.search(r"TYPE=(\S+)", text)
                if m_type:
                    props["type"] = m_type.group(1).rstrip(",")
                # MODE
                m_mode = re.search(r"MODE=(\S+)", text)
                if m_mode:
                    props["mode"] = m_mode.group(1).rstrip(",")
                # LANG
                m_lang = re.search(r"LANG=(\S+)", text)
                if m_lang:
                    props["lang"] = m_lang.group(1).rstrip(",")
                # Check for TYPE=FINAL
                if "TYPE=FINAL" in text.upper():
                    props["final"] = "yes"
                result.components.append(NormalizedComponent(
                    name=mapset_name,
                    component_type="MAP",
                    technology="BMS",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties=props,
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="BMS_DFHMSD",
                        snippet=text[:200],
                    )],
                ))
                continue

            # DFHMDI — map definition
            m_mdi = re.search(r"(\S+)\s+DFHMDI\b", text)
            if m_mdi:
                map_name = m_mdi.group(1)
                props: dict[str, str] = {}
                m_size = re.search(r"SIZE=\((\d+),(\d+)\)", text)
                if m_size:
                    props["size"] = f"{m_size.group(1)}x{m_size.group(2)}"
                m_line = re.search(r"LINE=(\d+)", text)
                if m_line:
                    props["line"] = m_line.group(1)
                m_col = re.search(r"COLUMN=(\d+)", text)
                if m_col:
                    props["column"] = m_col.group(1)
                result.components.append(NormalizedComponent(
                    name=map_name,
                    component_type="MAP",
                    technology="BMS",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties=props,
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="BMS_DFHMDI",
                        snippet=text[:200],
                    )],
                ))
                continue

            # DFHMDF — field definition
            # Format: [name] DFHMDF POS=(r,c), ATTRB=..., LENGTH=n, INITIAL='...'
            m_mdf = re.search(r"(\S+)?\s*DFHMDF\b", text)
            if m_mdf:
                field_name = m_mdf.group(1) if m_mdf.group(1) else "UNNAMED"
                # Skip if the "name" is actually DFHMDF itself
                if field_name.upper() == "DFHMDF":
                    field_name = "UNNAMED"
                props: dict[str, str] = {}
                m_pos = re.search(r"POS=\((\d+),(\d+)\)", text)
                if m_pos:
                    props["pos"] = f"({m_pos.group(1)},{m_pos.group(2)})"
                m_attr = re.search(r"ATTRB=\(([^)]+)\)", text)
                if m_attr:
                    props["attrb"] = m_attr.group(1)
                m_len = re.search(r"LENGTH=(\d+)", text)
                if m_len:
                    props["length"] = m_len.group(1)
                m_init = re.search(r"INITIAL=['\"]([^'\"]*)['\"]", text)
                if m_init:
                    props["initial"] = m_init.group(1)
                result.components.append(NormalizedComponent(
                    name=field_name,
                    component_type="MAP",
                    technology="BMS",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties=props,
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="BMS_DFHMDF",
                        snippet=text[:200],
                    )],
                ))
                continue

        return result
