# ReFrameX M2O Intelligence — LLM Evaluation Harness & Benchmark Specification

## Overview

The ReFrameX LLM Evaluation Harness is an automated benchmarking and quality framework designed to systematically evaluate LLM accuracy, safety, and consistency when reviewing mainframe modernization evidence.

All evaluation activities strictly maintain ReFrameX's core invariant:
> **Deterministic engine results remain the sole source of truth.** LLM outputs are treated strictly as advisory "AI-assisted (Inferred)" signals that must undergo human review before affecting migration planning.

---

## 1. Task Schemas & Protocol Specification

### Task T1: Finding Review (`FindingReviewOutput`)
Evaluates an individual deterministic rule firing against the raw extracted source snippet.

**Input Context**:
- `application_id`: UUID of the application.
- `rule_id`: Identifier of the evaluated rule (e.g. `CX-AB-001`, `RD-DS-001`).
- `finding_description`: The deterministic engine's reason for firing.
- `source_filename`: Program or JCL artifact name.
- `line_start` / `line_end`: Target line numbers of the finding.
- `code_snippet`: Sanitized ±20 lines around the target line.

**Output Schema**:
```json
{
  "agrees_with_rule": true,
  "ai_confidence": 0.95,
  "suggested_classification": "Inferred",
  "rationale": "Direct examination of lines 45-48 confirms dynamic CALL resolution via preceding literal MOVE.",
  "cited_lines": [45, 48]
}
```

**Validation Checks**:
- `cited_lines` must fall strictly within the snippet's line range (`[line_start - 20, line_end + 20]`).
- `suggested_classification` must be one of `Verified`, `Inferred`, `Assumed`, or `Unknown`.

---

### Task T2: Component Review (`ComponentReviewOutput`)
Evaluates extracted component boundaries, complexity attributes, and legacy constructs.

**Input Context**:
- `component_name`: Name of the program, paragraph, BMS map, or dataset.
- `component_type`: Inferred type (e.g., `PROGRAM`, `PARAGRAPH`, `TRANSACTION`).
- `technology`: Mainframe runtime (`COBOL`, `CICS`, `JCL`, `DB2`).
- `detected_properties`: Heuristic attributes (e.g. `has_goto`, `cics_commands`).
- `code_snippet`: Code surrounding the component definition.

**Output Schema**:
```json
{
  "verified_type": "PROGRAM",
  "complexity_assessment": "High",
  "suggested_classification": "Verified",
  "maintainability_concerns": [
    "Unstructured control flow via backward GO TO branches",
    "Tight coupling to CICS terminal maps"
  ],
  "rationale": "High branch cyclomatic complexity with legacy terminal I/O routines.",
  "cited_lines": [112, 118, 140]
}
```

---

### Task T3: Recommendation Critique (`RecommendationCritiqueOutput`)
Advisory critique of candidate modernization hypotheses (OpenShift containerization, refactoring in place, distributed microservices, or mainframe retention).

**Input Context**:
- `recommendation_title`: Modernization consideration title.
- `current_finding`: Root cause architecture finding.
- `candidate_options`: Modernization paths under consideration.

**Output Schema**:
```json
{
  "feasibility": "Medium",
  "risks": [
    "Stateful CICS COMMAREA dependencies complicate stateless container migration",
    "High sub-millisecond latency requirement with backend DB2"
  ],
  "alternatives": [
    "Modernize in place with z/OS Cloud Broker API wrapper first",
    "Extract business logic into Quarkus Java service with transactional gRPC"
  ],
  "prerequisites": [
    "Decouple screen-dependent logic from business calculations"
  ],
  "rationale": "Direct containerization is viable provided transaction state boundaries are externalized."
}
```

---

## 2. Evaluation Metrics

The evaluation harness computes five primary quantitative metrics:

1. **Validity Rate (%)**:
   $$\text{Validity} = \frac{\text{Syntactically valid JSON matching Pydantic schema}}{\text{Total runs}} \times 100$$
2. **Citation Accuracy Rate (%)**:
   $$\text{Citation Accuracy} = \frac{\text{Runs where all cited lines fall within snippet bounds}}{\text{Total valid runs}} \times 100$$
3. **Engine Agreement Rate (%)**:
   $$\text{Engine Agreement} = \frac{\text{Evaluations where agrees\_with\_rule is True}}{\text{Total valid runs}} \times 100$$
4. **Human Agreement Rate (%)**:
   $$\text{Human Agreement} = \frac{\text{Evaluations Accepted by Human Reviewer}}{\text{Evaluations Reviewed (Accepted + Dismissed)}} \times 100$$
5. **Consistency Score (0.0–1.0)**:
   Agreement percentage across repeated runs (e.g. temperature > 0 across 3 identical prompts).

---

## 3. Storage Schema & Review Lifecycle

All evaluations persist in SQLite table `llm_evaluations`:

```sql
CREATE TABLE llm_evaluations (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL,
    task_name VARCHAR(10) NOT NULL,          -- 'T1', 'T2', 'T3'
    target_id VARCHAR(100) NOT NULL,          -- finding_id, component_id, or rec_id
    target_type VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    raw_prompt TEXT NOT NULL,
    raw_response TEXT NOT NULL,
    structured_output JSON NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT 1,
    citation_valid BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL,
    review_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'dismissed'
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
);
```

### Review State Transitions:
```
           +-----------+
           |  Pending  |
           +-----+-----+
                 |
        +--------+--------+
        |                 |
        v                 v
  +-----------+     +-----------+
  | Accepted  |     | Dismissed |
  +-----------+     +-----------+
```
- **Accepted**: An enterprise architect confirms the AI second opinion.
- **Dismissed**: The recommendation is discarded with an optional human rationale note.

---

## 4. CLI Evaluation Harness

You can run offline or live batch evaluations from the command line:

```bash
# Run 3 passes on 5 findings for application APP-001 using default provider
python -m app.llm.evaluate_llm --app APP-001 --task T1 --limit 5 --runs 3

# Run component review (T2) using mock offline provider
python -m app.llm.evaluate_llm --app APP-001 --task T2 --provider mock

# Output JSON summary to file
python -m app.llm.evaluate_llm --app APP-001 --task T1 --output report.json
```
