# 2. Proposed Solution

## Reusable Tool

ReframeX is a reusable, evidence-driven assessment accelerator. It analyzes mainframe application artifacts and reports Migration Complexity, Assessment Confidence, and Migration Readiness separately, with full evidence traceability. It does NOT convert, containerize, or migrate anything.

## Inputs

- COBOL programs (.cbl, .cob, .cobol)
- Copybooks (.cpy, .copy)
- JCL job streams (.jcl, .proc, .cntl)
- SQL/DDL files (.sql, .ddl, .db2)
- BMS map definitions (.bms, .map)
- VSAM/IDCAMS definitions (.idcams, .vsam)
- HLASM assembler (.asm, .mac) — detect only
- IMS definitions (.psb, .dbd) — detect only
- Security configurations (.racf, .rcf) — detect only
- Scheduler configs (.ctm, .sch) — detect only
- Metadata/config files (.json, .csv, .xml, .yaml) — detect only

Inputs are provided via file upload, ZIP archive, or folder import (read-only from an operator-configured directory).

## Analysis Methods

1. **Classification**: Each artifact is classified by extension and content signature. Encoding (UTF-8, ASCII, EBCDIC cp037, binary) is detected.
2. **Static extraction**: Parsers extract normalized components (programs, paragraphs, files, tables, jobs, maps, etc.) with line numbers and evidence references.
3. **Dependency discovery**: Cross-component relationships (CALL, COPY, EXEC SQL table references, JCL EXEC references) are identified and classified.
4. **Graph analysis**: The dependency graph is analyzed for circular dependencies, single points of failure, and unresolved targets.
5. **Rule-based scoring**: A JSON ruleset (40 rules across 8 domains) is evaluated against the evidence. Each rule fires based on detection conditions and contributes to complexity, confidence, or readiness scores.

## Domains (8)

| Domain | Weight | What it measures |
|---|---|---|
| Application & Business Logic | 0.18 | GOTOs, ALTERs, dynamic calls, PERFORM nesting, paragraph count |
| Data Structures | 0.12 | Copybook usage, REDEFINES, COMP-3, OCCURS, COPY REPLACING |
| Database & Persistence | 0.15 | Embedded SQL, DDL artifacts, IMS DL/I, VSAM datasets |
| Jobs, Batch & Orchestration | 0.12 | JCL jobs, PROCs, DD statements, SORT utilities |
| Online Transactions & UI | 0.15 | CICS transactions, BMS maps, SEND/RECEIVE, LINK/XCTL, SYNCPOINT |
| Integration & External Dependencies | 0.12 | MQ, external interfaces, unresolved/circular/single-point dependencies |
| Security & Controls | 0.08 | RACF/ACF2/Top Secret resources |
| Operational & Nonfunctional | 0.08 | SYSOUT, assembler, unsupported/detect-only artifacts |

## Scoring

Three independent measures, each 0-100:

- **Complexity**: Sigmoid normalization `100 * raw / (raw + 20)` per domain, then weighted average across evidenced domains. Higher = more complex.
- **Confidence**: `clamp(50 + raw, 0, 100)` per domain, then weighted average. Higher = more trustworthy assessment.
- **Readiness**: `clamp(50 + raw, 0, 100)` per domain, then weighted average. Higher = more ready for planning.

Domains with no evidence are excluded from aggregation (weights renormalized over evidenced domains). Missing evidence never counts as low complexity.

## Confidence Model

Confidence is reduced by:
- Missing copybooks (CF-DS-002: -8)
- Missing JCL (CF-JB-002: -10)
- No security components (CF-SC-001: -8)
- Unsupported artifacts (CF-ON-001: -6)
- Detect-only parse status (CF-ON-002: -3)
- Unresolved dependencies (CF-IX-001: -4)
- Inferred (non-Evidence-based) components (CF-AB-002: -2)

Confidence is increased by:
- Evidence-based components (CF-AB-001: +3)
- Parsed COBOL (CF-AB-003: +2)
- Parsed copybooks (CF-DS-001: +3)
- Parsed SQL DDL (CF-DB-001: +4)
- Parsed JCL (CF-JB-001: +3)
- Parsed BMS (CF-OL-001: +4)
- Dependency discovery completed (CF-IX-002: +2)
- Human-validated findings (CF-ALL-001: +5)

## Missing-Information Handling

Missing artifacts are never silently ignored. They are:
1. Recorded in the missing-information registry
2. Flagged as reducing assessment confidence
3. Listed in the Unknowns and Risks page
4. Included in assessment reports as limitations

## Automation Model

| Step | Type |
|---|---|
| Artifact upload/import | Automated |
| Classification & encoding detection | Automated |
| Static extraction (parsing) | Automated |
| Dependency discovery | Automated |
| Graph analysis | Automated |
| Rule-based scoring | Rules-based |
| Finding generation | Rules-based |
| Recommendation generation | Rules-based |
| Report generation | Automated |
| What-if weight simulation | Rules-based (human-initiated) |
| AI-assisted analysis (optional) | AI-assisted (disabled by default) |
| Finding review & override | Human review |
| Rule weight tuning | Human review |

## Extension Guide

To add a new parser, artifact type, or rule, see the Reuse Guide (doc 06).
