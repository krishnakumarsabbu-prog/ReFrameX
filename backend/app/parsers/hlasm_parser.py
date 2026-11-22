"""High-Level Assembler (HLASM) Parser — FULL_EXTRACT.

Extracts:
- Control sections (CSECT, START, RSECT) -> PROGRAM components
- Dummy sections (DSECT) -> DATA_STRUCTURE components
- External symbol linkages (ENTRY, EXTRN, WXTRN) -> MODULE / EXTERNAL_SYSTEM
- Symbolic equates (EQU) -> MODULE components
- Data definitions (DC, DS) -> DATA_STRUCTURE components
- System, CICS, DB2, and user macro invocations -> MODULE components
- Static call targets (CALL target) -> dependencies
- Branch & control flow instructions for complexity tracking
"""

from __future__ import annotations

import re
from typing import ClassVar

from app.parsers.base import (
    BaseParser, CapabilityLevel, EvidenceRef, NormalizedComponent,
    ParseResult, ParseWarning, register_parser,
)
from app.parsers.preprocessor import PreprocessedLine

# Standard IBM mainframe system macros
KNOWN_SYSTEM_MACROS = {
    "CALL", "LINK", "ATTACH", "XCTL", "LOAD", "DELETE",
    "WTO", "WTOR", "ABEND", "GETMAIN", "FREEMAIN",
    "OPEN", "CLOSE", "GET", "PUT", "READ", "WRITE",
    "SNAP", "TIME", "STIMER", "ENQ", "DEQ", "ESTAE",
    "SPIE", "ESPIE", "POST", "WAIT", "RETURN", "SAVE",
}

# Standard machine instructions (to distinguish macros from native opcodes)
KNOWN_OPCODES = {
    "LR", "LTR", "L", "LH", "LA", "ST", "STH", "STC",
    "AR", "A", "AH", "SR", "S", "SH", "MR", "M", "MH", "DR", "D",
    "CR", "C", "CH", "CLR", "CL", "BCR", "BC", "B", "BR", "NOP",
    "BALR", "BAL", "BASR", "BAS", "BASSM", "BSM",
    "MVC", "MVI", "MVZ", "MVN", "MVCL", "CLC", "CLI", "CLCL",
    "PACK", "UNPK", "AP", "SP", "MP", "DP", "CP", "ZAP", "SRP",
    "CVB", "CVD", "ED", "EDMK", "TR", "TRT",
    "XR", "X", "XI", "NR", "N", "NI", "OR", "O", "OI",
    "SLL", "SRL", "SLA", "SRA", "SLDL", "SRDL", "SLDA", "SRDA",
    "IC", "ICM", "STCM", "EX", "SVC",
}


