# ReframeX Scoring Methodology

## Overview

ReframeX computes three independent measures for each application:

1. **Migration Complexity (0-100)** — higher means harder to migrate
2. **Assessment Confidence (0-100)** — higher means more reliable assessment
3. **Migration Readiness (0-100)** — higher means more ready for detailed planning

These measures are **never merged** into a single score. Each is computed independently from its own set of rules, aggregated separately, and reported separately.

## Core Guarantees

- **No random, hardcoded, or AI-generated scores.** Every point traces to a rule and its evidence.
- **Missing evidence is never counted as simplicity.** If a domain has no evidence, it is reported as "Not assessed: no evidence," not as low complexity.
- **Absence of a detected risk does not mean absence of the risk.** It is shown as "not evidenced."
- **Unsupported artifacts lower confidence.** They do not lower complexity (unknown complexity is not low complexity).
- **Complexity, Confidence, and Readiness are computed independently.** A change to one measure's rules does not affect the others.

## Eight Official Domains

| ID | Domain | Default Weight |
|----|--------|---------------|
| `application_business_logic` | Application & Business Logic | 0.18 |
| `data_structures` | Data Structures | 0.12 |
| `database_persistence` | Database & Persistence | 0.15 |
| `jobs_batch_orchestration` | Jobs, Batch & Orchestration | 0.12 |
| `online_transactions_ui` | Online Transactions & UI | 0.15 |
| `integration_external_dependencies` | Integration & External Dependencies | 0.12 |
| `security_controls` | Security & Controls | 0.08 |
| `operational_nonfunctional` | Operational & Nonfunctional | 0.08 |

Domain weights sum to 1.0. They represent the relative importance of each domain in the overall assessment. Only domains with evidence contribute to the overall score; weights are renormalized over contributing domains.

## Ruleset Structure

Each rule in the JSON ruleset has:

- **rule_id**: Unique identifier (e.g., `CX-AB-002`)
- **domain**: One of the eight domains
- **measure**: `complexity`, `confidence`, or `readiness`
- **description**: Human-readable summary
- **detection_condition**: Structured expression evaluated against evidence
- **weight**: Numeric contribution when the rule fires
- **impact**: `positive` or `negative`
- **severity**: `high`, `medium`, `low`, or `info`
- **evidence_requirement**: What evidence must exist for the rule to fire
- **explanation**: Why this rule matters
- **recommendation**: Actionable guidance (optional)
- **upgrade_guidance**: Technology-specific migration guidance (optional, for unsupported/EOL tech)

Rules are validated against a JSON schema at load time. Malformed rules are rejected with a clear error message.

## Formulas (Ruleset v2 & Engine Corrections)

### Per-Rule Contribution

When a rule fires against a component, artifact, or dependency:

```
points = weight (with sign: positive impact = +weight, negative impact = +weight)
```

For **complexity**: negative-impact rules add to raw score; positive-impact rules subtract.
For **confidence** and **readiness**: positive-impact rules add to raw score; negative-impact rules subtract.

### Per-Domain Raw Score

```
domain_raw[domain][measure] = sum of all fired rule points in that domain/measure
```

### Per-Domain Normalization

**Complexity (Saturating / Hyperbolic Normalization)**:
```
if raw > 0:
    normalized = 100 * raw / (raw + K)    where K is configurable (default K = 20)
if raw <= 0:
    normalized = 0.0
```

`K = 20` ensures smooth, asymptotically bounded scaling without arbitrary cutoffs or exponential distortion.

**Confidence & Readiness (Zero Baseline, Non-Inflated)**:
```
normalized = clamp(baseline + raw, 0, 100)    where baseline = 0 (ruleset v2)
```

In ruleset v2, the neutral baseline of 50 has been removed. Rule points are rescaled so that a fully evidenced, well-documented application can reach ~100 per domain, and an unevidenced domain scores 0.

### Overall Aggregation

- **Complexity (Evidenced Domains Only)**:
  Renormalized dynamically over evidenced domains only:
  ```
  overall_complexity = sum(domain_norm[d] * weight[d] for d in evidenced) / sum(weight[d] for d in evidenced)
  ```
  Output includes `domains_assessed` (N of 8), `coverage_ratio`, and `unassessed_domains`.

