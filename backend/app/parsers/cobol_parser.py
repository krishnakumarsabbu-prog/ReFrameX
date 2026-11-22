"""COBOL parser — FULL/PARTIAL_EXTRACT.

Extracts: program IDs, divisions, sections, paragraphs, COPY (with REPLACING),
CALL static vs dynamic, EXEC SQL (statements and table names), EXEC CICS
(commands, transactions, MAPs, LINK/XCTL, queues, files), EXEC DLI / CBLTDLI,
SELECT/ASSIGN/FD, working-storage structures, GOTO, PERFORM structures,
nesting depth, REDEFINES, OCCURS, COMP/COMP-3, missing copybooks, dynamic call
targets, ALTER and other legacy indicators.

This is static, regex/rule-based extraction — not full COBOL semantic compilation.
"""

from __future__ import annotations

import re
from typing import ClassVar

from app.parsers.base import (
    BaseParser, CapabilityLevel, EvidenceRef, NormalizedComponent,
    ParseResult, ParseWarning, register_parser,
)
from app.parsers.preprocessor import PreprocessedLine


@register_parser
class CobolParser(BaseParser):
    name: ClassVar[str] = "cobol"
    version: ClassVar[str] = "3.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.PARTIAL_EXTRACT
    supported_categories: ClassVar[list[str]] = ["COBOL"]

    def _language(self) -> str:
        return "cobol"

    def _parse(self, artifact_id: str, filename: str,
               lines: list[PreprocessedLine], category: str) -> ParseResult:
        result = ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            capability=self.capability.value,
            parse_status="parsed",
        )

        code_lines = [l for l in lines if not l.is_comment and not l.is_blank]
        full_text = " ".join(l.text.strip() for l in code_lines)

        # ---- Program ID ----
        self._extract_program_id(artifact_id, lines, result)

        # ---- Divisions ----
        self._extract_divisions(artifact_id, lines, result)

        # ---- Sections ----
        self._extract_sections(artifact_id, lines, result)

        # ---- Paragraphs ----
        self._extract_paragraphs(artifact_id, lines, result)

        # ---- COPY statements ----
        self._extract_copies(artifact_id, lines, result)

        # ---- CALL statements ----
        self._extract_calls(artifact_id, lines, result)

        # ---- EXEC SQL ----
        self._extract_exec_sql(artifact_id, lines, result)

        # ---- EXEC CICS ----
        self._extract_exec_cics(artifact_id, lines, result)

        # ---- EXEC DLI / CBLTDLI ----
        self._extract_dli(artifact_id, lines, result)

        # ---- SELECT/ASSIGN/FD ----
        self._extract_file_descriptions(artifact_id, lines, result)

        # ---- Working-storage structures ----
        self._extract_ws_structures(artifact_id, lines, result)

        # ---- GOTO ----
        self._extract_goto(artifact_id, lines, result)

        # ---- PERFORM structures ----
        self._extract_performs(artifact_id, lines, result)

        # ---- ALTER and legacy indicators ----
        self._extract_legacy(artifact_id, lines, result)

        return result

    # ---- Individual extractors ----

    def _extract_program_id(self, artifact_id: str, lines: list[PreprocessedLine],
                            result: ParseResult) -> None:
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            m = re.search(r"PROGRAM-ID\s*\.\s*([A-Z0-9][A-Z0-9-]*)", line.text, re.IGNORECASE)
            if m:
                prog_name = m.group(1).rstrip(".")
                result.components.append(NormalizedComponent(
                    name=prog_name,
                    component_type="PROGRAM",
                    technology="COBOL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="COBOL_PROGRAM_ID",
                        snippet=line.text.strip(),
                    )],
                ))
                return

    def _extract_divisions(self, artifact_id: str, lines: list[PreprocessedLine],
                           result: ParseResult) -> None:
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            m = re.search(r"(IDENTIFICATION|ENVIRONMENT|DATA|PROCEDURE)\s+DIVISION", line.text, re.IGNORECASE)
            if m:
                div_name = m.group(1).upper() + " DIVISION"
                result.components.append(NormalizedComponent(
                    name=div_name,
                    component_type="MODULE",
                    technology="COBOL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"division": div_name},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="COBOL_DIVISION",
                        snippet=line.text.strip(),
                    )],
                ))

    def _extract_sections(self, artifact_id: str, lines: list[PreprocessedLine],
                          result: ParseResult) -> None:
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            m = re.search(r"^\s*([A-Z0-9][A-Z0-9-]*)\s+SECTION\s*\.", line.text, re.IGNORECASE)
            if m:
                sec_name = m.group(1).upper() + " SECTION"
                result.components.append(NormalizedComponent(
                    name=sec_name,
                    component_type="MODULE",
                    technology="COBOL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"section": sec_name},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="COBOL_SECTION",
                        snippet=line.text.strip(),
                    )],
                ))

    def _extract_paragraphs(self, artifact_id: str, lines: list[PreprocessedLine],
                            result: ParseResult) -> None:
        # Paragraph: name in Area A followed by . (but not SECTION)
        paras: list[NormalizedComponent] = []
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            if line.area != "A":
                continue
            m = re.match(r"^\s*([A-Z0-9][A-Z0-9-]*)\s*\.\s*$", line.text, re.IGNORECASE)
            if m and "SECTION" not in line.text.upper():
                para_name = m.group(1).upper()
                if para_name in ("PROGRAM-ID", "AUTHOR", "INSTALLATION",
                                 "DATE-WRITTEN", "DATE-COMPILED", "SECURITY"):
                    continue
                paras.append(NormalizedComponent(
                    name=para_name,
                    component_type="MODULE",
                    technology="COBOL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"paragraph": para_name},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="COBOL_PARAGRAPH",
                        snippet=line.text.strip(),
                    )],
                ))
        para_count = len(paras)
        for p in paras:
            p.detected_properties["paragraph_count"] = str(para_count)
        result.components.extend(paras)

    def _extract_copies(self, artifact_id: str, lines: list[PreprocessedLine],
                        result: ParseResult) -> None:
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            m = re.search(r"COPY\s+([A-Z0-9][A-Z0-9._-]*)", line.text, re.IGNORECASE)
            if m:
                copy_name = m.group(1).rstrip(".")
                has_replacing = bool(re.search(r"\bREPLACING\b", line.text, re.IGNORECASE))
                props = {"copybook": copy_name}
                if has_replacing:
                    props["replacing"] = "yes"
                result.components.append(NormalizedComponent(
                    name=copy_name,
                    component_type="COPYBOOK",
                    technology="COBOL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties=props,
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="COBOL_COPY",
                        snippet=line.text.strip(),
                    )],
                ))

    def _find_literal_assignments_for_var(
        self, var_name: str, before_line_no: int, lines: list[PreprocessedLine]
    ) -> list[tuple[str, int, str]]:
        """Find literal values assigned to a variable prior to a line.
        Returns list of (literal_val, line_no, snippet). Ignores comments.
        """
        assignments = []
        var_upper = var_name.upper()

        for line in lines:
            if line.line_no >= before_line_no:
                break
            if line.is_comment or line.is_blank:
                continue

            # Check MOVE 'LITERAL' TO VAR / MOVE "LITERAL" TO VAR
            move_pattern = rf"\bMOVE\s+['\"]([A-Z0-9._-]+)['\"]\s+TO\s+([A-Z0-9_-]+)"
            for m in re.finditer(move_pattern, line.text, re.IGNORECASE):
                lit, target_var = m.group(1), m.group(2)
                if target_var.upper() == var_upper:
                    assignments.append((lit, line.line_no, line.text.strip()))

            # Check 01/05 VAR ... VALUE 'LITERAL'
            val_pattern = rf"\b[0-9]{{2}}\s+([A-Z0-9_-]+).*?\bVALUE\s+['\"]([A-Z0-9._-]+)['\"]"
            for m in re.finditer(val_pattern, line.text, re.IGNORECASE):
                target_var, lit = m.group(1), m.group(2)
                if target_var.upper() == var_upper:
                    assignments.append((lit, line.line_no, line.text.strip()))

        return assignments

    def _extract_calls(self, artifact_id: str, lines: list[PreprocessedLine],
                       result: ParseResult) -> None:
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            # Static CALL: CALL "PROGRAM" or CALL 'PROGRAM'
            for m in re.finditer(r'CALL\s+["\']([A-Z0-9][A-Z0-9._-]*)["\']', line.text, re.IGNORECASE):
                target = m.group(1)
                result.components.append(NormalizedComponent(
                    name=target,
                    component_type="PROGRAM",
                    technology="COBOL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"call_type": "static"},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="COBOL_CALL_STATIC",
                        snippet=line.text.strip(),
                    )],
                ))
            # Dynamic CALL: CALL WS-VAR or CALL variable-name (no quotes)
            for m in re.finditer(r"\bCALL\s+([A-Z][A-Z0-9-]*)", line.text, re.IGNORECASE):
                var_target = m.group(1)
                preceding = line.text[m.start(1) - 1:m.start(1)] if m.start(1) > 0 else ""
                if preceding in ('"', "'"):
                    continue  # Handled as static
                before = line.text[:m.start()]
                quote_count = before.count("'") + before.count('"')
                if quote_count % 2 == 1:
                    continue  # Inside a string literal

                # Search for preceding literal assignments to this variable (A5)
                assignments = self._find_literal_assignments_for_var(var_target, line.line_no, lines)

                if len(assignments) == 0:
                    # Unresolved dynamic call: Target is classification Unknown, rule UNRESOLVED_TARGET
                    result.components.append(NormalizedComponent(
                        name=var_target,
                        component_type="PROGRAM",
                        technology="COBOL",
                        source_artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        detected_properties={
                            "call_type": "dynamic_unresolved",
                            "target_variable": var_target,
                            "unresolved": "true",
                        },
                        evidence_class="Unknown",
                        evidence_refs=[EvidenceRef(
                            artifact_id=artifact_id,
                            line_start=line.line_no,
                            line_end=line.line_no,
                            rule="UNRESOLVED_TARGET",
                            snippet=line.text.strip(),
                        )],
                        warnings=[f"Unresolved dynamic CALL to variable {var_target} without literal assignment"],
                    ))
                elif len(assignments) == 1:
                    # Resolved by single literal: classification Inferred, NEVER Evidence-based.
                    # Evidence ref points to BOTH assignment line and CALL line.
                    lit_val, assign_line, assign_snip = assignments[0]
                    result.components.append(NormalizedComponent(
                        name=lit_val,
                        component_type="PROGRAM",
                        technology="COBOL",
                        source_artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        detected_properties={
                            "call_type": "dynamic_resolved",
                            "target_variable": var_target,
                            "resolved_target": lit_val,
                            "assignment_line": str(assign_line),
                        },
                        evidence_class="Inferred",
                        evidence_refs=[
                            EvidenceRef(
                                artifact_id=artifact_id,
                                line_start=assign_line,
                                line_end=assign_line,
                                rule="COBOL_DYNAMIC_CALL_ASSIGN",
                                snippet=assign_snip,
                            ),
                            EvidenceRef(
                                artifact_id=artifact_id,
                                line_start=line.line_no,
                                line_end=line.line_no,
                                rule="COBOL_CALL_DYNAMIC",
                                snippet=line.text.strip(),
                            ),
                        ],
                    ))
                else:
                    # Conflicting multiple MOVEs: keep all candidates, classification Inferred, flag ambiguity
                    candidates = list(dict.fromkeys(a[0] for a in assignments))
                    ev_refs = [
                        EvidenceRef(
                            artifact_id=artifact_id,
                            line_start=a[1],
                            line_end=a[1],
                            rule="COBOL_DYNAMIC_CALL_ASSIGN",
                            snippet=a[2],
                        ) for a in assignments
                    ]
                    ev_refs.append(EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="COBOL_CALL_DYNAMIC",
                        snippet=line.text.strip(),
                    ))

                    for lit_val in candidates:
                        result.components.append(NormalizedComponent(
                            name=lit_val,
                            component_type="PROGRAM",
                            technology="COBOL",
                            source_artifact_id=artifact_id,
                            line_start=line.line_no,
                            line_end=line.line_no,
                            detected_properties={
                                "call_type": "dynamic_resolved",
                                "target_variable": var_target,
                                "ambiguous": "true",
                                "candidate_targets": ",".join(candidates),
                            },
                            evidence_class="Inferred",
                            evidence_refs=ev_refs,
                            warnings=[f"Ambiguous dynamic CALL: multiple target candidates {candidates} for variable {var_target}"],
                        ))

    def _extract_exec_sql(self, artifact_id: str, lines: list[PreprocessedLine],
                          result: ParseResult) -> None:
        in_exec_sql = False
        start_line = 0
        sql_text: list[str] = []
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            if re.search(r"EXEC\s+SQL", line.text, re.IGNORECASE):
                in_exec_sql = True
                start_line = line.line_no
                sql_text = [line.text]
                continue
            if in_exec_sql:
                if re.search(r"END-EXEC", line.text, re.IGNORECASE):
                    sql_text.append(line.text)
                    full_sql = " ".join(sql_text)
                    # Extract statement type
                    stmt_type = "SQL"
                    for st in ("SELECT", "INSERT", "UPDATE", "DELETE", "MERGE",
                               "DECLARE", "FETCH", "OPEN", "CLOSE", "PREPARE",
                               "EXECUTE", "COMMIT", "ROLLBACK"):
                        if re.search(r"\b" + st + r"\b", full_sql, re.IGNORECASE):
                            stmt_type = st
                            break
                    # Extract table names (FROM, INTO, UPDATE, JOIN)
                    tables: list[str] = []
                    for m in re.finditer(r"\b(?:FROM|INTO|UPDATE|JOIN|TABLE)\s+([A-Z0-9_][A-Z0-9_.]*)", full_sql, re.IGNORECASE):
                        tables.append(m.group(1))
                    props: dict[str, str] = {"sql_statement": stmt_type}
                    if tables:
                        props["tables"] = ",".join(tables)
                    result.components.append(NormalizedComponent(
                        name=f"SQL-{stmt_type}",
                        component_type="TABLE",
                        technology="SQL",
                        source_artifact_id=artifact_id,
                        line_start=start_line,
                        line_end=line.line_no,
                        detected_properties=props,
                        evidence_class="Evidence-based",
                        evidence_refs=[EvidenceRef(
                            artifact_id=artifact_id,
                            line_start=start_line,
                            line_end=line.line_no,
                            rule="COBOL_EXEC_SQL",
                            snippet=" ".join(s.strip() for s in sql_text)[:200],
                        )],
                    ))
                    in_exec_sql = False
                    sql_text = []
                else:
                    sql_text.append(line.text)

    def _extract_exec_cics(self, artifact_id: str, lines: list[PreprocessedLine],
                           result: ParseResult) -> None:
        in_exec_cics = False
        start_line = 0
        cics_text: list[str] = []
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            if re.search(r"EXEC\s+CICS", line.text, re.IGNORECASE):
                in_exec_cics = True
                start_line = line.line_no
                cics_text = [line.text]
                continue
            if in_exec_cics:
                if re.search(r"END-EXEC", line.text, re.IGNORECASE):
                    cics_text.append(line.text)
                    full_cics = " ".join(cics_text)
                    # Extract CICS commands
                    commands: list[str] = []
                    for cmd in ("LINK", "XCTL", "RETURN", "READ", "WRITE",
                                "REWRITE", "DELETE", "START", "SEND", "RECEIVE",
                                "ENQ", "DEQ", "SYNCPOINT", "ASKTIME", "FORMATTIME",
                                "GETMAIN", "FREEMAIN", "READQ", "WRITEQ", "DELETEQ"):
                        if re.search(r"\b" + cmd + r"\b", full_cics, re.IGNORECASE):
                            commands.append(cmd)
                    # Extract transaction IDs
                    trans: list[str] = []
                    for m in re.finditer(r"TRANSID\s*\(([A-Z0-9]+)\)", full_cics, re.IGNORECASE):
                        trans.append(m.group(1))
                    # Extract MAP names
                    maps: list[str] = []
                    for m in re.finditer(r"MAP\s*\(([A-Z0-9]+)\)", full_cics, re.IGNORECASE):
                        maps.append(m.group(1))
                    # Extract file names
                    files: list[str] = []
                    for m in re.finditer(r"FILE\s*\(([A-Z0-9]+)\)", full_cics, re.IGNORECASE):
                        files.append(m.group(1))
                    props: dict[str, str] = {"cics_commands": ",".join(commands) if commands else "UNKNOWN"}
                    if trans:
                        props["transactions"] = ",".join(trans)
                    if maps:
                        props["maps"] = ",".join(maps)
                    if files:
                        props["files"] = ",".join(files)
                    result.components.append(NormalizedComponent(
                        name="CICS-CALL",
                        component_type="TRANSACTION",
                        technology="CICS",
                        source_artifact_id=artifact_id,
                        line_start=start_line,
                        line_end=line.line_no,
                        detected_properties=props,
                        evidence_class="Evidence-based",
                        evidence_refs=[EvidenceRef(
                            artifact_id=artifact_id,
                            line_start=start_line,
                            line_end=line.line_no,
                            rule="COBOL_EXEC_CICS",
                            snippet=" ".join(s.strip() for s in cics_text)[:200],
                        )],
                    ))
                    in_exec_cics = False
                    cics_text = []
                else:
                    cics_text.append(line.text)

    def _extract_dli(self, artifact_id: str, lines: list[PreprocessedLine],
                     result: ParseResult) -> None:
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            if re.search(r"EXEC\s+DLI", line.text, re.IGNORECASE) or \
               re.search(r"\bCBLTDLI\b", line.text, re.IGNORECASE):
                result.components.append(NormalizedComponent(
                    name="IMS-DLI-CALL",
                    component_type="EXTERNAL_SYSTEM",
                    technology="IMS",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"ims_indicator": "DLI"},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="COBOL_DLI_CALL",
                        snippet=line.text.strip(),
                    )],
                ))
                result.warnings.append(ParseWarning(
                    line=line.line_no,
                    code="IMS_DLI",
                    message="IMS DL/I call detected — requires specialist review",
                ))

    def _extract_file_descriptions(self, artifact_id: str, lines: list[PreprocessedLine],
                                   result: ParseResult) -> None:
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            # SELECT ... ASSIGN TO ...
            m = re.search(r"SELECT\s+([A-Z0-9][A-Z0-9-]*)\s+ASSIGN\s+TO\s+([A-Z0-9][A-Z0-9-]*)", line.text, re.IGNORECASE)
            if m:
                file_name = m.group(1)
                assign_name = m.group(2)
                org = ""
                org_m = re.search(r"ORGATION\s+IS\s+(\w+)", line.text, re.IGNORECASE)
                if org_m:
                    org = org_m.group(1).upper()
                else:
                    org_m2 = re.search(r"ORGANIZATION\s+IS\s+(\w+)", line.text, re.IGNORECASE)
                    if org_m2:
                        org = org_m2.group(1).upper()
                props = {"assign": assign_name}
                if org:
                    props["organization"] = org
                result.components.append(NormalizedComponent(
                    name=file_name,
                    component_type="FILE",
                    technology="COBOL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties=props,
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="COBOL_SELECT_ASSIGN",
                        snippet=line.text.strip(),
                    )],
                ))
            # FD entries
            m_fd = re.search(r"^\s*FD\s+([A-Z0-9][A-Z0-9-]*)", line.text, re.IGNORECASE)
            if m_fd:
                fd_name = m_fd.group(1)
                rec_m = re.search(r"RECORD\s+CONTAINS\s+(\d+)\s+CHARACTERS", line.text, re.IGNORECASE)
                props: dict[str, str] = {"fd": fd_name}
                if rec_m:
                    props["record_length"] = rec_m.group(1)
                result.components.append(NormalizedComponent(
                    name=fd_name,
                    component_type="FILE",
                    technology="COBOL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties=props,
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="COBOL_FD",
                        snippet=line.text.strip(),
                    )],
                ))

    def _extract_ws_structures(self, artifact_id: str, lines: list[PreprocessedLine],
                               result: ParseResult) -> None:
        in_ws = False
        in_file_section = False
        current_01: str | None = None
        current_01_line: int = 0
        current_section: str = ""
        has_redefines = False
        has_occurs = False
        has_comp = False
        has_comp3 = False
        occurs_count = ""
        occurs_max = 0
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            if re.search(r"WORKING-STORAGE\s+SECTION", line.text, re.IGNORECASE):
                if current_01:
                    self._emit_ws_component(artifact_id, current_01, current_01_line,
                                            line.line_no - 1, has_redefines, has_occurs,
                                            has_comp, has_comp3, occurs_count, result,
                                            current_section, occurs_max=occurs_max)
                in_ws = True
                in_file_section = False
                current_01 = None
                current_section = "WORKING-STORAGE"
                continue
            if re.search(r"FILE\s+SECTION", line.text, re.IGNORECASE):
                in_file_section = True
                in_ws = False
                current_01 = None
                current_section = "FILE"
                continue
            if re.search(r"(LINKAGE|PROCEDURE)\s+(SECTION|DIVISION)", line.text, re.IGNORECASE):
                if (in_ws or in_file_section) and current_01:
                    self._emit_ws_component(artifact_id, current_01, current_01_line,
                                            line.line_no - 1, has_redefines, has_occurs,
                                            has_comp, has_comp3, occurs_count, result,
                                            current_section, occurs_max=occurs_max)
                in_ws = False
                in_file_section = False
                current_01 = None
                continue
            if not in_ws and not in_file_section:
                continue
            # Detect 01 level
            m01 = re.match(r"^\s*01\s+([A-Z0-9][A-Z0-9-]*)", line.text, re.IGNORECASE)
            if m01:
                if current_01:
                    self._emit_ws_component(artifact_id, current_01, current_01_line,
                                            line.line_no - 1, has_redefines, has_occurs,
                                            has_comp, has_comp3, occurs_count, result,
                                            current_section, occurs_max=occurs_max)
                current_01 = m01.group(1)
                current_01_line = line.line_no
                has_redefines = False
                has_occurs = False
                has_comp = False
                has_comp3 = False
                occurs_count = ""
                occurs_max = 0
            if re.search(r"\bREDEFINES\b", line.text, re.IGNORECASE):
                has_redefines = True
            m_occ = re.search(r"\bOCCURS\s+(\d+)", line.text, re.IGNORECASE)
            if m_occ:
                has_occurs = True
                occurs_count = m_occ.group(1)
                try:
                    occurs_max = max(occurs_max, int(m_occ.group(1)))
                except ValueError:
                    pass
            if re.search(r"\bCOMP\b", line.text, re.IGNORECASE) or \
               re.search(r"\bCOMPUTATIONAL\b", line.text, re.IGNORECASE) or \
               re.search(r"\bBINARY\b", line.text, re.IGNORECASE):
                has_comp = True
            if re.search(r"\bCOMP-3\b", line.text, re.IGNORECASE) or \
               re.search(r"\bCOMPUTATIONAL-3\b", line.text, re.IGNORECASE) or \
               re.search(r"\bPACKED-DECIMAL\b", line.text, re.IGNORECASE):
                has_comp3 = True
        # Emit last structure
        if (in_ws or in_file_section) and current_01:
            last_line = lines[-1].line_no if lines else 0
            self._emit_ws_component(artifact_id, current_01, current_01_line,
                                    last_line, has_redefines, has_occurs,
                                    has_comp, has_comp3, occurs_count, result,
                                    current_section, occurs_max=occurs_max)

    def _emit_ws_component(self, artifact_id: str, name: str, start: int, end: int,
                           has_redefines: bool, has_occurs: bool, has_comp: bool,
                           has_comp3: bool, occurs_count: str,
                           result: ParseResult, section: str = "WORKING-STORAGE",
                           occurs_max: int = 0) -> None:
        props: dict[str, str] = {}
        if has_redefines:
            props["redefines"] = "yes"
        if has_occurs:
            props["occurs"] = occurs_count
            if occurs_max > 0:
                props["occurs_max"] = str(occurs_max)
        if has_comp:
            props["comp"] = "yes"
        if has_comp3:
            props["comp3"] = "yes"
        rule = "COBOL_WORKING_STORAGE" if section == "WORKING-STORAGE" else "COBOL_FD_RECORD"
        result.components.append(NormalizedComponent(
            name=name,
            component_type="DATA_STRUCTURE",
            technology="COBOL",
            source_artifact_id=artifact_id,
            line_start=start,
            line_end=end,
            detected_properties=props,
            evidence_class="Evidence-based",
            evidence_refs=[EvidenceRef(
                artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                rule=rule,
                snippet=f"01 {name}",
            )],
        ))

    def _extract_goto(self, artifact_id: str, lines: list[PreprocessedLine],
                      result: ParseResult) -> None:
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            if re.search(r"\bGO\s+TO\b", line.text, re.IGNORECASE) or \
               re.search(r"\bGOBACK\b", line.text, re.IGNORECASE):
                result.components.append(NormalizedComponent(
                    name="GOTO",
                    component_type="CONTROL_FLOW",
                    technology="COBOL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"legacy_indicator": "GOTO"},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="COBOL_GOTO",
                        snippet=line.text.strip(),
                    )],
                ))

    def _extract_performs(self, artifact_id: str, lines: list[PreprocessedLine],
                          result: ParseResult) -> None:
        depth = 0
        max_depth = 0
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            if re.search(r"\bPERFORM\b", line.text, re.IGNORECASE) and \
               not re.search(r"\bEND-PERFORM\b", line.text, re.IGNORECASE):
                depth += 1
                max_depth = max(max_depth, depth)
            if re.search(r"\bEND-PERFORM\b", line.text, re.IGNORECASE):
                depth = max(0, depth - 1)
        if max_depth > 0:
            result.components.append(NormalizedComponent(
                name="PERFORM",
                component_type="CONTROL_FLOW",
                technology="COBOL",
                source_artifact_id=artifact_id,
                line_start=1,
                line_end=lines[-1].line_no if lines else 1,
                detected_properties={"max_nesting_depth": str(max_depth)},
                evidence_class="Inferred",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=1,
                    line_end=lines[-1].line_no if lines else 1,
                    rule="COBOL_PERFORM_NESTING",
                    snippet=f"max nesting depth: {max_depth}",
                )],
            ))

    def _extract_legacy(self, artifact_id: str, lines: list[PreprocessedLine],
                        result: ParseResult) -> None:
        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            if re.search(r"\bALTER\b", line.text, re.IGNORECASE):
                result.components.append(NormalizedComponent(
                    name="ALTER",
                    component_type="CONTROL_FLOW",
                    technology="COBOL",
                    source_artifact_id=artifact_id,
                    line_start=line.line_no,
                    line_end=line.line_no,
                    detected_properties={"legacy_indicator": "ALTER"},
                    evidence_class="Evidence-based",
                    evidence_refs=[EvidenceRef(
                        artifact_id=artifact_id,
                        line_start=line.line_no,
                        line_end=line.line_no,
                        rule="COBOL_ALTER",
                        snippet=line.text.strip(),
                    )],
                ))