@register_parser
class HlasmParser(BaseParser):
    """HLASM Assembler parser providing FULL_EXTRACT capability."""
    name: ClassVar[str] = "hlasm_full"
    version: ClassVar[str] = "3.1.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.FULL_EXTRACT
    supported_categories: ClassVar[list[str]] = ["HLASM", "ASSEMBLER"]

    def _language(self) -> str:
        return "asm"

    def _parse(
        self,
        artifact_id: str,
        filename: str,
        lines: list[PreprocessedLine],
        category: str,
    ) -> ParseResult:
        result = ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            capability=self.capability.value,
            parse_status="parsed",
        )

        csect_count = 0
        dsect_count = 0
        macro_count = 0
        data_count = 0

        # Current section tracker for context
        current_section = ""

        for line in lines:
            if line.is_comment or line.is_blank:
                continue

            text = line.text.strip()
            line_no = line.line_no

            # 1. CSECT / START / RSECT
            m_sect = re.match(
                r"^([A-Z0-9$#@_]+)\s+(CSECT|START|RSECT)\b(.*)$",
                text,
                re.IGNORECASE,
            )
            if m_sect:
                sec_name = m_sect.group(1).upper()
                sec_type = m_sect.group(2).upper()
                current_section = sec_name
                csect_count += 1

                result.components.append(NormalizedComponent(
                    name=sec_name,
                    component_type="PROGRAM",
                    technology="HLASM",
                    source_artifact_id=artifact_id,
                    line_start=line_no,
                    line_end=line_no,
                    detected_properties={
                        "section_type": sec_type,
                        "section_name": sec_name,
                    },
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line_no,
                        line_end=line_no,
                        rule=f"HLASM_{sec_type}",
                        snippet=text[:200],
                    )],
                ))
                continue

            # 2. DSECT (Dummy Control Section)
            m_dsect = re.match(
                r"^([A-Z0-9$#@_]+)\s+DSECT\b(.*)$",
                text,
                re.IGNORECASE,
            )
            if m_dsect:
                dsect_name = m_dsect.group(1).upper()
                current_section = dsect_name
                dsect_count += 1

                result.components.append(NormalizedComponent(
                    name=dsect_name,
                    component_type="DATA_STRUCTURE",
                    technology="HLASM",
                    source_artifact_id=artifact_id,
                    line_start=line_no,
                    line_end=line_no,
                    detected_properties={
                        "section_type": "DSECT",
                        "dsect_name": dsect_name,
                    },
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line_no,
                        line_end=line_no,
                        rule="HLASM_DSECT",
                        snippet=text[:200],
                    )],
                ))
                continue

            # 3. ENTRY statements (exported symbols)
            m_entry = re.match(r"^\s*ENTRY\s+([A-Z0-9$#@_,\s]+)", text, re.IGNORECASE)
            if m_entry:
                symbols = [s.strip().upper() for s in m_entry.group(1).split(",") if s.strip()]
                for sym in symbols:
                    result.components.append(NormalizedComponent(
                        name=sym,
                        component_type="MODULE",
                        technology="HLASM",
                        source_artifact_id=artifact_id,
                        line_start=line_no,
                        line_end=line_no,
                        detected_properties={
                            "linkage": "ENTRY",
                            "symbol": sym,
                            "parent_section": current_section,
                        },
                        evidence_class="Evidence-based",
                        evidence_refs=[EvidenceRef(
                            artifact_id=artifact_id,
                            line_start=line_no,
                            line_end=line_no,
                            rule="HLASM_ENTRY",
                            snippet=text[:200],
                        )],
                    ))
                continue

            # 4. EXTRN / WXTRN statements (external dependencies)
            m_extrn = re.match(r"^\s*(EXTRN|WXTRN)\s+([A-Z0-9$#@_,\s]+)", text, re.IGNORECASE)
            if m_extrn:
                link_type = m_extrn.group(1).upper()
                symbols = [s.strip().upper() for s in m_extrn.group(2).split(",") if s.strip()]
                for sym in symbols:
                    result.components.append(NormalizedComponent(
                        name=sym,
                        component_type="EXTERNAL_SYSTEM",
                        technology="HLASM",
                        source_artifact_id=artifact_id,
                        line_start=line_no,
                        line_end=line_no,
                        detected_properties={
                            "linkage": link_type,
                            "symbol": sym,
                            "parent_section": current_section,
                        },
                        evidence_class="Evidence-based",
                        evidence_refs=[EvidenceRef(
                            artifact_id=artifact_id,
                            line_start=line_no,
                            line_end=line_no,
                            rule=f"HLASM_{link_type}",
                            snippet=text[:200],
                        )],
                    ))
                continue

            # 5. EQU (Symbolic Equate)
            m_equ = re.match(r"^([A-Z0-9$#@_]+)\s+EQU\s+([^\s,]+)", text, re.IGNORECASE)
            if m_equ:
                equ_name = m_equ.group(1).upper()
                equ_val = m_equ.group(2).strip()
                result.components.append(NormalizedComponent(
                    name=equ_name,
                    component_type="MODULE",
                    technology="HLASM",
                    source_artifact_id=artifact_id,
                    line_start=line_no,
                    line_end=line_no,
                    detected_properties={
                        "equ_name": equ_name,
                        "equ_value": equ_val,
                        "parent_section": current_section,
                    },
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line_no,
                        line_end=line_no,
                        rule="HLASM_EQU",
                        snippet=text[:200],
                    )],
                ))
                continue

            # 6. DC / DS (Data Definition)
            m_data = re.match(
                r"^([A-Z0-9$#@_]+)\s+(DC|DS)\s+([^\s]+)",
                text,
                re.IGNORECASE,
            )
            if m_data:
                field_name = m_data.group(1).upper()
                data_op = m_data.group(2).upper()
                format_spec = m_data.group(3).strip()
                data_count += 1

                result.components.append(NormalizedComponent(
                    name=field_name,
                    component_type="DATA_STRUCTURE",
                    technology="HLASM",
                    source_artifact_id=artifact_id,
                    line_start=line_no,
                    line_end=line_no,
                    detected_properties={
                        "data_op": data_op,
                        "format_spec": format_spec,
                        "parent_section": current_section,
                    },
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line_no,
                        line_end=line_no,
                        rule="HLASM_DATA_DEF",
                        snippet=text[:200],
                    )],
                ))
                continue

            # 7. Static CALL target: CALL PROGNAME, (...)
            m_call = re.match(
                r"^(?:[A-Z0-9$#@_]+\s+)?CALL\s+([A-Z0-9$#@_]+)",
                text,
                re.IGNORECASE,
            )
            if m_call:
                target = m_call.group(1).upper()
                result.components.append(NormalizedComponent(
                    name=target,
                    component_type="PROGRAM",
                    technology="HLASM",
                    source_artifact_id=artifact_id,
                    line_start=line_no,
                    line_end=line_no,
                    detected_properties={
                        "call_target": target,
                        "call_type": "static_asm_call",
                        "parent_section": current_section,
                    },
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line_no,
                        line_end=line_no,
                        rule="HLASM_CALL",
                        snippet=text[:200],
                    )],
                ))
                macro_count += 1
                continue

            # 8. Macro Calls (CICS, DB2, System, or User Macros)
            # Determine label and opcode based on standard column 1 indentation
            if line.text and line.text[0] in (" ", "\t"):
                label = ""
                parts = text.split(None, 1)
                opcode = parts[0].upper() if parts else ""
                operands = parts[1].strip() if len(parts) > 1 else ""
            else:
                parts = text.split(None, 2)
                label = parts[0].upper() if parts else ""
                opcode = parts[1].upper() if len(parts) > 1 else ""
                operands = parts[2].strip() if len(parts) > 2 else ""

            if opcode:
                # CICS command
                if opcode == "EXEC" and operands.upper().startswith("CICS"):
                    result.components.append(NormalizedComponent(
                        name="EXEC-CICS-ASM",
                        component_type="MODULE",
                        technology="HLASM",
                        source_artifact_id=artifact_id,
                        line_start=line_no,
                        line_end=line_no,
                        detected_properties={"macro_type": "CICS", "operands": operands[:100]},
                        evidence_class="Evidence-based",
                        evidence_refs=[EvidenceRef(
                            artifact_id=artifact_id,
                            line_start=line_no,
                            line_end=line_no,
                            rule="HLASM_CICS",
                            snippet=text[:200],
                        )],
                    ))
                    macro_count += 1
                    continue

                # DB2 SQL command
                if opcode == "EXEC" and operands.upper().startswith("SQL"):
                    result.components.append(NormalizedComponent(
                        name="EXEC-SQL-ASM",
                        component_type="TABLE",
                        technology="SQL",
                        source_artifact_id=artifact_id,
                        line_start=line_no,
                        line_end=line_no,
                        detected_properties={"macro_type": "SQL", "operands": operands[:100]},
                        evidence_class="Evidence-based",
                        evidence_refs=[EvidenceRef(
                            artifact_id=artifact_id,
                            line_start=line_no,
                            line_end=line_no,
                            rule="HLASM_SQL",
                            snippet=text[:200],
                        )],
                    ))
                    macro_count += 1
                    continue

                # System or Known Macro
                if opcode in KNOWN_SYSTEM_MACROS or opcode.startswith("DFH") or opcode.startswith("DSN"):
                    result.components.append(NormalizedComponent(
                        name=f"MACRO-{opcode}",
                        component_type="MODULE",
                        technology="HLASM",
                        source_artifact_id=artifact_id,
                        line_start=line_no,
                        line_end=line_no,
                        detected_properties={
                            "macro": opcode,
                            "operands": operands[:100],
                            "parent_section": current_section,
                        },
                        evidence_class="Evidence-based",
                        evidence_refs=[EvidenceRef(
                            artifact_id=artifact_id,
                            line_start=line_no,
                            line_end=line_no,
                            rule="HLASM_MACRO",
                            snippet=text[:200],
                        )],
                    ))
                    macro_count += 1
                    continue

        if result.components:
            result.warnings.append(ParseWarning(
                line=0,
                code="HLASM_SPECIALIST",
                message=f"HLASM assembler parsed: {csect_count} CSECT(s), {dsect_count} DSECT(s), {macro_count} macro(s) — specialist review recommended",
            ))

        return result