- **Confidence and Readiness (All 8 Domains)**:
  Aggregates over **ALL 8 domains** using domain weights. Unevidenced domains contribute 0 (not excluded, not 50):
  ```
  overall_score = sum(domain_norm[d] * weight[d] for d in all_8_domains)
  ```

- **Confidence Coverage Cap**:
  Confidence is capped by evidence coverage to prevent false certainty:
  ```
  overall_confidence = min(overall_confidence, coverage_cap * coverage_ratio)
  ```
  (where `coverage_cap = 100.0`).

### Target-Neutral Modernization Considerations

Recommendations are framed target-neutrally as **"Hypothesis for further evaluation"** listing options without premature commitment:
1. Decompose into distributed microservices
2. Refactor in place within modern language runtime
3. Retain on mainframe with API wrapper
4. Containerized platform such as OpenShift as ONE possible target

### Classification Thresholds

Default thresholds (configurable in the ruleset):

| Measure | Low | Medium | High |
|---------|-----|--------|------|
| Complexity | < 35 | 35-64 | >= 65 |
| Confidence | < 40 | 40-69 | >= 70 |
| Readiness | < 40 (Not Ready) | 40-69 (Partially Ready) | >= 70 (Ready for Detailed Planning) |

## Worked Example

Consider an application with one COBOL program containing a GOTO statement and a dynamic CALL, plus a parsed JCL file, but no DDL and no security artifacts.

### Step 1: Rules fire

| Rule | Domain | Measure | Weight | Impact | Evidence |
|------|--------|---------|--------|--------|----------|
| CX-AB-002 | app_business_logic | complexity | 10 | negative | GOTO at line 42 |
| CX-AB-005 | app_business_logic | complexity | 10 | negative | Dynamic CALL at line 78 |
| CX-AB-006 | app_business_logic | complexity | 3 | negative | Static CALL at line 15 |
| CF-AB-001 | app_business_logic | confidence | 3 | positive | Evidence-based PROGRAM |
| CF-AB-003 | app_business_logic | confidence | 2 | positive | COBOL parsed |
| CF-JB-001 | jobs_batch | confidence | 3 | positive | JCL parsed |
| CF-SC-001 | security | confidence | -8 | negative | No security evidence |
| CF-ON-001 | operational | confidence | -6 | negative | Unsupported artifact |
| RD-AB-001 | app_business_logic | readiness | 5 | positive | Owner documented |
| RD-JB-001 | jobs_batch | readiness | 5 | positive | JCL available |
| RD-SC-001 | security | readiness | -6 | negative | No security docs |

### Step 2: Domain raw scores

- `application_business_logic / complexity`: 10 + 10 + 3 = 23 (all negative)
- `application_business_logic / confidence`: 3 + 2 = 5 (positive)
- `jobs_batch / confidence`: 3 (positive)
- `security / confidence`: -8 (negative)
- `operational / confidence`: -6 (negative)
- `application_business_logic / readiness`: 5 (positive)
- `jobs_batch / readiness`: 5 (positive)
- `security / readiness`: -6 (negative)

### Step 3: Domain normalized scores

- `app_business_logic / complexity`: 100 * (23 / (23 + 20)) = 53.5
- `app_business_logic / confidence`: 50 + 5 = 55
- `jobs_batch / confidence`: 50 + 3 = 53
- `security / confidence`: 50 + (-8) = 42
- `operational / confidence`: 50 + (-6) = 44
- `app_business_logic / readiness`: 50 + 5 = 55
- `jobs_batch / readiness`: 50 + 5 = 55
- `security / readiness`: 50 + (-6) = 44

### Step 4: Overall aggregation (complexity)

Only `application_business_logic` has complexity evidence.
Renormalized weight: 1.0 (only contributing domain).
Overall complexity: 53.5 → **Medium**

### Step 5: Overall aggregation (confidence)

Contributing domains: app_business_logic (0.18), jobs_batch (0.12), security (0.08), operational (0.08).
Total weight: 0.46. Renormalized.

