# Developer Guide: Adding a New Parser to ReFrameX

ReFrameX uses a modular parser architecture to ingest, normalize, and extract components and dependencies from mainframe artifacts. This guide demonstrates how to build and register a new parser following Wells Fargo architecture standards.

---

## 1. Parser Architecture Overview

Every parser in ReFrameX:
1. Inherits from `BaseParser` (`backend/app/parsers/base_parser.py`).
2. Implements the `parse(artifact, raw_content, context)` contract.
3. Performs domain-specific preprocessing (handling column formats, comments, continuation characters, and character encoding).
4. Emits `NormalizedComponent` objects stamped with:
   - `name`: Clean component identifier.
   - `type`: Standard component category (e.g. `PROGRAM`, `MODULE`, `COPYBOOK`, `DATABASE_TABLE`, `MAPSET`).
   - `technology`: Technology tag (e.g. `COBOL`, `HLASM`, `JCL`, `SQL`, `BMS`).
   - `line_start` / `line_end`: Line locations for auditability.
   - `detected_properties`: Key/value dictionary extracted from syntax.
   - `evidence_class`: `Evidence-based` (direct syntax extract), `Inferred` (derived from conventions), or `Assumed` (default heuristic).
   - `evidence_refs`: Array of line reference objects with `file_name`, `line_start`, `line_end`, and `snippet`.

---

## 2. Step-by-Step Implementation

### Step 1: Subclass `BaseParser`
Create your parser module in `backend/app/parsers/` (e.g., `backend/app/parsers/rexx_parser.py`):

```python
"""REXX Script and Exec Parser."""

from __future__ import annotations

import re
from typing import Any
from app.parsers.base_parser import BaseParser, CapabilityLevel, ParseResult
from app.schemas.schemas import NormalizedComponent, EvidenceClass, EvidenceRef


class RexxParser(BaseParser):
    name = "rexx"
    category = "SCRIPT"
    capability = CapabilityLevel.FULL_EXTRACT

    def can_parse(self, filename: str, content: bytes) -> bool:
        lower = filename.lower()
        if lower.endswith((".rexx", ".rex", ".exec")):
            return True
        # Content sniffing on first 8 KiB
        sniff = content[:8192].decode("latin-1", errors="replace").upper()
        return "/* REXX" in sniff or "PARSE ARG" in sniff

    def parse(
        self,
        artifact: Any,
        raw_content: bytes,
        context: dict | None = None,
    ) -> ParseResult:
        text = raw_content.decode("latin-1", errors="replace")
        lines = text.splitlines()
        components: list[NormalizedComponent] = []

        # 1. Main Script Component
        script_name = artifact.name.rsplit(".", 1)[0].upper()
        components.append(
            NormalizedComponent(
                name=script_name,
                type="SCRIPT",
                technology="REXX",
                line_start=1,
                line_end=len(lines),
                detected_properties={"line_count": len(lines)},
                evidence_class=EvidenceClass.EVIDENCE_BASED,
                evidence_refs=[
                    EvidenceRef(
                        file_name=artifact.name,
                        line_start=1,
                        line_end=min(5, len(lines)),
                        snippet=lines[0] if lines else "",
                    )
                ],
            )
        )

        # 2. Extract Routines / Functions
        subroutine_pattern = re.compile(r"^([A-Z0-9_\$#@]+):", re.IGNORECASE)
        for idx, line in enumerate(lines, start=1):
            match = subroutine_pattern.match(line.strip())
            if match:
                routine_name = match.group(1).upper()
                components.append(
                    NormalizedComponent(
                        name=routine_name,
                        type="PROCEDURE",
                        technology="REXX",
                        line_start=idx,
                        line_end=idx,
                        detected_properties={"parent_script": script_name},
                        evidence_class=EvidenceClass.EVIDENCE_BASED,
                        evidence_refs=[
                            EvidenceRef(
                                file_name=artifact.name,
                                line_start=idx,
                                line_end=idx,
                                snippet=line.strip(),
                            )
                        ],
                    )
                )

        return ParseResult(
            status="parsed",
            components=components,
            dependencies=[],
            warnings=[],
            lines_parsed=len(lines),
        )
```

---

### Step 2: Register in `backend/app/parsers/classifier.py`

Update `classifier.py` so the ingestion pipeline routes files to your new parser:

1. Add the file extensions to `EXTENSION_MAP`:
   ```python
   ".rexx": ("SCRIPT", SupportLevel.SUPPORTED_PARSE),
   ".rex": ("SCRIPT", SupportLevel.SUPPORTED_PARSE),
   ".exec": ("SCRIPT", SupportLevel.SUPPORTED_PARSE),
   ```
2. Add content sniff signatures to `CONTENT_SIGNATURES`:
   ```python
   (b"/* REXX", "SCRIPT", SupportLevel.SUPPORTED_PARSE),
   ```
3. Register the parser instance in `PARSER_REGISTRY`:
   ```python
   from app.parsers.rexx_parser import RexxParser
   PARSER_REGISTRY["rexx"] = RexxParser()
   ```

---

### Step 3: Register in Dependency Discovery (if applicable)

If components extracted by your parser link to datasets, jobs, or other programs:
- Update `backend/app/services/dependency_service.py` to recognize the edge types (e.g. `EXECUTES_SCRIPT`, `INVOKES_ROUTINE`).
- Ensure missing targets resolve to placeholder `Unknown` components rather than being silently dropped.

---

### Step 4: Write Unit Tests

Create a comprehensive test suite in `backend/tests/test_rexx_parser.py`:

```python
from app.parsers.rexx_parser import RexxParser
from app.schemas.schemas import EvidenceClass

def test_rexx_parser_extracts_procedures():
    src = b"""/* REXX */
PARSE ARG InputVar
CALL ProcessData
EXIT

ProcessData:
  SAY 'Processing...'
  RETURN
"""
    parser = RexxParser()
    class DummyArtifact:
        name = "TESTEXEC.rexx"

    result = parser.parse(DummyArtifact(), src)
    assert result.status == "parsed"
    assert len(result.components) == 2
    assert result.components[0].name == "TESTEXEC"
    assert result.components[1].name == "PROCESSDATA"
    assert result.components[1].evidence_class == EvidenceClass.EVIDENCE_BASED
    assert len(result.components[1].evidence_refs) > 0
```

Run test suite:
```bash
cd backend
py -m pytest tests/test_rexx_parser.py
```
Assert that test suite passes and overall baseline coverage increases.
