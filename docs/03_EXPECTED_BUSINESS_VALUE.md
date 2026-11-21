# 3. Expected Business Value

## Grounded in Measured Facts

All claims below are grounded in measured facts from the test suite (107 tests passing) and accuracy report (156 components extracted with 100% precision and recall against hand-verified ground truth).

## What Is Automatic

The following are fully automated and require no human input after artifact upload:

1. **Artifact classification**: Extension + content signature detection, encoding identification
2. **Component extraction**: 156 components across 16 ground-truth samples with 100% precision/recall
3. **Dependency discovery**: Static CALL, COPY, EXEC SQL, and JCL reference extraction
4. **Graph analysis**: Circular dependency detection, single-point-of-failure identification, blast-radius computation
5. **Complexity scoring**: 24 complexity rules across 8 domains, deterministic and reproducible
6. **Confidence scoring**: 11 confidence rules that adjust based on artifact coverage
7. **Readiness scoring**: 13 readiness rules that measure documentation and dependency completeness
8. **Finding generation**: Material conclusions with evidence class, line references, and rule citations
9. **Recommendation generation**: Prioritized, evidence-linked refactoring actions
10. **Report generation**: Executive report with 19 sections, JSON/HTML export

## What Needs Application-Owner or Specialist Input

1. **Artifact provision**: The tool cannot analyze what it cannot see. Application owners must provide artifacts.
2. **Missing artifact identification**: When the tool flags missing copybooks or JCL, the owner must locate and upload them.
3. **Finding review**: A reviewer must validate machine-generated findings, override incorrect classifications, and add context.
4. **Rule weight tuning**: Domain experts can adjust rule weights via the Rule Studio what-if interface, but changes are temporary and not persisted until formally adopted.
5. **HLASM/IMS specialist review**: DETECT_ONLY parsers flag these artifacts but do not fully extract them. A specialist must review.
6. **Security configuration review**: RACF/ACF2/Top Secret artifacts are detected but require security specialist review.

## Consistency and Comparability

- **Deterministic**: Same artifacts + same ruleset = same scores, every time (proven by reproducibility tests)
- **Versioned**: Every assessment records model_version, ruleset_id, and ruleset_version
- **Comparable**: Two applications can be compared side-by-side via the Comparison page, with version mismatch warnings
- **Traceable**: Every score contribution cites its rule, artifact, and line number
- **Evidence-classified**: Every material conclusion is classified as Evidence-based, Inferred, Assumed, or Unknown

## Value Summary

| Capability | Benefit |
|---|---|
| Automated extraction | Eliminates weeks of manual artifact cataloging |
| Evidence-classified findings | Reviewers know exactly what is proven vs inferred |
| Independent confidence score | Prevents over-trusting assessments with missing artifacts |
| Missing-information registry | Drives targeted artifact collection, not guesswork |
| Dependency graph | Visual blast-radius analysis for refactoring planning |
| What-if simulation | Test weight changes before adopting them |
| Reproducible scoring | Defensible, auditable assessments |
| Comparison view | Prioritize applications for migration based on relative complexity |