Overall confidence: (53.5 * 0.18 + 53 * 0.12 + 42 * 0.08 + 44 * 0.08) / 0.46
= (9.63 + 6.36 + 3.36 + 3.52) / 0.46
= 22.87 / 0.46
= 49.7 → **Low**

### Step 6: Overall aggregation (readiness)

Contributing domains: app_business_logic (0.18), jobs_batch (0.12), security (0.08).
Total weight: 0.38. Renormalized.

Overall readiness: (55 * 0.18 + 55 * 0.12 + 44 * 0.08) / 0.38
= (9.9 + 6.6 + 3.52) / 0.38
= 20.02 / 0.38
= 52.7 → **Partially Ready**

## Sensitivity Analysis

### What-if weight override

The `POST /api/applications/{id}/assess/what-if` endpoint accepts temporary weight overrides and returns before/after scores. The Rule Studio UI in Settings provides sliders for every rule weight.

Example: increasing `CX-AB-002` (GOTO) weight from 10 to 50 increases the raw complexity score, which increases the normalized complexity score. The relationship is monotonic but non-linear due to the sigmoid normalization.

### Key sensitivities

- **K parameter (complexity normalization)**: K=20 gives moderate sensitivity. Lower K (e.g., 10) makes small raw scores map to higher complexity; higher K (e.g., 40) dampens the effect.
- **Domain weights**: Changing domain weights shifts the influence of each domain on the overall score. The current weights prioritize application logic and online transactions (0.18 and 0.15) over security and operational (0.08 each).
- **Confidence/readiness baseline**: The 50-point baseline means a domain with no positive or negative evidence scores 50 (neutral). This is a design choice — it means "we have no reason to be confident or unconfident."

## Known Limits of the Calibration

1. **Weights are expert-set starting values**, owned and reviewed by the ruleset owner. They are **not** scientifically calibrated or derived from empirical migration data. They represent reasonable starting assumptions based on mainframe migration experience.

2. **The K=20 constant** for complexity normalization is a heuristic. There is no empirical basis for this specific value; it was chosen to produce a reasonable distribution for typical mainframe applications.

3. **The 50-point baseline** for confidence and readiness assumes neutral stance. Some organizations may prefer a lower baseline (e.g., 40) to reflect a more conservative default.

4. **Static extraction only.** The scoring engine evaluates rules against statically extracted components. Dynamic behavior, runtime configurations, and operational characteristics not visible in source code are not captured.

5. **No cross-application benchmarking.** Scores are relative within an application, not comparable across different applications with different artifact sets.

6. **Severity does not directly affect scores.** Severity is metadata for triage and reporting. The weight, not severity, determines the numeric contribution.

## Ruleset Governance

- **Owner**: ReFrameX Architecture Review Board
- **Version**: 2.0.0
- **Effective date**: 2026-11-21
- **Change log**: Maintained in the ruleset JSON file

To modify the ruleset, edit the JSON file at `backend/app/assessment/rulesets/default_ruleset_v2.json`. The schema at `backend/app/assessment/ruleset_schema.json` validates the structure at load time.

## Unsupported Technology and Upgrade Guidance (FAQ 8)

When a rule detects unsupported, end-of-life, or platform-specific technology:
- A specific recommendation is produced
- If an upgrade path is known, it is stated as `upgrade_guidance`
- If none is identified, the finding is flagged as a risk requiring specialist review
- **The tool does not select a final target platform.** Approved base images are preferred but not mandatory; the tool does not prescribe images.

Examples:
- **HLASM/assembler**: No automated conversion path. Flagged for specialist review.
- **IMS DL/I**: Hierarchical database with no direct relational equivalent. Flagged for specialist review.
- **CICS**: Mainframe-specific transaction monitor. Flagged for specialist review.
- **VSAM**: Mainframe-specific file organization. Flagged for specialist review.
- **COMP-3/packed-decimal**: EBCDIC-specific numeric format. Upgrade guidance provided.

## Model and Ruleset Versioning

Every assessment result stores:
- `model_version`: The scoring engine version (`reframex-scoring-v1`)
- `ruleset_id` and `ruleset_version`: The ruleset used for computation

This ensures reproducibility: the same artifacts + same ruleset version = same scores.
