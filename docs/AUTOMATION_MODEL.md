# ReframeX Automation Model

This document describes which steps in the ReframeX assessment pipeline are
**automated**, **rules-based**, **AI-assisted (optional)**, and **human-review**.
It is the authoritative reference for the automation boundaries of the tool.

## Overview

ReframeX is a **deterministic, rules-based** mainframe migration assessment
accelerator. The default product makes **zero outbound network calls** and
produces fully reproducible results. AI assistance is an optional extension
point that is disabled by default and never changes scores or recommendations
until a human confirms it.

## Pipeline Steps

| Step | Type | Description |
|------|------|-------------|
| Artifact ingestion | Automated | Files are uploaded, checksummed, classified by extension and content sniffing. |
| Artifact classification | Rules-based | Deterministic classifier maps files to categories (COBOL, JCL, BMS, SQL, etc.). |
| Static extraction (parsing) | Rules-based | Deterministic parsers extract components, properties, and evidence references. No semantic analysis. |
| Dependency discovery | Rules-based | Static cross-referencing of CALL statements, COPY statements, EXEC SQL references. |
| Complexity/Confidence/Readiness scoring | Rules-based | External JSON ruleset drives all scoring. Every point traces to a rule + evidence. No random or hardcoded scores. |
| Finding generation | Rules-based | Findings are built from assessment results, components, dependencies, and unsupported artifacts. Every finding cites its artifact, line/record (where available), and detection rule. |
| Recommendation generation | Rules-based | Three categories (Good Candidate, Requires Further Analysis, Retain) derived from actual assessment results. |
| Roadmap generation | Rules-based | Six priority groups derived from missing information, assessment limitations, and open findings. |
| Reviewer actions | Human-review | Reviewers confirm, reject, mark for investigation, add context/notes. Machine findings are immutable; reviewer changes stored separately. |
| Reassessment with human validation | Rules-based + Human-review | Confirmed findings update the human-validation confidence factor on next reassessment. |
| AI-assisted analysis (optional) | AI-assisted (optional) | Extension point only. Disabled by default. Output stored as Inferred with generated_by, model name/version, prompt hash. Never changes scores until human-confirmed. |

## Automation Boundaries

### Fully Automated (no human input required)
- Artifact ingestion and classification
- Static extraction and parsing
- Dependency discovery
- Score computation (complexity, confidence, readiness)
- Finding generation
- Recommendation and roadmap generation

### Rules-Based (deterministic, configurable)
- All scoring via external JSON ruleset
- All finding classification (Evidence-based, Inferred, Assumed, Unknown)
- All recommendation categorization
- Parser versions and ruleset versions recorded with results

### AI-Assisted (optional, disabled by default)
- Finding analysis: optional AI can provide additional context for a finding
- Refactoring pattern suggestions: optional AI can propose pattern hypotheses
- **Never** changes scores or recommendations directly
- Output is always classified as **Inferred** with:
  - `generated_by`: identifier of the AI tool
  - `model_name` and `model_version`: model identification
  - `prompt_hash`: SHA-256 hash of the prompt for audit trail
- UI displays an **"AI-assisted (Inferred)"** badge for any AI-derived content
- Human confirmation is required before AI output influences any conclusion

### Human Review (always required for final decisions)
- Confirming or rejecting machine findings
- Adding reviewer context and notes
- Marking items for specialist investigation
- Validating unverified migration assumptions
- Approving AI-assisted output for inclusion in assessment

## AI Assistance Rules

1. **No public AI services**: Only local or explicitly approved endpoints from an allowlist.
2. **Zero outbound network calls by default**: The NoOp implementation makes no network calls.
3. **No score changes**: AI output never changes complexity, confidence, or readiness scores.
4. **No recommendation changes**: AI output never changes recommendations until a human confirms it.
5. **Full audit trail**: All AI output records generated_by, model name/version, and prompt hash.
6. **Inferred classification**: All AI output is classified as Inferred, never Evidence-based.
7. **UI transparency**: AI-assisted content is always badged in the UI.

## Endevor Constraint

Source code managed in **Endevor SCM** must be replicated to an approved Git
repository before any approved AI tools may use it. This ensures:

- Source provenance is traceable in a standard VCS.
- Access controls are enforced at the Git repository level.
- AI tools never directly access mainframe SCM systems.
- The audit trail includes the Git commit hash, not just the Endevor element version.

ReframeX itself does not access Endevor. Artifacts must be exported from Endevor
and uploaded to ReframeX through the standard ingestion pipeline.

## Reviewer Roles

ReframeX uses simple local roles (no heavy authentication):

| Role | Can View | Can Add Notes/Context | Can Confirm/Reject | Can Mark for Investigation |
|------|----------|----------------------|-------------------|---------------------------|
| Viewer | Yes | Yes | No | No |
| Reviewer | Yes | Yes | Yes | Yes |

Reviewer role is set in the Settings page and stored locally in the browser.
Machine findings are always immutable; reviewer actions are appended with
timestamp and reviewer name, and stored separately from machine findings.
