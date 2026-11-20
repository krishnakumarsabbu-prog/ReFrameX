"""SQL/DDL parser — FULL_EXTRACT.

Extracts: SELECT, INSERT, UPDATE, DELETE, MERGE, CREATE TABLE/INDEX/VIEW/
TRIGGER/PROCEDURE, table references, procedure calls, program association.
"""

from __future__ import annotations

import re
from typing import ClassVar

from app.parsers.base import (
    BaseParser, CapabilityLevel, EvidenceRef, NormalizedComponent,
    ParseResult, register_parser,
)
from app.parsers.preprocessor import PreprocessedLine


_STMT_TYPES = {
    "SELECT": "QUERY",
    "INSERT": "INSERT",
    "UPDATE": "UPDATE",
    "DELETE": "DELETE",
    "MERGE": "MERGE",
    "CREATE": "DDL",
    "ALTER": "DDL",
    "DROP": "DDL",
    "CALL": "PROC_CALL",
}


@register_parser
class SqlParser(BaseParser):
    name: ClassVar[str] = "sql"
    version: ClassVar[str] = "3.0.0"
    capability: ClassVar[CapabilityLevel] = CapabilityLevel.FULL_EXTRACT
    supported_categories: ClassVar[list[str]] = ["SQL"]

    def _language(self) -> str:
        return "sql"

    def _parse(self, artifact_id: str, filename: str,
               lines: list[PreprocessedLine], category: str) -> ParseResult:
        result = ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            capability=self.capability.value,
            parse_status="parsed",
        )

        # Join all non-comment lines into a single stream, tracking line numbers
        stmts = self._split_statements(lines)

        for stmt_text, start_line, end_line in stmts:
            self._process_statement(artifact_id, stmt_text, start_line, end_line, result)

        return result

    def _split_statements(self, lines: list[PreprocessedLine]) -> list[tuple[str, int, int]]:
        """Split SQL into individual statements, preserving line numbers."""
        statements: list[tuple[str, int, int]] = []
        current_text: list[str] = []
        current_start: int | None = None

        for line in lines:
            if line.is_comment or line.is_blank:
                continue
            if current_start is None:
                current_start = line.line_no
            current_text.append(line.text.strip())

            # Check for statement terminator
            if line.text.rstrip().endswith(";"):
                full = " ".join(current_text)
                statements.append((full, current_start, line.line_no))
                current_text = []
                current_start = None

        # Handle last statement without semicolon
        if current_text:
            full = " ".join(current_text)
            last_line = lines[-1].line_no if lines else 0
            statements.append((full, current_start or 1, last_line))

        return statements

    def _process_statement(self, artifact_id: str, stmt: str,
                           start: int, end: int, result: ParseResult) -> None:
        stmt_upper = stmt.upper().strip()

        # CREATE TABLE
        m = re.search(r"CREATE\s+TABLE\s+([A-Z0-9_][A-Z0-9_.]*)", stmt, re.IGNORECASE)
        if m:
            table_name = m.group(1)
            result.components.append(NormalizedComponent(
                name=table_name,
                component_type="TABLE",
                technology="SQL",
                source_artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                detected_properties={"statement": "CREATE TABLE"},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=start,
                    line_end=end,
                    rule="SQL_CREATE_TABLE",
                    snippet=stmt[:200],
                )],
            ))
            return

        # CREATE INDEX
        m = re.search(r"CREATE\s+(?:UNIQUE\s+)?INDEX\s+([A-Z0-9_][A-Z0-9_.]*)\s+ON\s+([A-Z0-9_][A-Z0-9_.]*)", stmt, re.IGNORECASE)
        if m:
            index_name = m.group(1)
            table_name = m.group(2)
            result.components.append(NormalizedComponent(
                name=index_name,
                component_type="TABLE",
                technology="SQL",
                source_artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                detected_properties={"statement": "CREATE INDEX", "table": table_name},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=start,
                    line_end=end,
                    rule="SQL_CREATE_INDEX",
                    snippet=stmt[:200],
                )],
            ))
            return

        # CREATE VIEW
        m = re.search(r"CREATE\s+VIEW\s+([A-Z0-9_][A-Z0-9_.]*)", stmt, re.IGNORECASE)
        if m:
            view_name = m.group(1)
            result.components.append(NormalizedComponent(
                name=view_name,
                component_type="TABLE",
                technology="SQL",
                source_artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                detected_properties={"statement": "CREATE VIEW"},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=start,
                    line_end=end,
                    rule="SQL_CREATE_VIEW",
                    snippet=stmt[:200],
                )],
            ))
            return

        # CREATE TRIGGER
        m = re.search(r"CREATE\s+TRIGGER\s+([A-Z0-9_][A-Z0-9_.]*)", stmt, re.IGNORECASE)
        if m:
            trigger_name = m.group(1)
            result.components.append(NormalizedComponent(
                name=trigger_name,
                component_type="EXTERNAL_SYSTEM",
                technology="SQL",
                source_artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                detected_properties={"statement": "CREATE TRIGGER"},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=start,
                    line_end=end,
                    rule="SQL_CREATE_TRIGGER",
                    snippet=stmt[:200],
                )],
            ))
            return

        # CREATE PROCEDURE
        m = re.search(r"CREATE\s+PROCEDURE\s+([A-Z0-9_][A-Z0-9_.]*)", stmt, re.IGNORECASE)
        if m:
            proc_name = m.group(1)
            result.components.append(NormalizedComponent(
                name=proc_name,
                component_type="EXTERNAL_SYSTEM",
                technology="SQL",
                source_artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                detected_properties={"statement": "CREATE PROCEDURE"},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=start,
                    line_end=end,
                    rule="SQL_CREATE_PROCEDURE",
                    snippet=stmt[:200],
                )],
            ))
            return

        # CALL
        m = re.search(r"CALL\s+([A-Z0-9_][A-Z0-9_.]*)", stmt, re.IGNORECASE)
        if m:
            proc_name = m.group(1)
            result.components.append(NormalizedComponent(
                name=proc_name,
                component_type="EXTERNAL_SYSTEM",
                technology="SQL",
                source_artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                detected_properties={"statement": "CALL"},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=start,
                    line_end=end,
                    rule="SQL_CALL",
                    snippet=stmt[:200],
                )],
            ))
            return

        # SELECT
        if re.match(r"SELECT\b", stmt_upper):
            tables: list[str] = []
            for m in re.finditer(r"\bFROM\s+([A-Z0-9_][A-Z0-9_.]*)", stmt, re.IGNORECASE):
                tables.append(m.group(1))
            for m in re.finditer(r"\bJOIN\s+([A-Z0-9_][A-Z0-9_.]*)", stmt, re.IGNORECASE):
                tables.append(m.group(1))
            props: dict[str, str] = {"statement": "SELECT"}
            if tables:
                props["tables"] = ",".join(dict.fromkeys(tables))
            result.components.append(NormalizedComponent(
                name="SELECT-QUERY",
                component_type="TABLE",
                technology="SQL",
                source_artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                detected_properties=props,
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=start,
                    line_end=end,
                    rule="SQL_SELECT",
                    snippet=stmt[:200],
                )],
            ))
            return

        # INSERT
        m = re.search(r"INSERT\s+INTO\s+([A-Z0-9_][A-Z0-9_.]*)", stmt, re.IGNORECASE)
        if m:
            table_name = m.group(1)
            result.components.append(NormalizedComponent(
                name=table_name,
                component_type="TABLE",
                technology="SQL",
                source_artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                detected_properties={"statement": "INSERT"},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=start,
                    line_end=end,
                    rule="SQL_INSERT",
                    snippet=stmt[:200],
                )],
            ))
            return

        # UPDATE
        m = re.search(r"UPDATE\s+([A-Z0-9_][A-Z0-9_.]*)\s+SET", stmt, re.IGNORECASE)
        if m:
            table_name = m.group(1)
            result.components.append(NormalizedComponent(
                name=table_name,
                component_type="TABLE",
                technology="SQL",
                source_artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                detected_properties={"statement": "UPDATE"},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=start,
                    line_end=end,
                    rule="SQL_UPDATE",
                    snippet=stmt[:200],
                )],
            ))
            return

        # DELETE
        m = re.search(r"DELETE\s+FROM\s+([A-Z0-9_][A-Z0-9_.]*)", stmt, re.IGNORECASE)
        if m:
            table_name = m.group(1)
            result.components.append(NormalizedComponent(
                name=table_name,
                component_type="TABLE",
                technology="SQL",
                source_artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                detected_properties={"statement": "DELETE"},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=start,
                    line_end=end,
                    rule="SQL_DELETE",
                    snippet=stmt[:200],
                )],
            ))
            return

        # MERGE
        m = re.search(r"MERGE\s+INTO\s+([A-Z0-9_][A-Z0-9_.]*)", stmt, re.IGNORECASE)
        if m:
            table_name = m.group(1)
            result.components.append(NormalizedComponent(
                name=table_name,
                component_type="TABLE",
                technology="SQL",
                source_artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                detected_properties={"statement": "MERGE"},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=start,
                    line_end=end,
                    rule="SQL_MERGE",
                    snippet=stmt[:200],
                )],
            ))
            return

        # ALTER TABLE
        m = re.search(r"ALTER\s+TABLE\s+([A-Z0-9_][A-Z0-9_.]*)", stmt, re.IGNORECASE)
        if m:
            table_name = m.group(1)
            result.components.append(NormalizedComponent(
                name=table_name,
                component_type="TABLE",
                technology="SQL",
                source_artifact_id=artifact_id,
                line_start=start,
                line_end=end,
                detected_properties={"statement": "ALTER TABLE"},
                evidence_class="Evidence-based",
                evidence_refs=[EvidenceRef(
                    artifact_id=artifact_id,
                    line_start=start,
                    line_end=end,
                    rule="SQL_ALTER_TABLE",
                    snippet=stmt[:200],
                )],
            ))
            return
