# ReframeX Parser Coverage Report

## Overview

This report describes the parser coverage for ReframeX Phase 3 — the static analysis engine that extracts normalized components from mainframe artifacts. Extraction is **static and regex/rule-based** — not full semantic compilation.

## Parser Registry

| Parser | Version | Capability | Supported Categories |
|--------|---------|------------|---------------------|
| cobol | 3.0.0 | PARTIAL_EXTRACT | COBOL |
| jcl | 3.0.0 | FULL_EXTRACT | JCL |
| copybook | 3.0.0 | FULL_EXTRACT | Copybook |
| sql | 3.0.0 | FULL_EXTRACT | SQL |
| bms | 3.0.0 | FULL_EXTRACT | BMS |
| vsam | 3.0.0 | FULL_EXTRACT | VSAM |
| hlasm | 3.0.0 | DETECT_ONLY | HLASM |
| ims | 3.0.0 | DETECT_ONLY | IMS |
| scheduler | 3.0.0 | DETECT_ONLY | Scheduler |
| security | 3.0.0 | DETECT_ONLY | Security |
| metadata | 3.0.0 | DETECT_ONLY | Config |
| unsupported | 3.0.0 | DETECT_ONLY | Data, UNKNOWN |

## Capability Levels

- **FULL_EXTRACT**: All major structural elements extracted with line numbers and evidence.
- **PARTIAL_EXTRACT**: Most structural elements extracted; some constructs (e.g., full COBOL data flow) are partially extracted.
- **DETECT_ONLY**: Artifact type detected and key elements flagged; no full extraction. Flagged for specialist review.
- **UNSUPPORTED**: Artifact recorded and flagged; reduces assessment confidence.

## Sample Data Coverage

The sample metadata folder (`backend/sample_data/`) contains 5 artifacts:

| File | Category | Parser | Capability | Components Extracted |
|------|----------|--------|------------|---------------------|
| CLAIMCTL.cbl | COBOL | cobol | PARTIAL_EXTRACT | 16 |
| POLICY.cpy | Copybook | copybook | FULL_EXTRACT | 1 |
| CLAIMJOB.jcl | JCL | jcl | FULL_EXTRACT | 13 |
| LOAN_DDL.sql | SQL | sql | FULL_EXTRACT | 3 |
| CLAIMMAP.bms | BMS | bms | FULL_EXTRACT | 6 |

### Summary by Capability

| Capability | Count |
|-----------|-------|
| PARTIAL_EXTRACT | 1 |
| FULL_EXTRACT | 4 |
| DETECT_ONLY | 0 |
| UNSUPPORTED | 0 |

## What Could Not Be Parsed

No unsupported artifacts were found in the sample data. The IDCAMS/VSAM sample (`CLAIMS_IDCAMS.idcams`) is parsed by the VSAM parser. If EBCDIC data files or binary artifacts were present, they would be recorded as UNSUPPORTED and would reduce assessment confidence — never silently ignored.

## Ground Truth Accuracy

The accuracy harness (`python -m app.assessment.accuracy_report`) compares parser output against hand-verified ground truth for 16 samples (5 COBOL, 3 copybooks, 3 JCL, 3 SQL, 1 BMS, 1 IDCAMS).

### Latest Results

| Metric | Value |
|--------|-------|
| **Precision** | 1.0000 |
| **Recall** | 1.0000 |
| **F1** | 1.0000 |
| True Positives | 156 |
| False Positives | 0 |
| False Negatives | 0 |

### Per-Parser Results

| Parser | Precision | Recall | F1 | TP | FP | FN |
|--------|-----------|--------|-----|-----|-----|-----|
| cobol | 1.0000 | 1.0000 | 1.0000 | 99 | 0 | 0 |
| copybook | 1.0000 | 1.0000 | 1.0000 | 3 | 0 | 0 |
| jcl | 1.0000 | 1.0000 | 1.0000 | 34 | 0 | 0 |
| sql | 1.0000 | 1.0000 | 1.0000 | 13 | 0 | 0 |
| bms | 1.0000 | 1.0000 | 1.0000 | 6 | 0 | 0 |
| vsam | 1.0000 | 1.0000 | 1.0000 | 1 | 0 | 0 |

### Tricky Cases Handled

- **Commented-out CALLs**: `CALL 'OLDPROG'` in a COBOL comment line is NOT extracted.
- **Commented-out COPY**: `COPY POLICY` in a COBOL comment line is NOT extracted.
- **Dynamic calls**: `CALL WS-CALL-TARGET` (variable, no quotes) is classified as dynamic and marked Inferred.
- **Static calls**: `CALL 'CALCTAX'` (quoted literal) is classified as static and marked Evidence-based.
- **Continuation lines**: COBOL continuation lines (col 7 = `-`) are merged with the preceding line.
- **Strings containing keywords**: `DISPLAY 'CALL ADMIN FOR APPROVAL'` does NOT produce a CALL extraction.
- **JCL IF-THEN-ELSE**: `//IF1 IF (STEP1.RC = 0) THEN` is detected as a conditional control flow element.
- **IDCAMS continuation**: `DEFINE CLUSTER - NAME(...)` across multiple lines is parsed correctly.

## Limitations

1. **COBOL is PARTIAL_EXTRACT**: Full COBOL semantic analysis (data flow, procedure flow, variable tracking) is NOT performed. This is static extraction only.
2. **HLASM is DETECT_ONLY**: Assembler CSECT/START and macro usage are detected, but full assembly analysis requires specialist review.
3. **IMS is DETECT_ONLY**: PSB/DBD definitions and DL/I calls are detected, but full IMS analysis requires specialist review.
4. **Scheduler, Security, Metadata are DETECT_ONLY**: Key elements are extracted but full configuration analysis is not performed.
5. **No outbound network calls**: The tool makes no outbound network calls by default. All analysis is local.
