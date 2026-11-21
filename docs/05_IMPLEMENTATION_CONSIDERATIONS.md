# 5. Implementation Considerations

## Supported Languages and Artifact Types

| Language/Type | Support Level | Parser | Capability |
|---|---|---|---|
| COBOL | SUPPORTED_PARSE | cobol v3.0.0 | PARTIAL_EXTRACT |
| Copybook | SUPPORTED_PARSE | copybook v3.0.0 | FULL_EXTRACT |
| JCL | SUPPORTED_PARSE | jcl v3.0.0 | FULL_EXTRACT |
| SQL/DDL | SUPPORTED_PARSE | sql v3.0.0 | FULL_EXTRACT |
| BMS maps | SUPPORTED_PARSE | bms v3.0.0 | FULL_EXTRACT |
| VSAM/IDCAMS | SUPPORTED_PARSE | vsam v3.0.0 | FULL_EXTRACT |
| HLASM | SUPPORTED_PARSE | hlasm v3.0.0 | DETECT_ONLY |
| IMS | DETECT_ONLY | ims v3.0.0 | DETECT_ONLY |
| Scheduler | DETECT_ONLY | scheduler v3.0.0 | DETECT_ONLY |
| Security (RACF) | DETECT_ONLY | security v3.0.0 | DETECT_ONLY |
| Config/metadata | DETECT_ONLY | metadata v3.0.0 | DETECT_ONLY |
| Data files (binary/EBCDIC) | UNSUPPORTED | (none) | Not parsed |

## Required Access

- Read access to mainframe artifact repositories (Endevor, GitHub, file shares)
- A local directory of artifacts, or ability to upload files/ZIPs
- No database credentials, API keys, or external service accounts required
- No outbound network calls required

## Security

- **No outbound network calls**: The tool makes zero outbound network calls by default. All analysis is local.
- **Upload safety**: Path traversal prevention (null bytes, `..` segments, absolute paths, Windows drive letters rejected), ZIP bomb protection (max 500 files, 300 MB uncompressed, 100:1 compression ratio, 8 nesting depth), executable rejection (extension + magic bytes), symlink containment checks.
- **No secrets stored**: No API keys, passwords, or credentials in the codebase or configuration.
- **File storage**: Uploaded files are stored with random flat names (UUID-based), made read-only (chmod 0o444), and the original path is kept only in the database for display.
- **AI assistant**: Disabled by default. When enabled, AI output is classified as Inferred, never changes scores, and requires human confirmation.

## Accuracy and False-Positive Risk

- **Parser accuracy**: 100% precision and recall against 16 hand-verified ground-truth samples (156 components). This is measured, not estimated.
- **Static extraction only**: No full COBOL semantic analysis. False positives are possible for:
  - Commented-out code that mimics active statements (mitigated: comment detection in all parsers)
  - String literals containing keywords (mitigated: string-aware parsing)
  - Continuation lines (mitigated: continuation line merging)
- **Scoring determinism**: Same inputs always produce same outputs (proven by reproducibility tests). No random or AI-generated scores.
- **Confidence model**: Low confidence explicitly signals when the assessment should not be fully trusted. Unsupported artifacts and missing artifacts reduce confidence, never silently ignored.

## Human Validation

- Every finding can be reviewed by a human reviewer
- Reviewer actions are stored separately from machine findings (immutable audit trail)
- Reviewer can override evidence classification, severity, and status
- Human-validated findings boost confidence (+5 via CF-ALL-001)
- Two roles: Viewer (read-only) and Reviewer (can review findings)

## Endevor-to-Git Requirement

ReframeX operates on artifacts as files. If source is in Endevor, it must be exported to a local directory or Git repository before analysis. The tool does not connect to Endevor directly. This aligns with the constraint that source must be replicated to an approved Git repository before any AI-assisted analysis (which is itself disabled by default).

## Integration with Existing Tools and Repositories

- **Input**: Files, ZIPs, or folder import from any local directory
- **Output**: JSON and HTML reports, printable PDFs via browser print
- **API**: RESTful API (FastAPI) for programmatic integration
- **No external dependencies**: No Docker, no paid services, no cloud accounts, no public AI APIs

## Ownership of the Scoring Model

- The ruleset is a JSON file (`default_ruleset_v1.json`) that is versioned and schema-validated
- Domain weights, rule weights, thresholds, and detection conditions are all in the ruleset
- The ruleset can be replaced or versioned without code changes
- Rule maintenance: A domain expert edits the JSON ruleset; the schema validator ensures structural integrity
- The scoring engine loads the ruleset at runtime — no recompilation needed

## Rule Maintenance

1. Edit `backend/app/assessment/rulesets/default_ruleset_v1.json`
2. Validate against `backend/app/assessment/ruleset_schema.json`
3. Run `python -m pytest tests/test_scoring.py` to verify scores are still valid
4. Run `python -m app.assessment.accuracy_report` to verify parser accuracy is unaffected

## Path from Prototype to Enterprise Capability

| Prototype (current) | Enterprise |
|---|---|
| SQLite local database | PostgreSQL or managed DB |
| No authentication | SSO/OIDC authentication |
| Single-user | Multi-user with role-based access |
| Local file storage | Object storage (S3) |
| No audit log | Full audit trail with compliance reporting |
| Manual artifact provision | Automated Endevor/Git sync |
| 12 artifact types | Extensible parser registry for additional languages |
| Default ruleset | Multiple rulesets per migration program |
| REST API | API + message queue for batch processing |
