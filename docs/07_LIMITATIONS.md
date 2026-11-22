# 7. Limitations

## Unsupported Artifacts

| Artifact Type | Status | Impact |
|---|---|---|
| EBCDIC data files (.dat, .bin, .ebc) | UNSUPPORTED | Recorded, reduces confidence, not parsed |
| Binary files | UNSUPPORTED | Recorded, reduces confidence, not parsed |
| Unrecognized extensions | UNSUPPORTED | Recorded, reduces confidence, not parsed |
| HLASM assembler (.asm, .mac) | DETECT_ONLY | Detected, CSECT/START flagged, not fully parsed |
| IMS (.psb, .dbd) | DETECT_ONLY | Detected, not fully parsed |
| Scheduler configs (.ctm, .sch) | DETECT_ONLY | Detected, not fully parsed |
| Security configs (.racf, .rcf) | DETECT_ONLY | Detected, not fully parsed |
| Metadata/config files | DETECT_ONLY | Detected, not fully parsed |

## Assumptions

1. Artifacts are text-based (UTF-8, ASCII, or EBCDIC cp037). Binary files are detected but not parsed.
2. COBOL programs follow standard ANSI COBOL formatting (columns 1-6 sequence, column 7 indicator, columns 8-72 code). Non-standard formats may not parse correctly.
3. JCL follows standard IBM JCL syntax. Non-standard job control statements may not be recognized.
4. SQL/DDL follows standard SQL syntax. Vendor-specific extensions may not be fully parsed.
5. Component IDs are deterministic (`sha256(app_id | type | NAME | relative_path | ordinal)[:16]`), deliberately excluding line numbers so non-semantic line shifts do not churn component IDs.
6. The default ruleset weights are expert-set, not empirically calibrated against real migration outcomes.
7. The complexity normalization constant K=20 is a heuristic that gives a reasonable distribution for typical mainframe applications.
8. Dependency graph cycle detection uses Tarjan's Strongly Connected Components (SCC) algorithm, providing linear-time $O(V+E)$ exact cycle detection without arbitrary depth bounds.

## Evidence Gaps

1. **No line-number accuracy verification**: The accuracy harness matches components by (name, type), not by line number. Line numbers are recorded but not verified against ground truth.
2. **No detected_properties verification**: Properties like `call_type`, `comp3`, `has_88_levels` are not verified by the accuracy harness.
3. **No dependency extraction accuracy**: There is no ground truth for relationships (CALL→target, COPY→file). Dependency extraction accuracy is not measured.
4. **No evidence_class accuracy**: The harness does not verify Evidence-based vs Inferred vs Unknown classifications.
5. **Ground truth scope**: 16 self-authored synthetic benchmark samples with self-authored ground truth cover 6 artifact types (99.36% precision & recall: 155 TP / 1 FP / 1 FN). HLASM, IMS, scheduler, security, and metadata parsers have no ground truth.

## Required Human Review

1. **All findings must be reviewed**: Machine-generated findings are a starting point, not a final assessment. A human reviewer must validate evidence classifications, severities, and recommendations.
2. **DETECT_ONLY artifacts**: HLASM, IMS, scheduler, and security artifacts require specialist review. The tool detects them but does not fully analyze them.
3. **Rule weight tuning**: Default weights are expert-set. Organizations should calibrate weights against their own migration experience.
4. **Missing artifact follow-up**: When the tool flags missing artifacts, the application owner must locate and provide them. The tool cannot find artifacts that were not uploaded.
5. **Recommendation prioritization**: Recommendations are generated deterministically but should be reviewed and reprioritized based on business context.
6. **Cross-application dependencies**: The tool analyzes one application at a time. Cross-application dependencies visible only at the portfolio level require manual investigation.
7. **Migration target assumptions**: The tool does not assume a specific migration target (e.g., OpenShift). Recommendations describe patterns, not final migration decisions.
